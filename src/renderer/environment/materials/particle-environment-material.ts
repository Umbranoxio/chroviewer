import {
  AddEquation,
  CustomBlending,
  DstAlphaFactor,
  DstColorFactor,
  MaxEquation,
  OneFactor,
  OneMinusDstAlphaFactor,
  OneMinusDstColorFactor,
  OneMinusSrcAlphaFactor,
  OneMinusSrcColorFactor,
  SrcAlphaFactor,
  SrcAlphaSaturateFactor,
  SrcColorFactor,
  ZeroFactor,
  type BlendingDstFactor,
  type BlendingSrcFactor,
} from 'three';

import type { Rgb } from '../../../core/colors';
import { createCustomParticlesMaterial } from '../../materials/environment-effect-materials';
import type { EnvironmentMaterialData } from '../types';
import {
  materialFog,
  materialTexture,
  materialTimeMode,
  vectorColor,
  type EnvironmentMaterialContext,
} from './material-context';

export function unityBlendSrcFactor(value: number | undefined): BlendingSrcFactor {
  switch (value) {
    case 0:
      return ZeroFactor;
    case 2:
      return DstColorFactor;
    case 3:
      return SrcColorFactor;
    case 4:
      return OneMinusDstColorFactor;
    case 5:
      return SrcAlphaFactor;
    case 6:
      return OneMinusSrcColorFactor;
    case 7:
      return DstAlphaFactor;
    case 8:
      return OneMinusDstAlphaFactor;
    case 9:
      return SrcAlphaSaturateFactor;
    case 10:
      return OneMinusSrcAlphaFactor;
    default:
      return OneFactor;
  }
}

export function unityBlendDstFactor(value: number | undefined): BlendingDstFactor {
  switch (value) {
    case 0:
      return ZeroFactor;
    case 2:
      return DstColorFactor;
    case 3:
      return SrcColorFactor;
    case 4:
      return OneMinusDstColorFactor;
    case 5:
      return SrcAlphaFactor;
    case 6:
      return OneMinusSrcColorFactor;
    case 7:
      return DstAlphaFactor;
    case 8:
      return OneMinusDstAlphaFactor;
    case 10:
      return OneMinusSrcAlphaFactor;
    default:
      return OneFactor;
  }
}

export function createParticleEnvironmentMaterial(
  data: EnvironmentMaterialData,
  context: EnvironmentMaterialContext,
  color: Rgb,
) {
  const keywords = new Set(data.keywords);
  let fogType: 'none' | 'alpha' | 'lerp' = 'none';
  if (keywords.has('_FOGTYPE_ALPHA')) fogType = 'alpha';
  else if (keywords.has('_FOGTYPE_LERP')) fogType = 'lerp';
  let billboard: 'none' | 'camera' | 'yAxis' = 'none';
  if (keywords.has('_BILLBOARD_Y_AXIS')) billboard = 'yAxis';
  else if (keywords.has('_BILLBOARD_FULL') || keywords.has('_BILLBOARD_CAMERA_FACING')) billboard = 'camera';
  let maskBlend: 'multiply' | 'add' | 'maskedAdd' = 'multiply';
  if (keywords.has('_MASKBLEND_MASKED_ADD')) maskBlend = 'maskedAdd';
  else if (keywords.has('_MASKBLEND_ADD')) maskBlend = 'add';
  let mask2Blend: 'multiply' | 'add' | 'maskedAdd' = 'multiply';
  if (keywords.has('_MASK2BLEND_MASKED_ADD')) mask2Blend = 'maskedAdd';
  else if (keywords.has('_MASK2BLEND_ADD')) mask2Blend = 'add';
  const material = createCustomParticlesMaterial(
    context.fog,
    color,
    data.colors._Color?.[3] ?? 1,
    {
      main: keywords.has('MAIN_TEXTURE') ? materialTexture(data, context, '_MainTex') : undefined,
      mask: keywords.has('MASK') ? materialTexture(data, context, '_MaskTex') : undefined,
      mask2: keywords.has('MASK2')
        ? (materialTexture(data, context, '_Mask2Tex') ?? materialTexture(data, context, '_NoiseTex'))
        : undefined,
      colorGradient: keywords.has('COLOR_GRADIENT') ? materialTexture(data, context, '_ColorGradient') : undefined,
    },
    {
      vertexColor:
        keywords.has('VERTEX_COLOR') ||
        keywords.has('VERTEX_RED_IS_ALPHA') ||
        keywords.has('VERTEX_SQUARE_ALPHA') ||
        keywords.has('_VERTEXCHANNELS_A') ||
        keywords.has('_VERTEXCHANNELS_RGB'),
      vertexRedIsAlpha: keywords.has('VERTEX_RED_IS_ALPHA'),
      vertexSquareAlpha: keywords.has('VERTEX_SQUARE_ALPHA'),
      vertexChannelsAlpha: keywords.has('_VERTEXCHANNELS_A'),
      textureColor: keywords.has('TEXTURE_COLOR'),
      alphaChannelRed: keywords.has('_ALPHACHANNEL_RED'),
      squareAlpha: keywords.has('SQUARE_ALPHA'),
      billboard,
      billboardScale: data.floats._BillboardScale ?? 1,
      customTime: materialTimeMode(data.keywords),
      songTime: context.songTime,
      timeOffset: data.floats._TimeOffset ?? 0,
      flipbook: keywords.has('TEXTURE_FLIPBOOK')
        ? {
            columns: data.floats._FlipbookColumns ?? 1,
            rows: data.floats._FlipbookRows ?? 1,
            speed: data.floats._FlipbookSpeed ?? 1,
          }
        : undefined,
      gradientPosition: data.floats._GradientPosition ?? 0,
      gradientPanningSpeed: data.floats._GradientPanningSpeed ?? 0,
      uvPanning: vectorColor(data.colors._UvPanning, [0, 0, 0]),
      maskPanning: vectorColor(data.colors._MaskPanning, [0, 0, 0]),
      mask2Panning: vectorColor(data.colors._Mask2Panning, [0, 0, 0]),
      baseLayer: data.floats._BaseLayer ?? 1,
      intensity: data.floats._Intensity ?? 1,
      alphaMultiplier: data.floats._AlphaMultiplier ?? 1,
      forcedWhiteBoost: keywords.has('_WHITEBOOSTTYPE_MAINEFFECT') && (data.floats._EnableForcedWhiteBoost ?? 0) !== 0,
      whiteBoostStart:
        data.floats._WhiteboostRemapStart ?? data.floats._WhiteBoostRemapStart ?? data.floats._WhiteBoostOffset ?? 0,
      bloomType: data.floats._BloomType ?? 0,
      bloomMultiplier: data.floats._BloomMultiplier ?? 1,
      bloomWhiteMultiplier: data.floats._BloomWhiteMultiplier ?? 1,
      fogType,
      fog: materialFog(data, fogType !== 'none'),
      maskRedIsAlpha: keywords.has('MASK_RED_IS_ALPHA'),
      maskBlend,
      maskStrength: data.floats._MaskStrength ?? 1,
      mask2RedIsAlpha: keywords.has('MASK2_RED_IS_ALPHA'),
      mask2Blend,
      mask2Strength: data.floats._Mask2Strength ?? 1,
    },
  );
  material.transparent = true;
  material.blending = CustomBlending;
  material.blendEquation = data.floats._BlendOp === 4 ? MaxEquation : AddEquation;
  material.blendSrc = unityBlendSrcFactor(data.floats._BlendModeSrc);
  material.blendDst = unityBlendDstFactor(data.floats._BlendModeDst);
  material.blendEquationAlpha = data.floats._BlendOp === 4 ? MaxEquation : AddEquation;
  material.blendSrcAlpha = unityBlendSrcFactor(data.floats._BlendModeSrcA);
  material.blendDstAlpha = unityBlendDstFactor(data.floats._BlendModeDstA);
  return material;
}
