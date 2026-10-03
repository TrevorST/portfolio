import * as THREE from 'three';

/**
 * The hero's floor grid, drawn in green laser light. Every 25 cm grid line
 * glows faintly; pulses of light run along some of them, each at its own
 * speed and direction. A burst sends a ring of light out across the grid.
 * One shader on one plane, so it adds nothing to download.
 */

const SIGNAL = new THREE.Color('#C6FF1A');
const SIZE = 12;
/** Grid pitch in metres. */
const PITCH = 0.25;

export class LaserFloor {
  readonly mesh: THREE.Mesh;
  private readonly material: THREE.ShaderMaterial;
  private burstStart = -Infinity;

  constructor(center: THREE.Vector3) {
    this.material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uCenter: { value: new THREE.Vector2(center.x, center.z) },
        uColor: { value: SIGNAL },
        uTime: { value: 0 },
        uPower: { value: 0 },
        uBurst: { value: -1 },
      },
      vertexShader: /* glsl */ `
        varying vec2 vWorld;
        void main() {
          vec4 world = modelMatrix * vec4(position, 1.0);
          vWorld = world.xz;
          gl_Position = projectionMatrix * viewMatrix * world;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec2 uCenter;
        uniform vec3 uColor;
        uniform float uTime;
        uniform float uPower;
        uniform float uBurst;
        varying vec2 vWorld;

        // arithmetic hash (no sin): cheap and stable on mobile GPUs
        float hash(float n) {
          n = fract(n * 0.1031);
          n *= n + 33.33;
          n *= n + n;
          return fract(n);
        }

        // One family of parallel lines. across: grid coordinate across the lines,
        // along: grid coordinate along them. Returns (beam, pulse).
        vec2 lines(float across, float along, float aa, float salt) {
          float id = floor(across + 0.5);
          float dist = abs(across - id);
          // a hard core and a soft glow, thinned out where lines crowd together far away
          float core = 1.0 - smoothstep(0.012, 0.012 + aa, dist);
          float glow = exp(-dist * dist * 900.0) * 0.35;
          float beam = (core + glow) * clamp(0.05 / aa, 0.0, 1.0);

          // about two thirds of the lines carry a pulse; each has its own speed and direction
          float h = hash(id + salt);
          float carries = step(0.35, h);
          float dir = hash(id + salt + 17.0) < 0.5 ? -1.0 : 1.0;
          float speed = 0.10 + hash(id + salt + 31.0) * 0.14;
          float p = fract(along * 0.085 * dir + uTime * speed + h * 9.0);
          float pulse = smoothstep(0.90, 1.0, p) + 0.3 * smoothstep(0.62, 0.90, p) * step(p, 0.90);
          return vec2(beam, beam * pulse * carries);
        }

        void main() {
          vec2 g = vWorld / ${PITCH.toFixed(2)};
          // derivatives first: they must be taken before any pixel is discarded
          vec2 aa = fwidth(g);
          float d = distance(vWorld, uCenter);
          float far = 1.0 - smoothstep(2.6, 5.8, d);
          // most of the plane is past the fade: skip the line maths there entirely
          if (far <= 0.0) discard;

          vec2 a = lines(g.y, g.x, aa.y, 0.0);
          vec2 b = lines(g.x, g.y, aa.x, 101.0);
          float beam = max(a.x, b.x);
          float pulse = a.y + b.y;
          // the burst: a ring racing outward that lights every line it crosses
          float ring = uBurst < 0.0 ? 0.0 : exp(-pow((d - uBurst) / 0.3, 2.0)) * (1.0 - uBurst / 6.0);

          float level = beam * (0.3 + max(ring, 0.0) * 1.1) + pulse * (0.75 + 0.35 * uPower);
          float alpha = level * far;
          gl_FragColor = vec4(uColor * alpha, alpha);
        }
      `,
    });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(SIZE, SIZE), this.material);
    this.mesh.rotation.x = -Math.PI / 2;
    this.mesh.position.y = 0.0006; // just above the floor, below the shadow
    this.mesh.renderOrder = 1;
  }

  /** Call every rendered frame while the floor is in view. */
  update(now: number): void {
    this.material.uniforms.uTime!.value = now / 1000;
    const t = (now - this.burstStart) / 1000;
    this.material.uniforms.uBurst!.value = t >= 0 && t < 2.8 ? t * 2.2 : -1;
  }

  setPower(p: number): void {
    this.material.uniforms.uPower!.value = p;
  }

  /** Send a ring of light out across the grid. */
  burst(now: number): void {
    this.burstStart = now;
  }
}
