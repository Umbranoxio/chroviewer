import { z } from 'zod';

import type { BasicEvent } from '../beatmap/types';
import { beatSaberNumberSchema as numberSchema, beatSaberStringSchema as stringSchema } from '../beatmap/value-schema';
import { chromaColor, type ChromaColor } from '../chroma';
import type { ColorScheme, Rgb } from '../colors';
import { easingFromId, easingFromName, type EasingFunction } from '../easing';

const lightGradientSchema = z.record(z.string(), z.json());

export type BasicLightColor = 'red' | 'blue' | 'white';
export type LightshowMode = 'full' | 'full-lightshow' | 'static' | 'none';

export const isFullLightshowMode = (mode: LightshowMode) => mode === 'full' || mode === 'full-lightshow';
export const isForcedLightshowMode = (mode: LightshowMode) => mode === 'full-lightshow';

export interface BasicLightSample {
  color: BasicLightColor;
  customColor?: Rgb;
  customAlpha?: number;
  alpha: number;
  resolvedAlpha?: number;
  fading?: true;
  transition?: {
    color: BasicLightColor;
    customColor?: Rgb;
    customAlpha?: number;
    progress: number;
    useHsv?: boolean;
  };
}

export interface BasicLightOptions {
  songBpm: number;
  offIntensity: number;
  lightOnStart: boolean;
  normalAlpha?: number;
  highlightAlpha?: number;
}

export const GAME_LIGHT_NORMAL_ALPHA = 191 / 255;
export const GAME_LIGHT_BOOST_NORMAL_ALPHA = 0.8;
export const GAME_LIGHT_HIGHLIGHT_ALPHA = 1;

export interface BasicLightTimeline {
  events: BasicEvent[];
  customColors: (Rgb | undefined)[];
  customAlphas: (number | undefined)[];
  gradients: ChromaGradient[];
}

interface ChromaGradient {
  startBeat: number;
  endBeat: number;
  startColor: ChromaColor;
  endColor: ChromaColor;
  easing: EasingFunction;
}

const isOff = (value: number) => value === 0;
const isOn = (value: number) => value === 1 || value === 5 || value === 9;
const isFlash = (value: number) => value === 2 || value === 6 || value === 10;
const isFade = (value: number) => value === 3 || value === 7 || value === 11;
const isTransition = (value: number) => value === 4 || value === 8 || value === 12;
const isLightValue = (value: number) => value >= 0 && value <= 12;
const canTransition = (value: number) => isOff(value) || isOn(value) || isTransition(value);
const RGB_INT_OFFSET = 2_000_000_000;
const RGB_RESET = 1_900_000_001;
const STATIC_LIGHT_EVENT: BasicEvent = {
  jsonTime: 0,
  songBpmTime: 0,
  type: 0,
  value: 1,
  floatValue: 1,
};
const STATIC_LIGHT_TIMELINE: BasicLightTimeline = {
  events: [STATIC_LIGHT_EVENT],
  customColors: [undefined],
  customAlphas: [undefined],
  gradients: [],
};
const EMPTY_LIGHT_TIMELINE: BasicLightTimeline = {
  events: [],
  customColors: [],
  customAlphas: [],
  gradients: [],
};

function eventColor(value: number): BasicLightColor {
  if (value >= 1 && value <= 4) return 'blue';
  if (value >= 5 && value <= 8) return 'red';
  return 'white';
}

const clamp01 = (value: number) => Math.min(Math.max(value, 0), 1);
const lerp = (start: number, end: number, time: number) => start + (end - start) * time;
function sameColor(left: Rgb | undefined, right: Rgb | undefined) {
  if (left === right) return true;
  if (left === undefined || right === undefined) return false;
  return left[0] === right[0] && left[1] === right[1] && left[2] === right[2];
}

function inheritedColor(events: BasicEvent[], index: number): BasicLightColor {
  for (let i = index; i >= 0; i--) {
    const event = events[i];
    if (event !== undefined && !isOff(event.value)) return eventColor(event.value);
  }
  return 'red';
}

function eventChromaColor(event: BasicEvent): ChromaColor | undefined {
  if (event.value >= 9 && event.value <= 12) return undefined;
  return chromaColor(event.customData);
}

function eventGradient(event: BasicEvent): ChromaGradient | undefined {
  const parsed = lightGradientSchema.safeParse(event.customData?._lightGradient ?? event.customData?.lightGradient);
  if (!parsed.success) return undefined;
  const data = parsed.data;
  const startColor = chromaColor({
    color: data._startColor ?? data.startColor ?? null,
  });
  const endColor = chromaColor({
    color: data._endColor ?? data.endColor ?? null,
  });
  if (startColor === undefined || endColor === undefined) return undefined;
  const duration = numberSchema.parse(data._duration ?? data.duration);
  return {
    startBeat: event.songBpmTime,
    endBeat: event.songBpmTime + duration,
    startColor,
    endColor,
    easing: easingFromName(stringSchema.parse(data._easing ?? data.easing) || undefined),
  };
}

function eventIndexAt(events: BasicEvent[], beat: number) {
  let low = 0;
  let high = events.length;
  while (low < high) {
    const middle = (low + high) >>> 1;
    if ((events[middle]?.songBpmTime ?? Infinity) <= beat) low = middle + 1;
    else high = middle;
  }
  return low - 1;
}

export function createBasicLightTimeline(source: BasicEvent[]): BasicLightTimeline {
  const events = source.filter((event) => isLightValue(event.value));
  const colors = new Map<BasicEvent, ChromaColor | undefined>();
  let legacyColor: ChromaColor | undefined;
  let start = 0;
  while (start < source.length) {
    const time = source[start]?.songBpmTime;
    let end = start + 1;
    while (end < source.length && source[end]?.songBpmTime === time) end++;
    for (let index = start; index < end; index++) {
      const event = source[index];
      if (event === undefined) continue;
      if (event.value === RGB_RESET) legacyColor = undefined;
      else if (event.value >= RGB_INT_OFFSET) {
        const packed = event.value - RGB_INT_OFFSET;
        legacyColor = [((packed >> 16) & 255) / 255, ((packed >> 8) & 255) / 255, (packed & 255) / 255, 1];
      }
    }
    for (let index = start; index < end; index++) {
      const event = source[index];
      if (event !== undefined && isLightValue(event.value)) {
        colors.set(event, legacyColor ?? eventChromaColor(event));
      }
    }
    start = end;
  }
  return {
    events,
    customColors: events.map((event) => {
      const color = colors.get(event);
      return color === undefined ? undefined : [color[0], color[1], color[2]];
    }),
    customAlphas: events.map((event) => {
      const alpha = colors.get(event)?.[3];
      return alpha === 1 ? undefined : alpha;
    }),
    gradients: source.flatMap((event) => eventGradient(event) ?? []),
  };
}

function sampleGradient(gradients: ChromaGradient[], stateBeat: number, beat: number): ChromaColor | undefined {
  for (let index = gradients.length - 1; index >= 0; index--) {
    const gradient = gradients[index];
    if (gradient === undefined || stateBeat < gradient.startBeat || stateBeat > gradient.endBeat) continue;
    const duration = gradient.endBeat - gradient.startBeat;
    const time = gradient.easing(duration <= 0 ? 1 : clamp01((beat - gradient.startBeat) / duration));
    return [
      lerp(gradient.startColor[0], gradient.endColor[0], time),
      lerp(gradient.startColor[1], gradient.endColor[1], time),
      lerp(gradient.startColor[2], gradient.endColor[2], time),
      lerp(gradient.startColor[3], gradient.endColor[3], time),
    ];
  }
  return undefined;
}

export function sampleBasicLightTimeline(
  timeline: BasicLightTimeline,
  beat: number,
  options: BasicLightOptions,
): BasicLightSample {
  const events = timeline.events;
  const index = eventIndexAt(events, beat);
  if (index < 0) {
    return {
      color: 'red',
      alpha: options.lightOnStart ? options.offIntensity : 0,
    };
  }

  const event = events[index];
  if (event === undefined) return { color: 'red', alpha: 0 };
  const next = events[index + 1];
  const normalAlpha = options.normalAlpha ?? 1;
  const highlightAlpha = options.highlightAlpha ?? 1.2;
  let color = isOff(event.value) ? inheritedColor(events, index - 1) : eventColor(event.value);
  let customColor = isOff(event.value) ? undefined : timeline.customColors[index];
  let customAlpha = isOff(event.value) ? undefined : timeline.customAlphas[index];
  let alpha = isOff(event.value) ? event.floatValue * options.offIntensity : event.floatValue * normalAlpha;

  if (next !== undefined && isTransition(next.value) && canTransition(event.value)) {
    const duration = next.songBpmTime - event.songBpmTime;
    const rawTime = duration <= 0 ? 1 : clamp01((beat - event.songBpmTime) / duration);
    const easing = easingFromName(stringSchema.parse(next.customData?._easing ?? next.customData?.easing) || undefined);
    const time = easing(rawTime);
    const nextColor = eventColor(next.value);
    const nextCustomColor = timeline.customColors[index + 1];
    const nextCustomAlpha = timeline.customAlphas[index + 1];
    if (isOff(event.value)) {
      color = nextColor;
      customColor = nextCustomColor;
      customAlpha = nextCustomAlpha;
    }
    const stateAlpha = lerp(alpha, next.floatValue * normalAlpha, time);
    const resolvedAlpha = lerp(
      alpha * (customAlpha ?? 1),
      next.floatValue * normalAlpha * (nextCustomAlpha ?? 1),
      time,
    );
    const sample: BasicLightSample = {
      color,
      ...(customColor === undefined ? {} : { customColor }),
      ...(customAlpha === undefined ? {} : { customAlpha }),
      alpha: stateAlpha,
      ...(resolvedAlpha === stateAlpha ? {} : { resolvedAlpha }),
      transition:
        color === nextColor && sameColor(customColor, nextCustomColor) && customAlpha === nextCustomAlpha
          ? undefined
          : {
              color: nextColor,
              ...(nextCustomColor === undefined ? {} : { customColor: nextCustomColor }),
              ...(nextCustomAlpha === undefined ? {} : { customAlpha: nextCustomAlpha }),
              progress: time,
              ...(stringSchema.parse(next.customData?._lerpType ?? next.customData?.lerpType) === 'HSV'
                ? { useHsv: true }
                : {}),
            },
    };
    const gradient = sampleGradient(timeline.gradients, event.songBpmTime, beat);
    if (gradient === undefined) return sample;
    return {
      color: sample.color,
      customColor: [gradient[0], gradient[1], gradient[2]],
      customAlpha: gradient[3],
      alpha: sample.alpha,
    };
  }

  const elapsed = beat - event.songBpmTime;
  if (isFlash(event.value)) {
    const duration = (0.6 * options.songBpm) / 60;
    alpha = lerp(
      event.floatValue * highlightAlpha,
      event.floatValue * normalAlpha,
      easingFromId(8)(clamp01(elapsed / duration)),
    );
  } else if (isFade(event.value)) {
    const duration = (1.5 * options.songBpm) / 60;
    alpha = lerp(
      event.floatValue * highlightAlpha,
      event.floatValue * options.offIntensity,
      easingFromId(17)(clamp01(elapsed / duration)),
    );
  }
  const gradient = sampleGradient(timeline.gradients, event.songBpmTime, beat);
  if (gradient !== undefined) {
    customColor = [gradient[0], gradient[1], gradient[2]];
    customAlpha = gradient[3];
  }
  const sample: BasicLightSample = {
    color,
    ...(customColor === undefined ? {} : { customColor }),
    ...(customAlpha === undefined ? {} : { customAlpha }),
    alpha,
  };
  if (isFade(event.value)) sample.fading = true;
  return sample;
}

export function boostAt(events: BasicEvent[], beat: number) {
  for (let index = eventIndexAt(events, beat); index >= 0; index--) {
    const event = events[index];
    if (event?.type === 5) return event.value === 1;
  }
  return false;
}

export function latestBasicLightTimelineBeat(timeline: BasicLightTimeline, beat: number) {
  return timeline.events[eventIndexAt(timeline.events, beat)]?.songBpmTime ?? Number.NEGATIVE_INFINITY;
}

function schemeColor(color: BasicLightColor, scheme: ColorScheme, invert: boolean, boost: boolean): Rgb {
  if (color === 'white') return boost ? scheme.environmentWhiteBoost : scheme.environmentWhite;
  const left = boost ? scheme.environmentLeftBoost : scheme.environmentLeft;
  const right = boost ? scheme.environmentRightBoost : scheme.environmentRight;
  if (color === 'blue') return invert ? left : right;
  return invert ? right : left;
}

export function resolveBasicLightColor(
  sample: BasicLightSample,
  scheme: ColorScheme,
  invert: boolean,
  boost: boolean,
): Rgb {
  const start = sample.customColor ?? schemeColor(sample.color, scheme, invert, boost);
  if (sample.transition === undefined) return start;
  const end = sample.transition.customColor ?? schemeColor(sample.transition.color, scheme, invert, boost);
  const time = sample.transition.progress;
  return sample.transition.useHsv ? lerpHsv(start, end, time) : lerpRgb(start, end, time);
}

function lerpRgb(start: Rgb, end: Rgb, time: number): Rgb {
  return [lerp(start[0], end[0], time), lerp(start[1], end[1], time), lerp(start[2], end[2], time)];
}

function rgbToHsv(color: Rgb): Rgb {
  const max = Math.max(...color);
  const min = Math.min(...color);
  const delta = max - min;
  let hue = 0;
  if (delta !== 0) {
    if (max === color[0]) hue = ((color[1] - color[2]) / delta) % 6;
    else if (max === color[1]) hue = (color[2] - color[0]) / delta + 2;
    else hue = (color[0] - color[1]) / delta + 4;
    hue /= 6;
    if (hue < 0) hue += 1;
  }
  return [hue, max === 0 ? 0 : delta / max, max];
}

function hsvToRgb([hue, saturation, value]: Rgb): Rgb {
  saturation = clamp01(saturation);
  value = clamp01(value);
  const section = Math.floor(hue * 6);
  const fraction = hue * 6 - section;
  const p = value * (1 - saturation);
  const q = value * (1 - fraction * saturation);
  const t = value * (1 - (1 - fraction) * saturation);
  switch (section % 6) {
    case 0:
      return [value, t, p];
    case 1:
      return [q, value, p];
    case 2:
      return [p, value, t];
    case 3:
      return [p, q, value];
    case 4:
      return [t, p, value];
    default:
      return [value, p, q];
  }
}

function lerpHsv(start: Rgb, end: Rgb, time: number): Rgb {
  const startHsv = rgbToHsv(start);
  const endHsv = rgbToHsv(end);
  let hueDelta = endHsv[0] - startHsv[0];
  if (hueDelta > 0.5) hueDelta -= 1;
  if (hueDelta < -0.5) hueDelta += 1;
  return hsvToRgb([
    (startHsv[0] + hueDelta * time + 1) % 1,
    lerp(startHsv[1], endHsv[1], time),
    lerp(startHsv[2], endHsv[2], time),
  ]);
}

export function resolveBasicLightAlpha(sample: BasicLightSample) {
  if (sample.resolvedAlpha !== undefined) return sample.resolvedAlpha;
  if (sample.transition === undefined) return sample.alpha * (sample.customAlpha ?? 1);
  return sample.alpha * lerp(sample.customAlpha ?? 1, sample.transition.customAlpha ?? 1, sample.transition.progress);
}

export function customLightIds(event: BasicEvent): number[] | undefined {
  const value = event.customData?._lightID ?? event.customData?.lightID;
  if (value === undefined) return undefined;
  const values = Array.isArray(value) ? value : [value];
  const ids = values.map((id) => numberSchema.parse(id));
  return ids.length === 0 ? undefined : ids;
}

export function customPropIds(event: BasicEvent): number[] | undefined {
  const value = event.customData?._propID ?? event.customData?.propID;
  if (value === undefined) return undefined;
  const values = Array.isArray(value) ? value : [value];
  const ids = values.map((id) => numberSchema.parse(id));
  return ids.length === 0 ? undefined : ids;
}

export function lightTimelineForMode(mode: LightshowMode, timeline: BasicLightTimeline) {
  if (mode === 'static') return STATIC_LIGHT_TIMELINE;
  if (mode === 'none') return EMPTY_LIGHT_TIMELINE;
  return timeline;
}
