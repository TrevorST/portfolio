import * as THREE from 'three';
import { buildPlaceholder, type Computer } from './computer';
import { measureScreen } from './screen-spec';
import { TRV01 } from './trv01';

/**
 * Picks the computer: the modelled trv01.glb (src/assets/models, passed in by
 * the page as a hashed URL), or the code-made placeholder if it fails to load. Either way the
 * screen mesh gets the CRT material.
 */
export async function loadComputer(
  modelUrl: string | undefined,
  screenMaterial: THREE.Material,
  version: string,
): Promise<Computer> {
  if (modelUrl) {
    try {
      const computer = await loadGlb(modelUrl);
      computer.screen.material = screenMaterial;
      return computer;
    } catch (err) {
      console.warn('trv01.glb failed to load; using the placeholder.', err);
    }
  }
  const computer = buildPlaceholder(version);
  computer.screen.material = screenMaterial;
  return computer;
}

/**
 * A brushed-metal finish for the modelled unit: every part is at least this
 * metallic and at most this rough, and reflects the room this strongly
 * (the scene applies `reflect`). Numbers only, so it costs nothing to load.
 */
const FINISH = { metalness: 0.7, roughness: 0.38, reflect: 1.1 };

async function loadGlb(url: string): Promise<Computer> {
  const [{ GLTFLoader }, { DRACOLoader }] = await Promise.all([
    import('three/addons/loaders/GLTFLoader.js'),
    import('three/addons/loaders/DRACOLoader.js'),
  ]);
  // three bundles and self-hosts the Draco decoder; it's fetched only for a Draco .glb
  const draco = new DRACOLoader();
  const gltf = await new GLTFLoader().setDRACOLoader(draco).loadAsync(url);
  draco.dispose();

  const screen = gltf.scene.getObjectByName(TRV01.screen.meshName);
  if (!(screen instanceof THREE.Mesh)) {
    throw new Error(`trv01.glb has no mesh named "${TRV01.screen.meshName}"`);
  }
  // anything emissive in the model (LEDs, accent keys) brightens at power-on
  const glowMaterials: THREE.MeshStandardMaterial[] = [];
  gltf.scene.traverse((o) => {
    if (!(o instanceof THREE.Mesh) || o === screen) return;
    for (const mat of [o.material].flat()) {
      if (mat instanceof THREE.MeshStandardMaterial) {
        mat.metalness = Math.max(mat.metalness, FINISH.metalness);
        mat.roughness = Math.min(mat.roughness, FINISH.roughness);
        mat.userData.reflect = FINISH.reflect;
      }
      const lit = mat instanceof THREE.MeshStandardMaterial && mat.emissive.getHex() !== 0;
      if (lit && mat.emissiveIntensity > 0) {
        // LEDs are dark until the machine powers on, then glow as modelled
        // capped so strong Blender emission strengths keep their colour
        mat.userData.emissiveOn = Math.min(mat.emissiveIntensity, 2.5);
        mat.userData.emissiveOff = 0;
        mat.emissiveIntensity = 0;
        glowMaterials.push(mat);
      }
    }
  });
  const computer: Computer = {
    group: gltf.scene,
    screen,
    spec: measureScreen(screen),
    glowMaterials,
  };
  // the unit itself, without the cords that trail off behind it
  const body = gltf.scene.getObjectByName('Body');
  if (body) computer.frame = body;
  return computer;
}
