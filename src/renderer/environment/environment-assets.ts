import {
  ClampToEdgeWrapping,
  CubeTextureLoader,
  NoColorSpace,
  RepeatWrapping,
  SRGBColorSpace,
  TextureLoader,
  type CubeTexture,
  type Texture,
} from 'three';

import { loadEnvironmentData } from './environment-worker-client';
import { PARAMETRIC_FAKE_GLOW_TEXTURE, PARAMETRIC_SLICE_TEXTURE } from './materials/light-environment-material';
import type { EnvironmentData } from './types';

export interface LoadedEnvironmentAssets {
  data: EnvironmentData;
  textures: ReadonlyMap<string, Texture>;
  reflectionProbe?: CubeTexture;
  dispose: () => void;
}

type EnvironmentDataLoader = (id: string, signal?: AbortSignal) => Promise<EnvironmentData>;

function materialTextureAssets(data: EnvironmentData) {
  return Object.values(data.materials).flatMap((material) =>
    Object.values(material.textures ?? {}).map((texture) => texture.asset),
  );
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
  function dispose() {
    for (const texture of textures.values()) texture.dispose();
    reflectionProbe?.dispose();
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
    signal?.throwIfAborted();
    return { data, textures, reflectionProbe, dispose };
  } catch (error) {
    dispose();
    throw error;
  }
}
