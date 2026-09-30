import * as THREE from 'three';
import { buildPlaceholder, type Computer } from './computer';
import { TRV01 } from './trv01';

/**
 * Picks the computer: the modelled /models/trv01.glb when the build found one
 * (see Hero.astro), otherwise the code-made placeholder. Either way the
 * screen mesh gets the CRT material.
 */
export async function loadComputer(
  hasModel: boolean,
  screenMaterial: THREE.Material,
  version: string,
): Promise<Computer> {
  if (hasModel) {
    try {
      const computer = await loadGlb();
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

async function loadGlb(): Promise<Computer> {
  const [{ GLTFLoader }, { DRACOLoader }] = await Promise.all([
    import('three/addons/loaders/GLTFLoader.js'),
    import('three/addons/loaders/DRACOLoader.js'),
  ]);
  // three bundles and self-hosts the Draco decoder; it's fetched only for a Draco .glb
  const draco = new DRACOLoader();
  const gltf = await new GLTFLoader().setDRACOLoader(draco).loadAsync(TRV01.modelUrl);
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
      if (mat instanceof THREE.MeshStandardMaterial && mat.emissiveIntensity > 0) {
        mat.userData.baseEmissive = mat.emissiveIntensity;
        glowMaterials.push(mat);
      }
    }
  });
  return { group: gltf.scene, screen, glowMaterials };
}
