import {
  AddEquation,
  Color,
  CustomBlending,
  DoubleSide,
  FrontSide,
  MeshBasicMaterial,
  OneMinusSrcAlphaFactor,
  OneFactor,
  ShaderMaterial,
  SrcAlphaFactor,
  Vector4,
  ZeroFactor,
  type Texture,
} from 'three';

import { BOMB_COLOR, type Rgb } from '../../core/colors';
import type { FogUniforms } from '../bloomfog/pipeline';
import { OBJECT_VERT } from '../shaders/chunks';
import {
  ARC_FRAG,
  ARC_VERT,
  ARROW_GLOW_FRAG,
  BOMB_FRAG,
  CIRCLE_GLOW_FRAG,
  GLOWING_FRAG,
  LEGACY_SOLID_OBSTACLE_FRAG,
  NOTE_FRAG,
  OBSTACLE_DISPLACEMENT_FRAG,
  OBSTACLE_DISPLACEMENT_VERT,
  OBSTACLE_FAKE_GLOW_FRAG,
  OBSTACLE_FAKE_GLOW_VERT,
  OBSTACLE_FRAG,
  OBSTACLE_OUTLINE_FRAG,
  OBSTACLE_OUTLINE_VERT,
  SABER_GLOW_FRAG,
  SABER_TRAIL_FRAG,
  SABER_TRAIL_VERT,
} from '../shaders/map-object-shaders';
import { additive, linearColor, materialFogUniforms } from './shared';
import { worldNoiseTexture } from './world-noise-texture';

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
    defines: {
      INSTANCED_COLOR: '',
      REFLECTION_RIM: '',
      REFLECTIVE_SURFACE: '',
    },
    vertexShader: OBJECT_VERT,
    fragmentShader: NOTE_FRAG,
    side: FrontSide,
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
      _CutoutNoiseTex: { value: worldNoiseTexture() },
      _CutoutTexScale: { value: 0.5 },
      _CutoutEdgeGlow: { value: 1 },
    },
  });
}

export function createNoteMaterial(fog: FogUniforms, color: Rgb, reflection: Texture) {
  return createNoteSurfaceMaterial(fog, linearColor(color), reflection, 0.92, 2, -0.1, 5, 0.03, 0.2, 0.95);
}

function directionalMaterial(fog: FogUniforms, decorative: boolean) {
  return new ShaderMaterial({
    defines: { INSTANCED_COLOR: '', ...(decorative ? { DECORATIVE_ARROW: '' } : {}) },
    vertexShader: OBJECT_VERT,
    fragmentShader: GLOWING_FRAG,
    transparent: decorative,
    depthWrite: !decorative,
    ...(decorative
      ? {
          blending: CustomBlending,
          blendEquation: AddEquation,
          blendSrc: SrcAlphaFactor,
          blendDst: OneMinusSrcAlphaFactor,
          blendEquationAlpha: AddEquation,
          blendSrcAlpha: ZeroFactor,
          blendDstAlpha: OneFactor,
        }
      : {}),
    uniforms: {
      ...materialFogUniforms(fog, { startOffset: decorative ? 49 : 100 }),
      _Color: { value: linearColor([1, 1, 1]) },
      _ColorMultiplier: { value: 1.71875 },
      _CutoutNoiseTex: { value: worldNoiseTexture() },
      _CutoutTexScale: { value: 2 },
      _CutoutEdgeGlow: { value: 1 },
    },
  });
}

export function createDirectionalMaterial(fog: FogUniforms) {
  return directionalMaterial(fog, false);
}

export function createDecorativeDirectionalMaterial(fog: FogUniforms) {
  return directionalMaterial(fog, true);
}

function createNoteGlowMaterial(fog: FogUniforms, fragmentShader: string, additiveBlend: boolean, decorative = false) {
  return new ShaderMaterial({
    defines: { INSTANCED_COLOR: '', ...(decorative ? { DECORATIVE_ARROW: '' } : {}) },
    vertexShader: OBJECT_VERT,
    fragmentShader,
    uniforms: {
      ...materialFogUniforms(fog, { startOffset: 49 }),
      _Color: { value: linearColor([1, 1, 1]) },
    },
    transparent: true,
    depthWrite: false,
    side: DoubleSide,
    blending: CustomBlending,
    blendEquation: AddEquation,
    blendSrc: OneFactor,
    blendDst: additiveBlend ? OneFactor : OneMinusSrcAlphaFactor,
    blendEquationAlpha: AddEquation,
    blendSrcAlpha: ZeroFactor,
    blendDstAlpha: OneFactor,
  });
}

export function createArrowGlowMaterial(fog: FogUniforms) {
  return createNoteGlowMaterial(fog, ARROW_GLOW_FRAG, true);
}

export function createDecorativeArrowGlowMaterial(fog: FogUniforms) {
  return createNoteGlowMaterial(fog, ARROW_GLOW_FRAG, true, true);
}

export function createCircleGlowMaterial(fog: FogUniforms) {
  return createNoteGlowMaterial(fog, CIRCLE_GLOW_FRAG, false);
}

export function createHitLineMaterial() {
  const material = new MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.8,
    depthWrite: false,
  });
  material.blending = CustomBlending;
  material.blendEquation = AddEquation;
  material.blendSrc = SrcAlphaFactor;
  material.blendDst = OneMinusSrcAlphaFactor;
  material.blendSrcAlpha = ZeroFactor;
  material.blendDstAlpha = OneFactor;
  return material;
}

export function createBombMaterial(fog: FogUniforms, reflection: Texture) {
  return new ShaderMaterial({
    defines: { INSTANCED_COLOR: '', REFLECTIVE_SURFACE: '', MIRROR_FACE_CORRECTION: '' },
    vertexShader: OBJECT_VERT,
    fragmentShader: BOMB_FRAG,
    side: DoubleSide,
    uniforms: {
      ...materialFogUniforms(fog, { startOffset: 100, scale: 0.5 }),
      _ReflectionMap: { value: reflection },
      _MirrorPass: { value: 0 },
      _Color: { value: linearColor(BOMB_COLOR) },
      _SurfaceGain: { value: 0.2 },
      _SurfaceGloss: { value: 1 },
      _CutoutSize: { value: 1 },
      _CutoutEdgeWidth: { value: 0.02 },
      _CutoutEdgeGlow: { value: 1 },
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
      _CutoutSize: { value: 1 },
      _CutoutEdgeWidth: { value: 0 },
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
      _CutoutSize: { value: 1 },
      _CutoutEdgeWidth: { value: 0 },
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
    defines: { INSTANCED_COLOR: '' },
    vertexShader: OBJECT_VERT,
    fragmentShader: OBSTACLE_FRAG,
    uniforms: {
      ...materialFogUniforms(fog, { startOffset: 100 }),
      _Color: { value: linearColor(color) },
      _CutoutSize: { value: 1.2 },
      _CutoutEdgeWidth: { value: 0 },
    },
    depthWrite: false,
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

export function createLegacySolidObstacleMaterial(color: Rgb) {
  return new ShaderMaterial({
    defines: { INSTANCED_COLOR: '' },
    vertexShader: OBJECT_VERT,
    fragmentShader: LEGACY_SOLID_OBSTACLE_FRAG,
    uniforms: {
      _Color: { value: linearColor(color) },
      _CutoutSize: { value: 1.2 },
      _CutoutEdgeWidth: { value: 0 },
      _CutoutSoftening: { value: 0 },
    },
    depthWrite: true,
    side: DoubleSide,
  });
}

export function createObstacleDisplacementMaterial(
  fog: FogUniforms,
  color: Rgb,
  screenTexture: { value: Texture },
  displacementTexture: Texture,
) {
  return new ShaderMaterial({
    defines: { INSTANCED_COLOR: '' },
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
      _WallDisplacementStrength: { value: 0.25 },
      _WallDisplacementAlpha: { value: 0.75 },
      _WallViewAngleDistortionParam: { value: 1 },
      _WallTintToWhite: { value: 0.75 },
      _WallAddColorMultiplier: { value: 0.1 },
      _CutoutSize: { value: 1.2 },
      _CutoutEdgeWidth: { value: 0 },
    },
    depthWrite: false,
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
    defines: { INSTANCED_COLOR: '' },
    vertexShader: OBSTACLE_OUTLINE_VERT,
    fragmentShader: OBSTACLE_OUTLINE_FRAG,
    uniforms: {
      ...materialFogUniforms(fog, {
        startOffset: 7,
        heightEnabled: true,
        heightScale: 2.5,
      }),
      _Color: { value: linearColor(color) },
      _CutoutSize: { value: 1 },
      _CutoutEdgeWidth: { value: 0 },
    },
    depthWrite: true,
    side: DoubleSide,
  });
}

export function createObstacleFakeGlowMaterial(fog: FogUniforms, color: Rgb) {
  return new ShaderMaterial({
    ...additive,
    defines: { INSTANCED_COLOR: '' },
    vertexShader: OBSTACLE_FAKE_GLOW_VERT,
    fragmentShader: OBSTACLE_FAKE_GLOW_FRAG,
    uniforms: {
      ...materialFogUniforms(fog, {
        heightEnabled: true,
        heightScale: 2.5,
      }),
      _Color: { value: linearColor(color) },
      _CutoutSize: { value: 1 },
      _CutoutEdgeWidth: { value: 0 },
    },
    depthWrite: false,
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
  disableGravity?: boolean;
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
      _ArcDrop: { value: settings.disableGravity ? 0 : 0.6 },
      _ArcRadius: { value: 0.15 },
      _NoodleDissolve: { value: 1 },
    },
    depthWrite: false,
    side: DoubleSide,
    ...additive,
  });
}
