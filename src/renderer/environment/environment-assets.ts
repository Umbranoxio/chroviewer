import {
  ClampToEdgeWrapping,
  CubeTextureLoader,
  NoColorSpace,
  RepeatWrapping,
  SRGBColorSpace,
  TextureLoader,
  Vector3,
  Vector4,
  type CubeTexture,
  type Texture,
} from 'three';

import type { EnvironmentBakedReflectionProbe } from './environment-runtime';
import { loadEnvironmentData } from './environment-worker-client';
import { PARAMETRIC_FAKE_GLOW_TEXTURE, PARAMETRIC_SLICE_TEXTURE } from './materials/light-environment-material';
import type { EnvironmentData } from './types';

export interface LoadedEnvironmentAssets {
  data: EnvironmentData;
  textures: ReadonlyMap<string, Texture>;
  reflectionProbe?: CubeTexture;
  bakedReflectionProbe?: EnvironmentBakedReflectionProbe;
  dispose: () => void;
}

type EnvironmentDataLoader = (id: string, signal?: AbortSignal) => Promise<EnvironmentData>;

function materialTextureAssets(data: EnvironmentData) {
  return [
    ...Object.values(data.materials).flatMap((material) =>
      Object.values(material.textures ?? {}).map((texture) => texture.asset),
    ),
    ...(data.particleSystems ?? []).map((system) => system.texture),
  ];
}

function linearTextureAssets(data: EnvironmentData) {
  const linearAssets = new Set(
    Object.values(data.materials).flatMap((material) => {
      const textures = material.textures;
      if (textures === undefined) return [];
      const assets = [
        '_NormalTex',
        '_MaskTex',
        '_Mask2Tex',
        '_DisplacementTex',
        '_NoiseTex',
        '_DistortTex',
        '_MetalSmoothnessTex',
        '_DirtDetailTex',
        '_EmissionTex',
        '_EmissionMask',
        '_SecondaryEmissionMask',
        '_NormalTexture',
      ].flatMap((property) => textures[property]?.asset ?? []);
      const main = textures._MainTex;
      if (
        main !== undefined &&
        material.keywords.includes('_ALPHACHANNEL_RED') &&
        !material.keywords.includes('TEXTURE_COLOR')
      ) {
        assets.push(main.asset);
      }
      return assets;
    }),
  );
  for (const system of data.particleSystems ?? []) {
    if (system.alphaChannelRed) linearAssets.add(system.texture);
  }
  return linearAssets;
}

export async function loadEnvironmentAssets(
  id: string,
  signal?: AbortSignal,
  loadData: EnvironmentDataLoader = loadEnvironmentData,
): Promise<LoadedEnvironmentAssets> {
  const data = await loadData(id, signal);

  const assets = new Set(materialTextureAssets(data));
  const clampedAssets = new Set(
    Object.values(data.materials).flatMap((material) =>
      material.shader === 'ChroMapper/Parametric Slice Billboard'
        ? (material.textures?._MainTex?.asset ?? PARAMETRIC_SLICE_TEXTURE)
        : [],
    ),
  );
  for (const system of data.particleSystems ?? []) clampedAssets.add(system.texture);
  if (Object.values(data.materials).some((material) => material.shader === 'ChroMapper/Parametric Box Fake Glow')) {
    assets.add(PARAMETRIC_FAKE_GLOW_TEXTURE);
  }
  if (Object.values(data.materials).some((material) => material.shader === 'ChroMapper/Parametric Slice Billboard')) {
    assets.add(PARAMETRIC_SLICE_TEXTURE);
  }

  const linearAssets = linearTextureAssets(data);
  const textureLoader = new TextureLoader();
  const textures = new Map<string, Texture>();
  let reflectionProbe: CubeTexture | undefined;
  let bakedReflectionProbe: EnvironmentBakedReflectionProbe | undefined;
  function dispose() {
    for (const texture of textures.values()) texture.dispose();
    reflectionProbe?.dispose();
    for (const texture of bakedReflectionProbe?.textures ?? []) texture.dispose();
  }

  try {
    let textureFailure: { cause: unknown } | undefined;
    await Promise.all(
      [...assets].map(async (asset) => {
        try {
          const texture = await textureLoader.loadAsync(`${import.meta.env.BASE_URL}environments/${asset}`);
          texture.colorSpace = linearAssets.has(asset) ? NoColorSpace : SRGBColorSpace;
          texture.wrapS = clampedAssets.has(asset) ? ClampToEdgeWrapping : RepeatWrapping;
          texture.wrapT = clampedAssets.has(asset) ? ClampToEdgeWrapping : RepeatWrapping;
          textures.set(asset, texture);
        } catch (cause) {
          textureFailure ??= { cause };
        }
      }),
    );
    if (textureFailure !== undefined) throw textureFailure.cause;
    signal?.throwIfAborted();
    reflectionProbe =
      data.reflectionProbe === undefined
        ? undefined
        : await new CubeTextureLoader().loadAsync(
            data.reflectionProbe.map((asset) => `${import.meta.env.BASE_URL}environments/${asset}`),
          );
    if (reflectionProbe !== undefined) reflectionProbe.colorSpace = SRGBColorSpace;
    if (data.bakedReflectionProbe !== undefined) {
      const [first, second] = data.bakedReflectionProbe.textures;
      const textures: [CubeTexture, CubeTexture] = await Promise.all([
        new CubeTextureLoader().loadAsync(first.map((asset) => `${import.meta.env.BASE_URL}environments/${asset}`)),
        new CubeTextureLoader().loadAsync(second.map((asset) => `${import.meta.env.BASE_URL}environments/${asset}`)),
      ]);
      for (const texture of textures) texture.colorSpace = SRGBColorSpace;
      const position = new Vector3(...data.bakedReflectionProbe.position);
      const halfSize = new Vector3(...data.bakedReflectionProbe.size).multiplyScalar(0.5);
      bakedReflectionProbe = {
        textures,
        position,
        boxMin: position.clone().sub(halfSize),
        boxMax: position.clone().add(halfSize),
        lightColors: Array.from({ length: 6 }, () => new Vector4()),
        lights: data.bakedReflectionProbe.lights,
      };
    }
    signal?.throwIfAborted();
    return { data, textures, reflectionProbe, bakedReflectionProbe, dispose };
  } catch (error) {
    dispose();
    throw error;
  }
}
