import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import type { Computer } from './computer';
import { crtMaterial } from './crt-material';
import { LaserFloor } from './laser-floor';
import { loadComputer } from './model';
import { screenCorners, type ScreenSpec } from './screen-spec';

/**
 * The hero's three.js scene. It knows nothing about the page: the controller
 * feeds it scroll progress, power level and a screen canvas, and asks where
 * the screen landed so it can put the real <input> over it.
 */

/** Scroll phases, as fractions of the pinned section. */
export const PHASE = { zoomEnd: 0.3, holdEnd: 0.72 } as const;

const VOID = new THREE.Color('#07080A');
const smooth = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));

interface Pose {
  pos: THREE.Vector3;
  target: THREE.Vector3;
}

/**
 * The backdrop: a dome around the scene, void black overhead and far below,
 * with a band of dark green light along the horizon where the grid runs out.
 */
function backdrop(): THREE.Mesh {
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(15, 32, 16),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        uVoid: { value: VOID },
        uHorizon: { value: new THREE.Color('#2a3d0c') },
        uDeep: { value: new THREE.Color('#111d07') },
      },
      vertexShader: /* glsl */ `
        varying vec3 vDir;
        void main() {
          vDir = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uVoid;
        uniform vec3 uHorizon;
        uniform vec3 uDeep;
        varying vec3 vDir;
        void main() {
          float h = normalize(vDir).y;
          // a tight glow above the horizon, a longer fall-off into the depths below it
          float band = h > 0.0 ? exp(-h * 9.0) : exp(h * 2.4);
          vec3 base = h > 0.0 ? uVoid : mix(uVoid, uDeep, smoothstep(0.0, -0.6, h));
          gl_FragColor = vec4(mix(base, uHorizon, band * 0.85), 1.0);
        }
      `,
    }),
  );
  dome.renderOrder = -1;
  return dome;
}

function isSoftwareRenderer(renderer: THREE.WebGLRenderer): boolean {
  try {
    const gl = renderer.getContext();
    const info = gl.getExtension('WEBGL_debug_renderer_info');
    const name = info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : '';
    return /swiftshader|llvmpipe|software/i.test(name);
  } catch {
    return false;
  }
}

export class HeroScene {
  readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(34, 1, 0.01, 20);
  private readonly screenTexture: THREE.CanvasTexture;
  private readonly crt: THREE.ShaderMaterial;
  private readonly computer: Computer;
  private readonly glow: THREE.PointLight;
  private readonly laser: LaserFloor;
  private readonly startedAt = performance.now();

  private progress = 0;
  private power = 0;
  private pointer = new THREE.Vector2();
  private dirty = true;
  private visible = true;
  private raf = 0;
  private lastLive = 0;
  /** Minimum ms between frames when only the CRT flicker is animating. */
  private idleFrameMs = 1000 / 30;
  /** The screen and the unit's centre, measured from whichever model loaded. */
  private readonly spec: ScreenSpec;
  private readonly unitCenter: THREE.Vector3;
  private holdPose: Pose = { pos: new THREE.Vector3(), target: new THREE.Vector3() };
  private wide: Pose = { pos: new THREE.Vector3(), target: new THREE.Vector3() };
  /** How far the wide shot slides the picture sideways (fraction of the width). */
  private wideShift = 0;
  private size = { width: 1, height: 1 };
  private readonly exit: Pose;

  static async create(
    canvas: HTMLCanvasElement,
    screenCanvas: HTMLCanvasElement,
    opts: { version: string; modelUrl: string | undefined },
  ): Promise<HeroScene> {
    const texture = new THREE.CanvasTexture(screenCanvas);
    texture.anisotropy = 8;
    const crt = crtMaterial(texture);
    const computer = await loadComputer(opts.modelUrl, crt, opts.version);
    return new HeroScene(canvas, texture, crt, computer);
  }

  private constructor(
    canvas: HTMLCanvasElement,
    screenTexture: THREE.CanvasTexture,
    crt: THREE.ShaderMaterial,
    computer: Computer,
  ) {
    this.screenTexture = screenTexture;
    this.crt = crt;
    this.computer = computer;
    this.spec = computer.spec;
    this.unitCenter = new THREE.Box3()
      .setFromObject(computer.frame ?? computer.group)
      .getCenter(new THREE.Vector3());
    this.exit = {
      pos: this.unitCenter.clone().add(new THREE.Vector3(-0.55, 0.65, 0.95)),
      target: this.unitCenter.clone().add(new THREE.Vector3(0, -0.05, 0)),
    };
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    // software WebGL (SwiftShader, llvmpipe) renders on the CPU: go easy on it
    if (isSoftwareRenderer(this.renderer)) {
      this.renderer.setPixelRatio(1);
      this.idleFrameMs = 1000 / 15;
    }
    this.renderer.setClearColor(VOID);

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.35;
    // materials that ask for it (the modelled unit's metal finish) reflect the room more strongly
    const env = this.scene.environment;
    this.computer.group.traverse((o) => {
      if (!(o instanceof THREE.Mesh)) return;
      for (const mat of [o.material].flat()) {
        const reflect = mat.userData.reflect as number | undefined;
        if (reflect && mat instanceof THREE.MeshStandardMaterial) {
          mat.envMap = env;
          mat.envMapIntensity = reflect;
        }
      }
    });
    pmrem.dispose();
    this.scene.background = VOID;
    this.scene.fog = new THREE.Fog(VOID, 1.8, 5.5);

    this.scene.add(this.computer.group);

    // no solid floor: the laser grid hangs in the void, over the backdrop's glow
    this.laser = new LaserFloor(this.unitCenter);
    this.scene.add(backdrop(), this.laser.mesh);

    const key = new THREE.DirectionalLight('#ffffff', 1.3);
    key.position.set(3, 5, 4);
    const rim = new THREE.DirectionalLight('#dfe8ff', 0.7);
    rim.position.set(-4, 3, -3);
    this.glow = new THREE.PointLight('#C6FF1A', 0, 1.2, 1.5);
    this.glow.position
      .copy(this.spec.center)
      .addScaledVector(this.spec.normal, 0.3)
      .addScaledVector(this.spec.up, -0.03);
    this.scene.add(key, rim, this.glow);

    this.resize(canvas.clientWidth, canvas.clientHeight);
  }

  resize(width: number, height: number): void {
    if (!width || !height) return;
    this.renderer.setSize(width, height, false);
    this.size = { width, height };
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    // stand back far enough that the screen fills ~86% of the smaller axis
    const tan = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
    const fill = 0.86;
    const d = Math.max(
      this.spec.height / (fill * 2 * tan),
      this.spec.width / (fill * 2 * tan * this.camera.aspect),
    );
    // wide shot: unit to the right of the headline on landscape, below it on portrait
    const portrait = this.camera.aspect < 1;
    this.wide = portrait
      ? {
          pos: this.unitCenter.clone().add(new THREE.Vector3(0.42, 0.66, 2.45)),
          target: this.unitCenter.clone().add(new THREE.Vector3(0, 0.3, 0)),
        }
      : {
          // wider windows get a closer camera, so the unit grows with the screen
          pos: this.unitCenter
            .clone()
            .add(new THREE.Vector3(0.8, 0.42, 1.7).multiplyScalar(this.wideScale())),
          target: this.unitCenter.clone().add(new THREE.Vector3(0, 0.02, 0)),
        };
    // landscape: the unit sits in the right third, clear of the headline
    this.wideShift = portrait
      ? 0
      : THREE.MathUtils.clamp(0.14 + (this.camera.aspect - 1) * 0.14, 0.12, 0.28);
    // square on to the screen, whichever way it faces (a tilted CRT included)
    this.holdPose = {
      pos: this.spec.center.clone().addScaledVector(this.spec.normal, d),
      target: this.spec.center.clone(),
    };
    this.dirty = true;
  }

  setProgress(p: number): void {
    if (p === this.progress) return;
    // pulling back from a powered-on screen sends a burst out across the grid,
    // timed for when the floor comes back into shot
    const burstAt = PHASE.holdEnd + 0.09;
    if (this.power > 0 && this.progress <= burstAt && p > burstAt) {
      this.laser.burst(performance.now());
    }
    this.progress = p;
    this.dirty = true;
  }

  setPower(p: number): void {
    this.power = p;
    this.crt.uniforms.uPower!.value = p;
    this.laser.setPower(p);
    for (const mat of this.computer.glowMaterials) {
      const off = (mat.userData.emissiveOff as number | undefined) ?? 0;
      const on = (mat.userData.emissiveOn as number | undefined) ?? 2;
      mat.emissiveIntensity = off + p * (on - off);
    }
    this.glow.intensity = p * 0.6;
    this.dirty = true;
  }

  setPointer(x: number, y: number): void {
    this.pointer.set(x, y);
    if (this.progress < PHASE.zoomEnd) this.dirty = true;
  }

  screenChanged(): void {
    this.screenTexture.needsUpdate = true;
    this.dirty = true;
  }

  setVisible(v: boolean): void {
    this.visible = v;
    if (v) this.loop();
    else cancelAnimationFrame(this.raf);
  }

  /** Where the screen is on the canvas, in CSS pixels. */
  screenRect(): { left: number; top: number; width: number; height: number } {
    this.updateCamera();
    const el = this.renderer.domElement;
    const w = el.clientWidth;
    const h = el.clientHeight;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const corner of screenCorners(this.spec)) {
      const v = corner.project(this.camera);
      const x = ((v.x + 1) / 2) * w;
      const y = ((1 - v.y) / 2) * h;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
    return { left: minX, top: minY, width: maxX - minX, height: maxY - minY };
  }

  private poseAt(p: number): Pose {
    const pos = new THREE.Vector3();
    const target = new THREE.Vector3();
    if (p <= PHASE.zoomEnd) {
      const t = smooth(p / PHASE.zoomEnd);
      pos.lerpVectors(this.wide.pos, this.holdPose.pos, t);
      target.lerpVectors(this.wide.target, this.holdPose.target, t);
      // a little parallax while you are still looking at the whole desk
      pos.x += this.pointer.x * 0.1 * (1 - t);
      pos.y += this.pointer.y * 0.06 * (1 - t);
    } else if (p <= PHASE.holdEnd) {
      pos.copy(this.holdPose.pos);
      target.copy(this.holdPose.target);
    } else {
      const t = smooth((p - PHASE.holdEnd) / (1 - PHASE.holdEnd));
      pos.lerpVectors(this.holdPose.pos, this.exit.pos, t);
      target.lerpVectors(this.holdPose.target, this.exit.target, t);
    }
    return { pos, target };
  }

  /** 1 at 4:3, closer (smaller) as the window widens. */
  private wideScale(): number {
    return THREE.MathUtils.clamp(1.45 / this.camera.aspect, 0.74, 1);
  }

  private updateCamera(): void {
    const { pos, target } = this.poseAt(this.progress);
    // the sideways slide eases out as the camera pushes in, so the hold is dead centre
    const shift = this.wideShift * (1 - smooth(this.progress / PHASE.zoomEnd));
    const { width, height } = this.size;
    if (shift > 0) this.camera.setViewOffset(width, height, -shift * width, 0, width, height);
    else if (this.camera.view?.enabled) this.camera.clearViewOffset();
    this.camera.position.copy(pos);
    this.camera.lookAt(target);
    this.camera.updateMatrixWorld();
  }

  private loop = (): void => {
    this.raf = requestAnimationFrame(this.loop);
    if (!this.visible) return;
    // the CRT flickers only while it is on and filling the view
    const live = this.power > 0 && this.progress > PHASE.zoomEnd * 0.6 && this.progress < 0.95;
    // the laser grid runs whenever the floor is in shot (not while the screen fills the view)
    const floorInView = this.progress < PHASE.zoomEnd || this.progress > PHASE.holdEnd;
    const now = performance.now();
    if (!this.dirty) {
      // nothing moved: only the flicker and the floor are animating, which don't need 60fps
      if (!live && !floorInView) return;
      if (now - this.lastLive < this.idleFrameMs) return;
      this.lastLive = now;
    }
    if (floorInView) this.laser.update(now);
    this.crt.uniforms.uTime!.value = (now - this.startedAt) / 1000;
    this.updateCamera();
    this.renderer.render(this.scene, this.camera);
    this.dirty = false;
  };

  renderOnce(): void {
    this.updateCamera();
    this.renderer.render(this.scene, this.camera);
  }

  dispose(): void {
    cancelAnimationFrame(this.raf);
    this.renderer.dispose();
  }
}
