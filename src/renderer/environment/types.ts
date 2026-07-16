import type { EnvironmentColorScheme } from '../../core/colors';
import type { FogParams } from '../fog-math';
import type { AnimationCurveData } from './animation-curve';

export type MaterialFamily =
  | 'lit'
  | 'lightTubeOpaque'
  | 'lightTubeTransparent'
  | 'fakeGlow'
  | 'customParticles'
  | 'lightning'
  | 'depthOnly'
  | 'clouds'
  | 'mirror'
  | 'stencil'
  | 'skip'
  | 'unknown';

export interface EnvironmentMaterialData {
  name: string;
  shader: string;
  family: MaterialFamily;
  colors: Record<string, [number, number, number, number]>;
  floats: Record<string, number>;
  textures?: Record<string, EnvironmentTextureData>;
  keywords: string[];
}

export interface EnvironmentTextureData {
  asset: string;
  scale: [number, number];
  offset: [number, number];
}

export interface EnvironmentMeshData {
  positions: number[];
  normals?: number[];
  uvs?: number[];
  secondaryUvs?: number[];
  colors?: number[];
  indices: number[];
  groups?: { start: number; count: number; materialIndex: number }[];
}

export interface EnvironmentParticleSystemData {
  name: string;
  path: string;
  position: [number, number, number];
  rotation: [number, number, number, number];
  scale: [number, number, number];
  prewarm: boolean;
  maxParticles: number;
  rate: number;
  lifetime: [number, number];
  speed: [number, number];
  size: [number, number];
  rotationRange: [number, number];
  shapeType: number;
  shapeRadius: number;
  shapePosition: [number, number, number];
  shapeRotation: [number, number, number];
  shapeScale: [number, number, number];
  randomDirection: number;
  alphaKeys: [number, number][];
  texture: string;
  tint: [number, number, number, number];
  alphaChannelRed: boolean;
  squareAlpha: boolean;
  whiteBoost: boolean;
  brightness: number;
  alphaMultiplier: number;
  fogEnabled: boolean;
  heightFogEnabled: boolean;
  sortingOrder: number;
}

export interface PositionConstraintData {
  enabled: boolean;
  m_Weight: number;
  m_TranslationAtRest: [number, number, number];
  m_TranslationOffset: [number, number, number];
  m_AffectTranslationX: number;
  m_AffectTranslationY: number;
  m_AffectTranslationZ: number;
  m_Active: number;
  m_Sources: { sourceTransform: ObjectReference; weight: number }[];
}

export interface ObjectReference {
  obj: number;
  component?: keyof NonNullable<EnvironmentObjectData['components']>;
  componentIndex?: number;
}

export interface GenericCallbackEventEffectData {
  ID: number;
  enabled: boolean;
}

export interface ColorBoostEffectData {
  ID: number;
  enabled: boolean;
}

export interface GameObjectIntSwitchData {
  Effect: ObjectReference;
  GameObjectsValueContainers: {
    Value: number;
    GameObjects: ObjectReference[];
  }[];
  DefaultValue: number;
  enabled: boolean;
}

export interface GameObjectSwitchData {
  Effect: ObjectReference;
  NormalGameObjects: ObjectReference[];
  BoostGameObjects: ObjectReference[];
  enabled: boolean;
}

export interface BloomFogControllerData {
  ID: number;
  Length: number;
  Center: number;
  BloomFogIntensityMultiplier: number;
  LightWidthMultiplier: number;
  StartWidth: number;
  EndWidth: number;
  StartAlpha: number;
  EndAlpha: number;
  BoostToWhite: number;
  ColorAlphaMultiplier: number;
  FakeBloomIntensityMultiplier: number;
  Width: number;
  OverrideChildrenLength: number;
  AddWidthToLength: number;
  BakedGlowWidthScale: number;
  ThickenWithDistance: number;
  ThickenCurve: AnimationCurveData;
  MinDistance: number;
  MaxDistance: number;
  MinWidthMultiplier: number;
  MaxWidthMultiplier: number;
  DisableRenderersOnZeroAlpha: number;
  MultiplyLengthByAlpha: number;
  AlphaToLengthCurve: AnimationCurveData;
  AlphaToLengthBloomFogCurve: AnimationCurveData;
  LimitAlpha: number;
  MinAlpha: number;
  MaxAlpha: number;
  OverrideChildrenAlpha: number;
  OverrideChildrenWidth: number;
  BoxLight: ObjectReference | null;
  SpriteLight: ObjectReference | null;
  BlendMode?: 'add' | 'max';
  enabled: boolean;
}

export interface ParametricBoxLightData {
  Width: number;
  Height: number;
  Length: number;
  Center: number;
  AlphaStart: number;
  AlphaEnd: number;
  WidthStart: number;
  WidthEnd: number;
  enabled: boolean;
}

export interface ParametricSpriteLightData {
  WidthMultiplier: number;
  Width: number;
  Length: number;
  Center: number;
  AlphaStart: number;
  AlphaEnd: number;
  WidthStart: number;
  WidthEnd: number;
  enabled: boolean;
}

export interface ColliderFxData {
  Collider: ObjectReference;
  Value: number;
  enabled: boolean;
}

export interface BoxColliderData {
  Center: [number, number, number];
  Size: [number, number, number];
  enabled: boolean;
}

export interface MeshColliderData {
  Mesh: string;
  enabled: boolean;
}

export interface ReflectedLightData {
  Light: ObjectReference;
  ShowHitPoint: number;
  HitPointGameObject: ObjectReference;
  HitPointTransform: ObjectReference;
  HitPointLightWithId: ObjectReference;
  HitPointDistanceToAlphaCurve: AnimationCurveData;
}

export interface LightReflectionData {
  MainParametricLight: ReflectedLightData;
  ParametricLightReflection: ReflectedLightData[];
  enabled: boolean;
}

export interface BasicLightEffectData {
  ID: number;
  OffIntensity: number;
  LightOnStart: number;
  InvertColorScheme: number;
  LightIdRemapEntries: [number, number][];
  lightEntries: ObjectReference[];
  enabled: boolean;
}

export interface LightRotationEffectData {
  ID: number;
  enabled: boolean;
}

export interface LightRotationData {
  Effect: ObjectReference;
  Transform: ObjectReference;
  StartRotation: [number, number, number, number];
  RotationVector: [number, number, number];
  SpeedMultiplier: number;
  enabled: boolean;
}

export interface TrackLaneRingData {
  PositionOffset: [number, number, number];
  PositionZ: number;
  enabled: boolean;
}

export interface TrackLaneRingsManagerData {
  Rings: ObjectReference[];
  RingPositionStep: number;
  SpawnAsChildren: number;
  enabled: boolean;
}

export interface TrackLaneRingsRotationData {
  Manager: ObjectReference;
  StartupRotationAngle: number;
  StartupRotationStep: number;
  StartupRotationPropagationSpeed: number;
  StartupRotationFlexySpeed: number;
  RotationStep: number;
  CounterSpin: number;
  enabled: boolean;
}

export interface TrackLaneRingsRotationEffectData {
  ID: number;
  Effect: ObjectReference;
  Rotation: number;
  Step: number;
  StepType: number;
  PropagationSpeed: number;
  FlexySpeed: number;
  enabled: boolean;
}

export interface TrackLaneRingsPositionEffectData {
  ID: number;
  enabled: boolean;
}

export interface TrackLaneRingsPositionSpawnerData {
  RingManager: ObjectReference;
  EffectManager: ObjectReference;
  MinPositionStep: number;
  MaxPositionStep: number;
  MoveSpeed: number;
  enabled: boolean;
}

export interface GroupEffectManagerData {
  effectEntries: { Group: number; Effect: ObjectReference }[];
  enabled: boolean;
}

export interface LightColorGroupEffectData {
  ID: number;
  Count: number;
  lightEntries: ObjectReference[];
  enabled: boolean;
}

export interface TransformEntryData {
  ID: number;
  Transforms: ObjectReference[];
  Axis: number;
  Mirrored: number;
}

export interface LightRotationGroupEffectData {
  ID: number;
  Count: number;
  transformEntries: TransformEntryData[];
  enabled: boolean;
}

export interface LightPairRotationData {
  LeftEffect: ObjectReference;
  RightEffect: ObjectReference;
  SwitchEffect: ObjectReference | null;
  Transforms: { Transform: ObjectReference }[];
  RotationVector: [number, number, number];
  OverrideRandomValues: number;
  UseZPositionForAngleOffset: number;
  ZPositionAngleOffsetScale: number;
  StartRotation: number;
  enabled: boolean;
}

export interface LightTranslationGroupEffectData extends LightRotationGroupEffectData {
  TranslationLimits: [number, number][];
  DistributionLimits: [number, number][];
}

export interface FloatFxGroupEffectData {
  ID: number;
  Count: number;
  Trigger: number;
  fxEntries: { ID: number; Targets: ObjectReference[] }[];
  enabled: boolean;
}

export interface VertexDisplacementFxData {
  Ranges: [number, number, number];
  XCurve: AnimationCurveData;
  YCurve: AnimationCurveData;
  ZCurve: AnimationCurveData;
  enabled: boolean;
}

export interface BackgroundGradientControllerData {
  ID: number;
  LightIntensity: number;
  Intensity: number;
  MaxIntensity: number;
  MultiplyColorByAlpha: number;
  MixType: number;
  TintColor: [number, number, number, number];
  Elements: {
    color: [number, number, number, number];
    startT: number;
    exp: number;
  }[];
  enabled: boolean;
}

export interface GroupLightControllerData {
  ID: number;
  Intensity?: number;
  enabled: boolean;
}

export interface DirectionalLightData {
  Color: [number, number, number, number];
  Intensity: number;
  Radius: number;
  enabled: boolean;
}

export interface DirectionalLightsControllerData {
  LightIntensityData: ObjectReference[];
  Intensity: number;
  MaxIntensity: number;
  MultiplyColorByAlpha: number;
  MixType: number;
  Light: ObjectReference;
  SetIntensityOnly: number;
  DefaultColor: [number, number, number, number];
  enabled: boolean;
}

export interface MaterialLightControllerData extends GroupLightControllerData {
  Renderer: ObjectReference | null;
  SetAlphaOnly: number;
  AlphaIntensity: number;
  AlphaIntoColor: number;
  SetColorOnly: number;
  MultiplyColorWithAlpha: number;
  MultiplyColor: number;
  ColorMultiplier: number;
  Alpha: number;
  Property: string;
}

export interface InstancedMaterialLightControllerData extends GroupLightControllerData {
  MpbColorSetter: ObjectReference;
  Intensity: number;
  HDR: number;
  MinAlpha: number;
  SetColorOnly: number;
  MultiplyColorByAlpha: number;
  SaturateIntensity: number;
}

export interface SpriteLightControllerData extends GroupLightControllerData {
  Renderer: ObjectReference | null;
  HideIfAlphaOutOfRange: number;
  HideAlphaRangeMin: number;
  HideAlphaRangeMax: number;
  Intensity: number;
  MinAlpha: number;
  MultiplyColorByAlpha: number;
  SetColorOnly: number;
  SetAlphaOnly: number;
}

export interface MaterialPropertyBlockColorSetterData {
  Controller: ObjectReference;
  Property: string;
  MultiplyWithAlpha: number;
  enabled: boolean;
}

export interface MaterialPropertyBlockControllerData {
  Renderers: ObjectReference[];
  enabled: boolean;
}

export interface MaterialPropertyBlockFloatSetterData {
  Controller: ObjectReference;
  Values: Record<string, number>;
  enabled: boolean;
}

export interface MaterialPropertyBlockPositionAnimatorData {
  Controller: ObjectReference;
  Property: string;
  TargetTransform: ObjectReference;
  enabled: boolean;
}

export interface RectangleFakeGlowLightControllerData extends GroupLightControllerData {
  MpbController: ObjectReference;
  MinAlpha: number;
  AlphaMultiplier: number;
  Size: [number, number];
  EdgeSize: number;
}

export interface MpbFxData {
  MpbController: ObjectReference;
  PropertyName: string;
  ValueBounds: [number, number];
  GranularityMultiplier: number;
  enabled: boolean;
}

export interface MpbArrayFxData extends Omit<MpbFxData, 'MpbController'> {
  MpbControllers: ObjectReference[];
}

export interface LocalScaleFxData {
  TargetTransforms: ObjectReference[];
  ValueBounds: [number, number];
  enabled: boolean;
}

export interface MoveInDirectionFxData {
  TargetTransform: ObjectReference;
  MoveOrigin: [number, number, number];
  MoveScale: number;
  enabled: boolean;
}

export interface AlphaFxData {
  MpbControllers: ObjectReference[];
  Property: string;
  StaticColor: [number, number, number, number];
  enabled: boolean;
}

export interface SwitchGameObjectFxData {
  GameObjectA: ObjectReference;
  GameObjectB: ObjectReference;
  enabled: boolean;
}

export interface SwitchGameObjectArrayFxData {
  GameObjects: { Threshold: number; GameObject: ObjectReference }[];
  enabled: boolean;
}

export interface CollectionFxData {
  Targets: ObjectReference[];
  enabled: boolean;
}

export interface ParametricSliceEndWidthFxData {
  SpriteLight: ObjectReference;
  ValueBounds: [number, number];
  ValueMultiplier: number;
  enabled: boolean;
}

export interface EnvironmentObjectData {
  name: string;
  parent: number;
  active: boolean;
  position: [number, number, number];
  rotation: [number, number, number, number];
  scale: [number, number, number];
  mesh?: string;
  materials?: (string | null)[];
  rendererEnabled?: boolean;
  components?: {
    ChromaIDMarker?: { ChromaID: string; enabled: boolean }[];
    ParametricBloomFogLightController?: BloomFogControllerData[];
    ParametricBoxLight?: ParametricBoxLightData[];
    ParametricSpriteLight?: ParametricSpriteLightData[];
    BasicLightEffect?: BasicLightEffectData[];
    ColorBoostEffect?: ColorBoostEffectData[];
    GenericCallbackEventEffect?: GenericCallbackEventEffectData[];
    GameObjectIntSwitch?: GameObjectIntSwitchData[];
    GameObjectSwitch?: GameObjectSwitchData[];
    LightRotationEffect?: LightRotationEffectData[];
    LightRotation?: LightRotationData[];
    LightPairRotation?: LightPairRotationData[];
    TrackLaneRing?: TrackLaneRingData[];
    TrackLaneRingsManager?: TrackLaneRingsManagerData[];
    TrackLaneRingsRotation?: TrackLaneRingsRotationData[];
    TrackLaneRingsRotationEffect?: TrackLaneRingsRotationEffectData[];
    TrackLaneRingsPositionEffect?: TrackLaneRingsPositionEffectData[];
    TrackLaneRingsPositionSpawner?: TrackLaneRingsPositionSpawnerData[];
    LightColorGroupEffectManager?: GroupEffectManagerData[];
    LightRotationGroupEffectManager?: GroupEffectManagerData[];
    LightTranslationGroupEffectManager?: GroupEffectManagerData[];
    FloatFxGroupEffectManager?: GroupEffectManagerData[];
    LightColorGroupEffect?: LightColorGroupEffectData[];
    LightRotationGroupEffect?: LightRotationGroupEffectData[];
    LightTranslationGroupEffect?: LightTranslationGroupEffectData[];
    FloatFxGroupEffect?: FloatFxGroupEffectData[];
    MaterialLightController?: MaterialLightControllerData[];
    InstancedMaterialLightController?: InstancedMaterialLightControllerData[];
    SpriteLightController?: SpriteLightControllerData[];
    LightIntensityController?: GroupLightControllerData[];
    DirectionalLight?: DirectionalLightData[];
    DirectionalLightsController?: DirectionalLightsControllerData[];
    LightSink?: GroupLightControllerData[];
    MaterialPropertyBlockController?: MaterialPropertyBlockControllerData[];
    MaterialPropertyBlockFloatSetter?: MaterialPropertyBlockFloatSetterData[];
    MaterialPropertyBlockPositionAnimator?: MaterialPropertyBlockPositionAnimatorData[];
    RectangleFakeGlowLightController?: RectangleFakeGlowLightControllerData[];
    MaterialPropertyBlockColorSetter?: MaterialPropertyBlockColorSetterData[];
    MpbFx?: MpbFxData[];
    MpbArrayFx?: MpbArrayFxData[];
    LocalScaleFx?: LocalScaleFxData[];
    MoveInDirectionFx?: MoveInDirectionFxData[];
    AlphaFx?: AlphaFxData[];
    SwitchGameObjectFx?: SwitchGameObjectFxData[];
    SwitchGameObjectArrayFx?: SwitchGameObjectArrayFxData[];
    CollectionFx?: CollectionFxData[];
    ParametricSliceEndWidthFx?: ParametricSliceEndWidthFxData[];
    VertexDisplacementFx?: VertexDisplacementFxData[];
    BackgroundGradientController?: BackgroundGradientControllerData[];
    PositionConstraint?: PositionConstraintData[];
    ColliderFx?: ColliderFxData[];
    BoxCollider?: BoxColliderData[];
    MeshCollider?: MeshColliderData[];
    LightReflection?: LightReflectionData[];
    PlanarReflection?: object[];
  };
}

export interface EnvironmentData {
  version: number;
  id: string;
  title: string;
  colorScheme: EnvironmentColorScheme;
  fogParams: FogParams;
  meshes: Record<string, EnvironmentMeshData>;
  materials: Record<string, EnvironmentMaterialData>;
  reflectionProbe?: [string, string, string, string, string, string];
  particleSystems?: EnvironmentParticleSystemData[];
  objects: EnvironmentObjectData[];
}
