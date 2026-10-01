#!/usr/bin/env node
/**
 * Turns Trevor's Blender export into the site's hero model.
 *
 *   npm run model
 *   (src/assets/models/trv01-source.glb -> src/assets/models/trv01.glb)
 *
 * The export is in metres with the front facing +X, textured from one sheet.
 * This script:
 *   1. finds the visible screen by ray-casting through the bezel, and adds a
 *      clean `Screen` plane over it with 0..1 UVs (the site paints the
 *      terminal onto it),
 *   2. keeps Trevor's materials and texture; LEDs go dark until power-on, and
 *      the cords (not unwrapped yet) get plain rubber,
 *   3. rotates the front to +Z, scales the body to TRV-01 height (462 mm) and
 *      puts its front-left-bottom corner at the origin (cords don't count),
 *   4. shrinks it: unused vertex data dropped, meshes joined per material,
 *      the texture re-encoded as WebP, geometry Draco-compressed.
 * Rerun it whenever the Blender file changes.
 */
import { statSync } from 'node:fs';
import * as THREE from 'three';
import { NodeIO, getBounds } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, draco, join, prune, textureCompress, weld } from '@gltf-transform/functions';
import draco3d from 'draco3dgltf';
import sharp from 'sharp';

const [, , SRC = 'src/assets/models/trv01-source.glb', OUT = 'src/assets/models/trv01.glb'] =
  process.argv;

/** The glass in the export. Measured, then replaced by the flat Screen plane. */
const SCREEN_SOURCE = 'screen.001';
/** Loose parts that shouldn't count toward the unit's size or the camera framing. */
const LOOSE = /^cord/i;
/**
 * Materials that use the sheet in Blender through nodes the glTF exporter
 * can't follow (front-plate mixes it with a colour attribute), so they export
 * untextured and plain white. They get the sheet back here.
 */
const USES_SHEET = ['front-plate'];
/** The cords aren't unwrapped onto the sheet yet, so they get plain rubber. */
const CORD = { hex: '#0c0d0f', rough: 0.8 };
const TARGET_HEIGHT = 0.462; // TRV-01: 462 mm
const TEXTURE_MAX = 1024;

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  'draco3d.decoder': await draco3d.createDecoderModule(),
  'draco3d.encoder': await draco3d.createEncoderModule(),
});
const doc = await io.read(SRC);
const root = doc.getRoot();
const scene = root.listScenes()[0];

// ---- 1. find the visible screen with three.js ray casting ----
function measureScreen() {
  const world = new THREE.Group();
  let screen;
  for (const node of root.listNodes()) {
    for (const prim of node.getMesh()?.listPrimitives() ?? []) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute(
        'position',
        new THREE.BufferAttribute(prim.getAttribute('POSITION').getArray(), 3),
      );
      const indices = prim.getIndices();
      if (indices) geo.setIndex(new THREE.BufferAttribute(indices.getArray(), 1));
      const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
      mesh.applyMatrix4(new THREE.Matrix4().fromArray(node.getWorldMatrix()));
      world.add(mesh);
      if (node.getName() === SCREEN_SOURCE) screen = mesh;
    }
  }
  if (!screen) throw new Error(`no ${SCREEN_SOURCE} in ${SRC}`);
  world.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(screen);
  // the front faces +X: cast from in front, find the rectangle of rays that hit
  // the screen itself rather than the bezel
  const rc = new THREE.Raycaster();
  const hitAt = (y, z) => {
    rc.set(new THREE.Vector3(box.max.x + 2, y, z), new THREE.Vector3(-1, 0, 0));
    const h = rc.intersectObject(world, true)[0];
    return h && h.object === screen ? h.point : null;
  };
  let minY = Infinity,
    maxY = -Infinity,
    minZ = Infinity,
    maxZ = -Infinity;
  const step = 0.002;
  for (let y = box.min.y; y <= box.max.y; y += step)
    for (let z = box.min.z; z <= box.max.z; z += step)
      if (hitAt(y, z)) {
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
        minZ = Math.min(minZ, z);
        maxZ = Math.max(maxZ, z);
      }
  // The glass can be tilted and its corners rounded, so fit its plane from
  // rays set well inside the corners, then put the rectangle's corners on it.
  const iy = (maxY - minY) * 0.1;
  const iz = (maxZ - minZ) * 0.1;
  const probe = (y, z) => {
    const p = hitAt(y, z);
    if (!p) throw new Error(`probe ray missed the screen at y=${y} z=${z}`);
    return p;
  };
  const a = probe(minY + iy, maxZ - iz);
  const b = probe(minY + iy, minZ + iz);
  const c = probe(maxY - iy, maxZ - iz);
  const plane = new THREE.Plane().setFromCoplanarPoints(a, b, c);
  const onPlane = (y, z) => {
    const ray = new THREE.Ray(new THREE.Vector3(box.max.x + 2, y, z), new THREE.Vector3(-1, 0, 0));
    const p = ray.intersectPlane(plane, new THREE.Vector3());
    if (!p) throw new Error('screen plane is parallel to the view');
    return p;
  };
  // viewer looks down -X with +Y up, so their left is +Z
  return {
    bl: onPlane(minY, maxZ),
    br: onPlane(minY, minZ),
    tr: onPlane(maxY, minZ),
    tl: onPlane(maxY, maxZ),
  };
}

const corners = measureScreen();
const width = corners.bl.distanceTo(corners.br);
const height = corners.bl.distanceTo(corners.tl);
const normal = new THREE.Vector3()
  .subVectors(corners.br, corners.bl)
  .cross(new THREE.Vector3().subVectors(corners.tl, corners.bl))
  .normalize();
console.log(
  `screen ${width.toFixed(3)} x ${height.toFixed(3)} (aspect ${(width / height).toFixed(3)}), normal ${normal.toArray().map((n) => n.toFixed(3))}`,
);

// ---- 2. materials ----
// drop the original glass: it is curved and would bulge in front of the Screen
for (const node of root.listNodes()) if (node.getName() === SCREEN_SOURCE) node.dispose();

const rubber = doc
  .createMaterial('trv01_cord')
  // glTF colour factors are linear; THREE.Color converts from sRGB hex
  .setBaseColorFactor([...new THREE.Color(CORD.hex).toArray(), 1])
  .setRoughnessFactor(CORD.rough)
  .setMetallicFactor(0);
for (const node of root.listNodes()) {
  if (!LOOSE.test(node.getName())) continue;
  for (const prim of node.getMesh()?.listPrimitives() ?? []) prim.setMaterial(rubber);
}
const sheet = root.listTextures()[0];
for (const mat of root.listMaterials()) {
  if (sheet && USES_SHEET.includes(mat.getName()) && !mat.getBaseColorTexture()) {
    mat.setBaseColorTexture(sheet);
  }
  // LEDs keep their glow colour but go dark when unlit
  if (mat.getEmissiveFactor().some((c) => c > 0)) mat.setBaseColorFactor([0.02, 0.02, 0.02, 1]);
}
for (const mesh of root.listMeshes()) {
  for (const prim of mesh.listPrimitives()) {
    // vertex colours are paint data the site doesn't use (three.js would tint with them)
    for (const semantic of prim.listSemantics()) {
      if (semantic.startsWith('COLOR_')) prim.setAttribute(semantic, null);
    }
    // UVs only matter where there is a texture to look up
    if (!prim.getMaterial()?.getBaseColorTexture()) prim.setAttribute('TEXCOORD_0', null);
  }
}

// ---- 3. the Screen plane, 1 mm in front of the glass, in source coordinates ----
const glass = doc
  .createMaterial('trv01_glass')
  .setBaseColorFactor([...new THREE.Color('#030403').toArray(), 1])
  .setRoughnessFactor(0.2)
  .setMetallicFactor(0);
const lift = normal.clone().multiplyScalar(0.001);
const pts = [corners.bl, corners.br, corners.tr, corners.tl].map((p) => p.clone().add(lift));
const buffer = root.listBuffers()[0];
const acc = (type, array) => doc.createAccessor().setType(type).setArray(array).setBuffer(buffer);
const screenPrim = doc
  .createPrimitive()
  .setAttribute('POSITION', acc('VEC3', new Float32Array(pts.flatMap((p) => p.toArray()))))
  .setAttribute(
    'NORMAL',
    acc('VEC3', new Float32Array([0, 1, 2, 3].flatMap(() => normal.toArray()))),
  )
  .setAttribute('TEXCOORD_0', acc('VEC2', new Float32Array([0, 0, 1, 0, 1, 1, 0, 1])))
  .setIndices(acc('SCALAR', new Uint16Array([0, 1, 2, 0, 2, 3])))
  .setMaterial(glass);
const screenNode = doc
  .createNode('Screen')
  .setMesh(doc.createMesh('Screen').addPrimitive(screenPrim));

// ---- 4. re-root: TRV01 > Body (the unit), Loose (cords), Screen ----
const unit = doc.createNode('TRV01');
const body = doc.createNode('Body');
const loose = doc.createNode('Loose');
for (const node of scene.listChildren()) {
  scene.removeChild(node);
  (LOOSE.test(node.getName()) ? loose : body).addChild(node);
}
unit.addChild(body).addChild(loose).addChild(screenNode);
scene.addChild(unit);
// front to +Z, the body scaled to TRV-01 height, its front-left-bottom at the origin
unit.setRotation([0, -Math.SQRT1_2, 0, Math.SQRT1_2]); // -90 deg about Y: +X -> +Z
let b = getBounds(body);
const scale = TARGET_HEIGHT / (b.max[1] - b.min[1]);
unit.setScale([scale, scale, scale]);
b = getBounds(body);
unit.setTranslation([-b.min[0], -b.min[1], -b.max[2]]);
b = getBounds(body);
console.log(
  `unit ${b.max[0].toFixed(3)} W x ${b.max[1].toFixed(3)} H x ${(-b.min[2]).toFixed(3)} D m`,
);

// ---- 5. shrink ----
await doc.transform(
  dedup(),
  // one mesh per material within Body and within Loose: fewer draw calls
  join(),
  // keepAttributes: the Screen UVs look unused (its stand-in material has no
  // texture) but the site paints the terminal through them
  prune({ keepAttributes: true }),
  weld(),
  textureCompress({
    encoder: sharp,
    targetFormat: 'webp',
    lossless: true,
    resize: [TEXTURE_MAX, TEXTURE_MAX],
  }),
  draco(),
);
await io.write(OUT, doc);
const kb = (f) => `${(statSync(f).size / 1024).toFixed(0)} KB`;
console.log(`wrote ${OUT}: ${kb(SRC)} -> ${kb(OUT)}`);
