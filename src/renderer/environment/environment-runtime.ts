import type { CubeTexture, Group, Object3D, ShaderMaterial, Vector3, Vector4 } from 'three';

import type { ChromaEnvironmentData } from '../../core/chroma-environment';
import type { Rgb } from '../../core/colors';
import type { RingPositionConfig, RingRotationConfig } from '../../core/lighting/ring-motion';
import type { LightSegment } from '../bloomfog/light-quads';
import type { BloomFogControllerData, EnvironmentData } from './types';

export interface EnvironmentBackgroundGradient {
  ramp: Uint8Array;
  tint: [number, number, number, number];
}

export interface LoadedEnvironment {
  root: Group;
  lightSegments: EnvironmentLightSegment[];
  materialLights: EnvironmentMaterialLight[];
  backgroundGradient: EnvironmentBackgroundGradient | null;
  rotations: EnvironmentRotation[];
  ringGroups: EnvironmentRingGroup[];
  glsColorGroups: EnvironmentGlsColorGroup[];
  glsRotationGroups: EnvironmentGlsRotationGroup[];
  glsTranslationGroups: EnvironmentGlsTranslationGroup[];
  glsFxGroups: EnvironmentGlsFxGroup[];
  eventSwitches: EnvironmentEventSwitch[];
  boostSwitches: EnvironmentBoostSwitch[];
  directionalLights: EnvironmentDirectionalLight[];
  bakedReflectionProbe?: EnvironmentBakedReflectionProbe;
  data: EnvironmentData;
  chromaEnvironment?: ChromaEnvironmentData;
  chromaTracks?: Map<string, Object3D[]>;
  chromaMaterialTracks?: Map<string, ShaderMaterial[]>;
  chromaFogTracks?: Set<string>;
  chromaTubeTracks?: Map<string, EnvironmentChromaTubeTarget[]>;
  applyChromaRemoval: (ids: readonly string[]) => void;
  enforceChromaRemoval: () => void;
  applyConstraints: () => boolean;
  syncInstancedMeshes: () => void;
  applyReflections: (segments: EnvironmentLightSegment[]) => void;
  dispose: () => void;
}

export interface EnvironmentBakedReflectionProbe {
  textures: [CubeTexture, CubeTexture];
  position: Vector3;
  boxMin: Vector3;
  boxMax: Vector3;
  lightColors: Vector4[];
  lights: NonNullable<EnvironmentData['bakedReflectionProbe']>['lights'];
}

export interface EnvironmentChromaTubeTarget {
  segments: EnvironmentLightSegment[];
  materialLights: EnvironmentMaterialLight[];
}

export interface EnvironmentDirectionalLight {
  node: Object3D;
  color: Rgb;
  intensity: number;
  controllerIntensity: number;
  radius: number;
  maxIntensity: number;
  multiplyColorByAlpha: boolean;
  mixType: number;
  inputs: { binding: EnvironmentLightBinding; intensity: number }[];
}

export interface EnvironmentGlsColorTarget {
  id: number;
  node?: Object3D;
  materials: ShaderMaterial[];
  colorProperty: string;
  segments: EnvironmentLightSegment[];
  materialLights: EnvironmentMaterialLight[];
  transform: (color: Rgb, alpha: number) => { color: Rgb; alpha: number; visible: boolean };
}

export interface EnvironmentGlsColorGroup {
  groupId: number;
  count: number;
  targets: EnvironmentGlsColorTarget[];
}

export interface EnvironmentGlsTransformEntry {
  id: number;
  axis: number;
  mirrored: boolean;
  targets: Object3D[];
}

export interface EnvironmentGlsRotationGroup {
  groupId: number;
  count: number;
  entries: EnvironmentGlsTransformEntry[];
}

export interface EnvironmentGlsTranslationGroup extends EnvironmentGlsRotationGroup {
  translationLimits: [number, number][];
  distributionLimits: [number, number][];
}

export interface EnvironmentGlsFxGroup {
  groupId: number;
  count: number;
  trigger: boolean;
  entries: { id: number; targets: EnvironmentGlsFxTarget[] }[];
}

export interface EnvironmentGlsFxTarget {
  apply: (value: number) => void;
  reset: () => void;
}

export interface EnvironmentEventSwitch {
  eventType: number;
  defaultValue: number;
  apply: (value: number) => void;
}

export interface EnvironmentBoostSwitch {
  apply: (boosted: boolean) => void;
}

export interface EnvironmentLightBinding {
  eventType: number;
  offIntensity: number;
  lightOnStart: boolean;
  invertColorScheme: boolean;
  lightId: number;
  lightIdRemap: [number, number][];
}

export interface EnvironmentLightSegment extends LightSegment {
  bindings: EnvironmentLightBinding[];
  node: Object3D;
  localStart: [number, number, number];
  localEnd: [number, number, number];
  baseLength: number;
  center: number;
  multiplyLengthByAlpha: boolean;
  alphaToLengthCurve: BloomFogControllerData['AlphaToLengthCurve'];
  alphaToBloomLengthCurve: BloomFogControllerData['AlphaToLengthBloomFogCurve'];
}

export interface EnvironmentMaterialLight {
  materials: ShaderMaterial[];
  bindings: EnvironmentLightBinding[];
  intensityMultiplier: number;
  initialVisible?: boolean;
  combined?: {
    inputs: { bindings: EnvironmentLightBinding[]; intensity: number }[];
    intensity: number;
    maxIntensity: number;
    multiplyColorByAlpha: boolean;
    mixType: number;
    setAlphaOnly: boolean;
    alphaIntoColor: boolean;
    setColorOnly: boolean;
  };
  minimumAlpha?: number;
  applyAlpha?: (alpha: number) => void;
  node?: Object3D;
  transform?: EnvironmentGlsColorTarget['transform'];
  colorProperty?: string;
}

export interface EnvironmentRotation {
  target: Object3D;
  eventType: number;
  startRotation: [number, number, number, number];
  axis: [number, number, number];
  speedMultiplier: number;
  seed: number;
  pair?: { mirrored: boolean; startAngle: number };
}

export interface EnvironmentRingGroup {
  rings: { target: Object3D; positionOffset: [number, number, number] }[];
  rotationEventType?: number;
  rotationConfig?: RingRotationConfig;
  initialRotations: number[];
  positionEventType?: number;
  positionConfig?: RingPositionConfig;
  seed: number;
}
