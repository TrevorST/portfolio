#!/usr/bin/env node
/**
 * Turns Trevor's Blender export into the site's hero model.
 *
 *   npm run model   (models-src/trv01-source.glb -> public/models/trv01.glb)
 *
 * The export holds several design iterations and default grey materials, in
 * metres with the front facing +X. This script:
 *   1. keeps one computer (KEEP),
 *   2. finds the visible screen by ray-casting through the bezel, and adds a
 *      clean `Screen` plane over it with 0..1 UVs (the site paints the
 *      terminal onto it),
 *   3. gives the parts the Signal palette (LED materials are kept),
 *   4. rotates the front to +Z, scales to TRV-01 height (462 mm) and puts the
 *      front-left-bottom corner at the origin,
 *   5. Draco-compresses the result.
 * Rerun it whenever the Blender file changes.
 */
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { NodeIO, getBounds } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { draco, prune, dedup, weld } from '@gltf-transform/functions';
import draco3d from 'draco3dgltf';

const [, , SRC = 'models-src/trv01-source.glb', OUT = 'public/models/trv01.glb'] = process.argv;

/** The computer with the power LEDs (the other two are earlier iterations). */
const KEEP = [
  'Cube.005',
  'Cube.006',
  'Cube.007',
  'Cube.008',
  'Circle.011',
  'Circle.013',
  'Circle.014',
  'Circle.015',
  'Circle.016',
  'Plane.008',
  'Plane.009',
  'Plane.010',
  'LED_power_on',
  'scanner.001',
  'scanner_screen.001',
  'screen.001',
];
const SCREEN_SOURCE = 'screen.001';
const TARGET_HEIGHT = 0.462; // TRV-01: 462 mm

/** Signal palette by part. Unlisted parts get the shell. */
const PALETTE = {
  shell: { hex: '#1b1d21', rough: 0.55, metal: 0.15 },
  panel: { hex: '#202328', rough: 0.6, metal: 0.1 },
  trim: { hex: '#0c0d0f', rough: 0.85, metal: 0.05 },
  keys: { hex: '#15171a', rough: 0.6, metal: 0.05 },
  metal: { hex: '#4a4e55', rough: 0.35, metal: 0.8 },
  glass: { hex: '#030403', rough: 0.2, metal: 0.0 },
};
const PART = {
  'Cube.005': 'shell',
  'Cube.006': 'panel',
  'Cube.007': 'trim',
  'Cube.008': 'shell',
  'Plane.008': 'keys',
  'Plane.009': 'trim',
  'Circle.011': 'trim',
  'Circle.013': 'trim',
  'Circle.014': 'metal',
  'Circle.015': 'metal',
  'Circle.016': 'metal',
  'scanner.001': 'trim',
  'scanner_screen.001': 'glass',
  'screen.001': 'glass',
};

// ---- 1. find the visible screen with three.js ray casting ----
async function measureScreen() {
  const buf = readFileSync(SRC);
  const gltf = await new GLTFLoader().parseAsync(
    buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
    '',
  );
  const scene = gltf.scene;
  scene.updateMatrixWorld(true);
  const screen = scene.getObjectByName(SCREEN_SOURCE.replace('.', ''));
  if (!screen) throw new Error(`no ${SCREEN_SOURCE} in ${SRC}`);
  const box = new THREE.Box3().setFromObject(screen);
  // the front faces +X: cast from in front, find the rectangle of rays that hit
  // the screen itself rather than the bezel
  const rc = new THREE.Raycaster();
  const hitAt = (y, z) => {
    rc.set(new THREE.Vector3(box.max.x + 2, y, z), new THREE.Vector3(-1, 0, 0));
    const h = rc.intersectObject(scene, true)[0];
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

const corners = await measureScreen();
const width = corners.bl.distanceTo(corners.br);
const height = corners.bl.distanceTo(corners.tl);
const normal = new THREE.Vector3()
  .subVectors(corners.br, corners.bl)
  .cross(new THREE.Vector3().subVectors(corners.tl, corners.bl))
  .normalize();
console.log(
  `screen ${width.toFixed(3)} x ${height.toFixed(3)} (aspect ${(width / height).toFixed(3)}), normal ${normal.toArray().map((n) => n.toFixed(3))}`,
);

// ---- 2. edit the file with glTF Transform ----
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  'draco3d.decoder': await draco3d.createDecoderModule(),
  'draco3d.encoder': await draco3d.createEncoderModule(),
});
const doc = await io.read(SRC);
const root = doc.getRoot();
const scene = root.listScenes()[0];

// keep one computer; drop its original glass, which is curved and would bulge
// in front of the flat Screen plane that replaces it
for (const node of root.listNodes()) {
  const keep = KEEP.includes(node.getName()) && node.getName() !== SCREEN_SOURCE;
  if (!keep && !node.getParentNode()) node.dispose();
}

// palette
const materials = {};
for (const [key, p] of Object.entries(PALETTE)) {
  materials[key] = doc
    .createMaterial(`trv01_${key}`)
    // glTF colour factors are linear; THREE.Color converts from sRGB hex
    .setBaseColorFactor([...new THREE.Color(p.hex).toArray(), 1])
    .setRoughnessFactor(p.rough)
    .setMetallicFactor(p.metal);
}
for (const node of root.listNodes()) {
  const mesh = node.getMesh();
  if (!mesh) continue;
  for (const prim of mesh.listPrimitives()) {
    const current = prim.getMaterial();
    if (current && current.getEmissiveFactor().some((c) => c > 0)) {
      // LEDs keep their glow colour but go dark when unlit
      current.setBaseColorFactor([0.02, 0.02, 0.02, 1]);
      continue;
    }
    prim.setMaterial(materials[PART[node.getName()] ?? 'shell']);
  }
}

// the Screen plane, 1 mm in front of the glass, in source coordinates
const lift = normal.clone().multiplyScalar(0.001);
const pts = [corners.bl, corners.br, corners.tr, corners.tl].map((p) => p.clone().add(lift));
const buffer = root.listBuffers()[0];
const acc = (type, array) => doc.createAccessor().setType(type).setArray(array).setBuffer(buffer);
const prim = doc
  .createPrimitive()
  .setAttribute('POSITION', acc('VEC3', new Float32Array(pts.flatMap((p) => p.toArray()))))
  .setAttribute(
    'NORMAL',
    acc('VEC3', new Float32Array([0, 1, 2, 3].flatMap(() => normal.toArray()))),
  )
  .setAttribute('TEXCOORD_0', acc('VEC2', new Float32Array([0, 0, 1, 0, 1, 1, 0, 1])))
  .setIndices(acc('SCALAR', new Uint16Array([0, 1, 2, 0, 2, 3])))
  .setMaterial(materials.glass);
const screenNode = doc.createNode('Screen').setMesh(doc.createMesh('Screen').addPrimitive(prim));

// re-root: front to +Z, scaled to TRV-01 height, front-left-bottom at the origin
const unit = doc.createNode('TRV01');
for (const node of scene.listChildren()) {
  scene.removeChild(node);
  unit.addChild(node);
}
unit.addChild(screenNode);
scene.addChild(unit);
unit.setRotation([0, -Math.SQRT1_2, 0, Math.SQRT1_2]); // -90 deg about Y: +X -> +Z
let b = getBounds(unit);
const scale = TARGET_HEIGHT / (b.max[1] - b.min[1]);
unit.setScale([scale, scale, scale]);
b = getBounds(unit);
unit.setTranslation([-b.min[0], -b.min[1], -b.max[2]]);
b = getBounds(unit);
console.log(
  `unit ${b.max[0].toFixed(3)} W x ${b.max[1].toFixed(3)} H x ${(-b.min[2]).toFixed(3)} D m`,
);

// keepAttributes: the Screen UVs look unused (its stand-in material has no
// texture) but the site paints the terminal through them
await doc.transform(dedup(), prune({ keepAttributes: true }), weld(), draco());
await io.write(OUT, doc);
console.log(`wrote ${OUT}`);
