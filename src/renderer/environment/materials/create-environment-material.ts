import {
  AddEquation,
  AlwaysStencilFunc,
  BackSide,
  CustomBlending,
  DecrementStencilOp,
  DecrementWrapStencilOp,
  DoubleSide,
  EqualStencilFunc,
  FrontSide,
  GreaterEqualStencilFunc,
  GreaterStencilFunc,
  IncrementStencilOp,
  IncrementWrapStencilOp,
  InvertStencilOp,
  KeepStencilOp,
  LessEqualStencilFunc,
  LessStencilFunc,
  MaxEquation,
  MeshBasicMaterial,
  NeverStencilFunc,
  NotEqualStencilFunc,
  ReplaceStencilOp,
  ShaderMaterial,
  ZeroStencilOp,
  type Material,
} from 'three';

import {
  createLightningMaterial,
  createOpaqueCloudMaterial,
  createRainMaterial,
} from '../../materials/environment-effect-materials';
import { createMirrorMaterial } from '../../materials/scene-materials';
import type { EnvironmentMaterialData } from '../types';
import { createLightEnvironmentMaterial } from './light-environment-material';
import { createLitEnvironmentMaterial } from './lit-environment-material';
import { materialColor, materialFog, materialTexture, type EnvironmentMaterialContext } from './material-context';
import {
  createParticleEnvironmentMaterial,
  unityBlendDstFactor,
  unityBlendSrcFactor,
} from './particle-environment-material';

export interface EnvironmentMaterialInstance {
  material: Material;
  shader?: ShaderMaterial;
}

const environmentMaterialFamilies = new WeakMap<Material, EnvironmentMaterialData['family']>();

export function environmentMaterialFamily(material: Material) {
  return environmentMaterialFamilies.get(material);
}

function unityStencilFunc(value: number) {
  switch (value) {
    case 1:
      return NeverStencilFunc;
    case 2:
      return LessStencilFunc;
    case 3:
      return EqualStencilFunc;
    case 4:
      return LessEqualStencilFunc;
    case 5:
      return GreaterStencilFunc;
    case 6:
      return NotEqualStencilFunc;
    case 7:
      return GreaterEqualStencilFunc;
    default:
      return AlwaysStencilFunc;
  }
}

function unityStencilOp(value: number) {
  switch (value) {
    case 1:
      return ZeroStencilOp;
    case 2:
      return ReplaceStencilOp;
    case 3:
      return IncrementStencilOp;
    case 4:
      return DecrementStencilOp;
    case 5:
      return InvertStencilOp;
    case 6:
      return IncrementWrapStencilOp;
    case 7:
      return DecrementWrapStencilOp;
    default:
      return KeepStencilOp;
  }
}

export function createEnvironmentMaterial(
  data: EnvironmentMaterialData,
  context: EnvironmentMaterialContext,
  environmentId?: string,
): EnvironmentMaterialInstance | null {
  const color = materialColor(data);
  let material: Material;
  let shader: ShaderMaterial | undefined;
  switch (data.family) {
    case 'lit':
      material = shader = createLitEnvironmentMaterial(data, context, color);
      if (data.shader === 'ChroMapper/Water Lit' && data.keywords.includes('Z_FADE')) {
        material.transparent = true;
        material.blending = CustomBlending;
        material.blendEquation = AddEquation;
        material.blendSrc = unityBlendSrcFactor(data.floats._BlendModeSrc);
        material.blendDst = unityBlendDstFactor(data.floats._BlendModeDst);
        material.blendEquationAlpha = AddEquation;
        material.blendSrcAlpha = unityBlendSrcFactor(data.floats._BlendModeSrcA);
        material.blendDstAlpha = unityBlendDstFactor(data.floats._BlendModeDstA);
      }
      break;
    case 'lightTubeOpaque':
    case 'lightTubeTransparent':
    case 'fakeGlow':
      material = shader = createLightEnvironmentMaterial(data, context, color);
      break;
    case 'customParticles':
      material = shader = createParticleEnvironmentMaterial(data, context, color);
      break;
    case 'rain':
      material = shader = createRainMaterial(context.fog, color, data.colors._Color?.[3] ?? 1, {
        height: data.floats._Height ?? 10,
        speed: data.floats._Speed ?? 1,
        bottomFadeScale: data.floats._BottomFadeScale ?? 1,
        topFadeScale: data.floats._TopFadeScale ?? 1,
        bottomEnd: data.floats._BottomEnd ?? 1,
        topEnd: data.floats._TopEnd ?? 1,
        intensity: data.floats._Intensity ?? 1,
        alphaMultiplier: data.floats._AlphaMultiplier ?? 1,
        alphaFromFog: data.floats._AlphaFromFog ?? 0.5,
      });
      material.transparent = true;
      material.depthTest = false;
      material.blending = CustomBlending;
      material.blendEquation = AddEquation;
      material.blendSrc = unityBlendSrcFactor(data.floats._BlendSrcFactor);
      material.blendDst = unityBlendDstFactor(data.floats._BlendDstFactor);
      material.blendEquationAlpha = AddEquation;
      material.blendSrcAlpha = unityBlendSrcFactor(data.floats._BlendSrcFactorA);
      material.blendDstAlpha = unityBlendDstFactor(data.floats._BlendDstFactorA);
      break;
    case 'lightning': {
      material = shader = createLightningMaterial(
        context.fog,
        color,
        data.colors._Color?.[3] ?? 1,
        data.colors._TargetPoint ?? [0, 0, 0, 1],
        materialTexture(data, context, '_MainTex'),
        {
          width: data.floats._Width ?? 1,
          jitter: data.floats._Jitter ?? 5,
          speed: data.floats._Speed ?? 1,
          fog: materialFog(data, true),
        },
      );
      material.transparent = true;
      material.blending = CustomBlending;
      material.blendEquation = data.floats._BlendOp === 4 ? MaxEquation : AddEquation;
      material.blendSrc = unityBlendSrcFactor(data.floats._BlendModeSrc);
      material.blendDst = unityBlendDstFactor(data.floats._BlendModeDst);
      material.blendEquationAlpha = material.blendEquation;
      material.blendSrcAlpha = unityBlendSrcFactor(data.floats._BlendModeSrcA);
      material.blendDstAlpha = unityBlendDstFactor(data.floats._BlendModeDstA);
      break;
    }
    case 'depthOnly':
      material = new MeshBasicMaterial({ colorWrite: false });
      break;
    case 'stencil':
      material = new MeshBasicMaterial({
        colorWrite: false,
        depthWrite: false,
      });
      break;
    case 'clouds': {
      const scrolling = data.colors._WorldNoiseScrolling ?? [0, 0, 0, 1];
      material = shader = createOpaqueCloudMaterial(
        context.fog,
        context.directionalLights,
        materialTexture(data, context, '_MainTex'),
        materialTexture(data, context, '_NoiseTex'),
        {
          speed: data.floats._Speed ?? 1,
          noiseIntensityOffset: data.floats._WorldNoiseIntensityOffset ?? 0,
          noiseIntensityScale: data.floats._WorldNoiseIntensityScale ?? 0,
          noiseScrolling: [scrolling[0], scrolling[1]],
          // game clouds always height-fog with the live globals plus this material offset
          fog: {
            ...materialFog(data, true),
            heightEnabled: true,
            heightOffset: data.floats._HeightFogOffset ?? 0,
            heightScale: 1,
          },
        },
      );
      break;
    }
    case 'mirror': {
      const dirtData = data.keywords.includes('DIRT') ? data.textures?._DirtTex : undefined;
      const dirtTexture = dirtData === undefined ? undefined : context.textures?.get(dirtData.asset);
      const normalData = data.textures?._NormalTex;
      const normalTexture = normalData === undefined ? undefined : context.textures?.get(normalData.asset);
      const textureScrolling = data.colors._TextureScrolling ?? [0, 0, 0, 0];
      const detailNormalScrolling = data.colors._DetailNormalTexScrolling ?? [0, 0, 0, 0];
      material = shader = createMirrorMaterial(
        context.fog,
        context.reflectionTexture,
        color,
        data.floats._ReflectionIntensity ?? 0.5,
        dirtData === undefined || dirtTexture === undefined
          ? undefined
          : {
              texture: dirtTexture,
              scale: dirtData.scale,
              offset: dirtData.offset,
              intensity: data.floats._DirtIntensity ?? 1,
            },
        normalData === undefined || normalTexture === undefined
          ? undefined
          : {
              texture: normalTexture,
              scale: normalData.scale,
              offset: normalData.offset,
              intensity: data.floats._BumpIntensity ?? 0.1,
              scrolling: [textureScrolling[0], textureScrolling[1]],
              detailScrolling: [detailNormalScrolling[0], detailNormalScrolling[1]],
              detailScale: data.floats._DetailNormalTextureScale ?? 1,
              detailIntensity: data.keywords.includes('DETAIL_NORMAL_MAP')
                ? (data.floats._DetailNormalIntensity ?? 0)
                : 0,
            },
      );
      break;
    }
    case 'skip':
    case 'unknown':
      return null;
  }
  if (shader !== undefined) {
    const fogStart = shader.uniforms._FogStartOffset;
    const fogScale = shader.uniforms._FogScale;
    const fogStartOffset = data.floats._FogStartOffset;
    const materialFogScale = data.floats._FogScale;
    if (fogStart !== undefined && fogStartOffset !== undefined) {
      fogStart.value = fogStartOffset;
    }
    if (fogScale !== undefined && materialFogScale !== undefined) {
      fogScale.value = materialFogScale;
    }
  }
  const isParametricSliceBillboard = data.shader === 'ChroMapper/Parametric Slice Billboard';
  if (isParametricSliceBillboard) {
    material.side = DoubleSide;
  } else {
    const cullMode = data.floats._CullMode ?? data.floats._Cull;
    if (cullMode === 0) material.side = DoubleSide;
    if (cullMode === 1) material.side = BackSide;
    if (cullMode === 2) material.side = FrontSide;
  }
  const disableDepthWrite = environmentId === 'WeaveEnvironment' && isParametricSliceBillboard;
  material.depthWrite =
    data.family === 'depthOnly' ||
    (!disableDepthWrite && data.family !== 'stencil' && data.family !== 'rain' && data.floats._ZWrite !== 0);
  const stencilComp = data.floats._StencilComp ?? 8;
  const stencilPass = data.floats._StencilPass ?? 0;
  if (stencilComp !== 8 || stencilPass !== 0) {
    material.stencilWrite = true;
    material.stencilRef = data.floats._StencilRefValue ?? 0;
    material.stencilFunc = unityStencilFunc(stencilComp);
    material.stencilZPass = unityStencilOp(stencilPass);
  }
  environmentMaterialFamilies.set(material, data.family);
  return { material, shader };
}
