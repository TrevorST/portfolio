import * as THREE from 'three';

/**
 * The hero's floor as a circuit board. Traces leave the computer along the
 * floor's grid lines, turn at right angles and run out to the horizon. Pulses
 * of light travel along them into the machine; a burst sends them back out.
 * A faint haze marks the horizon. It is all generated here from a fixed seed
 * and drawn by two small shaders, so it adds nothing to download.
 */

const SIGNAL = new THREE.Color('#C6FF1A');
/** The floor's grid pitch: traces snap to it. */
const PITCH = 0.25;
const TRACES = 46;
const REACH = 5.8;
const WIDTH = 0.012;

/** Small seeded generator, so the board is the same on every visit. */
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** One trace: grid points from beside the unit out past the fog. */
function route(center: THREE.Vector3, angle: number, rand: () => number): THREE.Vector2[] {
  const snap = (v: number) => Math.round(v / PITCH) * PITCH;
  let x = snap(center.x + Math.cos(angle) * 0.6);
  let z = snap(center.z + Math.sin(angle) * 0.6);
  const points = [new THREE.Vector2(x, z)];
  // head mostly along whichever axis the trace set off on, jogging sideways now and then
  const alongX = Math.abs(Math.cos(angle)) > Math.abs(Math.sin(angle));
  const dirMain = alongX ? Math.sign(Math.cos(angle)) : Math.sign(Math.sin(angle));
  const dirSide = (alongX ? Math.sign(Math.sin(angle)) : Math.sign(Math.cos(angle))) || 1;
  while (Math.hypot(x - center.x, z - center.z) < REACH) {
    const run = (2 + Math.floor(rand() * 6)) * PITCH * dirMain;
    if (alongX) x += run;
    else z += run;
    points.push(new THREE.Vector2(x, z));
    const jog = (1 + Math.floor(rand() * 3)) * PITCH * (rand() < 0.75 ? dirSide : -dirSide);
    if (alongX) z += jog;
    else x += jog;
    points.push(new THREE.Vector2(x, z));
  }
  return points;
}

function buildTraces(center: THREE.Vector3): THREE.BufferGeometry {
  const rand = mulberry32(0x7256_3031); // "rV01"
  const position: number[] = [];
  const along: number[] = [];
  const seed: number[] = [];
  const index: number[] = [];
  for (let t = 0; t < TRACES; t++) {
    // spread around the unit, leaving the front clear for the keyboard and the camera
    const angle = Math.PI * 0.72 + ((t + rand() * 0.8) / TRACES) * Math.PI * 1.56;
    const points = route(center, angle, rand);
    const phase = rand();
    let length = 0;
    for (let i = 0; i + 1 < points.length; i++) {
      const a = points[i]!;
      const b = points[i + 1]!;
      const dir = b.clone().sub(a);
      const len = dir.length();
      if (len === 0) continue;
      dir.divideScalar(len);
      const side = new THREE.Vector2(-dir.y, dir.x).multiplyScalar(WIDTH / 2);
      // extend each end by half a width so corners meet square
      const a0 = a.clone().addScaledVector(dir, -WIDTH / 2);
      const b0 = b.clone().addScaledVector(dir, WIDTH / 2);
      const base = position.length / 3;
      for (const [p, l] of [
        [a0.clone().add(side), length],
        [a0.clone().sub(side), length],
        [b0.clone().add(side), length + len],
        [b0.clone().sub(side), length + len],
      ] as const) {
        position.push(p.x, 0.0012, p.y);
        along.push(l);
        seed.push(phase);
      }
      index.push(base, base + 1, base + 2, base + 2, base + 1, base + 3);
      length += len;
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(position, 3));
  geo.setAttribute('aAlong', new THREE.Float32BufferAttribute(along, 1));
  geo.setAttribute('aSeed', new THREE.Float32BufferAttribute(seed, 1));
  geo.setIndex(index);
  return geo;
}

export class CircuitFloor {
  readonly group = new THREE.Group();
  private readonly traces: THREE.ShaderMaterial;
  private burstStart = -Infinity;

  constructor(center: THREE.Vector3) {
    this.traces = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      uniforms: {
        uCenter: { value: new THREE.Vector2(center.x, center.z) },
        uColor: { value: SIGNAL },
        uTime: { value: 0 },
        uPower: { value: 0 },
        uBurst: { value: -1 },
      },
      vertexShader: /* glsl */ `
        attribute float aAlong;
        attribute float aSeed;
        varying float vAlong;
        varying float vSeed;
        varying vec2 vWorld;
        void main() {
          vAlong = aAlong;
          vSeed = aSeed;
          vWorld = position.xz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec2 uCenter;
        uniform vec3 uColor;
        uniform float uTime;
        uniform float uPower;
        uniform float uBurst;
        varying float vAlong;
        varying float vSeed;
        varying vec2 vWorld;

        void main() {
          float d = distance(vWorld, uCenter);
          float far = 1.0 - smoothstep(2.6, 5.6, d);

          // pulses run inward, toward the machine; each trace has its own rhythm
          float speed = 0.22 + vSeed * 0.2;
          float p = fract(vAlong * 0.16 + uTime * speed + vSeed * 7.0);
          float pulse = smoothstep(0.86, 1.0, p) + 0.35 * smoothstep(0.55, 0.86, p) * step(p, 0.86);

          // the burst: a ring racing outward that lights every trace it crosses
          float ring = uBurst < 0.0 ? 0.0 : exp(-pow((d - uBurst) / 0.3, 2.0)) * (1.0 - uBurst / 6.0);

          float level = 0.07 + pulse * (0.55 + 0.45 * uPower) + max(ring, 0.0) * 1.2;
          float a = level * far;
          gl_FragColor = vec4(uColor * a, a);
        }
      `,
    });
    const lines = new THREE.Mesh(buildTraces(center), this.traces);
    lines.renderOrder = 1;
    lines.frustumCulled = false;

    // the horizon: a low band of haze where the floor runs out
    const haze = new THREE.Mesh(
      new THREE.CylinderGeometry(6.2, 6.2, 0.9, 64, 1, true),
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.BackSide,
        uniforms: { uColor: { value: SIGNAL } },
        vertexShader: /* glsl */ `
          varying float vUp;
          void main() {
            vUp = uv.y;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: /* glsl */ `
          uniform vec3 uColor;
          varying float vUp;
          void main() {
            float a = pow(1.0 - vUp, 3.0) * 0.16;
            gl_FragColor = vec4(uColor * a, a);
          }
        `,
      }),
    );
    haze.position.set(center.x, 0.45, center.z);
    this.group.add(lines, haze);
  }

  /** Call every rendered frame while the floor is in view. */
  update(now: number): void {
    this.traces.uniforms.uTime!.value = now / 1000;
    const t = (now - this.burstStart) / 1000;
    this.traces.uniforms.uBurst!.value = t >= 0 && t < 2.8 ? t * 2.2 : -1;
  }

  setPower(p: number): void {
    this.traces.uniforms.uPower!.value = p;
  }

  /** Send a ring of light out along every trace. */
  burst(now: number): void {
    this.burstStart = now;
  }
}
