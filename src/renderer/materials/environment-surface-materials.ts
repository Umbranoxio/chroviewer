import { ShaderMaterial, Vector2, Vector3, type CubeTexture } from 'three';

import type { Rgb } from '../../core/colors';
import type { FogUniforms } from '../bloomfog/pipeline';
import { OBJECT_VERT } from '../shaders/chunks';
import {
  ENVIRONMENT_LIT_FRAG,
  ENVIRONMENT_LIT_VERT,
  ENVIRONMENT_UNLIT_FRAG,
} from '../shaders/environment-surface-shaders';
import {
  linearColor,
  materialFogUniforms,
  textureUniforms,
  type DirectionalLightUniforms,
  type MaterialFogSettings,
  type MaterialTexture,
} from './shared';

export interface EnvironmentLitSettings {
  ambientMinimalValue: number;
  nominalDiffuseLevel: Rgb;
  ambientMultiplier: number;
  diffuseEnabled: boolean;
  bothSidesDiffuseMultiplier: number;
  metallic: number;
  specularEnabled: boolean;
  smoothness: number;
  specularIntensity: number;
  lightFalloffEnabled: boolean;
  privatePointLightEnabled: boolean;
  privatePointLightColor: Rgb;
  privatePointLightPosition: Rgb;
  privatePointLightLocal: boolean;
  privatePointLightIntensity: number;
  groundFadeEnabled: boolean;
  groundFadeScale: number;
  groundFadeOffset: number;
  distanceDarkeningEnabled: boolean;
  darkeningScale: number;
  darkeningIntensity: number;
  darkeningCenter: Rgb;
  darkeningDirection: Rgb;
  vertexColorEnabled: boolean;
  vertexEmissionEnabled: boolean;
  vertexEmissionColor: Rgb;
  vertexEmissionColorAlpha: number;
  vertexEmissionThreshold: number;
  vertexEmissionStrength: number;
  vertexEmissionBloomIntensity: number;
  vertexEmissionMainEffect: boolean;
  displacementEnabled: boolean;
  displacementSpatial: boolean;
  displacementBidirectional: boolean;
  displacementStrength: number;
  displacementAxisMultiplier: Rgb;
  meshPackingEnabled: boolean;
  meshPackingId: number;
  diffuse?: MaterialTexture;
  albedoMultiplier: number;
  metalSmoothness?: MaterialTexture;
  metallicTextureEnabled: boolean;
  smoothnessTextureSource: 'none' | 'green' | 'greenRoughness' | 'alpha';
  occlusionEnabled: boolean;
  occlusionBeforeEmission: boolean;
  occlusionIntensity: number;
  occlusionDetail?: MaterialTexture;
  occlusionDetailEnabled: boolean;
  occlusionDetailOffset: [number, number];
  occlusionDetailIntensity: number;
  normal?: MaterialTexture;
  normalScale: number;
  emission?: MaterialTexture;
  emissionMask?: MaterialTexture;
  secondaryEmissionMask?: MaterialTexture;
  emissionMaskSecondaryUvs: boolean;
  secondaryEmissionMaskSecondaryUvs: boolean;
  emissionMaskSpeed: Rgb;
  secondaryEmissionMaskSpeed: Rgb;
  primaryEmissionGain: number;
  secondaryEmissionGain: number;
  reflectionProbe?: CubeTexture;
  reflectionIntensity: number;
  multiplyReflections: boolean;
  emissionColor: Rgb;
  emissionColorAlpha: number;
  emissionBrightness: number;
  emissionFogSuppression: number;
  emissionAlphaSource: 'green' | 'textureAlpha';
  emissionWhiteBoost: boolean;
  emissionWhiteBoostMultiplier: number;
  emissionMainEffect: boolean;
  emissionBloomIntensity: number;
  toneMapBeforeEmission: boolean;
  customTime: 'continuous' | 'song' | 'freeze';
  songTime?: { value: number };
  timeOffset: number;
  fog: MaterialFogSettings;
}

export function createEnvironmentLitMaterial(
  fog: FogUniforms,
  color: Rgb,
  lights: DirectionalLightUniforms,
  settings: EnvironmentLitSettings,
) {
  const elapsed = { value: 0 };
  const material = new ShaderMaterial({
    defines: {
      ...(settings.vertexColorEnabled || settings.vertexEmissionEnabled ? { USE_VERTEX_COLOR: 1 } : {}),
      ...(settings.vertexEmissionEnabled ? { VERTEX_EMISSION: 1 } : {}),
      ...(settings.vertexEmissionEnabled && settings.vertexEmissionMainEffect
        ? { VERTEX_EMISSION_MAIN_EFFECT: 1 }
        : {}),
      ...(settings.displacementEnabled ? { VERTEX_DISPLACEMENT: 1 } : {}),
      ...(settings.displacementSpatial ? { DISPLACEMENT_SPATIAL: 1 } : {}),
      ...(settings.displacementBidirectional ? { DISPLACEMENT_BIDIRECTIONAL: 1 } : {}),
      ...(settings.meshPackingEnabled ? { MESH_PACKING: 1 } : {}),
      ...(settings.diffuse === undefined ? {} : { DIFFUSE_TEXTURE: 1 }),
      ...(settings.metalSmoothness === undefined ? {} : { METAL_SMOOTHNESS_TEXTURE: 1 }),
      ...(settings.metalSmoothness !== undefined && settings.metallicTextureEnabled ? { METALLIC_TEXTURE: 1 } : {}),
      ...(settings.metalSmoothness !== undefined && settings.smoothnessTextureSource !== 'none'
        ? { SMOOTHNESS_TEXTURE: 1 }
        : {}),
      ...(settings.metalSmoothness !== undefined && settings.smoothnessTextureSource === 'greenRoughness'
        ? { METAL_SMOOTHNESS_GREEN_ROUGHNESS: 1 }
        : {}),
      ...(settings.metalSmoothness !== undefined && settings.smoothnessTextureSource === 'alpha'
        ? { METAL_SMOOTHNESS_ALPHA: 1 }
        : {}),
      ...(settings.metalSmoothness !== undefined && settings.occlusionEnabled ? { OCCLUSION: 1 } : {}),
      ...(settings.occlusionDetail !== undefined && settings.occlusionDetailEnabled ? { OCCLUSION_DETAIL: 1 } : {}),
      ...(settings.metalSmoothness !== undefined && settings.occlusionEnabled && settings.occlusionBeforeEmission
        ? { OCCLUSION_BEFORE_EMISSION: 1 }
        : {}),
      ...(settings.normal === undefined ? {} : { NORMAL_TEXTURE: 1 }),
      ...(settings.emission === undefined ? {} : { EMISSION_TEXTURE: 1 }),
      ...(settings.emission !== undefined && settings.emissionAlphaSource === 'green'
        ? { EMISSION_TEXTURE_SIMPLE: 1 }
        : {}),
      ...(settings.emission !== undefined && settings.emissionWhiteBoost ? { EMISSION_WHITE_BOOST: 1 } : {}),
      ...(settings.emission !== undefined && settings.emissionMainEffect ? { EMISSION_MAIN_EFFECT: 1 } : {}),
      ...((settings.emission !== undefined || settings.vertexEmissionEnabled) && settings.toneMapBeforeEmission
        ? { TONE_MAP_BEFORE_EMISSION: 1 }
        : {}),
      ...(settings.emissionMask === undefined ? {} : { EMISSION_MASK: 1 }),
      ...(settings.secondaryEmissionMask === undefined ? {} : { SECONDARY_EMISSION_MASK: 1 }),
      ...(settings.emissionMask !== undefined && settings.emissionMaskSecondaryUvs
        ? { EMISSION_MASK_SECONDARY_UV: 1, USE_SECONDARY_UV: 1 }
        : {}),
      ...(settings.secondaryEmissionMask !== undefined && settings.secondaryEmissionMaskSecondaryUvs
        ? { SECONDARY_EMISSION_MASK_SECONDARY_UV: 1, USE_SECONDARY_UV: 1 }
        : {}),
      ...(settings.reflectionProbe === undefined ? {} : { REFLECTION_PROBE: 1 }),
      ...(settings.reflectionProbe !== undefined && settings.multiplyReflections ? { MULTIPLY_REFLECTIONS: 1 } : {}),
      ...(settings.customTime === 'freeze' ? { CUSTOM_TIME_FREEZE: 1 } : {}),
      ...(settings.customTime === 'song' ? { CUSTOM_TIME_SONG: 1 } : {}),
    },
    vertexShader: ENVIRONMENT_LIT_VERT,
    fragmentShader: ENVIRONMENT_LIT_FRAG,
    uniforms: {
      ...materialFogUniforms(fog, settings.fog),
      _Color: { value: linearColor(color) },
      _EmissionColor: { value: linearColor(settings.vertexEmissionColor) },
      _EmissionColorAlpha: { value: settings.vertexEmissionColorAlpha },
      _VertexEmissionThreshold: { value: settings.vertexEmissionThreshold },
      _VertexEmissionStrength: { value: settings.vertexEmissionStrength },
      _VertexEmissionBloomIntensity: { value: settings.vertexEmissionBloomIntensity },
      ...textureUniforms('_DiffuseTex', settings.diffuse),
      _AlbedoMultiplier: { value: settings.albedoMultiplier },
      ...textureUniforms('_MetalSmoothnessTex', settings.metalSmoothness),
      _OcclusionIntensity: { value: settings.occlusionIntensity },
      ...textureUniforms('_DirtDetailTex', settings.occlusionDetail),
      _OcclusionDetailOffset: {
        value: new Vector2(...settings.occlusionDetailOffset),
      },
      _OcclusionDetailIntensity: { value: settings.occlusionDetailIntensity },
      ...textureUniforms('_NormalTexture', settings.normal),
      _NormalScale: { value: settings.normalScale },
      ...textureUniforms('_EmissionTex', settings.emission),
      ...textureUniforms('_EmissionMask', settings.emissionMask),
      ...textureUniforms('_SecondaryEmissionMask', settings.secondaryEmissionMask),
      _EmissionMaskSpeed: {
        value: new Vector2(settings.emissionMaskSpeed[0], settings.emissionMaskSpeed[1]),
      },
      _SecondaryEmissionMaskSpeed: {
        value: new Vector2(settings.secondaryEmissionMaskSpeed[0], settings.secondaryEmissionMaskSpeed[1]),
      },
      _PrimaryEmissionGain: { value: settings.primaryEmissionGain },
      _SecondaryEmissionGain: { value: settings.secondaryEmissionGain },
      _ReflectionProbe: { value: settings.reflectionProbe },
      _ReflectionIntensity: { value: settings.reflectionIntensity },
      _EmissionTexColor: { value: linearColor(settings.emissionColor) },
      _EmissionTexColorAlpha: { value: settings.emissionColorAlpha },
      _EmissionBrightness: { value: settings.emissionBrightness },
      _EmissionFogSuppression: { value: settings.emissionFogSuppression },
      _EmissionTexBloomIntensity: { value: settings.emissionBloomIntensity },
      _EmissionTexWhiteBoostMultiplier: {
        value: settings.emissionWhiteBoostMultiplier,
      },
      _TimeSeconds: elapsed,
      _SongTime: settings.songTime ?? { value: 0 },
      _TimeOffset: { value: settings.timeOffset },
      _DirectionalLightDirections: lights.directions,
      _DirectionalLightColors: lights.colors,
      _DirectionalLightPositions: lights.positions,
      _DirectionalLightRadii: lights.radii,
      _AmbientMinimalValue: { value: settings.ambientMinimalValue },
      _NominalDiffuseLevel: {
        value: new Vector3(...settings.nominalDiffuseLevel),
      },
      _AmbientMultiplier: { value: settings.ambientMultiplier },
      _DiffuseEnabled: { value: settings.diffuseEnabled ? 1 : 0 },
      _BothSidesDiffuseMultiplier: {
        value: settings.bothSidesDiffuseMultiplier,
      },
      _Metallic: { value: settings.metallic },
      _SpecularEnabled: { value: settings.specularEnabled ? 1 : 0 },
      _Smoothness: { value: settings.smoothness },
      _SpecularIntensity: { value: settings.specularIntensity },
      _LightFalloffEnabled: { value: settings.lightFalloffEnabled ? 1 : 0 },
      _PrivatePointLightEnabled: {
        value: settings.privatePointLightEnabled ? 1 : 0,
      },
      _PrivatePointLightColor: {
        value: linearColor(settings.privatePointLightColor),
      },
      _PrivatePointLightPosition: {
        value: new Vector3(...settings.privatePointLightPosition),
      },
      _PrivatePointLightLocal: {
        value: settings.privatePointLightLocal ? 1 : 0,
      },
      _PrivatePointLightIntensity: {
        value: settings.privatePointLightIntensity,
      },
      _GroundFadeEnabled: { value: settings.groundFadeEnabled ? 1 : 0 },
      _GroundFadeScale: { value: settings.groundFadeScale },
      _GroundFadeOffset: { value: settings.groundFadeOffset },
      _DistanceDarkeningEnabled: {
        value: settings.distanceDarkeningEnabled ? 1 : 0,
      },
      _DarkeningScale: { value: settings.darkeningScale },
      _DarkeningIntensity: { value: settings.darkeningIntensity },
      _DarkeningCenter: { value: new Vector3(...settings.darkeningCenter) },
      _DarkeningDirection: {
        value: new Vector3(...settings.darkeningDirection),
      },
      _DisplacementStrength: { value: settings.displacementStrength },
      _DisplacementAxisMultiplier: {
        value: new Vector3(...settings.displacementAxisMultiplier),
      },
      _MeshPackingId: { value: settings.meshPackingId },
    },
  });
  if (settings.customTime === 'continuous') {
    material.onBeforeRender = () => {
      elapsed.value = performance.now() * 0.001;
    };
  }
  return material;
}

export function createEnvironmentUnlitMaterial(
  fog: FogUniforms,
  color: Rgb,
  alpha: number,
  settings: MaterialFogSettings,
) {
  return new ShaderMaterial({
    vertexShader: OBJECT_VERT,
    fragmentShader: ENVIRONMENT_UNLIT_FRAG,
    uniforms: {
      ...materialFogUniforms(fog, settings),
      _Color: { value: linearColor(color) },
      _ColorAlpha: { value: alpha },
    },
  });
}
