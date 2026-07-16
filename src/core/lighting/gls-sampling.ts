import type {
  EventBox,
  FloatFxEvent,
  LightColorEvent,
  LightRotationEvent,
  LightTransformEventBox,
  LightTranslationEvent,
} from '../beatmap/types';
import type { ColorScheme, Rgb } from '../colors';
import { easingFromId } from '../easing';
import type { ExpandedGlsEvent } from './gls-events';

interface TweenEvent {
  time: number;
  value: number;
  easing: number;
  usePrevious: number;
}

const clamp01 = (value: number) => Math.min(Math.max(value, 0), 1);
const lerp = (start: number, end: number, time: number) => start + (end - start) * time;

function lastIndexAtOrBefore(events: readonly { time: number }[], time: number) {
  let low = 0;
  let high = events.length;
  while (low < high) {
    const middle = (low + high) >>> 1;
    if ((events[middle]?.time ?? Number.POSITIVE_INFINITY) <= time) low = middle + 1;
    else high = middle;
  }
  return low - 1;
}
function lerpRgb(start: Rgb, end: Rgb, time: number): Rgb {
  return [lerp(start[0], end[0], time), lerp(start[1], end[1], time), lerp(start[2], end[2], time)];
}

export interface GlsColorTweenEvent {
  time: number;
  color: number;
  brightness: number;
  easing: number;
  usePrevious: number;
  frequency: number;
  strobeBrightness: number;
  strobeFade: number;
}

export interface GlsColorSample {
  color: Rgb;
  alpha: number;
}

function glsColor(color: number, scheme: ColorScheme, boost: boolean): Rgb {
  if (color === 1) return boost ? scheme.environmentRightBoost : scheme.environmentRight;
  if (color === 2) return boost ? scheme.environmentWhiteBoost : scheme.environmentWhite;
  return boost ? scheme.environmentLeftBoost : scheme.environmentLeft;
}

function previousColorState(states: GlsColorTweenEvent[], index: number, initial: GlsColorTweenEvent) {
  for (let i = index; i >= 0; i -= 1) {
    const state = states[i];
    if (state !== undefined && state.usePrevious !== 1) return state;
  }
  return initial;
}

export function glsColorTween(
  events: ExpandedGlsEvent<LightColorEvent, EventBox<LightColorEvent>>[],
  toSongBpmTime: (jsonTime: number) => number,
) {
  return events.map(({ jsonTime, distributionOffset, event }) => ({
    time: toSongBpmTime(jsonTime),
    color: event.color,
    brightness: event.brightness + distributionOffset,
    easing: event.easing,
    usePrevious: event.usePrevious,
    frequency: event.frequency,
    strobeBrightness: event.strobeBrightness,
    strobeFade: event.strobeFade,
  }));
}

export function sampleGlsColorTween(
  states: GlsColorTweenEvent[],
  time: number,
  scheme: ColorScheme,
  boost: boolean,
): GlsColorSample {
  const initial: GlsColorTweenEvent = {
    time: Number.NEGATIVE_INFINITY,
    color: 0,
    brightness: 0,
    easing: -1,
    usePrevious: 0,
    frequency: 0,
    strobeBrightness: 0,
    strobeFade: 0,
  };
  const index = lastIndexAtOrBefore(states, time);
  if (index < 0) return { color: glsColor(initial.color, scheme, boost), alpha: 0 };
  const current = states[index];
  if (current === undefined) return { color: glsColor(initial.color, scheme, boost), alpha: 0 };
  const start = current.usePrevious === 1 ? previousColorState(states, index - 1, initial) : current;
  const rawNext = states[index + 1];
  const startColor = glsColor(start.color, scheme, boost);
  if (rawNext === undefined) return { color: startColor, alpha: start.brightness };
  const end = rawNext.usePrevious === 1 ? start : rawNext;
  const duration = rawNext.time - current.time;
  const progress = duration <= 0 ? 1 : clamp01((time - current.time) / duration);
  const eased = easingFromId(end.easing)(progress);
  const color = lerpRgb(startColor, glsColor(end.color, scheme, boost), eased);
  const alpha = lerp(start.brightness, end.brightness, eased);
  const endFrequency = end.easing === -1 ? start.frequency : end.frequency;
  const endStrobeBrightness = end.easing === -1 ? start.strobeBrightness : end.strobeBrightness;
  if (start.frequency <= 0 && endFrequency <= 0) return { color, alpha };

  const strobeBrightness = lerp(start.strobeBrightness, endStrobeBrightness, progress);
  const elapsed = progress * duration;
  const elapsedHalf = duration === 0 ? 0 : (elapsed * elapsed) / (2 * duration);
  const half = (-start.frequency * elapsedHalf + start.frequency * elapsed + endFrequency * elapsedHalf) % 1;
  if (end.strobeFade === 1) {
    const strobe = easingFromId(9)(1 - Math.abs(half * 2 - 1));
    return { color, alpha: lerp(1, strobeBrightness, strobe) };
  }
  return { color, alpha: half > 0.5 ? strobeBrightness : alpha };
}

export function sampleGlsFloat(events: TweenEvent[], time: number, initial = 0) {
  const index = lastIndexAtOrBefore(events, time);
  if (index < 0) return initial;
  const current = events[index];
  if (current === undefined) return initial;
  let start = current.value;
  if (current.usePrevious === 1) {
    start = initial;
    for (let i = index - 1; i >= 0; i -= 1) {
      const previous = events[i];
      if (previous !== undefined && previous.usePrevious !== 1) {
        start = previous.value;
        break;
      }
    }
  }
  const next = events[index + 1];
  if (next === undefined) return start;
  const end = next.usePrevious === 1 ? start : next.value;
  const duration = next.time - current.time;
  const progress = duration <= 0 ? 1 : clamp01((time - current.time) / duration);
  return lerp(start, end, easingFromId(next.easing)(progress));
}

export function floatFxTween(
  events: ExpandedGlsEvent<FloatFxEvent>[],
  toSongBpmTime: (jsonTime: number) => number,
): TweenEvent[] {
  return events.map(({ jsonTime, distributionOffset, event }) => ({
    time: toSongBpmTime(jsonTime),
    value: event.value + distributionOffset,
    easing: event.easing,
    usePrevious: event.usePrevious,
  }));
}

const repeat = (value: number, length: number) => ((value % length) + length) % length;
const deltaAngle = (current: number, target: number) => repeat(target - current + 180, 360) - 180;

function targetAngle(start: number, end: number, loops: number, direction: number) {
  const delta = deltaAngle(start, end);
  if (direction === 1) return start + delta + (delta < 0 ? 360 : 0) + loops * 360;
  if (direction === 2) return start + delta - (delta > 0 ? 360 : 0) - loops * 360;
  return start + delta + Math.sign(delta) * loops * 360;
}

export interface GlsRotationTweenEvent extends TweenEvent {
  loop: number;
  direction: number;
}

export function glsRotationTween(
  events: ExpandedGlsEvent<LightRotationEvent, LightTransformEventBox<LightRotationEvent>>[],
  toSongBpmTime: (jsonTime: number) => number,
) {
  return events.map(({ jsonTime, distributionOffset, event, box }) => {
    const extraLoops = Math.floor(Math.abs(distributionOffset) / 360);
    const offset = repeat(Math.abs(distributionOffset), 360) * Math.sign(distributionOffset);
    const direction = box.flip === 1 ? -1 : 1;
    return {
      time: toSongBpmTime(jsonTime),
      value: (offset + event.rotation) * direction,
      easing: event.easing,
      usePrevious: event.usePrevious,
      loop: event.loop + extraLoops,
      direction: event.direction,
    };
  });
}

export function sampleGlsRotationTween(values: GlsRotationTweenEvent[], time: number) {
  const index = lastIndexAtOrBefore(values, time);
  if (index < 0) return 0;
  const current = values[index];
  if (current === undefined) return 0;
  let startValue = current.value;
  if (current.usePrevious === 1) {
    startValue = 0;
    for (let i = index - 1; i >= 0; i -= 1) {
      const previous = values[i];
      if (previous !== undefined && previous.usePrevious !== 1) {
        startValue = previous.value;
        break;
      }
    }
  }
  const start = repeat(startValue, 360);
  const next = values[index + 1];
  if (next === undefined || next.usePrevious === 1) return start;
  const end = targetAngle(start, repeat(next.value, 360), next.loop, next.direction);
  const duration = next.time - current.time;
  const progress = duration <= 0 ? 1 : clamp01((time - current.time) / duration);
  return lerp(start, end, easingFromId(next.easing)(progress));
}

export function translationTween(
  events: ExpandedGlsEvent<LightTranslationEvent, LightTransformEventBox<LightTranslationEvent>>[],
  toSongBpmTime: (jsonTime: number) => number,
  limits: readonly [number, number],
  distributionLimits: readonly [number, number],
  mirrored: boolean,
): TweenEvent[] {
  return events.map(({ jsonTime, distributionOffset, event, box }) => {
    const flip = box.flip === 1 ? -1 : 1;
    const mirror = mirrored ? -1 : 1;
    const translation = event.translation * flip * mirror;
    const distribution = distributionOffset * flip * mirror;
    return {
      time: toSongBpmTime(jsonTime),
      value:
        lerp(limits[0], limits[1], (translation + 1) * 0.5) +
        lerp(distributionLimits[0], distributionLimits[1], (distribution + 1) * 0.5),
      easing: event.easing,
      usePrevious: event.usePrevious,
    };
  });
}
