import { AddEquation, CustomBlending, MaxEquation, OneFactor, SrcAlphaFactor, ZeroFactor } from 'three';

import type { Rgb } from '../../../core/colors';
import {
  createFakeGlowMaterial,
  createOpaqueLightMaterial,
  createTransparentLightMaterial,
} from '../../materials/environment-effect-materials';
import type { EnvironmentMaterialData, EnvironmentTextureData } from '../types';
import { materialFog, type EnvironmentMaterialContext } from './material-context';

export const PARAMETRIC_FAKE_GLOW_TEXTURE = 'textures/rectangle-fake-glow.png';
export const PARAMETRIC_SLICE_TEXTURE = 'textures/game-e28988ba8e66079a.png';

function createFakeGlowEnvironmentMaterial(
  data: EnvironmentMaterialData,
  context: EnvironmentMaterialContext,
  color: Rgb,
) {
  let fallbackTexture: EnvironmentTextureData | undefined;
  if (data.shader === 'ChroMapper/Parametric Box Fake Glow') {
    fallbackTexture = { asset: PARAMETRIC_FAKE_GLOW_TEXTURE, scale: [1, 1], offset: [0, 0] };
  } else if (data.shader === 'ChroMapper/Parametric Slice Billboard') {
    fallbackTexture = { asset: PARAMETRIC_SLICE_TEXTURE, scale: [1, 1], offset: [0, 0] };
  }
  const mainTextureData = data.textures?._MainTex ?? fallbackTexture;
  const mainTexture = mainTextureData === undefined ? undefined : context.textures?.get(mainTextureData.asset);
  const worldNoiseScrolling = data.colors._WorldNoiseScrolling ?? [0, 0, 0, 1];
  const material = createFakeGlowMaterial(
    context.fog,
    color,
    data.floats._BloomWhiteMultiplier ?? 1,
    data.shader === 'ChroMapper/Parametric Box Fake Glow' || data.shader === 'ChroMapper/Parametric Slice Billboard'
      ? data.colors._SizeParams
      : undefined,
    mainTextureData === undefined || mainTexture === undefined
      ? undefined
      : {
          texture: mainTexture,
          scale: mainTextureData.scale,
          offset: mainTextureData.offset,
        },
    {
      parametricSlice: data.shader === 'ChroMapper/Parametric Slice Billboard',
      yAxisBillboard: (data.floats._EnableYAxisBillboard ?? 0) !== 0,
      alphaWidthScale: data.keywords.includes('ALPHA_WIDTH_SCALE'),
      capUvSize: data.floats._CapUVSize ?? 0.25,
      alphaWidth: data.colors._AlphaWidth ?? [1, 1, 1, 1],
      bloomType: data.floats._BloomType ?? 0,
      bloomMultiplier: data.floats._BloomMultiplier ?? 1,
      squareAlpha: (data.floats._SquareAlpha ?? 0) !== 0,
      useFogForLights: (data.floats._UseFogForLights ?? 0) !== 0,
      worldNoise: data.keywords.includes('ENABLE_WORLD_NOISE')
        ? {
            scale: data.floats._WorldNoiseScale ?? 1,
            intensityOffset: data.floats._WorldNoiseIntensityOffset ?? 0,
            intensityScale: data.floats._WorldNoiseIntensityScale ?? 1,
            scrolling: [worldNoiseScrolling[1], worldNoiseScrolling[2], worldNoiseScrolling[3]],
          }
        : undefined,
      worldSpaceFade: data.keywords.includes('ENABLE_WORLD_SPACE_FADE')
        ? {
            position: data.floats._WorldSpaceFadePos ?? 0,
            slope: data.floats._WorldSpaceFadeSlope ?? 1,
          }
        : undefined,
      fog: materialFog(data),
    },
  );
  material.transparent = true;
  material.blending = CustomBlending;
  material.blendEquation = data.floats._BlendOp === 4 ? MaxEquation : AddEquation;
  material.blendSrc = OneFactor;
  material.blendDst = OneFactor;
  material.blendEquationAlpha = data.floats._BlendOp === 4 ? MaxEquation : AddEquation;
  material.blendSrcAlpha =
    data.floats._BlendModeSrcA === 5 ? SrcAlphaFactor : data.floats._BlendModeSrcA === 1 ? OneFactor : ZeroFactor;
  material.blendDstAlpha = OneFactor;
  return material;
}

export function createLightEnvironmentMaterial(
  data: EnvironmentMaterialData,
  context: EnvironmentMaterialContext,
  color: Rgb,
) {
  if (data.family === 'fakeGlow') return createFakeGlowEnvironmentMaterial(data, context, color);
  const material =
    data.family === 'lightTubeOpaque'
      ? createOpaqueLightMaterial(context.fog, color, data.colors._AlphaWidth ?? [1, 1, 1, 1], materialFog(data, true))
      : createTransparentLightMaterial(
          context.fog,
          color,
          data.colors._AlphaWidth ?? [1, 1, 1, 1],
          materialFog(data, true),
        );
  if (data.family === 'lightTubeOpaque') return material;
  material.transparent = true;
  material.blending = CustomBlending;
  material.blendEquation = AddEquation;
  material.blendSrc = OneFactor;
  material.blendDst = OneFactor;
  material.blendEquationAlpha = AddEquation;
  material.blendSrcAlpha = OneFactor;
  material.blendDstAlpha = OneFactor;
  return material;
}
