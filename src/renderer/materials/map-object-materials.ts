import {
  AddEquation,
  Color,
  CustomBlending,
  DoubleSide,
  OneMinusSrcAlphaFactor,
  OneFactor,
  ShaderMaterial,
  SrcAlphaFactor,
  Vector4,
  ZeroFactor,
  type Texture,
} from 'three';

import type { Rgb } from '../../core/colors';
import type { FogUniforms } from '../bloomfog/pipeline';
import { OBJECT_VERT } from '../shaders/chunks';
import {
  ARC_FRAG,
  ARC_VERT,
  BOMB_FRAG,
  GLOWING_FRAG,
  NOTE_FRAG,
  OBSTACLE_DISPLACEMENT_FRAG,
  OBSTACLE_DISPLACEMENT_VERT,
  OBSTACLE_FRAG,
  OBSTACLE_OUTLINE_FRAG,
  OBSTACLE_OUTLINE_VERT,
  SABER_GLOW_FRAG,
  SABER_TRAIL_FRAG,
  SABER_TRAIL_VERT,
} from '../shaders/map-object-shaders';
import { additive, linearColor, materialFogUniforms } from './shared';

function createNoteSurfaceMaterial(
  fog: FogUniforms,
  color: Color,
  reflection: Texture,
  surfaceGain: number,
  edgeStrength: number,
  edgeBias: number,
  edgeDistanceStart: number,
  edgeDistanceGain: number,
  edgeShadow: number,
  surfaceGloss = 0.95,
) {
  return new ShaderMaterial({
    vertexShader: OBJECT_VERT,
    fragmentShader: NOTE_FRAG,
    uniforms: {
      ...materialFogUniforms(fog, {
        startOffset: 100,
        scale: 0.5,
        heightEnabled: true,
        heightScale: 2.5,
      }),
      _ReflectionMap: { value: reflection },
      _Color: { value: color },
      _SurfaceGain: { value: surfaceGain },
      _EdgeStrength: { value: edgeStrength },
      _EdgeBias: { value: edgeBias },
      _EdgeDistanceStart: { value: edgeDistanceStart },
      _EdgeDistanceGain: { value: edgeDistanceGain },
      _EdgeShadow: { value: edgeShadow },
      _SurfaceGloss: { value: surfaceGloss },
    },
  });
}

export function createNoteMaterial(fog: FogUniforms, color: Rgb, reflection: Texture) {
  return createNoteSurfaceMaterial(fog, linearColor(color), reflection, 1, 2, -0.1, 5, 0.03, 0.2, 0.95);
}

export function createDirectionalMaterial(fog: FogUniforms) {
  return new ShaderMaterial({
    vertexShader: OBJECT_VERT,
    fragmentShader: GLOWING_FRAG,
    uniforms: {
      ...materialFogUniforms(fog, { startOffset: 100 }),
      _Color: { value: linearColor([1, 1, 1]) },
      _ColorMultiplier: { value: 1.71875 },
    },
  });
}

export function createBombMaterial(fog: FogUniforms, reflection: Texture) {
  return new ShaderMaterial({
    vertexShader: OBJECT_VERT,
    fragmentShader: BOMB_FRAG,
    uniforms: {
      ...materialFogUniforms(fog, { startOffset: 100, scale: 0.5 }),
      _ReflectionMap: { value: reflection },
      _Color: { value: linearColor([64 / 255, 64 / 255, 64 / 255]) },
      _SurfaceGain: { value: 1 },
      _SurfaceGloss: { value: 1 },
    },
  });
}

export function createSaberGlowMaterial(fog: FogUniforms, color: Rgb, coreColor: Rgb) {
  return new ShaderMaterial({
    ...additive,
    depthWrite: false,
    vertexShader: OBJECT_VERT,
    fragmentShader: SABER_GLOW_FRAG,
    uniforms: {
      ...materialFogUniforms(fog),
      _Color: { value: linearColor(color) },
      _ColorMultiplier: { value: 1.4 },
      _CoreColor: { value: linearColor(coreColor) },
      _CoreMultiplier: { value: 1.65 },
      _CoreBlend: { value: 0.26 },
      _BloomAlpha: { value: 0.62 },
      _CoreBloomAlpha: { value: 0.65 },
    },
  });
}

export function createSaberCoreMaterial(fog: FogUniforms, color: Rgb) {
  return new ShaderMaterial({
    vertexShader: OBJECT_VERT,
    fragmentShader: SABER_GLOW_FRAG,
    uniforms: {
      ...materialFogUniforms(fog),
      _Color: { value: linearColor(color) },
      _ColorMultiplier: { value: 2.05 },
      _CoreColor: { value: linearColor(color) },
      _CoreMultiplier: { value: 2.05 },
      _CoreBlend: { value: 0 },
      _BloomAlpha: { value: 0.3 },
      _CoreBloomAlpha: { value: 0.3 },
    },
  });
}

export function createSaberTrailMaterial(color: Rgb) {
  return new ShaderMaterial({
    vertexShader: SABER_TRAIL_VERT,
    fragmentShader: SABER_TRAIL_FRAG,
    uniforms: { _Color: { value: linearColor(color) } },
    transparent: true,
    depthWrite: false,
    side: DoubleSide,
  });
}

export function createObstacleMaterial(fog: FogUniforms, color: Rgb) {
  return new ShaderMaterial({
    vertexShader: OBJECT_VERT,
    fragmentShader: OBSTACLE_FRAG,
    uniforms: {
      ...materialFogUniforms(fog, { startOffset: 100 }),
      _Color: { value: linearColor(color) },
    },
    depthWrite: true,
    side: DoubleSide,
    transparent: true,
    blending: CustomBlending,
    blendEquation: AddEquation,
    blendSrc: SrcAlphaFactor,
    blendDst: OneMinusSrcAlphaFactor,
    blendSrcAlpha: ZeroFactor,
    blendDstAlpha: OneFactor,
  });
}

export function createObstacleDisplacementMaterial(
  fog: FogUniforms,
  color: Rgb,
  screenTexture: { value: Texture },
  displacementTexture: Texture,
) {
  return new ShaderMaterial({
    vertexShader: OBSTACLE_DISPLACEMENT_VERT,
    fragmentShader: OBSTACLE_DISPLACEMENT_FRAG,
    uniforms: {
      ...materialFogUniforms(fog, {
        startOffset: 100,
        scale: 1,
        heightEnabled: true,
        heightScale: 2.5,
      }),
      _Color: { value: linearColor(color) },
      _WallSceneTexture: screenTexture,
      _WallNoiseTexture: { value: displacementTexture },
      _WallDistortion: { value: 0.1875 },
      _WallOpacity: { value: 0.75 },
      _WallFacingStrength: { value: 1 },
      _WallTintToWhite: { value: 0.75 },
      _WallGlow: { value: 0.1 },
    },
    depthWrite: true,
    side: DoubleSide,
    transparent: true,
    blending: CustomBlending,
    blendEquation: AddEquation,
    blendSrc: OneFactor,
    blendDst: ZeroFactor,
    blendSrcAlpha: OneFactor,
    blendDstAlpha: ZeroFactor,
  });
}

export function createObstacleOutlineMaterial(fog: FogUniforms, color: Rgb) {
  return new ShaderMaterial({
    vertexShader: OBSTACLE_OUTLINE_VERT,
    fragmentShader: OBSTACLE_OUTLINE_FRAG,
    uniforms: {
      ...materialFogUniforms(fog, { startOffset: 100 }),
      _Color: { value: linearColor(color) },
    },
    depthWrite: true,
    side: DoubleSide,
  });
}

export interface ArcMaterialSettings {
  headBeat: number;
  tailBeat: number;
  hjdBeats: number;
  unitsPerBeat: number;
  pathLength: number;
  headFadeLength: number;
  tailFadeLength: number;
  random: number;
}

export function createArcMaterial(fog: FogUniforms, color: Rgb, texture: Texture, settings: ArcMaterialSettings) {
  const linear = linearColor(color);
  return new ShaderMaterial({
    vertexShader: ARC_VERT,
    fragmentShader: ARC_FRAG,
    uniforms: {
      ...materialFogUniforms(fog, { startOffset: 100, scale: 0.5 }),
      _ArcColor: { value: new Vector4(linear.r, linear.g, linear.b, 1) },
      _ArcNoise: { value: texture },
      _PlaybackBeat: { value: settings.headBeat - settings.hjdBeats },
      _StartBeat: { value: settings.headBeat },
      _EndBeat: { value: settings.tailBeat },
      _JumpBeats: { value: settings.hjdBeats },
      _TravelPerBeat: { value: settings.unitsPerBeat },
      _CurveLength: { value: settings.pathLength },
      _StartFadeDistance: { value: settings.headFadeLength },
      _EndFadeDistance: { value: settings.tailFadeLength },
      _NoiseSeed: { value: settings.random },
      _ClockSeconds: { value: 0 },
      _ArcDrop: { value: 0.598 },
      _ArcRadius: { value: 0.149 },
    },
    depthWrite: false,
    side: DoubleSide,
    ...additive,
  });
}
