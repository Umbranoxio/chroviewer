import { Matrix4, Quaternion, Vector3 } from 'three';

import { eventProgress, eventProviderBeat } from './animation/event-timing';
import {
  multiplyQuaternions,
  sampleNumber,
  sampleRotation,
  sampleVector,
  sampleVector4,
  type NumberPoint,
  type PointSampleContext,
  type QuaternionTuple,
  type RotationPoint,
  type Vector3Tuple,
  type Vector4Point,
  type Vector4Tuple,
  type VectorPoint,
} from './animation/point-definition';
import type {
  NoodleAnimationProperties,
  NoodleBeatmapData,
  NoodleObjectData,
  NoodleParentEvent,
  NoodleTrackEvent,
} from './noodle-data';

export interface NoodleTransform {
  position?: Vector3Tuple;
  localPosition?: Vector3Tuple;
  rotation?: QuaternionTuple;
  scale?: Vector3Tuple;
  localRotation?: QuaternionTuple;
  dissolve?: number;
  dissolveArrow?: number;
  interactable?: number;
  definitePosition?: Vector3Tuple;
  color?: Vector4Tuple;
  time?: number;
  parentMatrix?: readonly number[];
  absolute?: boolean;
}

interface EventLimit {
  songBpmTime: number;
  order: number;
}

interface AnimationProperty<T, P> {
  key: keyof NoodleAnimationProperties;
  legacyPathInitial: T;
  points(animation: NoodleAnimationProperties): P[] | null | undefined;
  sample(points: readonly P[], time: number, context?: PointSampleContext, songBpmTime?: number): T | undefined;
  combine(left: T | undefined, right: T | undefined): T | undefined;
  blend(left: T | undefined, right: T | undefined, amount: number): T | undefined;
}

interface TrackPropertyEvents {
  animate: NoodleTrackEvent[];
  path: NoodleTrackEvent[];
  animateHasValue: boolean;
  pathHasValue: boolean;
}

const identityScale: Vector3Tuple = [1, 1, 1];
const zero: Vector3Tuple = [0, 0, 0];
const identityRotation: QuaternionTuple = [0, 0, 0, 1];

function add(left: Vector3Tuple | undefined, right: Vector3Tuple | undefined) {
  if (left === undefined) return right;
  if (right === undefined) return left;
  return [left[0] + right[0], left[1] + right[1], left[2] + right[2]] as const;
}

function multiplyVector(left: Vector3Tuple | undefined, right: Vector3Tuple | undefined) {
  if (left === undefined) return right;
  if (right === undefined) return left;
  return [left[0] * right[0], left[1] * right[1], left[2] * right[2]] as const;
}

function multiplyNumber(left: number | undefined, right: number | undefined) {
  if (left === undefined) return right;
  if (right === undefined) return left;
  return left * right;
}

function multiplyVector4(left: Vector4Tuple | undefined, right: Vector4Tuple | undefined) {
  if (left === undefined) return right;
  if (right === undefined) return left;
  return [left[0] * right[0], left[1] * right[1], left[2] * right[2], left[3] * right[3]] as const;
}

function vectorProperty(
  key: keyof NoodleAnimationProperties,
  points: AnimationProperty<Vector3Tuple, VectorPoint>['points'],
  combine: AnimationProperty<Vector3Tuple, VectorPoint>['combine'] = add,
): AnimationProperty<Vector3Tuple, VectorPoint> {
  return { key, legacyPathInitial: zero, points, sample: sampleVector, combine, blend: blendVector };
}

function rotationProperty(
  key: keyof NoodleAnimationProperties,
  points: AnimationProperty<QuaternionTuple, RotationPoint>['points'],
): AnimationProperty<QuaternionTuple, RotationPoint> {
  return {
    key,
    legacyPathInitial: identityRotation,
    points,
    sample: sampleRotation,
    combine: multiplyQuaternions,
    blend: blendRotation,
  };
}

function numberProperty(
  key: keyof NoodleAnimationProperties,
  points: AnimationProperty<number, NumberPoint>['points'],
): AnimationProperty<number, NumberPoint> {
  return { key, legacyPathInitial: 0, points, sample: sampleNumber, combine: multiplyNumber, blend: blendNumber };
}

const positionProperty = vectorProperty('position', (animation) => animation.position);
const localPositionProperty = vectorProperty('localPosition', (animation) => animation.localPosition);
const offsetPositionProperty = vectorProperty('offsetPosition', (animation) => animation.offsetPosition);
const scaleProperty = vectorProperty('scale', (animation) => animation.scale, multiplyVector);
const definitePositionProperty = vectorProperty('definitePosition', (animation) => animation.definitePosition);
const rotationPropertyValue = rotationProperty('rotation', (animation) => animation.rotation);
const offsetWorldRotationProperty = rotationProperty(
  'offsetWorldRotation',
  (animation) => animation.offsetWorldRotation,
);
const localRotationProperty = rotationProperty('localRotation', (animation) => animation.localRotation);
const dissolveProperty = numberProperty('dissolve', (animation) => animation.dissolve);
const dissolveArrowProperty = numberProperty('dissolveArrow', (animation) => animation.dissolveArrow);
const interactableProperty = numberProperty('interactable', (animation) => animation.interactable);
const timeProperty = numberProperty('time', (animation) => animation.time);
const colorProperty: AnimationProperty<Vector4Tuple, Vector4Point> = {
  key: 'color',
  legacyPathInitial: [0, 0, 0, 0],
  points: (animation) => animation.color,
  sample: sampleVector4,
  combine: multiplyVector4,
  blend: blendVector4,
};

const animationPropertyKeys = [
  'position',
  'localPosition',
  'rotation',
  'offsetPosition',
  'offsetWorldRotation',
  'scale',
  'localRotation',
  'dissolve',
  'dissolveArrow',
  'interactable',
  'definitePosition',
  'color',
  'time',
] as const satisfies readonly (keyof NoodleAnimationProperties)[];
const trackEventIndexes = new WeakMap<
  NoodleBeatmapData,
  Map<string, Map<keyof NoodleAnimationProperties, TrackPropertyEvents>>
>();
const parentEventIndexes = new WeakMap<NoodleBeatmapData, Map<string, NoodleParentEvent[]>>();
const playerEventIndexes = new WeakMap<NoodleBeatmapData, Map<string, NoodleBeatmapData['playerEvents']>>();
const noTrackEvents: readonly NoodleTrackEvent[] = [];
const noParentEvents: readonly NoodleParentEvent[] = [];
const noPlayerEvents: readonly NoodleBeatmapData['playerEvents'][number][] = [];

function indexedTrackPropertyEvents(data: NoodleBeatmapData, track: string, property: keyof NoodleAnimationProperties) {
  let index = trackEventIndexes.get(data);
  if (index === undefined) {
    index = new Map();
    for (const event of data.trackEvents) {
      for (const [trackIndex, eventTrack] of event.tracks.entries()) {
        if (event.tracks.indexOf(eventTrack) !== trackIndex) continue;
        let properties = index.get(eventTrack);
        if (properties === undefined) {
          properties = new Map();
          index.set(eventTrack, properties);
        }
        for (const key of animationPropertyKeys) {
          if (event.animation[key] === undefined) continue;
          let events = properties.get(key);
          if (events === undefined) {
            events = { animate: [], path: [], animateHasValue: false, pathHasValue: false };
            properties.set(key, events);
          }
          if (event.type === 'AnimateTrack') {
            events.animate.push(event);
            if (event.animation[key] !== null) events.animateHasValue = true;
          } else {
            events.path.push(event);
            if (event.animation[key] !== null) events.pathHasValue = true;
          }
        }
      }
    }
    trackEventIndexes.set(data, index);
  }
  return index.get(track)?.get(property);
}

function indexedTrackEvents(
  data: NoodleBeatmapData,
  track: string,
  property: keyof NoodleAnimationProperties,
  type: NoodleTrackEvent['type'],
) {
  const events = indexedTrackPropertyEvents(data, track, property);
  return events?.[type === 'AnimateTrack' ? 'animate' : 'path'] ?? noTrackEvents;
}

function eventIsBefore(event: { songBpmTime: number; order?: number }, beat: number, limit?: EventLimit) {
  return (
    event.songBpmTime <= beat &&
    (limit === undefined ||
      event.songBpmTime < limit.songBpmTime ||
      (event.songBpmTime === limit.songBpmTime && eventOrder(event) < limit.order))
  );
}

function lastEventIndex(events: readonly { songBpmTime: number; order?: number }[], beat: number, limit?: EventLimit) {
  let low = 0;
  let high = events.length;
  while (low < high) {
    const middle = (low + high) >>> 1;
    const event = events[middle];
    if (event !== undefined && eventIsBefore(event, beat, limit)) low = middle + 1;
    else high = middle;
  }
  return low - 1;
}

function eventOrder(event: { order?: number }) {
  return event.order ?? 0;
}

function newer<T extends { songBpmTime: number; order?: number }>(left: T | undefined, right: T) {
  return (
    left === undefined ||
    right.songBpmTime > left.songBpmTime ||
    (right.songBpmTime === left.songBpmTime && eventOrder(right) > eventOrder(left))
  );
}

function staticProperty<T, P>(
  data: NoodleBeatmapData,
  track: string,
  property: AnimationProperty<T, P>,
  beat: number,
  context?: PointSampleContext,
  limit?: EventLimit,
) {
  const events = indexedTrackEvents(data, track, property.key, 'AnimateTrack');
  const latest = events[lastEventIndex(events, beat, limit)];
  if (latest === undefined) return undefined;
  const points = property.points(latest.animation);
  if (points === null || points === undefined) return undefined;
  return property.sample(
    points,
    eventProgress(beat, latest.songBpmTime, latest.durationSongBpmTime, latest.repeat, latest.easing),
    context,
    eventProviderBeat(beat, latest.songBpmTime, latest.durationSongBpmTime, latest.repeat),
  );
}

function mergedStaticProperty<T, P>(
  data: NoodleBeatmapData,
  tracks: readonly string[],
  property: AnimationProperty<T, P>,
  beat: number,
  context: PointSampleContext | undefined,
  objectAddedBeat: number,
) {
  const mergeAt = (sampleBeat: number, limit?: EventLimit) => {
    let result: T | undefined;
    for (const track of tracks) {
      result = property.combine(result, staticProperty(data, track, property, sampleBeat, context, limit));
    }
    return result;
  };

  const current = mergeAt(beat);
  if (current !== undefined) return current;
  const clears = tracks.flatMap((track) => {
    const events = indexedTrackEvents(data, track, property.key, 'AnimateTrack');
    const result: NoodleTrackEvent[] = [];
    for (let index = lastEventIndex(events, beat); index >= 0; index--) {
      const event = events[index];
      if (event === undefined || event.songBpmTime < objectAddedBeat) break;
      if (property.points(event.animation) === null) result.push(event);
    }
    return result;
  });
  clears.sort((left, right) => right.songBpmTime - left.songBpmTime || eventOrder(right) - eventOrder(left));
  for (const event of clears) {
    const previous = mergeAt(event.songBpmTime, {
      songBpmTime: event.songBpmTime,
      order: eventOrder(event),
    });
    if (previous !== undefined) return previous;
  }
  return undefined;
}

function persistentStaticProperty<T, P>(
  data: NoodleBeatmapData,
  track: string,
  property: AnimationProperty<T, P>,
  beat: number,
  context?: PointSampleContext,
) {
  const events = indexedTrackEvents(data, track, property.key, 'AnimateTrack');
  const end = lastEventIndex(events, beat);
  let latestValueIndex = -1;
  for (let index = end; index >= 0; index--) {
    const event = events[index];
    if (event !== undefined && property.points(event.animation) !== null) {
      latestValueIndex = index;
      break;
    }
  }
  const latestValue = events[latestValueIndex];
  if (latestValue === undefined) return undefined;
  let firstClear: NoodleTrackEvent | undefined;
  for (let index = latestValueIndex + 1; index <= end; index++) {
    const event = events[index];
    if (event !== undefined && property.points(event.animation) === null) {
      firstClear = event;
      break;
    }
  }
  const points = property.points(latestValue.animation);
  if (points === null || points === undefined) return undefined;
  const sampleBeat = firstClear?.songBpmTime ?? beat;
  return property.sample(
    points,
    eventProgress(
      sampleBeat,
      latestValue.songBpmTime,
      latestValue.durationSongBpmTime,
      latestValue.repeat,
      latestValue.easing,
    ),
    context,
    eventProviderBeat(sampleBeat, latestValue.songBpmTime, latestValue.durationSongBpmTime, latestValue.repeat),
  );
}

function blendVector(left: Vector3Tuple | undefined, right: Vector3Tuple | undefined, amount: number) {
  if (left === undefined || right === undefined) return right;
  return [
    left[0] + (right[0] - left[0]) * amount,
    left[1] + (right[1] - left[1]) * amount,
    left[2] + (right[2] - left[2]) * amount,
  ] as const;
}

function blendVector4(left: Vector4Tuple | undefined, right: Vector4Tuple | undefined, amount: number) {
  if (left === undefined || right === undefined) return right;
  return [
    left[0] + (right[0] - left[0]) * amount,
    left[1] + (right[1] - left[1]) * amount,
    left[2] + (right[2] - left[2]) * amount,
    left[3] + (right[3] - left[3]) * amount,
  ] as const;
}

function blendNumber(left: number | undefined, right: number | undefined, amount: number) {
  return left === undefined || right === undefined ? right : left + (right - left) * amount;
}

function blendRotation(left: QuaternionTuple | undefined, right: QuaternionTuple | undefined, amount: number) {
  if (left === undefined || right === undefined) return right;
  return sampleRotation(
    [
      { value: left, time: 0 },
      { value: right, time: 1 },
    ],
    amount,
  );
}

function pathProperty<T, P>(
  data: NoodleBeatmapData,
  track: string,
  property: AnimationProperty<T, P>,
  beat: number,
  objectTime: number,
  context?: PointSampleContext,
) {
  const events = indexedTrackEvents(data, track, property.key, 'AssignPathAnimation');
  const latestIndex = lastEventIndex(events, beat);
  const latest = events[latestIndex];
  if (latest === undefined) return undefined;
  const previous = events[latestIndex - 1];
  const targetPoints = property.points(latest.animation);
  if (targetPoints === null || targetPoints === undefined) return undefined;
  const target = property.sample(targetPoints, objectTime, context, beat);
  const previousPoints = previous === undefined ? undefined : property.points(previous.animation);
  if (latest.durationSongBpmTime <= 0) return target;
  const previousValue =
    previousPoints === null || previousPoints === undefined
      ? data.version === 2
        ? property.legacyPathInitial
        : undefined
      : property.sample(previousPoints, objectTime, context, beat);
  if (previousValue === undefined) return target;
  const progress = eventProgress(beat, latest.songBpmTime, latest.durationSongBpmTime, 0, latest.easing);
  if (progress >= 1) return target;
  return property.blend(previousValue, target, progress);
}

function animationProperty<T, P>(
  animation: NoodleAnimationProperties | undefined,
  property: AnimationProperty<T, P>,
  objectTime: number,
  beat: number,
  context?: PointSampleContext,
) {
  if (animation === undefined) return undefined;
  const points = property.points(animation);
  return points === undefined || points === null ? undefined : property.sample(points, objectTime, context, beat);
}

function mergedStaticTracks(
  data: NoodleBeatmapData,
  tracks: readonly string[],
  beat: number,
  context?: PointSampleContext,
  objectAddedBeat = Number.NEGATIVE_INFINITY,
): NoodleTransform {
  return {
    position: mergedStaticProperty(data, tracks, offsetPositionProperty, beat, context, objectAddedBeat),
    rotation: mergedStaticProperty(data, tracks, offsetWorldRotationProperty, beat, context, objectAddedBeat),
    scale: mergedStaticProperty(data, tracks, scaleProperty, beat, context, objectAddedBeat),
    localRotation: mergedStaticProperty(data, tracks, localRotationProperty, beat, context, objectAddedBeat),
    dissolve: mergedStaticProperty(data, tracks, dissolveProperty, beat, context, objectAddedBeat),
    dissolveArrow: mergedStaticProperty(data, tracks, dissolveArrowProperty, beat, context, objectAddedBeat),
    interactable: mergedStaticProperty(data, tracks, interactableProperty, beat, context, objectAddedBeat),
    color: mergedStaticProperty(data, tracks, colorProperty, beat, context, objectAddedBeat),
  };
}

function mergedPathTracks<T, P>(
  data: NoodleBeatmapData,
  tracks: readonly string[],
  property: AnimationProperty<T, P>,
  beat: number,
  objectTime: number,
  context?: PointSampleContext,
) {
  let result: T | undefined;
  for (const track of tracks) {
    result = property.combine(result, pathProperty(data, track, property, beat, objectTime, context));
  }
  return result;
}

function objectPathProperty<T, P>(
  object: NoodleObjectData,
  data: NoodleBeatmapData,
  property: AnimationProperty<T, P>,
  beat: number,
  objectTime: number,
  context?: PointSampleContext,
) {
  return (
    animationProperty(object.animation, property, objectTime, beat, context) ??
    mergedPathTracks(data, object.tracks, property, beat, objectTime, context)
  );
}

function trackTime(object: NoodleObjectData, data: NoodleBeatmapData, beat: number, context?: PointSampleContext) {
  for (const track of object.tracks) {
    const value = staticProperty(data, track, timeProperty, beat, context);
    if (value !== undefined) return value;
  }
  return undefined;
}

function latestParentEvent(
  data: NoodleBeatmapData,
  tracks: readonly string[],
  beat: number,
  ignored?: NoodleParentEvent,
) {
  let index = parentEventIndexes.get(data);
  if (index === undefined) {
    index = new Map();
    for (const event of data.parentEvents) {
      for (const [trackIndex, childTrack] of event.childrenTracks.entries()) {
        if (event.childrenTracks.indexOf(childTrack) !== trackIndex) continue;
        const events = index.get(childTrack);
        if (events === undefined) index.set(childTrack, [event]);
        else events.push(event);
      }
    }
    parentEventIndexes.set(data, index);
  }
  let latest: NoodleParentEvent | undefined;
  for (const [trackIndex, track] of tracks.entries()) {
    if (tracks.indexOf(track) !== trackIndex) continue;
    const events = index.get(track) ?? noParentEvents;
    for (let eventIndex = lastEventIndex(events, beat); eventIndex >= 0; eventIndex--) {
      const event = events[eventIndex];
      if (event === undefined || event === ignored) continue;
      if (newer(latest, event)) latest = event;
      break;
    }
  }
  return latest;
}

function parentObjectMatrix(
  data: NoodleBeatmapData,
  event: NoodleParentEvent,
  beat: number,
  context: PointSampleContext | undefined,
  leftHanded: boolean,
  visiting: Set<NoodleParentEvent>,
  preserveWorldTransform: boolean,
): Matrix4 {
  if (visiting.has(event)) return new Matrix4();
  visiting.add(event);
  const ownParent = parentMatrixForTracks(
    data,
    [event.parentTrack],
    beat,
    context,
    leftHanded,
    event.songBpmTime,
    visiting,
    event,
    preserveWorldTransform,
  );
  const track = event.parentTrack;
  const trackPosition = persistentStaticProperty(data, track, positionProperty, beat, context);
  const trackLocalPosition = persistentStaticProperty(data, track, localPositionProperty, beat, context);
  const trackRotation = persistentStaticProperty(data, track, rotationPropertyValue, beat, context);
  const trackLocalRotation = persistentStaticProperty(data, track, localRotationProperty, beat, context);
  const trackScale = persistentStaticProperty(data, track, scaleProperty, beat, context);
  const unit = data.version === 2 ? 0.6 : 1;

  let position = event.transform.localPosition ?? zero;
  let rotation = event.transform.localRotation ?? identityRotation;
  let scale = event.transform.scale ?? identityScale;
  let worldPosition = event.transform.localPosition === undefined ? event.transform.position : undefined;
  let worldRotation = event.transform.localRotation === undefined ? event.transform.rotation : undefined;

  if (data.version === 2) {
    worldPosition = undefined;
    worldRotation = undefined;
    const startRotation = event.transform.rotation ?? identityRotation;
    const offsetRotation = staticProperty(data, track, offsetWorldRotationProperty, beat, context);
    const offsetPosition = staticProperty(data, track, offsetPositionProperty, beat, context);
    const firstRotation = multiplyQuaternions(startRotation, offsetRotation) ?? identityRotation;
    const sourcePosition = add(event.transform.position, offsetPosition) ?? zero;
    const vector = new Vector3(...sourcePosition).applyQuaternion(new Quaternion(...firstRotation));
    position = [vector.x, vector.y, vector.z];
    const startLocal =
      event.transform.localRotation === undefined
        ? event.transform.rotation === undefined
          ? identityRotation
          : startRotation
        : (multiplyQuaternions(startRotation, event.transform.localRotation) ?? identityRotation);
    rotation =
      multiplyQuaternions(multiplyQuaternions(firstRotation, startLocal), trackLocalRotation) ?? identityRotation;
    scale = multiplyVector(event.transform.scale ?? identityScale, trackScale) ?? identityScale;
  } else {
    if (trackLocalPosition !== undefined) {
      position = trackLocalPosition;
      worldPosition = undefined;
    } else if (trackPosition !== undefined) worldPosition = trackPosition;
    if (trackLocalRotation !== undefined) {
      rotation = trackLocalRotation;
      worldRotation = undefined;
    } else if (trackRotation !== undefined) worldRotation = trackRotation;
    if (trackScale !== undefined) scale = trackScale;
    else if (leftHanded && event.transform.scale !== undefined) scale = [-scale[0], scale[1], scale[2]];
  }

  const local = new Matrix4().compose(
    new Vector3(position[0] * unit, position[1] * unit, position[2] * unit),
    new Quaternion(...rotation),
    new Vector3(...scale),
  );
  const result = ownParent === undefined ? local : new Matrix4().multiplyMatrices(ownParent, local);
  if (worldPosition !== undefined || worldRotation !== undefined) {
    const resultPosition = new Vector3();
    const resultRotation = new Quaternion();
    const resultScale = new Vector3();
    result.decompose(resultPosition, resultRotation, resultScale);
    if (worldPosition !== undefined) resultPosition.set(...worldPosition).multiplyScalar(unit);
    if (worldRotation !== undefined) resultRotation.set(...worldRotation);
    result.compose(resultPosition, resultRotation, resultScale);
  }
  visiting.delete(event);
  return result;
}

function parentMatrixForTracks(
  data: NoodleBeatmapData,
  tracks: readonly string[],
  beat: number,
  context?: PointSampleContext,
  leftHanded = false,
  objectAddedBeat = Number.NEGATIVE_INFINITY,
  visiting?: Set<NoodleParentEvent>,
  ignored?: NoodleParentEvent,
  preserveWorldTransform = true,
): Matrix4 | undefined {
  const event = latestParentEvent(data, tracks, beat, ignored);
  if (event === undefined) return undefined;
  const activeEvents = visiting ?? new Set<NoodleParentEvent>();
  const current = parentObjectMatrix(data, event, beat, context, leftHanded, activeEvents, preserveWorldTransform);
  if (!event.worldPositionStays || !preserveWorldTransform) return current;
  const attachedBeat = Math.max(event.songBpmTime, objectAddedBeat);
  const initial = parentObjectMatrix(data, event, attachedBeat, context, leftHanded, new Set(activeEvents), true);
  return current.multiply(initial.invert());
}

export function sampleNoodleParent(
  data: NoodleBeatmapData,
  tracks: readonly string[],
  beat: number,
  context?: PointSampleContext,
) {
  const event = latestParentEvent(data, tracks, beat);
  if (event === undefined) return undefined;
  return {
    matrix: parentObjectMatrix(data, event, beat, context, false, new Set(), false).toArray(),
    worldPositionStays: event.worldPositionStays,
  };
}

function genericTrackTransform(
  data: NoodleBeatmapData,
  track: string,
  beat: number,
  context?: PointSampleContext,
  leftHanded = false,
  objectAddedBeat = Number.NEGATIVE_INFINITY,
): NoodleTransform {
  return {
    position: persistentStaticProperty(data, track, positionProperty, beat, context),
    localPosition: persistentStaticProperty(data, track, localPositionProperty, beat, context),
    rotation: persistentStaticProperty(data, track, rotationPropertyValue, beat, context),
    localRotation: persistentStaticProperty(data, track, localRotationProperty, beat, context),
    scale: persistentStaticProperty(data, track, scaleProperty, beat, context),
    parentMatrix: parentMatrixForTracks(data, [track], beat, context, leftHanded, objectAddedBeat)?.toArray(),
    absolute: true,
  };
}

export function sampleNoodleTrack(
  data: NoodleBeatmapData,
  track: string,
  beat: number,
  context?: PointSampleContext,
  leftHanded = false,
  objectAddedBeat = Number.NEGATIVE_INFINITY,
) {
  if (data.version === 3) return genericTrackTransform(data, track, beat, context, leftHanded, objectAddedBeat);
  const transform = mergedStaticTracks(data, [track], beat, context);
  transform.parentMatrix = parentMatrixForTracks(data, [track], beat, context, leftHanded, objectAddedBeat)?.toArray();
  return transform;
}

export function sampleNoodlePlayerTrack(
  data: NoodleBeatmapData,
  target: string,
  beat: number,
  context?: PointSampleContext,
  leftHanded = false,
) {
  let index = playerEventIndexes.get(data);
  if (index === undefined) {
    index = new Map();
    for (const event of data.playerEvents) {
      const events = index.get(event.target);
      if (events === undefined) {
        index.set(event.target, [event]);
        continue;
      }
      const previous = events.at(-1);
      if (previous?.songBpmTime !== event.songBpmTime || eventOrder(previous) !== eventOrder(event)) {
        events.push(event);
      }
    }
    playerEventIndexes.set(data, index);
  }
  const assignments = index.get(target) ?? noPlayerEvents;
  const assignment = assignments[lastEventIndex(assignments, beat)];
  if (assignment === undefined) return {};
  const transform = sampleNoodleTrack(data, assignment.track, beat, context, leftHanded, assignment.songBpmTime);
  if (data.version !== 2) return transform;
  return {
    position: transform.position,
    rotation: transform.rotation,
    localRotation: transform.localRotation,
    parentMatrix: transform.parentMatrix,
  };
}

export function noodleTrackControlsTime(object: NoodleObjectData | undefined, data: NoodleBeatmapData) {
  if (object === undefined || object.tracks.length === 0) return false;
  return object.tracks.some((track) => indexedTrackEvents(data, track, 'time', 'AnimateTrack').length > 0);
}

export function noodleTrackControlsInteractability(object: NoodleObjectData, data: NoodleBeatmapData) {
  return object.tracks.some((track) => {
    const events = indexedTrackPropertyEvents(data, track, 'interactable');
    return events?.animateHasValue === true || events?.pathHasValue === true;
  });
}

export function sampleNoodleObject(
  object: NoodleObjectData | undefined,
  data: NoodleBeatmapData,
  beat: number,
  objectTime: number,
  context?: PointSampleContext,
  leftHanded = false,
  objectAddedBeat = Number.NEGATIVE_INFINITY,
): NoodleTransform {
  if (object === undefined) return {};
  const time = trackTime(object, data, beat, context);
  const localTime = time ?? objectTime;
  const staticTransform = mergedStaticTracks(data, object.tracks, beat, context, objectAddedBeat);
  const pathPosition = objectPathProperty(object, data, offsetPositionProperty, beat, localTime, context);
  const pathRotation = objectPathProperty(object, data, offsetWorldRotationProperty, beat, localTime, context);
  const pathScale = objectPathProperty(object, data, scaleProperty, beat, localTime, context);
  const pathLocalRotation = objectPathProperty(object, data, localRotationProperty, beat, localTime, context);
  const pathDissolve = objectPathProperty(object, data, dissolveProperty, beat, localTime, context);
  const pathDissolveArrow = objectPathProperty(object, data, dissolveArrowProperty, beat, localTime, context);
  const pathInteractable = objectPathProperty(object, data, interactableProperty, beat, localTime, context);
  const pathDefinite = objectPathProperty(object, data, definitePositionProperty, beat, localTime, context);
  const pathColor = objectPathProperty(object, data, colorProperty, beat, localTime, context);
  const position = add(staticTransform.position, pathPosition);
  return {
    position,
    rotation: multiplyQuaternions(staticTransform.rotation, pathRotation),
    scale: multiplyVector(staticTransform.scale, pathScale),
    localRotation: multiplyQuaternions(staticTransform.localRotation, pathLocalRotation),
    dissolve: multiplyNumber(staticTransform.dissolve, pathDissolve),
    dissolveArrow: multiplyNumber(staticTransform.dissolveArrow, pathDissolveArrow),
    interactable: multiplyNumber(staticTransform.interactable, pathInteractable),
    definitePosition: pathDefinite === undefined ? undefined : add(position, pathDefinite),
    color: multiplyVector4(staticTransform.color, pathColor),
    time,
    parentMatrix: parentMatrixForTracks(data, object.tracks, beat, context, leftHanded, objectAddedBeat)?.toArray(),
  };
}
