import { ShaderMaterial, Vector2, Vector3, Vector4 } from 'three';

import type { Rgb } from '../../core/colors';
import type { FogUniforms } from '../bloomfog/pipeline';
import { OBJECT_VERT } from '../shaders/chunks';
import {
  CLOUDS_FRAG,
  CLOUDS_VERT,
  CUSTOM_PARTICLES_FRAG,
  CUSTOM_PARTICLES_VERT,
  LIGHTNING_FRAG,
  LIGHTNING_VERT,
  TRANSPARENT_CLOUDS_FRAG,
  TRANSPARENT_CLOUDS_VERT,
} from '../shaders/environment-effect-shaders';
import {
  FAKE_GLOW_FRAG,
  FAKE_GLOW_VERT,
  OPAQUE_LIGHT_FRAG,
  PARAMETRIC_BOX_VERT,
  TRANSPARENT_LIGHT_FRAG,
} from '../shaders/scene-shaders';
import {
  linearColor,
  materialFogUniforms,
  textureUniforms,
  type DirectionalLightUniforms,
  type MaterialFogSettings,
  type MaterialTexture,
} from './shared';
import { worldNoiseTexture } from './world-noise-texture';

export interface CustomParticlesSettings {
  vertexColor: boolean;
  vertexRedIsAlpha: boolean;
  vertexSquareAlpha: boolean;
  vertexChannelsAlpha: boolean;
  textureColor: boolean;
  alphaChannelRed: boolean;
  squareAlpha: boolean;
  billboard: 'none' | 'camera' | 'yAxis';
  billboardScale: number;
  customTime: 'continuous' | 'song' | 'freeze';
  songTime?: { value: number };
  timeOffset: number;
  flipbook?: { columns: number; rows: number; speed: number };
  gradientPosition: number;
  gradientPanningSpeed: number;
  uvPanning: Rgb;
  maskPanning: Rgb;
  mask2Panning: Rgb;
  baseLayer: number;
  intensity: number;
  alphaMultiplier: number;
  forcedWhiteBoost: boolean;
  whiteBoostStart: number;
  bloomType: number;
  bloomMultiplier: number;
  bloomWhiteMultiplier: number;
  fogType: 'none' | 'lerp' | 'alpha';
  fog: MaterialFogSettings;
  maskRedIsAlpha: boolean;
  maskBlend: 'multiply' | 'add' | 'maskedAdd';
  maskStrength: number;
  mask2RedIsAlpha: boolean;
  mask2Blend: 'multiply' | 'add' | 'maskedAdd';
  mask2Strength: number;
}

export function createOpaqueLightMaterial(
  fog: FogUniforms,
  color: Rgb,
  alphaWidth: [number, number, number, number] = [1, 1, 1, 1],
  fogSettings?: MaterialFogSettings,
) {
  return new ShaderMaterial({
    vertexShader: PARAMETRIC_BOX_VERT,
    fragmentShader: OPAQUE_LIGHT_FRAG,
    uniforms: {
      ...materialFogUniforms(fog, fogSettings),
      _Color: { value: linearColor(color) },
      _ColorMultiplier: { value: 1 },
      _AlphaWidth: { value: new Vector4(...alphaWidth) },
    },
    defines: { OPAQUE_LENGTH_FACTOR: 1 },
  });
}

export function createTransparentLightMaterial(
  fog: FogUniforms,
  color: Rgb,
  alphaWidth: [number, number, number, number] = [1, 1, 1, 1],
  fogSettings?: MaterialFogSettings,
) {
  return new ShaderMaterial({
    vertexShader: PARAMETRIC_BOX_VERT,
    fragmentShader: TRANSPARENT_LIGHT_FRAG,
    uniforms: {
      ...materialFogUniforms(fog, fogSettings),
      _Color: { value: linearColor(color) },
      _ColorMultiplier: { value: 1 },
      _AlphaWidth: { value: new Vector4(...alphaWidth) },
    },
  });
}

export function createFakeGlowMaterial(
  fog: FogUniforms,
  color: Rgb,
  bloomWhiteMultiplier: number,
  sizeParams?: [number, number, number, number],
  mainTexture?: MaterialTexture,
  settings: {
    parametricSlice?: boolean;
    yAxisBillboard?: boolean;
    alphaWidthScale?: boolean;
    capUvSize?: number;
    alphaWidth?: [number, number, number, number];
    bloomType?: number;
    bloomMultiplier?: number;
    squareAlpha?: boolean;
    useFogForLights?: boolean;
    worldNoise?: {
      scale: number;
      intensityOffset: number;
      intensityScale: number;
      scrolling: [number, number, number];
    };
    worldSpaceFade?: {
      position: number;
      slope: number;
    };
    fog?: MaterialFogSettings;
  } = {},
) {
  const { worldNoise, worldSpaceFade } = settings;
  const time = { value: 0 };
  const material = new ShaderMaterial({
    vertexShader: sizeParams === undefined && !settings.parametricSlice ? OBJECT_VERT : FAKE_GLOW_VERT,
    fragmentShader: FAKE_GLOW_FRAG,
    uniforms: {
      ...materialFogUniforms(fog, settings.fog),
      _Color: { value: linearColor(color) },
      _ColorMultiplier: { value: 1 },
      _BloomWhiteMultiplier: { value: bloomWhiteMultiplier },
      _BloomType: { value: settings.bloomType ?? 2 },
      _BloomMultiplier: { value: settings.bloomMultiplier ?? 1 },
      _SquareAlpha: { value: settings.squareAlpha ? 1 : 0 },
      _UseFogForLights: { value: settings.useFogForLights ? 1 : 0 },
      _TimeSeconds: time,
      _WorldNoiseScale: { value: worldNoise?.scale ?? 1 },
      _WorldNoiseIntensityOffset: { value: worldNoise?.intensityOffset ?? 0 },
      _WorldNoiseIntensityScale: { value: worldNoise?.intensityScale ?? 1 },
      _WorldNoiseScrolling: { value: new Vector3(...(worldNoise?.scrolling ?? [0, 0, 0])) },
      _WorldNoiseTex: { value: worldNoise === undefined ? null : worldNoiseTexture() },
      _WorldSpaceFadePos: { value: worldSpaceFade?.position ?? 0 },
      _WorldSpaceFadeSlope: { value: worldSpaceFade?.slope ?? 1 },
      _AlphaWidth: { value: new Vector4(...(settings.alphaWidth ?? [1, 1, 1, 1])) },
      _CapUVSize: { value: settings.capUvSize ?? 0.25 },
      ...(sizeParams === undefined ? {} : { _SizeParams: { value: new Vector4(...sizeParams) } }),
      ...textureUniforms('_MainTex', mainTexture),
    },
    defines: {
      ...(mainTexture === undefined ? {} : { MAIN_TEXTURE: 1 }),
      ...(settings.parametricSlice ? { PARAMETRIC_SLICE: 1 } : {}),
      ...(settings.yAxisBillboard ? { Y_AXIS_BILLBOARD: 1 } : {}),
      ...(settings.alphaWidthScale ? { ALPHA_WIDTH_SCALE: 1 } : {}),
      ...(worldNoise === undefined ? {} : { WORLD_NOISE: 1 }),
      ...(worldSpaceFade === undefined ? {} : { WORLD_SPACE_FADE: 1 }),
    },
  });
  if (worldNoise !== undefined) {
    material.onBeforeRender = () => {
      time.value = performance.now() * 0.001;
    };
  }
  return material;
}

export function createCustomParticlesMaterial(
  fog: FogUniforms,
  color: Rgb,
  colorMultiplier: number,
  textures: {
    main?: MaterialTexture;
    mask?: MaterialTexture;
    mask2?: MaterialTexture;
    colorGradient?: MaterialTexture;
  },
  settings: CustomParticlesSettings,
) {
  const defines = {
    ...(settings.vertexColor ? { USE_VERTEX_COLOR: 1 } : {}),
    ...(settings.vertexRedIsAlpha ? { VERTEX_RED_IS_ALPHA: 1 } : {}),
    ...(settings.vertexSquareAlpha ? { VERTEX_SQUARE_ALPHA: 1 } : {}),
    ...(settings.vertexChannelsAlpha ? { VERTEX_CHANNELS_A: 1 } : {}),
    ...(settings.textureColor ? { TEXTURE_COLOR: 1 } : {}),
    ...(settings.alphaChannelRed ? { ALPHA_CHANNEL_RED: 1 } : {}),
    ...(settings.squareAlpha ? { SQUARE_ALPHA: 1 } : {}),
    ...(settings.forcedWhiteBoost ? { FORCED_WHITE_BOOST: 1 } : {}),
    ...(settings.billboard === 'camera' ? { BILLBOARD_CAMERA: 1 } : {}),
    ...(settings.billboard === 'yAxis' ? { BILLBOARD_Y_AXIS: 1 } : {}),
    ...(settings.customTime === 'freeze' ? { CUSTOM_TIME_FREEZE: 1 } : {}),
    ...(settings.customTime === 'song' ? { CUSTOM_TIME_SONG: 1 } : {}),
    ...(settings.flipbook === undefined ? {} : { TEXTURE_FLIPBOOK: 1 }),
    ...(textures.main === undefined ? {} : { MAIN_TEXTURE: 1 }),
    ...(textures.mask === undefined
      ? {}
      : {
          MASK: 1,
          ...(settings.maskRedIsAlpha ? { MASK_RED_IS_ALPHA: 1 } : {}),
          ...(settings.maskBlend === 'add' ? { MASK_BLEND_ADD: 1 } : {}),
          ...(settings.maskBlend === 'maskedAdd' ? { MASK_BLEND_MASKED_ADD: 1 } : {}),
        }),
    ...(textures.mask2 === undefined
      ? {}
      : {
          MASK2: 1,
          ...(settings.mask2RedIsAlpha ? { MASK2_RED_IS_ALPHA: 1 } : {}),
          ...(settings.mask2Blend === 'add' ? { MASK2_BLEND_ADD: 1 } : {}),
          ...(settings.mask2Blend === 'maskedAdd' ? { MASK2_BLEND_MASKED_ADD: 1 } : {}),
        }),
    ...(textures.colorGradient === undefined ? {} : { COLOR_GRADIENT: 1 }),
    ...(settings.fogType === 'lerp' ? { FOG_LERP: 1 } : {}),
    ...(settings.fogType === 'alpha' ? { FOG_ALPHA: 1 } : {}),
  };
  const elapsed = { value: 0 };
  const material = new ShaderMaterial({
    defines,
    vertexShader: CUSTOM_PARTICLES_VERT,
    fragmentShader: CUSTOM_PARTICLES_FRAG,
    uniforms: {
      ...materialFogUniforms(fog, settings.fog),
      _Color: { value: linearColor(color) },
      _ColorMultiplier: { value: colorMultiplier },
      ...textureUniforms('_MainTex', textures.main),
      ...textureUniforms('_MaskTex', textures.mask),
      ...textureUniforms('_Mask2Tex', textures.mask2),
      ...textureUniforms('_ColorGradient', textures.colorGradient),
      _BillboardScale: { value: settings.billboardScale },
      _TimeSeconds: elapsed,
      _SongTime: settings.songTime ?? { value: 0 },
      _TimeOffset: { value: settings.timeOffset },
      _FlipbookColumns: { value: settings.flipbook?.columns ?? 1 },
      _FlipbookRows: { value: settings.flipbook?.rows ?? 1 },
      _FlipbookSpeed: { value: settings.flipbook?.speed ?? 1 },
      _GradientPosition: { value: settings.gradientPosition },
      _GradientPanningSpeed: { value: settings.gradientPanningSpeed },
      _UvPanning: { value: new Vector2(settings.uvPanning[0], settings.uvPanning[1]) },
      _MaskPanning: { value: new Vector2(settings.maskPanning[0], settings.maskPanning[1]) },
      _Mask2Panning: { value: new Vector2(settings.mask2Panning[0], settings.mask2Panning[1]) },
      _BaseLayer: { value: settings.baseLayer },
      _Intensity: { value: settings.intensity },
      _AlphaMultiplier: { value: settings.alphaMultiplier },
      _WhiteBoostStart: { value: settings.whiteBoostStart },
      _BloomType: { value: settings.bloomType },
      _BloomMultiplier: { value: settings.bloomMultiplier },
      _BloomWhiteMultiplier: { value: settings.bloomWhiteMultiplier },
      _MaskStrength: { value: settings.maskStrength },
      _Mask2Strength: { value: settings.mask2Strength },
    },
  });
  if (settings.customTime === 'continuous') {
    material.onBeforeRender = () => {
      elapsed.value = performance.now() * 0.001;
    };
  }
  return material;
}

export function createLightningMaterial(
  fog: FogUniforms,
  color: Rgb,
  colorMultiplier: number,
  target: [number, number, number, number],
  mainTexture: MaterialTexture | undefined,
  settings: {
    width: number;
    jitter: number;
    speed: number;
    fog: MaterialFogSettings;
  },
) {
  const time = { value: 0 };
  const material = new ShaderMaterial({
    defines: mainTexture === undefined ? {} : { MAIN_TEXTURE: 1 },
    vertexShader: LIGHTNING_VERT,
    fragmentShader: LIGHTNING_FRAG,
    uniforms: {
      ...materialFogUniforms(fog, settings.fog),
      _Color: { value: linearColor(color) },
      _ColorMultiplier: { value: colorMultiplier },
      _TargetPoint: { value: new Vector4(...target) },
      _Width: { value: settings.width },
      _Jitter: { value: settings.jitter },
      _Speed: { value: settings.speed },
      _TimeSeconds: time,
      ...textureUniforms('_MainTex', mainTexture),
    },
  });
  material.onBeforeRender = () => {
    time.value = performance.now() * 0.001;
  };
  return material;
}

export function createTransparentCloudMaterial(
  lights: DirectionalLightUniforms,
  color: Rgb,
  colorAlpha: number,
  diffuseTexture: MaterialTexture | undefined,
  distortTexture: MaterialTexture | undefined,
  settings: {
    vertexWaveFrequency: number;
    vertexWaveAmplitude: number;
    rotateLayerSpeeds: Rgb;
    backLightingBoost: number;
    fadeBottomMin: number;
    fadeBottomMax: number;
    runwayFadeOffset: number;
    runwayFadeScale: number;
    distortTextureSpeed: [number, number];
    distortAmount: number;
  },
) {
  const time = { value: 0 };
  const material = new ShaderMaterial({
    defines: {
      ...(diffuseTexture === undefined ? {} : { DIFFUSE_TEXTURE: 1 }),
      ...(distortTexture === undefined ? {} : { DISTORT_TEXTURE: 1 }),
    },
    vertexShader: TRANSPARENT_CLOUDS_VERT,
    fragmentShader: TRANSPARENT_CLOUDS_FRAG,
    uniforms: {
      ...textureUniforms('_DiffuseTexture', diffuseTexture),
      ...textureUniforms('_DistortTex', distortTexture),
      _Color: { value: linearColor(color) },
      _ColorAlpha: { value: colorAlpha },
      _TimeSeconds: time,
      _VertexWaveFrequency: { value: settings.vertexWaveFrequency },
      _VertexWaveAmplitude: { value: settings.vertexWaveAmplitude },
      _RotateLayerSpeeds: { value: new Vector3(...settings.rotateLayerSpeeds) },
      _DirectionalLightDirections: lights.directions,
      _DirectionalLightColors: lights.colors,
      _BackLightingBoost: { value: settings.backLightingBoost },
      _FadeBottomMin: { value: settings.fadeBottomMin },
      _FadeBottomMax: { value: settings.fadeBottomMax },
      _RunwayFadeOffset: { value: settings.runwayFadeOffset },
      _RunwayFadeScale: { value: settings.runwayFadeScale },
      _DistortTexSpeed: { value: new Vector2(...settings.distortTextureSpeed) },
      _DistortAmount: { value: settings.distortAmount },
    },
  });
  material.onBeforeRender = () => {
    time.value = performance.now() * 0.001;
  };
  return material;
}

export function createOpaqueCloudMaterial(
  fog: FogUniforms,
  lights: DirectionalLightUniforms,
  mainTexture: MaterialTexture | undefined,
  noiseTexture: MaterialTexture | undefined,
  settings: {
    speed: number;
    noiseIntensityOffset: number;
    noiseIntensityScale: number;
    noiseScrolling: [number, number];
    fog: MaterialFogSettings;
  },
) {
  const time = { value: 0 };
  const material = new ShaderMaterial({
    defines: {
      ...(mainTexture === undefined ? {} : { MAIN_TEXTURE: 1 }),
      ...(noiseTexture === undefined ? {} : { NOISE_TEXTURE: 1 }),
    },
    vertexShader: CLOUDS_VERT,
    fragmentShader: CLOUDS_FRAG,
    uniforms: {
      ...materialFogUniforms(fog, settings.fog),
      ...textureUniforms('_MainTex', mainTexture),
      ...textureUniforms('_NoiseTex', noiseTexture),
      _Speed: { value: settings.speed },
      _WorldNoiseIntensityOffset: { value: settings.noiseIntensityOffset },
      _WorldNoiseIntensityScale: { value: settings.noiseIntensityScale },
      _WorldNoiseScrolling: { value: new Vector2(...settings.noiseScrolling) },
      _TimeSeconds: time,
      _DirectionalLightDirections: lights.directions,
      _DirectionalLightColors: lights.colors,
    },
  });
  material.onBeforeRender = () => {
    time.value = performance.now() * 0.001;
  };
  return material;
}
