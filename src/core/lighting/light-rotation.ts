import type { BasicEvent } from '../beatmap/types';
import {
  beatSaberBooleanSchema as booleanSchema,
  beatSaberNumberSchema as numberSchema,
} from '../beatmap/value-schema';

export type RotationRandom = (event: BasicEvent, index: number, channel: 'direction' | 'angle') => number;

const customValue = (event: BasicEvent, v2: string, v3: string) => event.customData?.[v2] ?? event.customData?.[v3];

interface RotationKeyframe {
  beat: number;
  angle: number;
  speed: number;
}

function createRotationSampler(
  events: BasicEvent[],
  songBpm: number,
  startAngle: number,
  randomAngle: number,
  speedMultiplier: number,
  mirrored: boolean,
  random: RotationRandom,
) {
  let angle = startAngle;
  let speed = 0;
  let previousBeat = 0;
  const degreesPerBeat = 60 / songBpm;
  const keyframes: RotationKeyframe[] = [];

  events.forEach((event, index) => {
    angle += (event.songBpmTime - previousBeat) * degreesPerBeat * speed;
    previousBeat = event.songBpmTime;

    const lockRotation = booleanSchema.parse(customValue(event, '_lockPosition', 'lockRotation'));
    let value = event.value;
    if (value > 0) {
      const preciseSpeed = customValue(event, '_preciseSpeed', 'preciseSpeed');
      const customSpeed = customValue(event, '_speed', 'speed');
      if (preciseSpeed !== undefined) value = numberSchema.parse(preciseSpeed);
      else if (customSpeed !== undefined) value = numberSchema.parse(customSpeed);
    }

    if (value === 0) {
      speed = 0;
      if (!lockRotation) angle = startAngle;
      keyframes.push({ beat: event.songBpmTime, angle, speed });
      return;
    }
    if (value < 0) {
      keyframes.push({ beat: event.songBpmTime, angle, speed });
      return;
    }

    const customDirection = customValue(event, '_direction', 'direction');
    let direction =
      customDirection === undefined
        ? random(event, index, 'direction') < 0.5
          ? 1
          : -1
        : numberSchema.parse(customDirection) === 0
          ? 1
          : -1;
    if (mirrored) direction *= -1;
    if (!lockRotation) angle = startAngle + random(event, index, 'angle') * randomAngle;
    speed = value * speedMultiplier * 20 * direction;
    keyframes.push({ beat: event.songBpmTime, angle, speed });
  });

  return (beat: number) => {
    let low = 0;
    let high = keyframes.length;
    while (low < high) {
      const middle = (low + high) >>> 1;
      if ((keyframes[middle]?.beat ?? Infinity) <= beat) low = middle + 1;
      else high = middle;
    }
    const keyframe = keyframes[low - 1];
    return keyframe === undefined
      ? startAngle
      : keyframe.angle + (beat - keyframe.beat) * degreesPerBeat * keyframe.speed;
  };
}

export function createLightRotationSampler(
  events: BasicEvent[],
  songBpm: number,
  speedMultiplier: number,
  random: RotationRandom,
) {
  return createRotationSampler(events, songBpm, 0, 180, speedMultiplier, false, random);
}

export function createLightPairRotationSampler(
  events: BasicEvent[],
  songBpm: number,
  mirrored: boolean,
  startAngle: number,
  random: RotationRandom,
) {
  return createRotationSampler(events, songBpm, startAngle, 360 * (mirrored ? -1 : 1), 1, mirrored, random);
}

export function deterministicRotationRandom(seed: number): RotationRandom {
  return (event, index, channel) => {
    const value = Math.sin(
      seed * 12.9898 + event.songBpmTime * 78.233 + index * 37.719 + (channel === 'angle' ? 1 : 0),
    );
    return value - Math.floor(value);
  };
}
