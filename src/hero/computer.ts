import * as THREE from 'three';
import { ConvexGeometry } from 'three/addons/geometries/ConvexGeometry.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { measureScreen, type ScreenSpec } from './screen-spec';
import { TRV01 } from './trv01';

/**
 * The code-made TRV-01 placeholder: same envelope, chamfers, deck slope and
 * screen placement as the reference sheet, in the Signal palette (graphite
 * shell, one acid-green accent). A modelled .glb replaces it via
 * loadComputer() in model.ts; the rest of the scene doesn't know which it got.
 */

const SIGNAL = new THREE.Color('#C6FF1A');

export interface Computer {
  group: THREE.Object3D;
  /** What the camera frames, when that is less than the whole group (no trailing cords). */
  frame?: THREE.Object3D;
  screen: THREE.Mesh;
  /** The screen, measured from its mesh. */
  spec: ScreenSpec;
  /**
   * Materials that light up at power-on (LEDs, accent key). Each carries
   * userData.emissiveOff / emissiveOn intensities.
   */
  glowMaterials: THREE.MeshStandardMaterial[];
}

function labelTexture(text: string): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 64;
  const g = c.getContext('2d')!;
  g.fillStyle = '#101114';
  g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = '#C6FF1A';
  g.font = '600 30px ui-monospace, Menlo, monospace';
  g.textBaseline = 'middle';
  g.fillText(text, 16, 34);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** Monitor housing: a box behind the screen plane with the two 40 mm chamfers. */
function housingGeometry(): THREE.BufferGeometry {
  const W = TRV01.size.width;
  const H = TRV01.size.height;
  const zf = -TRV01.housingFrontDepth;
  const zb = -TRV01.size.depth;
  const c = TRV01.chamfer;
  const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
  return new ConvexGeometry([
    v(0, 0, zf),
    v(W, 0, zf),
    v(0, 0, zb),
    v(W, 0, zb),
    v(0, H, zf),
    v(W - c, H, zf), // top-right chamfer, front
    v(W, H - c, zf),
    v(0, H, zb + c), // top-rear chamfer, left
    v(0, H - c, zb),
    v(W - c, H, zb + c), // where the two chamfers meet
    v(W, H - c, zb),
  ]);
}

/** Keyboard deck in front of the housing, its top sloped at 17.7 degrees. */
function deckGeometry(): THREE.BufferGeometry {
  const W = TRV01.size.width;
  const d = TRV01.housingFrontDepth;
  const hf = TRV01.deck.frontHeight;
  const hb = hf + d * Math.tan(THREE.MathUtils.degToRad(TRV01.deck.slopeDeg));
  const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
  return new ConvexGeometry([
    v(0, 0, 0),
    v(W, 0, 0),
    v(0, hf, 0),
    v(W, hf, 0),
    v(0, 0, -d),
    v(W, 0, -d),
    v(0, hb, -d),
    v(W, hb, -d),
  ]);
}

export function buildPlaceholder(version: string): Computer {
  const group = new THREE.Group();
  const shell = new THREE.MeshStandardMaterial({
    color: '#1b1d21',
    roughness: 0.55,
    metalness: 0.15,
    flatShading: true,
  });
  const trim = new THREE.MeshStandardMaterial({ color: '#0c0d0f', roughness: 0.85 });
  const keyMat = new THREE.MeshStandardMaterial({ color: '#15171a', roughness: 0.6 });

  const housing = new THREE.Mesh(housingGeometry(), shell);
  const deck = new THREE.Mesh(deckGeometry(), shell);

  const { screen: s } = TRV01;
  const zFace = -TRV01.housingFrontDepth;

  // bezel recess, then the screen: flat, vertical, on the housing face
  const recess = new THREE.Mesh(new THREE.PlaneGeometry(s.width + 0.024, s.height + 0.024), trim);
  recess.position.set(s.center.x, s.center.y, zFace + 0.0005);
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(s.width, s.height));
  screen.name = s.meshName;
  screen.position.set(s.center.x, s.center.y, zFace + 0.001);

  // label plate, power LED and a floppy slot on the housing face
  const below = s.center.y - s.height / 2 - 0.03;
  const label = new THREE.Mesh(
    new THREE.PlaneGeometry(0.15, 0.019),
    new THREE.MeshBasicMaterial({ map: labelTexture(`TRV-01 // SYS ${version}`) }),
  );
  label.position.set(s.center.x - s.width / 2 + 0.075, below, zFace + 0.001);
  const led = new THREE.MeshStandardMaterial({
    color: '#0b1402',
    emissive: SIGNAL,
    emissiveIntensity: 0,
  });
  led.userData.emissiveOff = 0;
  led.userData.emissiveOn = 2.2;
  const ledMesh = new THREE.Mesh(new THREE.CircleGeometry(0.005, 16), led);
  ledMesh.position.set(0.43, below, zFace + 0.001);
  const slot = new THREE.Mesh(new THREE.PlaneGeometry(0.008, 0.09), trim);
  slot.position.set(0.43, s.center.y + 0.02, zFace + 0.001);

  // keys on the sloped deck, one signal-green Enter
  const keys = new THREE.Group();
  keys.position.set(0, TRV01.deck.frontHeight, 0);
  keys.rotation.x = THREE.MathUtils.degToRad(TRV01.deck.slopeDeg);
  const cols = 12;
  const rows = 4;
  const pitch = 0.031;
  const keyGeo = new RoundedBoxGeometry(0.026, 0.01, 0.026, 1, 0.004);
  const grid = new THREE.InstancedMesh(keyGeo, keyMat, cols * rows);
  const m = new THREE.Matrix4();
  let i = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      m.makeTranslation(0.035 + c * pitch + (r % 2) * 0.008, 0.005, -0.045 - r * pitch);
      grid.setMatrixAt(i++, m);
    }
  }
  const accent = new THREE.MeshStandardMaterial({
    color: '#6f8f10',
    emissive: SIGNAL,
    emissiveIntensity: 0.15,
    roughness: 0.5,
  });
  accent.userData.emissiveOff = 0.15;
  accent.userData.emissiveOn = 1.05;
  const enter = new THREE.Mesh(new RoundedBoxGeometry(0.052, 0.01, 0.026, 1, 0.004), accent);
  enter.position.set(0.035 + cols * pitch + 0.02, 0.005, -0.045 - pitch);
  const space = new THREE.Mesh(new RoundedBoxGeometry(0.18, 0.01, 0.026, 1, 0.004), keyMat);
  space.position.set(0.2, 0.005, -0.045 - rows * pitch);
  keys.add(grid, enter, space);

  group.add(housing, deck, recess, screen, label, ledMesh, slot, keys);
  return { group, screen, spec: measureScreen(screen), glowMaterials: [led, accent] };
}
