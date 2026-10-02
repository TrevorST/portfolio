import * as THREE from 'three';
import { Life } from '~/lib/life';

/**
 * Conway's Game of Life played on the hero's floor. Every 25 cm floor tile
 * holds 3 x 3 cells; live cells glow acid green, brightest near the computer and fading
 * into the dark. It reuses the site's Life class and draws with one small
 * shader over the floor, so it adds nothing to download.
 */

/** Cells per side. The floor is 12 m across with 48 grid lines: 3 x 3 cells per 25 cm tile. */
const CELLS = 144;
const SIZE = 12;
/** Milliseconds per generation: slow enough to read, cheap enough to ignore. */
const STEP_MS = 150;
const SIGNAL = new THREE.Color('#C6FF1A');

export class LifeFloor {
  readonly mesh: THREE.Mesh;
  private life = new Life(CELLS, CELLS).seed(0.18);
  /** Per-cell brightness, eased toward alive/dead so cells fade, not blink. */
  private glow = new Float32Array(CELLS * CELLS);
  private readonly pixels = new Uint8Array(CELLS * CELLS);
  private readonly texture: THREE.DataTexture;
  private readonly material: THREE.ShaderMaterial;
  private lastStep = 0;
  private pulseStart = -Infinity;

  constructor(center: THREE.Vector3, intensity = 1) {
    this.texture = new THREE.DataTexture(
      this.pixels,
      CELLS,
      CELLS,
      THREE.RedFormat,
      THREE.UnsignedByteType,
    );
    this.texture.magFilter = this.texture.minFilter = THREE.NearestFilter;
    this.material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        map: { value: this.texture },
        uCenter: { value: new THREE.Vector2(center.x, center.z) },
        uColor: { value: SIGNAL },
        uIntensity: { value: intensity },
        uPower: { value: 0 },
        uPulse: { value: -1 },
      },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        varying vec2 vWorld;
        void main() {
          vUv = uv;
          vec4 world = modelMatrix * vec4(position, 1.0);
          vWorld = world.xz;
          gl_Position = projectionMatrix * viewMatrix * world;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform sampler2D map;
        uniform vec2 uCenter;
        uniform vec3 uColor;
        uniform float uIntensity;
        uniform float uPower;
        uniform float uPulse;
        varying vec2 vUv;
        varying vec2 vWorld;

        void main() {
          vec2 cell = vUv * ${CELLS}.0;
          vec2 f = fract(cell);
          // a square tile set inside its grid lines
          float tile = step(0.14, f.x) * step(f.x, 0.86) * step(0.14, f.y) * step(f.y, 0.86);
          float alive = texture2D(map, (floor(cell) + 0.5) / ${CELLS}.0).r;

          float d = distance(vWorld, uCenter);
          // nothing under the unit; bright around it; gone before the fog ends
          float near = smoothstep(0.45, 0.75, d);
          float far = 1.0 - smoothstep(2.4, 5.6, d);
          float level = alive * (0.28 + 0.9 * exp(-d * 0.55)) * (0.7 + 0.3 * uPower);

          // the power-on wave: a ring that lights every tile it crosses
          float ring = uPulse < 0.0 ? 0.0 : exp(-pow((d - uPulse) / 0.22, 2.0)) * (1.0 - uPulse / 5.5);
          level += max(ring, 0.0) * (0.18 + 0.5 * alive);

          float a = level * tile * near * far * uIntensity;
          gl_FragColor = vec4(uColor * a, a);
        }
      `,
    });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(SIZE, SIZE), this.material);
    this.mesh.rotation.x = -Math.PI / 2;
    this.mesh.position.y = 0.0006; // just above the floor, below the shadow
    this.mesh.renderOrder = 1;
    // start part-way in, so the first frame isn't random noise
    for (let i = 0; i < 12; i++) this.life.step();
    this.glow.set(this.life.cells);
    this.upload();
  }

  /** Advance and fade. Call every rendered frame while the floor is in view. */
  update(now: number): void {
    if (now - this.lastStep >= STEP_MS) {
      this.lastStep = now;
      // a board that dies out gets fresh gliders, so it never goes dark
      if (this.life.step() < CELLS * CELLS * 0.05) {
        for (let i = 0; i < 40; i++) {
          this.life.glider(Math.floor(Math.random() * CELLS), Math.floor(Math.random() * CELLS));
        }
      }
    }
    const { cells } = this.life;
    for (let i = 0; i < this.glow.length; i++) {
      this.glow[i]! += ((cells[i] ?? 0) - this.glow[i]!) * 0.22;
    }
    this.upload();
    const t = (now - this.pulseStart) / 1000;
    this.material.uniforms.uPulse!.value = t >= 0 && t < 2.6 ? t * 2.2 : -1;
  }

  /** True while the wave is still travelling. */
  get pulsing(): boolean {
    return (this.material.uniforms.uPulse!.value as number) >= 0;
  }

  setPower(p: number): void {
    this.material.uniforms.uPower!.value = p;
  }

  /** Send a wave of light out from the computer. */
  pulse(now: number): void {
    this.pulseStart = now;
  }

  /** Reseed the whole floor densely (the hidden \`life\` command). */
  flood(): void {
    this.life.seed(0.34);
  }

  private upload(): void {
    for (let i = 0; i < this.glow.length; i++) this.pixels[i] = Math.round(this.glow[i]! * 255);
    this.texture.needsUpdate = true;
  }
}
