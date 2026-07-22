import { z } from 'zod';

import {
  numberPoints,
  rotationPoints,
  vector4Points,
  vectorPoints,
  type NumberPoint,
  type QuaternionTuple,
  type RotationPoint,
  type Vector3Tuple,
  type Vector4Point,
  type VectorPoint,
} from './animation/point-definition';
import type { BeatmapCustomData } from './beatmap/types';
import {
  beatSaberBooleanSchema,
  beatSaberJsonObjectSchema as dataSchema,
  beatSaberNumberSchema,
  beatSaberStringSchema,
  beatSaberTrackSchema,
  beatSaberVector3Schema,
} from './beatmap/value-schema';

type Animated<T> = T[] | null;
type PartialVector3 = readonly [number | undefined, number | undefined, number | undefined];

export interface NoodleAnimationProperties {
  position?: Animated<VectorPoint>;
  localPosition?: Animated<VectorPoint>;
  rotation?: Animated<RotationPoint>;
  offsetPosition?: Animated<VectorPoint>;
  offsetWorldRotation?: Animated<RotationPoint>;
  scale?: Animated<VectorPoint>;
  localRotation?: Animated<RotationPoint>;
  dissolve?: Animated<NumberPoint>;
  dissolveArrow?: Animated<NumberPoint>;
  interactable?: Animated<NumberPoint>;
  definitePosition?: Animated<VectorPoint>;
  color?: Animated<Vector4Point>;
  time?: Animated<NumberPoint>;
}

export interface NoodleTrackEvent {
  jsonTime: number;
  songBpmTime: number;
  order?: number;
  type: 'AnimateTrack' | 'AssignPathAnimation';
  tracks: string[];
  duration: number;
  durationSongBpmTime: number;
  easing?: string;
  repeat: number;
  animation: NoodleAnimationProperties;
}

export interface NoodleParentTransform {
  position?: Vector3Tuple;
  localPosition?: Vector3Tuple;
  rotation?: QuaternionTuple;
  localRotation?: QuaternionTuple;
  scale?: Vector3Tuple;
}

export interface NoodleParentEvent {
  jsonTime: number;
  songBpmTime: number;
  order?: number;
  parentTrack: string;
  childrenTracks: string[];
  worldPositionStays: boolean;
  transform: NoodleParentTransform;
}

export interface NoodlePlayerEvent {
  jsonTime: number;
  songBpmTime: number;
  order?: number;
  track: string;
  target: string;
}

export interface NoodleBeatmapData {
  version: 2 | 3;
  pointDefinitions: Record<string, unknown[]>;
  trackEvents: NoodleTrackEvent[];
  parentEvents: NoodleParentEvent[];
  playerEvents: NoodlePlayerEvent[];
  localSpaceSaberTrail: boolean;
}

export interface NoodleObjectData {
  tracks: string[];
  animation?: NoodleAnimationProperties;
  localRotation?: QuaternionTuple;
  scale?: PartialVector3;
  obstacleSize?: PartialVector3;
  link?: string;
  uninteractable: boolean;
  disableGravity: boolean;
  disableLook: boolean;
  noteJumpSpeed?: number;
  noteSpawnOffset?: number;
}

export const EMPTY_NOODLE_BEATMAP: NoodleBeatmapData = {
  version: 3,
  pointDefinitions: {},
  trackEvents: [],
  parentEvents: [],
  playerEvents: [],
  localSpaceSaberTrail: false,
};

const optionalVectorSchema = beatSaberVector3Schema.optional().catch(undefined);
const v2PointDefinitionSchema = z.object({
  _name: beatSaberStringSchema,
  _points: z.array(z.unknown()),
});
// missing fields default like the game's SimpleJSON reads: time 0, type "", data {}
const v2EventSchema = z.object({
  _time: beatSaberNumberSchema.optional(),
  _type: beatSaberStringSchema.optional(),
  _data: dataSchema.optional().catch(undefined),
});
const v3EventSchema = z.object({
  b: beatSaberNumberSchema.optional(),
  t: beatSaberStringSchema.optional(),
  d: dataSchema.optional().catch(undefined),
});
const v2BeatmapSchema = z.object({
  _pointDefinitions: z.array(v2PointDefinitionSchema).optional().catch(undefined),
  _customEvents: z.array(v2EventSchema.optional().catch(undefined)).optional().catch(undefined),
  _localSpaceSaberTrail: z.unknown().optional(),
});
const v3BeatmapSchema = z.object({
  pointDefinitions: z.record(z.string(), z.array(z.unknown())).optional().catch(undefined),
  customEvents: z.array(v3EventSchema.optional().catch(undefined)).optional().catch(undefined),
  _localSpaceSaberTrail: z.unknown().optional(),
});

function partialVector(value: unknown): PartialVector3 | undefined {
  if (!Array.isArray(value)) return undefined;
  const result = [
    value[0] == null ? undefined : beatSaberNumberSchema.parse(value[0]),
    value[1] == null ? undefined : beatSaberNumberSchema.parse(value[1]),
    value[2] == null ? undefined : beatSaberNumberSchema.parse(value[2]),
  ] as const;
  return result.every((entry) => entry === undefined) ? undefined : result;
}

function rotation(value: unknown) {
  return rotationPoints(value)[0]?.value;
}

function animated<T>(
  data: Readonly<Record<string, unknown>>,
  name: string,
  definitions: Readonly<Record<string, unknown[]>>,
  parse: (value: unknown, definitions: Readonly<Record<string, unknown[]>>) => T[],
): Animated<T> | undefined {
  if (!(name in data)) return undefined;
  if (data[name] === null) return null;
  const result = parse(data[name], definitions);
  return result.length === 0 ? undefined : result;
}

function animationProperties(
  data: Readonly<Record<string, unknown>>,
  definitions: Readonly<Record<string, unknown[]>>,
  v2: boolean,
  objectAnimation = false,
) {
  const animation: NoodleAnimationProperties = {};
  const set = <K extends keyof NoodleAnimationProperties>(key: K, value: NoodleAnimationProperties[K]) => {
    if (value !== undefined) animation[key] = value;
  };

  if (v2) {
    const position = animated(data, '_position', definitions, vectorPoints);
    const rotation = animated(data, '_rotation', definitions, rotationPoints);
    set('offsetPosition', position);
    set('offsetWorldRotation', rotation);
    if (!objectAnimation) {
      set('position', position);
      set('rotation', rotation);
    }
    set('scale', animated(data, '_scale', definitions, vectorPoints));
    set('localRotation', animated(data, '_localRotation', definitions, rotationPoints));
    set('dissolve', animated(data, '_dissolve', definitions, numberPoints));
    set('dissolveArrow', animated(data, '_dissolveArrow', definitions, numberPoints));
    set('interactable', animated(data, '_interactable', definitions, numberPoints));
    set('definitePosition', animated(data, '_definitePosition', definitions, vectorPoints));
    set('color', animated(data, '_color', definitions, vector4Points));
    if (!objectAnimation) set('time', animated(data, '_time', definitions, numberPoints));
    return animation;
  }

  if (!objectAnimation) {
    set('position', animated(data, 'position', definitions, vectorPoints));
    set('localPosition', animated(data, 'localPosition', definitions, vectorPoints));
    set('rotation', animated(data, 'rotation', definitions, rotationPoints));
  }
  set('offsetPosition', animated(data, 'offsetPosition', definitions, vectorPoints));
  set('offsetWorldRotation', animated(data, 'offsetWorldRotation', definitions, rotationPoints));
  set('scale', animated(data, 'scale', definitions, vectorPoints));
  set('localRotation', animated(data, 'localRotation', definitions, rotationPoints));
  set('dissolve', animated(data, 'dissolve', definitions, numberPoints));
  set('dissolveArrow', animated(data, 'dissolveArrow', definitions, numberPoints));
  set('interactable', animated(data, 'interactable', definitions, numberPoints));
  set('definitePosition', animated(data, 'definitePosition', definitions, vectorPoints));
  set('color', animated(data, 'color', definitions, vector4Points));
  if (!objectAnimation) set('time', animated(data, 'time', definitions, numberPoints));
  return animation;
}

function parentTransform(data: Readonly<Record<string, unknown>>, v2: boolean): NoodleParentTransform {
  if (v2) {
    return {
      position: optionalVectorSchema.parse(data._position),
      rotation: rotation(data._rotation),
      localRotation: rotation(data._localRotation),
      scale: optionalVectorSchema.parse(data._scale),
    };
  }
  return {
    position: optionalVectorSchema.parse(data.position),
    localPosition: optionalVectorSchema.parse(data.localPosition),
    rotation: rotation(data.rotation),
    localRotation: rotation(data.localRotation),
    scale: optionalVectorSchema.parse(data.scale),
  };
}

function parseEvents(
  events: readonly { time: number; type: string; data: Readonly<Record<string, unknown>> }[],
  definitions: Readonly<Record<string, unknown[]>>,
  v2: boolean,
) {
  const trackEvents: NoodleTrackEvent[] = [];
  const parentEvents: NoodleParentEvent[] = [];
  const playerEvents: NoodlePlayerEvent[] = [];
  for (const [order, event] of events.entries()) {
    const data = event.data;
    if (event.type === 'AnimateTrack' || event.type === 'AssignPathAnimation') {
      const eventTracks = beatSaberTrackSchema.parse(data[v2 ? '_track' : 'track']);
      if (eventTracks.length === 0) continue;
      const eventEasing = data[v2 ? '_easing' : 'easing'];
      trackEvents.push({
        jsonTime: event.time,
        songBpmTime: 0,
        order,
        type: event.type,
        tracks: eventTracks,
        duration: beatSaberNumberSchema.parse(data[v2 ? '_duration' : 'duration']),
        durationSongBpmTime: 0,
        easing: typeof eventEasing === 'string' ? eventEasing : undefined,
        repeat: v2 ? 0 : Math.max(Math.trunc(beatSaberNumberSchema.parse(data.repeat)), 0),
        animation: animationProperties(data, definitions, v2),
      });
      continue;
    }
    if (event.type === 'AssignTrackParent') {
      const parentTrack = data[v2 ? '_parentTrack' : 'parentTrack'];
      if (typeof parentTrack !== 'string') continue;
      parentEvents.push({
        jsonTime: event.time,
        songBpmTime: 0,
        order,
        parentTrack,
        childrenTracks: beatSaberTrackSchema.parse(data[v2 ? '_childrenTracks' : 'childrenTracks']),
        worldPositionStays: beatSaberBooleanSchema.parse(data[v2 ? '_worldPositionStays' : 'worldPositionStays']),
        transform: parentTransform(data, v2),
      });
      continue;
    }
    if (event.type === 'AssignPlayerToTrack') {
      const track = data[v2 ? '_track' : 'track'];
      const target = data[v2 ? '_target' : 'target'];
      if (typeof track !== 'string') continue;
      playerEvents.push({
        jsonTime: event.time,
        songBpmTime: 0,
        order,
        track,
        target: typeof target === 'string' ? target : 'Root',
      });
    }
  }
  const byTime = (left: { jsonTime: number; order?: number }, right: { jsonTime: number; order?: number }) =>
    left.jsonTime - right.jsonTime || (left.order ?? 0) - (right.order ?? 0);
  trackEvents.sort(byTime);
  parentEvents.sort(byTime);
  playerEvents.sort(byTime);
  return { trackEvents, parentEvents, playerEvents };
}

export function parseNoodleBeatmap(input: unknown, majorVersion: number): NoodleBeatmapData {
  const version = majorVersion === 2 ? 2 : 3;
  if (version === 2) {
    const parsed = v2BeatmapSchema.safeParse(input);
    if (!parsed.success) return { ...EMPTY_NOODLE_BEATMAP, version };
    const pointDefinitions = Object.fromEntries(
      (parsed.data._pointDefinitions ?? []).map((definition) => [definition._name, definition._points]),
    );
    const events = (parsed.data._customEvents ?? []).flatMap((event) =>
      event === undefined ? [] : [{ time: event._time ?? 0, type: event._type ?? '', data: event._data ?? {} }],
    );
    return {
      version,
      pointDefinitions,
      ...parseEvents(events, pointDefinitions, true),
      localSpaceSaberTrail: beatSaberBooleanSchema.parse(parsed.data._localSpaceSaberTrail),
    };
  }
  const parsed = v3BeatmapSchema.safeParse(input);
  if (!parsed.success) return { ...EMPTY_NOODLE_BEATMAP, version };
  const pointDefinitions = parsed.data.pointDefinitions ?? {};
  const events = (parsed.data.customEvents ?? []).flatMap((event) =>
    event === undefined ? [] : [{ time: event.b ?? 0, type: event.t ?? '', data: event.d ?? {} }],
  );
  return {
    version,
    pointDefinitions,
    ...parseEvents(events, pointDefinitions, false),
    localSpaceSaberTrail: beatSaberBooleanSchema.parse(parsed.data._localSpaceSaberTrail),
  };
}

export function parseNoodleObject(
  customData: BeatmapCustomData | undefined,
  majorVersion: number,
  pointDefinitions: Readonly<Record<string, unknown[]>>,
): NoodleObjectData | undefined {
  if (customData === undefined) return undefined;
  const v2 = majorVersion === 2;
  const objectTracks = beatSaberTrackSchema.parse(customData[v2 ? '_track' : 'track']);
  const animationData = customData[v2 ? '_animation' : 'animation'];
  const parsedAnimation = dataSchema.safeParse(animationData);
  const animation = parsedAnimation.success
    ? animationProperties(parsedAnimation.data, pointDefinitions, v2, true)
    : undefined;
  const localRotation = rotation(customData[v2 ? '_localRotation' : 'localRotation']);
  const objectScale = v2 ? undefined : partialVector(customData.scale);
  const obstacleSize = partialVector(customData[v2 ? '_scale' : 'size']);
  const uninteractable = v2
    ? customData._interactable != null && !beatSaberBooleanSchema.parse(customData._interactable)
    : beatSaberBooleanSchema.parse(customData.uninteractable);
  const link = customData.link;
  return {
    tracks: objectTracks,
    animation: animation !== undefined && Object.keys(animation).length > 0 ? animation : undefined,
    localRotation,
    scale: objectScale,
    obstacleSize,
    link: typeof link === 'string' ? link : undefined,
    uninteractable,
    disableGravity: beatSaberBooleanSchema.parse(customData[v2 ? '_disableNoteGravity' : 'disableNoteGravity']),
    disableLook: beatSaberBooleanSchema.parse(customData[v2 ? '_disableNoteLook' : 'disableNoteLook']),
    noteJumpSpeed:
      customData[v2 ? '_noteJumpMovementSpeed' : 'noteJumpMovementSpeed'] == null
        ? undefined
        : beatSaberNumberSchema.parse(customData[v2 ? '_noteJumpMovementSpeed' : 'noteJumpMovementSpeed']),
    noteSpawnOffset:
      customData[v2 ? '_noteJumpStartBeatOffset' : 'noteJumpStartBeatOffset'] == null
        ? undefined
        : beatSaberNumberSchema.parse(customData[v2 ? '_noteJumpStartBeatOffset' : 'noteJumpStartBeatOffset']),
  };
}
