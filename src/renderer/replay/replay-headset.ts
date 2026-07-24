import { Result } from 'better-result';
import { Group, Mesh, ShaderMaterial, type BufferGeometry, type Material, type Vector3 } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

import type { Rgb } from '../../core/colors';
import type { FogUniforms } from '../bloomfog/pipeline';
import { createEnvironmentLitMaterial } from '../materials/environment-surface-materials';

interface HeadsetSurface {
  color: Rgb;
  metallic: number;
  smoothness: number;
  specularIntensity: number;
  ambientMinimalValue?: number;
}

export interface ReplayDirectionalLights {
  directions: Vector3[];
  colors: Vector3[];
  positions: Vector3[];
  radii: number[];
}

const DEFAULT_HEADSET_SURFACE: HeadsetSurface = {
  color: [0.18, 0.22, 0.28],
  metallic: 0.05,
  smoothness: 0.55,
  specularIntensity: 0.2,
};

const HEADSET_SURFACES: Record<string, HeadsetSurface> = {
  Headset_M: DEFAULT_HEADSET_SURFACE,
  Foam: {
    color: [0.035, 0.04, 0.05],
    metallic: 0,
    smoothness: 0.12,
    specularIntensity: 0.05,
  },
  Gray_Plastic: {
    color: [0.12, 0.15, 0.2],
    metallic: 0.05,
    smoothness: 0.45,
    specularIntensity: 0.18,
  },
  Lens: {
    color: [0.025, 0.11, 0.16],
    metallic: 0.35,
    smoothness: 0.82,
    specularIntensity: 0.45,
  },
  L: {
    color: [0.06, 0.42, 0.58],
    metallic: 0.15,
    smoothness: 0.7,
    specularIntensity: 0.3,
  },
  Strap: {
    color: [0.06, 0.07, 0.09],
    metallic: 0,
    smoothness: 0.08,
    specularIntensity: 0.04,
  },
};

export const SABER_METAL_SURFACE: HeadsetSurface = {
  color: [0.05, 0.055, 0.065],
  metallic: 0.65,
  smoothness: 0.45,
  specularIntensity: 0.32,
  ambientMinimalValue: 0.01,
};

export const SABER_GRIP_SURFACE: HeadsetSurface = {
  color: [0.025, 0.03, 0.04],
  metallic: 0.05,
  smoothness: 0.2,
  specularIntensity: 0.12,
  ambientMinimalValue: 0.01,
};

export function createReplaySurfaceMaterial(
  fog: FogUniforms,
  directionalLights: ReplayDirectionalLights,
  surface: HeadsetSurface,
) {
  return createEnvironmentLitMaterial(
    fog,
    surface.color,
    {
      directions: { value: directionalLights.directions },
      colors: { value: directionalLights.colors },
      positions: { value: directionalLights.positions },
      radii: { value: directionalLights.radii },
    },
    {
      ambientMinimalValue: surface.ambientMinimalValue ?? 0.16,
      emissionFogSuppression: 0,
      nominalDiffuseLevel: [0.3, 0.3, 0.3],
      ambientMultiplier: 0.5,
      diffuseEnabled: true,
      bothSidesDiffuseMultiplier: 0.08,
      metallic: surface.metallic,
      specularEnabled: true,
      smoothness: surface.smoothness,
      specularIntensity: surface.specularIntensity,
      lightFalloffEnabled: false,
      privatePointLightEnabled: false,
      privatePointLightColor: [0, 0, 0],
      privatePointLightPosition: [0, 0, 0],
      privatePointLightLocal: false,
      privatePointLightIntensity: 0,
      groundFadeEnabled: false,
      groundFadeScale: 0,
      groundFadeOffset: 0,
      distanceDarkeningEnabled: false,
      darkeningScale: 0,
      darkeningIntensity: 0,
      darkeningCenter: [0, 0, 0],
      darkeningDirection: [0, 0, 1],
      vertexColorEnabled: false,
      vertexEmissionEnabled: false,
      vertexEmissionColor: [0, 0, 0],
      vertexEmissionColorAlpha: 0,
      vertexEmissionThreshold: 0,
      vertexEmissionStrength: 1,
      vertexEmissionBloomIntensity: 1,
      vertexEmissionMainEffect: false,
      displacementEnabled: false,
      displacementSpatial: false,
      displacementBidirectional: false,
      displacementStrength: 0,
      displacementAxisMultiplier: [0, 0, 0],
      meshPackingEnabled: false,
      meshPackingId: 0,
      albedoMultiplier: 1,
      metallicTextureEnabled: false,
      smoothnessTextureSource: 'none',
      occlusionEnabled: false,
      occlusionBeforeEmission: false,
      occlusionIntensity: 1,
      occlusionDetailEnabled: false,
      occlusionDetailOffset: [0, 0],
      occlusionDetailIntensity: 0,
      normalScale: 1,
      emissionColor: [0, 0, 0],
      emissionColorAlpha: 0,
      emissionBrightness: 0,
      emissionAlphaSource: 'textureAlpha',
      emissionWhiteBoost: false,
      emissionWhiteBoostMultiplier: 1,
      emissionMainEffect: false,
      emissionBloomIntensity: 1,
      toneMapBeforeEmission: false,
      emissionMaskSpeed: [0, 0, 0],
      secondaryEmissionMaskSpeed: [0, 0, 0],
      emissionMaskSecondaryUvs: false,
      secondaryEmissionMaskSecondaryUvs: false,
      primaryEmissionGain: 1,
      secondaryEmissionGain: 1,
      reflectionIntensity: 0,
      multiplyReflections: false,
      customTime: 'continuous',
      timeOffset: 0,
      fog: { startOffset: 100 },
    },
  );
}

export class ReplayHeadset {
  readonly root = new Group();

  private readonly geometries: BufferGeometry[] = [];
  private readonly materials: ShaderMaterial[] = [];
  private disposed = false;

  constructor(
    private readonly fog: FogUniforms,
    private readonly directionalLights: ReplayDirectionalLights,
    private readonly refreshMirrorMaterials: () => void,
  ) {}

  async load() {
    const result = await Result.tryPromise(() =>
      new GLTFLoader().loadAsync(`${import.meta.env.BASE_URL}models/vr-headset.glb`),
    );
    if (result.isErr()) {
      if (!this.disposed) console.error('replay headset failed to load', result.error);
      return;
    }

    const gltf = result.value;
    const geometries = new Set<BufferGeometry>();
    const sourceMaterials = new Set<Material>();
    const materials = new Map<string, ShaderMaterial>();
    const fog = this.fog;
    const directionalLights = this.directionalLights;
    function materialFor(source: Material) {
      sourceMaterials.add(source);
      const existing = materials.get(source.name);
      if (existing !== undefined) return existing;
      const surface = HEADSET_SURFACES[source.name] ?? DEFAULT_HEADSET_SURFACE;
      const material = createReplaySurfaceMaterial(fog, directionalLights, surface);
      material.name = source.name;
      materials.set(source.name, material);
      return material;
    }
    gltf.scene.traverse((object) => {
      if (!(object instanceof Mesh)) return;
      const mesh = object as Mesh;
      geometries.add(mesh.geometry);
      mesh.material = Array.isArray(mesh.material) ? mesh.material.map(materialFor) : materialFor(mesh.material);
    });
    for (const material of sourceMaterials) material.dispose();
    gltf.scene.name = 'ReplayHeadset';
    gltf.scene.rotation.y = Math.PI / 2;
    gltf.scene.scale.setScalar(0.22);
    if (this.disposed) {
      for (const geometry of geometries) geometry.dispose();
      for (const material of materials.values()) material.dispose();
      return;
    }
    this.root.add(gltf.scene);
    this.geometries.push(...geometries);
    this.materials.push(...materials.values());
    this.refreshMirrorMaterials();
  }

  dispose() {
    this.disposed = true;
    for (const geometry of this.geometries) geometry.dispose();
    for (const material of this.materials) material.dispose();
  }
}
