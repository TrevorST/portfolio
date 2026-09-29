import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import type { Computer } from './computer';
import { crtMaterial } from './crt-material';
import { loadComputer } from './model';
import { TRV01, UNIT_CENTER } from './trv01';

const SCREEN = TRV01.screen;

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

function gridTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  g.fillStyle = '#07080A';
  g.fillRect(0, 0, 128, 128);
  g.strokeStyle = '#262A2F';
  g.lineWidth = 2;
  g.strokeRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(48, 48); // 25 cm cells
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

function shadowTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(64, 64, 4, 64, 64, 64);
  grad.addColorStop(0, 'rgba(0,0,0,0.85)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

export class HeroScene {
  readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(34, 1, 0.01, 20);
  private readonly screenTexture: THREE.CanvasTexture;
  private readonly crt: THREE.ShaderMaterial;
  private readonly computer: Computer;
  private readonly glow: THREE.PointLight;
  private readonly startedAt = performance.now();

  private progress = 0;
  private power = 0;
  private pointer = new THREE.Vector2();
  private dirty = true;
  private visible = true;
  private raf = 0;
  private holdPose: Pose = { pos: new THREE.Vector3(), target: SCREEN.center.clone() };

  private wide: Pose = { pos: new THREE.Vector3(), target: new THREE.Vector3() };
  private readonly exit: Pose = {
    pos: UNIT_CENTER.clone().add(new THREE.Vector3(-0.55, 0.65, 0.95)),
    target: UNIT_CENTER.clone().add(new THREE.Vector3(0, -0.05, 0)),
  };

  static async create(
    canvas: HTMLCanvasElement,
    screenCanvas: HTMLCanvasElement,
    opts: { version: string; hasModel: boolean },
  ): Promise<HeroScene> {
    const texture = new THREE.CanvasTexture(screenCanvas);
    texture.anisotropy = 8;
    const crt = crtMaterial(texture);
    const computer = await loadComputer(opts.hasModel, crt, opts.version);
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
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(VOID);

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.35;
    pmrem.dispose();
    this.scene.background = VOID;
    this.scene.fog = new THREE.Fog(VOID, 1.8, 5.5);

    this.scene.add(this.computer.group);

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(12, 12),
      new THREE.MeshStandardMaterial({ map: gridTexture(), roughness: 0.95 }),
    );
    floor.rotation.x = -Math.PI / 2;
    const shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(1.1, 1.1),
      new THREE.MeshBasicMaterial({ map: shadowTexture(), transparent: true, depthWrite: false }),
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.set(UNIT_CENTER.x, 0.001, UNIT_CENTER.z + 0.05);
    this.scene.add(floor, shadow);

    const key = new THREE.DirectionalLight('#ffffff', 1.3);
    key.position.set(3, 5, 4);
    const rim = new THREE.DirectionalLight('#dfe8ff', 0.7);
    rim.position.set(-4, 3, -3);
    this.glow = new THREE.PointLight('#C6FF1A', 0, 1.2, 1.5);
    this.glow.position.copy(SCREEN.center).add(new THREE.Vector3(0, -0.03, 0.3));
    this.scene.add(key, rim, this.glow);

    this.resize(canvas.clientWidth, canvas.clientHeight);
  }

  resize(width: number, height: number): void {
    if (!width || !height) return;
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    // stand back far enough that the screen fills ~86% of the smaller axis
    const tan = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
    const fill = 0.86;
    const d = Math.max(
      SCREEN.height / (fill * 2 * tan),
      SCREEN.width / (fill * 2 * tan * this.camera.aspect),
    );
    // wide shot: unit to the right of the headline on landscape, below it on portrait
    const portrait = this.camera.aspect < 1;
    this.wide = portrait
      ? {
          pos: UNIT_CENTER.clone().add(new THREE.Vector3(0.42, 0.66, 2.45)),
          target: UNIT_CENTER.clone().add(new THREE.Vector3(0, 0.3, 0)),
        }
      : {
          pos: UNIT_CENTER.clone().add(new THREE.Vector3(0.8, 0.42, 1.7)),
          target: UNIT_CENTER.clone().add(new THREE.Vector3(-0.22, 0.03, 0)),
        };
    this.holdPose = {
      pos: new THREE.Vector3(SCREEN.center.x, SCREEN.center.y, SCREEN.center.z + d),
      target: SCREEN.center.clone(),
    };
    this.dirty = true;
  }

  setProgress(p: number): void {
    if (p === this.progress) return;
    this.progress = p;
    this.dirty = true;
  }

  setPower(p: number): void {
    this.power = p;
    this.crt.uniforms.uPower!.value = p;
    for (const mat of this.computer.glowMaterials) {
      mat.emissiveIntensity = (mat.userData.baseEmissive ?? 0) + p * 2;
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
    const hw = SCREEN.width / 2;
    const hh = SCREEN.height / 2;
    const z = SCREEN.center.z;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const [dx, dy] of [
      [-hw, -hh],
      [hw, -hh],
      [-hw, hh],
      [hw, hh],
    ] as const) {
      const v = new THREE.Vector3(SCREEN.center.x + dx, SCREEN.center.y + dy, z).project(
        this.camera,
      );
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

  private updateCamera(): void {
    const { pos, target } = this.poseAt(this.progress);
    this.camera.position.copy(pos);
    this.camera.lookAt(target);
    this.camera.updateMatrixWorld();
  }

  private loop = (): void => {
    this.raf = requestAnimationFrame(this.loop);
    if (!this.visible) return;
    // the CRT flickers only while it is on and filling the view
    const live = this.power > 0 && this.progress > PHASE.zoomEnd * 0.6 && this.progress < 0.95;
    if (!this.dirty && !live) return;
    this.crt.uniforms.uTime!.value = (performance.now() - this.startedAt) / 1000;
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
