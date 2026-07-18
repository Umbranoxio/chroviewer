import { Result, TaggedError } from 'better-result';
import * as z from 'zod/mini';

import type { HitScoreVisualizerConfig } from './hit-score-visualizer';

export const MAX_HSV_PROFILE_BYTES = 32 * 1024;

const maxListItems = 32;
const maxStringBytes = 512;
const latestSupportedMinor = 7;
const displayModes = ['none', 'format', 'textonly', 'numeric', 'scoreontop', 'directions'] as const;
const badCutTypes = ['all', 'wrongdirection', 'wrongcolor', 'bomb'] as const;

const colorSchema = z.union([
  z.array(z.number()).check(z.minLength(4)),
  z.object({
    r: z.optional(z.number()),
    g: z.optional(z.number()),
    b: z.optional(z.number()),
    a: z.optional(z.number()),
    R: z.optional(z.number()),
    G: z.optional(z.number()),
    B: z.optional(z.number()),
    A: z.optional(z.number()),
  }),
]);
const vectorSchema = z.union([
  z.array(z.number()).check(z.minLength(3)),
  z.object({
    x: z.optional(z.number()),
    y: z.optional(z.number()),
    z: z.optional(z.number()),
    X: z.optional(z.number()),
    Y: z.optional(z.number()),
    Z: z.optional(z.number()),
  }),
]);
const displayModeSchema = z.union([z.number(), z.string()]);
const judgmentSchema = z.object({
  threshold: z.optional(z.number()),
  text: z.optional(z.string()),
  color: z.optional(colorSchema),
  fade: z.optional(z.boolean()),
});
const segmentSchema = z.object({
  threshold: z.optional(z.number()),
  text: z.optional(z.string()),
});
const coloredTextSchema = z.object({
  text: z.optional(z.string()),
  color: z.optional(colorSchema),
});
const badCutDisplaySchema = z.object({
  text: z.optional(z.string()),
  color: z.optional(colorSchema),
  type: z.optional(z.union([z.number(), z.string()])),
});
const profileFields = {
  displayMode: z.optional(displayModeSchema),
  fixedPosition: z.optional(vectorSchema),
  targetPositionOffset: z.optional(vectorSchema),
  judgments: z.array(judgmentSchema),
  chainHeadJudgments: z.optional(z.array(judgmentSchema)),
  chainLinkDisplay: z.optional(coloredTextSchema),
  beforeCutAngleJudgments: z.optional(z.array(segmentSchema)),
  accuracyJudgments: z.optional(z.array(segmentSchema)),
  afterCutAngleJudgments: z.optional(z.array(segmentSchema)),
  badCutDisplays: z.optional(z.array(badCutDisplaySchema)),
  missDisplays: z.optional(z.array(coloredTextSchema)),
};
const modernProfileSchema = z.object({
  ...profileFields,
  majorVersion: z.number(),
  minorVersion: z.number(),
  patchVersion: z.optional(z.number()),
  timeDependenceDecimalPrecision: z.optional(z.number()),
  timeDependenceDecimalOffset: z.optional(z.number()),
  timeDependenceJudgments: z.optional(z.array(segmentSchema)),
  timeDependencyDecimalPrecision: z.optional(z.number()),
  timeDependencyDecimalOffset: z.optional(z.number()),
  timeDependencyJudgments: z.optional(z.array(segmentSchema)),
});
const legacyProfileSchema = z.object({
  ...profileFields,
  majorVersion: z.optional(z.never()),
  timeDependencyDecimalPrecision: z.optional(z.number()),
  timeDependencyDecimalOffset: z.optional(z.number()),
  timeDependencyJudgments: z.optional(z.array(segmentSchema)),
});
const profileSchema = z.union([modernProfileSchema, legacyProfileSchema]);

type Profile = z.infer<typeof profileSchema>;
type Judgment = z.infer<typeof judgmentSchema>;
type Segment = z.infer<typeof segmentSchema>;
type ColoredText = z.infer<typeof coloredTextSchema>;
type BadCutDisplay = z.infer<typeof badCutDisplaySchema>;
type Color = z.infer<typeof colorSchema>;
type Vector = z.infer<typeof vectorSchema>;

export class InvalidHsvProfile extends TaggedError('InvalidHsvProfile')<{
  message: string;
}>() {}

function invalid(message: string) {
  return new InvalidHsvProfile({ message });
}

function validateList(values: readonly unknown[] | undefined, name: string) {
  return (values?.length ?? 0) <= maxListItems
    ? Result.ok(undefined)
    : Result.err(invalid(`${name} contains more than ${String(maxListItems)} entries`));
}

function validateText(value: string, name: string) {
  return new TextEncoder().encode(value).length <= maxStringBytes
    ? Result.ok(undefined)
    : Result.err(invalid(`${name} contains text longer than ${String(maxStringBytes)} bytes`));
}

function readDisplayMode(value: string | number | undefined, legacy: boolean) {
  if (value === undefined) return Result.ok(legacy ? 4 : 0);
  if (typeof value === 'number') {
    return Number.isInteger(value) && value >= 0 && value < displayModes.length
      ? Result.ok(value)
      : Result.err(invalid('display mode is not supported'));
  }
  const index = displayModes.indexOf(value.replaceAll('_', '').toLowerCase() as (typeof displayModes)[number]);
  return index === -1 ? Result.err(invalid('display mode is not supported')) : Result.ok(index);
}

function readBadCutType(value: string | number | undefined) {
  if (value === undefined) return Result.ok(0);
  if (typeof value === 'number') {
    return Number.isInteger(value) && value >= 0 && value < badCutTypes.length
      ? Result.ok(value)
      : Result.err(invalid('bad cut display type is not supported'));
  }
  const index = badCutTypes.indexOf(value.replaceAll('_', '').toLowerCase() as (typeof badCutTypes)[number]);
  return index === -1 ? Result.err(invalid('bad cut display type is not supported')) : Result.ok(index);
}

function colorChannel(value: number) {
  return Math.round(Math.min(Math.max(value, 0), 1) * 255);
}

function colorHex(value: Color | undefined) {
  const channels = Array.isArray(value)
    ? value
    : [value?.r ?? value?.R ?? 1, value?.g ?? value?.G ?? 1, value?.b ?? value?.B ?? 1];
  return `#${channels
    .slice(0, 3)
    .map((channel) => colorChannel(channel).toString(16).padStart(2, '0'))
    .join('')}`;
}

function vectorTuple(value: Vector | undefined): readonly [number, number, number] | undefined {
  if (value === undefined) return undefined;
  return Array.isArray(value)
    ? [value[0] ?? 0, value[1] ?? 0, value[2] ?? 0]
    : [value.x ?? value.X ?? 0, value.y ?? value.Y ?? 0, value.z ?? value.Z ?? 0];
}

function validateThresholds(values: readonly { threshold: number }[], name: string) {
  const seen = new Set<number>();
  for (const value of values) {
    if (!Number.isInteger(value.threshold) || value.threshold < 0 || value.threshold > 65_535)
      return Result.err(invalid(`${name} contains an out-of-range threshold`));
    if (seen.has(value.threshold)) return Result.err(invalid(`${name} contains duplicate thresholds`));
    seen.add(value.threshold);
  }
  return Result.ok(undefined);
}

function readJudgments(source: Judgment[] | undefined, name: string, required: boolean, allowFirstFade = false) {
  const list = validateList(source, name);
  if (list.isErr()) return Result.err(list.error);
  if (required && (source === undefined || source.length === 0)) return Result.err(invalid(`${name} is empty`));
  const values = (source ?? [])
    .map((value) => ({
      threshold: value.threshold ?? 0,
      text: value.text ?? '',
      color: colorHex(value.color),
      fade: value.fade ?? false,
    }))
    .sort((left, right) => right.threshold - left.threshold);
  const thresholds = validateThresholds(values, name);
  if (thresholds.isErr()) return Result.err(thresholds.error);
  if (!allowFirstFade && values[0]?.fade === true) return Result.err(invalid(`the first ${name} entry cannot fade`));
  for (const value of values) {
    const text = validateText(value.text, name);
    if (text.isErr()) return Result.err(text.error);
  }
  return Result.ok(values);
}

function readSegments(source: Segment[] | undefined, name: string, floatThresholds = false) {
  const list = validateList(source, name);
  if (list.isErr()) return Result.err(list.error);
  const values = [...(source ?? [])]
    .map((value) => ({
      threshold: value.threshold ?? 0,
      text: value.text ?? '',
    }))
    .sort((left, right) => right.threshold - left.threshold);
  const seen = new Set<number>();
  for (const value of values) {
    if ((!floatThresholds && !Number.isInteger(value.threshold)) || (!floatThresholds && value.threshold < 0))
      return Result.err(invalid(`${name} contains an out-of-range threshold`));
    if (!floatThresholds && value.threshold > 65_535)
      return Result.err(invalid(`${name} contains an out-of-range threshold`));
    if (seen.has(value.threshold)) return Result.err(invalid(`${name} contains duplicate thresholds`));
    seen.add(value.threshold);
    const text = validateText(value.text, name);
    if (text.isErr()) return Result.err(text.error);
  }
  return Result.ok(values);
}

function readColoredText(value: ColoredText | undefined, name: string) {
  if (value === undefined) return Result.ok(undefined);
  const text = value.text ?? '';
  const validText = validateText(text, name);
  return validText.isErr() ? Result.err(validText.error) : Result.ok({ text, color: colorHex(value.color) });
}

function readColoredTexts(source: ColoredText[] | undefined, name: string) {
  const list = validateList(source, name);
  if (list.isErr()) return Result.err(list.error);
  const values: { text: string; color: string }[] = [];
  for (const value of source ?? []) {
    const entry = readColoredText(value, name);
    if (entry.isErr()) return Result.err(entry.error);
    if (entry.value !== undefined) values.push(entry.value);
  }
  return Result.ok(values);
}

function readBadCutDisplays(source: BadCutDisplay[] | undefined) {
  const list = validateList(source, 'bad cut displays');
  if (list.isErr()) return Result.err(list.error);
  const values: { text: string; color: string; type: number }[] = [];
  for (const value of source ?? []) {
    const text = value.text ?? '';
    const validText = validateText(text, 'bad cut displays');
    if (validText.isErr()) return Result.err(validText.error);
    const type = readBadCutType(value.type);
    if (type.isErr()) return Result.err(type.error);
    values.push({ text, color: colorHex(value.color), type: type.value });
  }
  return Result.ok(values);
}

function readProfile(profile: Profile) {
  const legacy = profile.majorVersion === undefined;
  if (
    !legacy &&
    (profile.majorVersion !== 3 ||
      !Number.isInteger(profile.minorVersion) ||
      profile.minorVersion < 0 ||
      profile.minorVersion > latestSupportedMinor)
  )
    return Result.err(invalid('only Hit Score Visualizer 3.0 through 3.7 profiles are supported'));
  const displayMode = readDisplayMode(profile.displayMode, legacy);
  if (displayMode.isErr()) return Result.err(displayMode.error);
  const judgments = readJudgments(profile.judgments, 'judgments', true, legacy);
  if (judgments.isErr()) return Result.err(judgments.error);
  const chainHeadJudgments = readJudgments(profile.chainHeadJudgments, 'chain head judgments', false, legacy);
  if (chainHeadJudgments.isErr()) return Result.err(chainHeadJudgments.error);
  const chainLinkDisplay = readColoredText(profile.chainLinkDisplay, 'chain link display');
  if (chainLinkDisplay.isErr()) return Result.err(chainLinkDisplay.error);
  const beforeSegments = readSegments(profile.beforeCutAngleJudgments, 'before cut angle judgments');
  if (beforeSegments.isErr()) return Result.err(beforeSegments.error);
  const accuracySegments = readSegments(profile.accuracyJudgments, 'accuracy judgments');
  if (accuracySegments.isErr()) return Result.err(accuracySegments.error);
  const afterSegments = readSegments(profile.afterCutAngleJudgments, 'after cut angle judgments');
  if (afterSegments.isErr()) return Result.err(afterSegments.error);
  const timeSegments = readSegments(
    legacy ? profile.timeDependencyJudgments : (profile.timeDependencyJudgments ?? profile.timeDependenceJudgments),
    'time dependence judgments',
    true,
  );
  if (timeSegments.isErr()) return Result.err(timeSegments.error);
  const badCuts = readBadCutDisplays(profile.badCutDisplays);
  if (badCuts.isErr()) return Result.err(badCuts.error);
  const misses = readColoredTexts(profile.missDisplays, 'miss displays');
  if (misses.isErr()) return Result.err(misses.error);
  const timePrecision =
    (legacy
      ? profile.timeDependencyDecimalPrecision
      : (profile.timeDependencyDecimalPrecision ?? profile.timeDependenceDecimalPrecision)) ?? (legacy ? 0 : 1);
  const timeOffset =
    (legacy
      ? profile.timeDependencyDecimalOffset
      : (profile.timeDependencyDecimalOffset ?? profile.timeDependenceDecimalOffset)) ?? (legacy ? 0 : 2);
  if (!Number.isInteger(timePrecision) || timePrecision < 0 || timePrecision > 99)
    return Result.err(invalid('time dependence decimal precision is out of range'));
  if (!Number.isInteger(timeOffset) || timeOffset < 0 || timeOffset > 38)
    return Result.err(invalid('time dependence decimal offset is out of range'));
  return Result.ok({
    displayMode: displayMode.value,
    fixedPosition: vectorTuple(profile.fixedPosition),
    targetPositionOffset: vectorTuple(profile.targetPositionOffset),
    judgments: judgments.value,
    chainHeadJudgments:
      chainHeadJudgments.value.length === 0
        ? [{ threshold: 0, text: '%s', color: '#ffffff', fade: false }]
        : chainHeadJudgments.value,
    chainLinkDisplay: chainLinkDisplay.value ?? {
      text: '<u>%s',
      color: '#ffffff',
    },
    beforeSegments: beforeSegments.value,
    accuracySegments: accuracySegments.value,
    afterSegments: afterSegments.value,
    timeSegments: timeSegments.value,
    badCuts: badCuts.value,
    misses: misses.value,
    timePrecision,
    timeOffset,
  } satisfies HitScoreVisualizerConfig);
}

export function parseHitScoreVisualizerProfile(text: string) {
  if (new TextEncoder().encode(text).length > MAX_HSV_PROFILE_BYTES)
    return Result.err(invalid(`profile is larger than ${String(MAX_HSV_PROFILE_BYTES / 1024)} KB`));
  const json = Result.try({
    try: (): unknown => JSON.parse(text),
    catch: () => invalid('profile is not valid JSON'),
  });
  if (json.isErr()) return Result.err(json.error);
  const parsed = profileSchema.safeParse(json.value);
  return parsed.success ? readProfile(parsed.data) : Result.err(invalid('profile format is not supported'));
}
