import * as THREE from 'three';

/**
 * TRV-01: the computer in the hero, from the orthographic reference sheet
 * Trevor models from in Blender. Every size, the camera path and the screen
 * overlay read from here, so a modelled .glb drops in without re-tuning.
 *
 * Blender: 1 unit = 1 mm, X = width, Y = depth (from the front), Z = up,
 * front-left-bottom corner at the origin; exported scaled by 0.001.
 * three.js (glTF): metres, Y up, the front faces +Z, so Blender (x, y, z)
 * becomes (x, z, -y) here. See doc/3D-MODEL.md.
 */

const mm = (v: number) => v / 1000;

/** Blender millimetres -> three.js metres. */
export function fromBlender(x: number, y: number, z: number): THREE.Vector3 {
  return new THREE.Vector3(mm(x), mm(z), -mm(y));
}

export const TRV01 = {
  /** Overall envelope: 480 W x 520 D x 462 H mm. */
  size: { width: mm(480), depth: mm(520), height: mm(462) },
  screen: {
    /** Flat, vertical, 16:10. */
    width: mm(336),
    height: mm(210),
    /** Centre: X 208, Y (depth) 220, Z 281 mm. */
    center: fromBlender(208, 220, 281),
    /** The mesh name in the .glb, and on the placeholder. */
    meshName: 'Screen',
  },
  /** Where the monitor housing starts (the screen plane) and the deck slope. */
  housingFrontDepth: mm(220),
  deck: { slopeDeg: 17.7, frontHeight: mm(45) },
  /** 40 x 40 mm chamfers on the top-right and top-rear edges. */
  chamfer: mm(40),
  /** Terminal texture: 16:10, like the reference's 1680 x 1050 emission map. */
  texture: { width: 1280, height: 800 },
  /** Optional modelled replacement for the placeholder. */
  modelUrl: '/models/trv01.glb',
} as const;

/** Centre of the whole unit, for framing the wide shots. */
export const UNIT_CENTER = fromBlender(240, 260, 200);
