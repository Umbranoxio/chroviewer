import { z } from 'zod';

import {
  numberPoints,
  vector4Points,
  vectorPoints,
  type NumberPoint,
  type Vector4Point,
  type Vector4Tuple,
  type VectorPoint,
} from './animation/point-definition';
import {
  beatSaberBooleanSchema,
  beatSaberIntegerSchema,
  beatSaberJsonArraySchema,
  beatSaberJsonObjectSchema,
  beatSaberNumberSchema,
  beatSaberStringArraySchema,
  beatSaberStringSchema,
  beatSaberTrackSchema,
  beatSaberVector3Schema,
} from './beatmap/value-schema';

export type ChromaVector = readonly [number, number, number];
export type ChromaColor = Vector4Tuple;
export type ChromaVectorPoint = VectorPoint;
export type ChromaNumberPoint = NumberPoint;
export type ChromaColorPoint = Vector4Point;

export type ChromaGeometryType = 'Sphere' | 'Capsule' | 'Cylinder' | 'Cube' | 'Plane' | 'Quad' | 'Triangle';

export type ChromaShader =
  | 'Standard'
  | 'OpaqueLight'
  | 'TransparentLight'
  | 'BaseWater'
  | 'BillieWater'
  | 'BTSPillar'
  | 'InterscopeConcrete'
  | 'InterscopeCar'
  | 'Obstacle'
  | 'WaterfallMirror'
  | 'Glowing';

export type ChromaLookupMethod = 'Regex' | 'Exact' | 'Contains' | 'StartsWith' | 'EndsWith';

export interface ChromaMaterial {
  shader: ChromaShader;
  color?: ChromaColor;
  keywords?: string[];
  tracks: string[];
}

export interface ChromaGeometry {
  type: ChromaGeometryType;
  material: string | ChromaMaterial;
  collision: boolean;
}

export interface ChromaLightWithIdComponent {
  lightId?: number;
  type?: number;
}

export interface ChromaBloomFogComponent {
  attenuation?: number;
  offset?: number;
  startY?: number;
  height?: number;
}

export interface ChromaTubeBloomComponent {
  colorAlphaMultiplier?: number;
  bloomFogIntensityMultiplier?: number;
}

export interface ChromaComponents {
  ILightWithId?: ChromaLightWithIdComponent;
  BloomFogEnvironment?: ChromaBloomFogComponent;
  TubeBloomPrePassLight?: ChromaTubeBloomComponent;
}

export interface ChromaEnvironmentEnhancement {
  id?: string;
  lookupMethod: ChromaLookupMethod;
  geometry?: ChromaGeometry;
  track: string[];
  duplicate?: number;
  active?: boolean;
  scale?: ChromaVector;
  position?: ChromaVector;
  rotation?: ChromaVector;
  localPosition?: ChromaVector;
  localRotation?: ChromaVector;
  components?: ChromaComponents;
  lightId?: number;
  lightType?: number;
}

export interface ChromaTrackAnimation {
  jsonTime: number;
  songBpmTime: number;
  duration: number;
  durationSongBpmTime: number;
  track: string[];
  easing?: string;
  repeat: number;
  position?: ChromaVectorPoint[];
  localPosition?: ChromaVectorPoint[];
  rotation?: ChromaVectorPoint[];
  localRotation?: ChromaVectorPoint[];
  scale?: ChromaVectorPoint[];
  color?: ChromaColorPoint[];
  fogHeight?: ChromaNumberPoint[];
  fogStartY?: ChromaNumberPoint[];
  fogAttenuation?: ChromaNumberPoint[];
  fogOffset?: ChromaNumberPoint[];
}

export interface ChromaAnimatedBloomFogComponent {
  attenuation?: ChromaNumberPoint[];
  offset?: ChromaNumberPoint[];
  startY?: ChromaNumberPoint[];
  height?: ChromaNumberPoint[];
}

export interface ChromaAnimatedTubeBloomComponent {
  colorAlphaMultiplier?: ChromaNumberPoint[];
  bloomFogIntensityMultiplier?: ChromaNumberPoint[];
}

export interface ChromaAnimatedComponents {
  BloomFogEnvironment?: ChromaAnimatedBloomFogComponent;
  TubeBloomPrePassLight?: ChromaAnimatedTubeBloomComponent;
}

export interface ChromaComponentAnimation {
  jsonTime: number;
  songBpmTime: number;
  duration: number;
  durationSongBpmTime: number;
  track: string[];
  easing?: string;
  components: ChromaAnimatedComponents;
}

export interface ChromaFogTrackEvent {
  jsonTime: number;
  songBpmTime: number;
  track: string;
}

export interface ChromaEnvironmentData {
  version: 2 | 3;
  materials: Record<string, ChromaMaterial>;
  enhancements: ChromaEnvironmentEnhancement[];
  animations: ChromaTrackAnimation[];
  componentAnimations: ChromaComponentAnimation[];
  fogTrackEvents: ChromaFogTrackEvent[];
  fogTrack?: string;
}

export const EMPTY_CHROMA_ENVIRONMENT: ChromaEnvironmentData = {
  version: 2,
  materials: {},
  enhancements: [],
  animations: [],
  componentAnimations: [],
  fogTrackEvents: [],
};

const geometryTypeSchema = z.enum(['Sphere', 'Capsule', 'Cylinder', 'Cube', 'Plane', 'Quad', 'Triangle']);
const shaderSchema = z.enum([
  'Standard',
  'OpaqueLight',
  'TransparentLight',
  'BaseWater',
  'BillieWater',
  'BTSPillar',
  'InterscopeConcrete',
  'InterscopeCar',
  'Obstacle',
  'WaterfallMirror',
  'Glowing',
]);
const lookupMethodSchema = z.enum(['Regex', 'Exact', 'Contains', 'StartsWith', 'EndsWith']);
const optionalNumberSchema = z.preprocess(
  (value) => (value === null ? undefined : value),
  beatSaberNumberSchema.optional(),
);
const optionalIntegerSchema = z.preprocess(
  (value) => (value === null ? undefined : value),
  beatSaberIntegerSchema.optional(),
);
const optionalBooleanSchema = z.preprocess(
  (value) => (value === null ? undefined : value),
  beatSaberBooleanSchema.optional(),
);
const optionalStringSchema = z.preprocess(
  (value) => (value === null ? undefined : value),
  beatSaberStringSchema.optional(),
);
const optionalVectorSchema = beatSaberVector3Schema.optional().catch(undefined);
const colorSchema = z
  .array(z.json())
  .min(3)
  .transform(
    ([red, green, blue, alpha]) =>
      [
        beatSaberNumberSchema.parse(red),
        beatSaberNumberSchema.parse(green),
        beatSaberNumberSchema.parse(blue),
        alpha === undefined ? 1 : beatSaberNumberSchema.parse(alpha),
      ] as const,
  );
const optionalColorSchema = colorSchema.optional().catch(undefined);
const optionalKeywordsSchema = z.preprocess(
  (value) => (value === null ? undefined : value),
  beatSaberStringArraySchema.optional(),
);

const v2MaterialSchema = z
  .looseObject({
    _shader: shaderSchema,
    _color: optionalColorSchema,
    _shaderKeywords: optionalKeywordsSchema,
    _track: beatSaberTrackSchema,
  })
  .transform(
    (data): ChromaMaterial => ({
      shader: data._shader,
      color: data._color,
      keywords: data._shaderKeywords,
      tracks: data._track,
    }),
  );

const v3MaterialSchema = z
  .looseObject({
    shader: shaderSchema,
    color: optionalColorSchema,
    shaderKeywords: optionalKeywordsSchema,
    track: beatSaberTrackSchema,
  })
  .transform(
    (data): ChromaMaterial => ({
      shader: data.shader,
      color: data.color,
      keywords: data.shaderKeywords,
      tracks: data.track,
    }),
  );

const v2GeometrySchema = z
  .looseObject({
    _type: geometryTypeSchema,
    _material: z.union([z.string(), v2MaterialSchema]),
    _collision: beatSaberBooleanSchema,
  })
  .transform(
    (data): ChromaGeometry => ({
      type: data._type,
      material: data._material,
      collision: data._collision,
    }),
  );

const v3GeometrySchema = z
  .looseObject({
    type: geometryTypeSchema,
    material: z.union([z.string(), v3MaterialSchema]),
    collision: beatSaberBooleanSchema,
  })
  .transform(
    (data): ChromaGeometry => ({
      type: data.type,
      material: data.material,
      collision: data.collision,
    }),
  );

const lightWithIdSchema = z
  .looseObject({ lightID: optionalIntegerSchema, type: optionalIntegerSchema })
  .transform((data): ChromaLightWithIdComponent | undefined =>
    data.lightID === undefined && data.type === undefined ? undefined : { lightId: data.lightID, type: data.type },
  );
const bloomFogSchema = z
  .looseObject({
    attenuation: optionalNumberSchema,
    offset: optionalNumberSchema,
    startY: optionalNumberSchema,
    height: optionalNumberSchema,
  })
  .transform((data): ChromaBloomFogComponent | undefined =>
    Object.values(data).every((value) => value === undefined) ? undefined : data,
  );
const tubeBloomSchema = z
  .looseObject({
    colorAlphaMultiplier: optionalNumberSchema,
    bloomFogIntensityMultiplier: optionalNumberSchema,
  })
  .transform((data): ChromaTubeBloomComponent | undefined =>
    Object.values(data).every((value) => value === undefined) ? undefined : data,
  );
const componentsSchema = z
  .looseObject({
    ILightWithId: lightWithIdSchema.optional().catch(undefined),
    BloomFogEnvironment: bloomFogSchema.optional().catch(undefined),
    TubeBloomPrePassLight: tubeBloomSchema.optional().catch(undefined),
  })
  .transform((data): ChromaComponents | undefined =>
    Object.values(data).every((value) => value === undefined) ? undefined : data,
  );

const v2EnhancementSchema = z
  .looseObject({
    _id: optionalStringSchema,
    _lookupMethod: lookupMethodSchema.optional().catch(undefined),
    _geometry: v2GeometrySchema.optional().catch(undefined),
    _track: beatSaberTrackSchema,
    _duplicate: optionalIntegerSchema,
    _active: optionalBooleanSchema,
    _scale: optionalVectorSchema,
    _position: optionalVectorSchema,
    _rotation: optionalVectorSchema,
    _localPosition: optionalVectorSchema,
    _localRotation: optionalVectorSchema,
    _lightID: optionalIntegerSchema,
    _lightType: optionalIntegerSchema,
  })
  .refine((data) => data._geometry !== undefined || data._id !== undefined)
  .transform((data): ChromaEnvironmentEnhancement => {
    const components =
      data._lightID === undefined && data._lightType === undefined
        ? undefined
        : { ILightWithId: { lightId: data._lightID, type: data._lightType } };
    return {
      id: data._id,
      lookupMethod: data._lookupMethod ?? 'Contains',
      geometry: data._geometry,
      track: data._track,
      duplicate: data._duplicate,
      active: data._active,
      scale: data._scale,
      position: data._position,
      rotation: data._rotation,
      localPosition: data._localPosition,
      localRotation: data._localRotation,
      components,
      lightId: data._lightID,
      lightType: data._lightType,
    };
  });

const v3EnhancementSchema = z
  .looseObject({
    id: optionalStringSchema,
    lookupMethod: lookupMethodSchema.optional().catch(undefined),
    geometry: v3GeometrySchema.optional().catch(undefined),
    track: beatSaberTrackSchema,
    duplicate: optionalIntegerSchema,
    active: optionalBooleanSchema,
    scale: optionalVectorSchema,
    position: optionalVectorSchema,
    rotation: optionalVectorSchema,
    localPosition: optionalVectorSchema,
    localRotation: optionalVectorSchema,
    components: componentsSchema.optional().catch(undefined),
  })
  .refine((data) => data.geometry !== undefined || data.id !== undefined)
  .transform(
    (data): ChromaEnvironmentEnhancement => ({
      id: data.id,
      lookupMethod: data.lookupMethod ?? 'Exact',
      geometry: data.geometry,
      track: data.track,
      duplicate: data.duplicate,
      active: data.active,
      scale: data.scale,
      position: data.position,
      rotation: data.rotation,
      localPosition: data.localPosition,
      localRotation: data.localRotation,
      components: data.components,
      lightId: data.components?.ILightWithId?.lightId,
      lightType: data.components?.ILightWithId?.type,
    }),
  );

const pointValueSchema = z.json().optional();

interface TrackAnimationInput {
  track: string[];
  duration: number;
  easing?: string;
  repeat: number;
  position?: z.output<typeof pointValueSchema>;
  localPosition?: z.output<typeof pointValueSchema>;
  rotation?: z.output<typeof pointValueSchema>;
  localRotation?: z.output<typeof pointValueSchema>;
  scale?: z.output<typeof pointValueSchema>;
  color?: z.output<typeof pointValueSchema>;
  fogHeight?: z.output<typeof pointValueSchema>;
  fogStartY?: z.output<typeof pointValueSchema>;
  fogAttenuation?: z.output<typeof pointValueSchema>;
  fogOffset?: z.output<typeof pointValueSchema>;
}

const v2TrackAnimationSchema = z
  .looseObject({
    _track: beatSaberTrackSchema,
    _duration: beatSaberNumberSchema,
    _easing: optionalStringSchema,
    _position: pointValueSchema,
    _localPosition: pointValueSchema,
    _rotation: pointValueSchema,
    _localRotation: pointValueSchema,
    _scale: pointValueSchema,
    _color: pointValueSchema,
    _height: pointValueSchema,
    _startY: pointValueSchema,
    _attenuation: pointValueSchema,
    _offset: pointValueSchema,
  })
  .transform(
    (data): TrackAnimationInput => ({
      track: data._track,
      duration: data._duration,
      easing: data._easing,
      repeat: 0,
      position: data._position,
      localPosition: data._localPosition,
      rotation: data._rotation,
      localRotation: data._localRotation,
      scale: data._scale,
      color: data._color,
      fogHeight: data._height,
      fogStartY: data._startY,
      fogAttenuation: data._attenuation,
      fogOffset: data._offset,
    }),
  );

const v3TrackAnimationSchema = z
  .looseObject({
    track: beatSaberTrackSchema,
    duration: beatSaberNumberSchema,
    easing: optionalStringSchema,
    repeat: optionalIntegerSchema,
    position: pointValueSchema,
    localPosition: pointValueSchema,
    rotation: pointValueSchema,
    localRotation: pointValueSchema,
    scale: pointValueSchema,
    color: pointValueSchema,
    _height: pointValueSchema,
    _startY: pointValueSchema,
    _attenuation: pointValueSchema,
    _offset: pointValueSchema,
  })
  .transform(
    (data): TrackAnimationInput => ({
      track: data.track,
      duration: data.duration,
      easing: data.easing,
      repeat: Math.max(data.repeat ?? 0, 0),
      position: data.position,
      localPosition: data.localPosition,
      rotation: data.rotation,
      localRotation: data.localRotation,
      scale: data.scale,
      color: data.color,
      fogHeight: data._height,
      fogStartY: data._startY,
      fogAttenuation: data._attenuation,
      fogOffset: data._offset,
    }),
  );

const animatedBloomFogSchema = z.looseObject({
  attenuation: pointValueSchema,
  offset: pointValueSchema,
  startY: pointValueSchema,
  height: pointValueSchema,
});
const animatedTubeBloomSchema = z.looseObject({
  colorAlphaMultiplier: pointValueSchema,
  bloomFogIntensityMultiplier: pointValueSchema,
});
const componentAnimationSchema = z.looseObject({
  track: beatSaberTrackSchema,
  duration: beatSaberNumberSchema,
  easing: optionalStringSchema,
  BloomFogEnvironment: animatedBloomFogSchema.optional().catch(undefined),
  TubeBloomPrePassLight: animatedTubeBloomSchema.optional().catch(undefined),
});

const v2PointDefinitionSchema = z.looseObject({
  _name: optionalStringSchema,
  _points: beatSaberJsonArraySchema.catch([]),
});
const v2CustomEventSchema = z.looseObject({
  _time: beatSaberNumberSchema,
  _type: beatSaberStringSchema,
  _data: beatSaberJsonObjectSchema,
});
const v3CustomEventSchema = z.looseObject({
  b: beatSaberNumberSchema,
  t: beatSaberStringSchema,
  d: beatSaberJsonObjectSchema,
});

const v2ChromaSchema = z.looseObject({
  _pointDefinitions: z.array(v2PointDefinitionSchema.optional().catch(undefined)).catch([]),
  _materials: z.record(z.string(), v2MaterialSchema.optional().catch(undefined)).catch({}),
  _environment: z.array(v2EnhancementSchema.optional().catch(undefined)).catch([]),
  _customEvents: z.array(v2CustomEventSchema.optional().catch(undefined)).catch([]),
});

const v3ChromaSchema = z.looseObject({
  pointDefinitions: z.record(z.string(), beatSaberJsonArraySchema.optional().catch(undefined)).catch({}),
  materials: z.record(z.string(), v3MaterialSchema.optional().catch(undefined)).catch({}),
  environment: z.array(v3EnhancementSchema.optional().catch(undefined)).catch([]),
  customEvents: z.array(v3CustomEventSchema.optional().catch(undefined)).catch([]),
});

function points<T>(parsed: T[]) {
  return parsed.length === 0 ? undefined : parsed;
}

function parseTrackAnimation(
  time: number,
  data: TrackAnimationInput,
  definitions: Readonly<Record<string, unknown[]>>,
): ChromaTrackAnimation | undefined {
  if (data.track.length === 0) return undefined;
  return {
    jsonTime: time,
    songBpmTime: 0,
    duration: data.duration,
    durationSongBpmTime: 0,
    track: data.track,
    easing: data.easing,
    repeat: data.repeat,
    position: points(vectorPoints(data.position, definitions)),
    localPosition: points(vectorPoints(data.localPosition, definitions)),
    rotation: points(vectorPoints(data.rotation, definitions)),
    localRotation: points(vectorPoints(data.localRotation, definitions)),
    scale: points(vectorPoints(data.scale, definitions)),
    color: points(vector4Points(data.color, definitions)),
    fogHeight: points(numberPoints(data.fogHeight, definitions)),
    fogStartY: points(numberPoints(data.fogStartY, definitions)),
    fogAttenuation: points(numberPoints(data.fogAttenuation, definitions)),
    fogOffset: points(numberPoints(data.fogOffset, definitions)),
  };
}

function animatedBloomFog(
  data: z.output<typeof animatedBloomFogSchema> | undefined,
  definitions: Readonly<Record<string, unknown[]>>,
) {
  if (data === undefined) return undefined;
  const component: ChromaAnimatedBloomFogComponent = {
    attenuation: points(numberPoints(data.attenuation, definitions)),
    offset: points(numberPoints(data.offset, definitions)),
    startY: points(numberPoints(data.startY, definitions)),
    height: points(numberPoints(data.height, definitions)),
  };
  return Object.values(component).every((entry) => entry === undefined) ? undefined : component;
}

function animatedTubeBloom(
  data: z.output<typeof animatedTubeBloomSchema> | undefined,
  definitions: Readonly<Record<string, unknown[]>>,
) {
  if (data === undefined) return undefined;
  const component: ChromaAnimatedTubeBloomComponent = {
    colorAlphaMultiplier: points(numberPoints(data.colorAlphaMultiplier, definitions)),
    bloomFogIntensityMultiplier: points(numberPoints(data.bloomFogIntensityMultiplier, definitions)),
  };
  return Object.values(component).every((entry) => entry === undefined) ? undefined : component;
}

function parseComponentAnimation(
  time: number,
  data: z.output<typeof componentAnimationSchema>,
  definitions: Readonly<Record<string, unknown[]>>,
): ChromaComponentAnimation | undefined {
  if (data.track.length === 0) return undefined;
  const components: ChromaAnimatedComponents = {
    BloomFogEnvironment: animatedBloomFog(data.BloomFogEnvironment, definitions),
    TubeBloomPrePassLight: animatedTubeBloom(data.TubeBloomPrePassLight, definitions),
  };
  if (Object.values(components).every((entry) => entry === undefined)) return undefined;
  return {
    jsonTime: time,
    songBpmTime: 0,
    duration: data.duration,
    durationSongBpmTime: 0,
    track: data.track,
    easing: data.easing,
    components,
  };
}

function parseChromaEnvironment(input: unknown, version: 2 | 3): ChromaEnvironmentData {
  const v2 = version === 2;
  let definitions: Record<string, unknown[]>;
  let materials: Record<string, ChromaMaterial>;
  let enhancements: ChromaEnvironmentEnhancement[];
  let events: { time: number; type: string; data: z.output<typeof beatSaberJsonObjectSchema> }[];
  if (v2) {
    const parsed = v2ChromaSchema.safeParse(input);
    if (!parsed.success) return { ...EMPTY_CHROMA_ENVIRONMENT, version };
    const data = parsed.data;
    definitions = Object.fromEntries(
      data._pointDefinitions.flatMap((definition) =>
        definition?._name === undefined || definition._points.length === 0
          ? []
          : [[definition._name, definition._points]],
      ),
    );
    materials = Object.fromEntries(
      Object.entries(data._materials).flatMap(([name, material]) => (material === undefined ? [] : [[name, material]])),
    );
    enhancements = data._environment.filter((enhancement) => enhancement !== undefined);
    events = data._customEvents.flatMap((event) =>
      event === undefined ? [] : [{ time: event._time, type: event._type, data: event._data }],
    );
  } else {
    const parsed = v3ChromaSchema.safeParse(input);
    if (!parsed.success) return { ...EMPTY_CHROMA_ENVIRONMENT, version };
    const data = parsed.data;
    definitions = Object.fromEntries(
      Object.entries(data.pointDefinitions).flatMap(([name, definition]) =>
        definition === undefined || definition.length === 0 ? [] : [[name, definition]],
      ),
    );
    materials = Object.fromEntries(
      Object.entries(data.materials).flatMap(([name, material]) => (material === undefined ? [] : [[name, material]])),
    );
    enhancements = data.environment.filter((enhancement) => enhancement !== undefined);
    events = data.customEvents.flatMap((event) =>
      event === undefined ? [] : [{ time: event.b, type: event.t, data: event.d }],
    );
  }
  const animations: ChromaTrackAnimation[] = [];
  const componentAnimations: ChromaComponentAnimation[] = [];
  const fogTrackEvents: ChromaFogTrackEvent[] = [];
  for (const event of events) {
    if (event.type === 'AnimateTrack') {
      const animation = parseTrackAnimation(
        event.time,
        (v2 ? v2TrackAnimationSchema : v3TrackAnimationSchema).parse(event.data),
        definitions,
      );
      if (animation !== undefined) animations.push(animation);
      continue;
    }
    if (v2 && event.type === 'AssignFogTrack') {
      const track = beatSaberTrackSchema.parse(event.data._track)[0];
      if (track !== undefined) fogTrackEvents.push({ jsonTime: event.time, songBpmTime: 0, track });
      continue;
    }
    if (!v2 && event.type === 'AnimateComponent') {
      const animation = parseComponentAnimation(event.time, componentAnimationSchema.parse(event.data), definitions);
      if (animation !== undefined) componentAnimations.push(animation);
    }
  }
  animations.sort((left, right) => left.jsonTime - right.jsonTime);
  componentAnimations.sort((left, right) => left.jsonTime - right.jsonTime);
  fogTrackEvents.sort((left, right) => left.jsonTime - right.jsonTime);
  return {
    version,
    materials,
    enhancements,
    animations,
    componentAnimations,
    fogTrackEvents,
    fogTrack: fogTrackEvents.at(-1)?.track,
  };
}

export function parseV2ChromaEnvironment(input: unknown) {
  return parseChromaEnvironment(input, 2);
}

export function parseV3ChromaEnvironment(input: unknown) {
  return parseChromaEnvironment(input, 3);
}
