import type { BasicEvent } from '../beatmap/types';
import {
  beatSaberBooleanSchema as booleanSchema,
  beatSaberNumberSchema as numberSchema,
  beatSaberStringSchema as stringSchema,
} from '../beatmap/value-schema';

const FIXED_DELTA = 0.02;

export interface RingRotationConfig {
  name: string;
  ringCount: number;
  startupRotationAngle: number;
  startupRotationStep: number;
  startupPropagationSpeed: number;
  startupFlexySpeed: number;
  rotationStep: number;
  counterSpin: boolean;
  rotation: number;
  step: number;
  stepType: number;
  propagationSpeed: number;
  flexySpeed: number;
}

export interface RingPositionConfig {
  positionOffsets: readonly number[];
  initialPositions: readonly number[];
  minPositionStep: number;
  maxPositionStep: number;
  moveSpeed: number;
}

export type RingRandom = (event: BasicEvent | null, index: number, channel: 'direction' | 'step') => number;

interface TargetChange {
  tick: number;
  order: number;
  target: number;
  speed: number;
}

interface SampledTargetChange {
  tick: number;
  target: number;
  speed: number;
  valueBefore: number;
}

const custom = (event: BasicEvent, v2: string, v3: string) => event.customData?.[v2] ?? event.customData?.[v3];
const tickAt = (seconds: number) => Math.max(1, Math.ceil(seconds / FIXED_DELTA));
const lerp = (start: number, end: number, time: number) => start + (end - start) * Math.min(Math.max(time, 0), 1);

function addPropagation(
  changes: TargetChange[][],
  startTick: number,
  order: number,
  angle: number,
  step: number,
  propagationSpeed: number,
  flexySpeed: number,
) {
  if (propagationSpeed <= 0) return;
  let progressPos = 0;
  let relativeTick = 0;
  while (progressPos < changes.length) {
    let progress = Math.floor(progressPos);
    while (progress < progressPos + propagationSpeed && progress < changes.length) {
      changes[progress]?.push({
        tick: startTick + relativeTick,
        order,
        target: angle + progress * step,
        speed: flexySpeed,
      });
      progress++;
    }
    progressPos += propagationSpeed;
    relativeTick++;
  }
}

function approachTarget(value: number, target: number, speed: number, ticks: number) {
  return target + (value - target) * (1 - Math.min(Math.max(FIXED_DELTA * speed, 0), 1)) ** ticks;
}

function compileChanges(initial: number, changes: TargetChange[]) {
  const sampled: SampledTargetChange[] = [];
  let value = initial;
  let target = initial;
  let speed = 0;
  let nextTick = 1;
  let index = 0;
  while (index < changes.length) {
    const tick = changes[index]?.tick ?? Infinity;
    const count = tick - nextTick;
    if (count > 0) value = approachTarget(value, target, speed, count);
    while (changes[index]?.tick === tick) {
      target = changes[index]?.target ?? target;
      speed = changes[index]?.speed ?? speed;
      index++;
    }
    sampled.push({ tick, target, speed, valueBefore: value });
    nextTick = tick;
  }
  return sampled;
}

function valueAfterTicks(initial: number, changes: SampledTargetChange[], ticks: number) {
  if (ticks <= 0) return initial;
  let low = 0;
  let high = changes.length;
  while (low < high) {
    const middle = (low + high) >>> 1;
    if ((changes[middle]?.tick ?? Infinity) <= ticks) low = middle + 1;
    else high = middle;
  }
  const change = changes[low - 1];
  return change === undefined
    ? initial
    : approachTarget(change.valueBefore, change.target, change.speed, ticks - change.tick + 1);
}

function sampleChanges(initial: number, changes: SampledTargetChange[], seconds: number) {
  const ticks = Math.floor(seconds / FIXED_DELTA);
  const fraction = seconds / FIXED_DELTA - ticks;
  const previous = valueAfterTicks(initial, changes, Math.max(ticks - 1, 0));
  const current = valueAfterTicks(initial, changes, ticks);
  return lerp(previous, current, fraction);
}

function sortChanges(changes: TargetChange[][]) {
  for (const entries of changes) entries.sort((a, b) => a.tick - b.tick || b.order - a.order);
  return changes;
}

function randomStep(config: RingRotationConfig, event: BasicEvent, index: number, random: RingRandom) {
  const value = random(event, index, 'step');
  if (config.stepType === 0) return value * config.step;
  if (config.stepType === 1) return -config.step + value * config.step * 2;
  if (config.stepType === 2) return value > 0.5 ? config.step : 0;
  return 0;
}

export function createRingRotationSampler(
  events: BasicEvent[],
  songBpm: number,
  initialRotations: readonly number[],
  config: RingRotationConfig,
  random: RingRandom,
) {
  const changes = Array.from({ length: config.ringCount }, (): TargetChange[] => []);
  addPropagation(
    changes,
    1,
    0,
    config.startupRotationAngle,
    config.startupRotationStep,
    config.startupPropagationSpeed,
    config.startupFlexySpeed,
  );

  let rotationInitial = config.startupRotationAngle;
  events.forEach((event, index) => {
    const hasCustomData = event.customData !== undefined;
    const directionValue = custom(event, '_direction', 'direction');
    const clockwise = hasCustomData
      ? directionValue !== undefined && numberSchema.parse(directionValue) === 0
      : random(event, index, 'direction') < 0.5;
    const ringRotation = custom(event, '_rotation', 'rotation');
    const rotation = ringRotation === undefined ? config.rotation : numberSchema.parse(ringRotation);
    const rotationStep = ringRotation === undefined ? config.rotationStep : numberSchema.parse(ringRotation);
    const signedRotation = clockwise ? rotation : -rotation;
    const nameFilter = custom(event, '_nameFilter', 'nameFilter');
    if (nameFilter === undefined || !config.name.includes(stringSchema.parse(nameFilter))) {
      let step = randomStep(config, event, index, random);
      let propagationSpeed = config.propagationSpeed;
      let flexySpeed = config.flexySpeed;
      const customStep = custom(event, '_step', 'step');
      const customProp = custom(event, '_prop', 'prop');
      const customSpeed = custom(event, '_speed', 'speed');
      if (customStep !== undefined) step = numberSchema.parse(customStep);
      if (customProp !== undefined) propagationSpeed = numberSchema.parse(customProp);
      if (customSpeed !== undefined) flexySpeed = numberSchema.parse(customSpeed);
      const stepMultiplier = custom(event, '_stepMult', 'stepMult');
      const propagationMultiplier = custom(event, '_propMult', 'propMult');
      const speedMultiplier = custom(event, '_speedMult', 'speedMult');
      if (stepMultiplier !== undefined) step *= numberSchema.parse(stepMultiplier);
      if (propagationMultiplier !== undefined) propagationSpeed *= numberSchema.parse(propagationMultiplier);
      if (speedMultiplier !== undefined) flexySpeed *= numberSchema.parse(speedMultiplier);

      let multiplier = clockwise ? 1 : -1;
      const counterSpinEvent = booleanSchema.parse(event.customData?._counterSpin);
      if (config.counterSpin && counterSpinEvent) multiplier *= -1;
      const reset = booleanSchema.parse(event.customData?._reset);
      addPropagation(
        changes,
        tickAt((event.songBpmTime * 60) / songBpm),
        index + 1,
        rotationInitial + (reset ? 90 * (counterSpinEvent ? 1 : -1) : rotationStep * multiplier),
        reset ? 0 : step,
        reset ? 50 : propagationSpeed,
        reset ? 50 : flexySpeed,
      );
    }
    rotationInitial += signedRotation;
  });

  const sampledChanges = sortChanges(changes).map((entries, index) =>
    compileChanges(initialRotations[index] ?? 0, entries),
  );
  const result = initialRotations.map(() => 0);
  return (beat: number) => {
    const seconds = (beat * 60) / songBpm;
    for (let index = 0; index < sampledChanges.length; index++) {
      result[index] = sampleChanges(initialRotations[index] ?? 0, sampledChanges[index] ?? [], seconds);
    }
    return result;
  };
}

export function createRingPositionSampler(events: BasicEvent[], songBpm: number, config: RingPositionConfig) {
  const changes = config.initialPositions.map<TargetChange[]>(() => []);
  events.forEach((event, index) => {
    const customStep = custom(event, '_step', 'step');
    const customSpeed = custom(event, '_speed', 'speed');
    const step =
      customStep === undefined
        ? (index + 1) % 2 === 0
          ? config.maxPositionStep
          : config.minPositionStep
        : numberSchema.parse(customStep);
    const speed = customSpeed === undefined ? config.moveSpeed : numberSchema.parse(customSpeed);
    const tick = tickAt((event.songBpmTime * 60) / songBpm);
    changes.forEach((ringChanges, ringIndex) => {
      ringChanges.push({
        tick,
        order: index + 1,
        target: (config.positionOffsets[ringIndex] ?? 0) + ringIndex * step,
        speed,
      });
    });
  });
  const sampledChanges = sortChanges(changes).map((entries, index) =>
    compileChanges(config.initialPositions[index] ?? 0, entries),
  );
  const result = config.initialPositions.map(() => 0);
  return (beat: number) => {
    const seconds = (beat * 60) / songBpm;
    for (let index = 0; index < sampledChanges.length; index++) {
      result[index] = sampleChanges(config.initialPositions[index] ?? 0, sampledChanges[index] ?? [], seconds);
    }
    return result;
  };
}

export function deterministicRingRandom(seed: number): RingRandom {
  return (event, index, channel) => {
    const time = event?.songBpmTime ?? 0;
    const value = Math.sin(seed * 23.1407 + time * 91.737 + index * 17.119 + (channel === 'step' ? 1 : 0));
    return value - Math.floor(value);
  };
}
