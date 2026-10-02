import * as THREE from 'three';

/**
 * Where the screen is, measured from its mesh rather than trusted from a
 * spec sheet, so any model's screen (tilted, off-centre, any size) frames and
 * takes typing correctly. Vectors are in world space.
 */
export interface ScreenSpec {
  center: THREE.Vector3;
  /** Faces the viewer. */
  normal: THREE.Vector3;
  /** The viewer's right and up across the screen. */
  right: THREE.Vector3;
  up: THREE.Vector3;
  width: number;
  height: number;
}

export function measureScreen(mesh: THREE.Mesh): ScreenSpec {
  mesh.updateWorldMatrix(true, false);
  const pos = mesh.geometry.getAttribute('position');
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i < pos.count; i++) {
    pts.push(new THREE.Vector3().fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld));
  }
  const center = pts.reduce((a, p) => a.add(p), new THREE.Vector3()).divideScalar(pts.length);

  // facing direction: the mesh normals if present, else the first triangle
  const normal = new THREE.Vector3();
  const nAttr = mesh.geometry.getAttribute('normal');
  if (nAttr) {
    const nm = new THREE.Matrix3().getNormalMatrix(mesh.matrixWorld);
    for (let i = 0; i < nAttr.count; i++) {
      normal.add(new THREE.Vector3().fromBufferAttribute(nAttr, i).applyMatrix3(nm));
    }
  }
  if (normal.lengthSq() < 1e-8 && pts.length >= 3) {
    normal.subVectors(pts[1]!, pts[0]!).cross(new THREE.Vector3().subVectors(pts[2]!, pts[0]!));
  }
  normal.normalize();

  // "up" is world up laid onto the screen; "right" follows from it
  const up = new THREE.Vector3(0, 1, 0).addScaledVector(normal, -normal.y).normalize();
  const right = new THREE.Vector3().crossVectors(up, normal).normalize();

  let minU = Infinity,
    maxU = -Infinity,
    minV = Infinity,
    maxV = -Infinity;
  for (const p of pts) {
    const d = p.clone().sub(center);
    const u = d.dot(right);
    const v = d.dot(up);
    minU = Math.min(minU, u);
    maxU = Math.max(maxU, u);
    minV = Math.min(minV, v);
    maxV = Math.max(maxV, v);
  }
  // re-centre on the rectangle, not the vertex average
  center.addScaledVector(right, (minU + maxU) / 2).addScaledVector(up, (minV + maxV) / 2);
  return { center, normal, right, up, width: maxU - minU, height: maxV - minV };
}

/** The screen's four corners, for projecting the typing overlay. */
export function screenCorners(s: ScreenSpec): THREE.Vector3[] {
  const hw = s.width / 2;
  const hh = s.height / 2;
  return [
    [-hw, -hh],
    [hw, -hh],
    [hw, hh],
    [-hw, hh],
  ].map(([u, v]) => s.center.clone().addScaledVector(s.right, u!).addScaledVector(s.up, v!));
}
