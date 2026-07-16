import { z } from 'zod';

import type {
  Difficulty,
  EventBox,
  EventBoxGroup,
  FloatFxEvent,
  IndexFilter,
  LightColorEvent,
  LightColorEventBox,
  LightRotationEvent,
  LightTransformEventBox,
  LightTranslationEvent,
} from './types';
import {
  beatSaberIntegerSchema as integerSchema,
  beatSaberJsonObjectSchema as customDataSchema,
  beatSaberNumberSchema as numberSchema,
} from './value-schema';
const indexFilterSchema = z.object({
  f: integerSchema,
  p: integerSchema,
  t: integerSchema,
  r: integerSchema,
  c: integerSchema,
  n: integerSchema,
  s: integerSchema,
  l: numberSchema,
  d: integerSchema,
});
const v3ColorEventSchema = z.object({
  b: numberSchema,
  c: integerSchema,
  s: numberSchema,
  i: integerSchema,
  f: integerSchema,
  sb: numberSchema,
  sf: integerSchema,
  customData: customDataSchema.optional().catch(undefined),
});
const v3RotationEventSchema = z.object({
  b: numberSchema,
  r: numberSchema,
  o: integerSchema,
  e: integerSchema,
  l: integerSchema,
  p: integerSchema,
  customData: customDataSchema.optional().catch(undefined),
});
const v3TranslationEventSchema = z.object({
  b: numberSchema,
  t: numberSchema,
  e: integerSchema,
  p: integerSchema,
  customData: customDataSchema.optional().catch(undefined),
});
const v3ColorBoxSchema = z.object({
  f: indexFilterSchema.catch({ f: 0, p: 0, t: 0, r: 0, c: 0, n: 0, s: 0, l: 0, d: 0 }),
  w: numberSchema,
  d: integerSchema,
  r: numberSchema,
  t: integerSchema,
  b: integerSchema,
  i: integerSchema,
  e: z.array(v3ColorEventSchema).catch([]),
});
const v3RotationBoxSchema = z.object({
  f: indexFilterSchema.catch({ f: 0, p: 0, t: 0, r: 0, c: 0, n: 0, s: 0, l: 0, d: 0 }),
  w: numberSchema,
  d: integerSchema,
  s: numberSchema,
  t: integerSchema,
  b: integerSchema,
  i: integerSchema,
  a: integerSchema,
  r: integerSchema,
  l: z.array(v3RotationEventSchema).catch([]),
});
const v3TranslationBoxSchema = z.object({
  f: indexFilterSchema.catch({ f: 0, p: 0, t: 0, r: 0, c: 0, n: 0, s: 0, l: 0, d: 0 }),
  w: numberSchema,
  d: integerSchema,
  s: numberSchema,
  t: integerSchema,
  b: integerSchema,
  i: integerSchema,
  a: integerSchema,
  r: integerSchema,
  l: z.array(v3TranslationEventSchema).catch([]),
});
const v3FloatEventSchema = z.object({
  b: numberSchema,
  v: numberSchema,
  i: integerSchema,
  p: integerSchema,
});
const v3FxBoxSchema = z.object({
  f: indexFilterSchema.catch({ f: 0, p: 0, t: 0, r: 0, c: 0, n: 0, s: 0, l: 0, d: 0 }),
  w: numberSchema,
  d: integerSchema,
  s: numberSchema,
  t: integerSchema,
  b: integerSchema,
  i: integerSchema,
  l: z.array(integerSchema).catch([]),
});

function groupSchema<T extends z.ZodType>(box: T) {
  return z.object({
    b: numberSchema,
    g: integerSchema,
    t: integerSchema,
    e: z.array(box).catch([]),
    customData: customDataSchema.optional().catch(undefined),
  });
}

const v3GlsSchema = z
  .object({
    lightColorEventBoxGroups: z.array(groupSchema(v3ColorBoxSchema)).catch([]),
    lightRotationEventBoxGroups: z.array(groupSchema(v3RotationBoxSchema)).catch([]),
    lightTranslationEventBoxGroups: z.array(groupSchema(v3TranslationBoxSchema)).catch([]),
    _fxEventsCollection: z.object({ _fl: z.array(v3FloatEventSchema).catch([]) }).catch({ _fl: [] }),
    vfxEventBoxGroups: z.array(groupSchema(v3FxBoxSchema)).catch([]),
  })
  .catch({
    lightColorEventBoxGroups: [],
    lightRotationEventBoxGroups: [],
    lightTranslationEventBoxGroups: [],
    _fxEventsCollection: { _fl: [] },
    vfxEventBoxGroups: [],
  });

const v4BoxDataSchema = z.object({
  w: numberSchema,
  d: integerSchema,
  s: numberSchema,
  t: integerSchema,
  b: integerSchema,
  e: integerSchema,
  a: integerSchema,
  f: integerSchema,
});
const v4ColorEventSchema = z.object({
  c: integerSchema,
  b: numberSchema,
  e: integerSchema,
  p: integerSchema,
  f: integerSchema,
  sb: numberSchema,
  sf: integerSchema,
});
const v4RotationEventSchema = z.object({
  r: numberSchema,
  d: integerSchema,
  e: integerSchema,
  l: integerSchema,
  p: integerSchema,
});
const v4TranslationEventSchema = z.object({ t: numberSchema, e: integerSchema, p: integerSchema });
const v4FxEventSchema = z.object({ v: numberSchema, e: integerSchema, p: integerSchema });
const v4GroupSchema = z.object({
  b: numberSchema,
  g: integerSchema,
  t: integerSchema,
  e: z
    .array(
      z.object({
        f: integerSchema,
        e: integerSchema,
        l: z.array(z.object({ b: numberSchema, i: integerSchema })).catch([]),
      }),
    )
    .catch([]),
  customData: customDataSchema.optional().catch(undefined),
});
const v4GlsSchema = z
  .object({
    indexFilters: z.array(indexFilterSchema).catch([]),
    eventBoxGroups: z.array(v4GroupSchema).catch([]),
    lightColorEventBoxes: z.array(v4BoxDataSchema).catch([]),
    lightColorEvents: z.array(v4ColorEventSchema).catch([]),
    lightRotationEventBoxes: z.array(v4BoxDataSchema).catch([]),
    lightRotationEvents: z.array(v4RotationEventSchema).catch([]),
    lightTranslationEventBoxes: z.array(v4BoxDataSchema).catch([]),
    lightTranslationEvents: z.array(v4TranslationEventSchema).catch([]),
    fxEventBoxes: z.array(v4BoxDataSchema).catch([]),
    floatFxEvents: z.array(v4FxEventSchema).catch([]),
  })
  .catch({
    indexFilters: [],
    eventBoxGroups: [],
    lightColorEventBoxes: [],
    lightColorEvents: [],
    lightRotationEventBoxes: [],
    lightRotationEvents: [],
    lightTranslationEventBoxes: [],
    lightTranslationEvents: [],
    fxEventBoxes: [],
    floatFxEvents: [],
  });

interface V3BoxBase {
  f: z.infer<typeof indexFilterSchema>;
  w: number;
  d: number;
  t: number;
  b: number;
  i: number;
}
interface V3Group {
  b: number;
  g: number;
  customData?: z.infer<typeof customDataSchema>;
}
type V4BoxData = z.infer<typeof v4BoxDataSchema>;
type V4Gls = z.infer<typeof v4GlsSchema>;

function at<T>(items: T[], index: number, name: string): T {
  const item = items[index];
  if (item === undefined) throw new Error(`missing ${name} common data at index ${String(index)}`);
  return item;
}

function parseIndexFilter(node: z.infer<typeof indexFilterSchema>): IndexFilter {
  return {
    type: node.f,
    param0: node.p,
    param1: node.t,
    reverse: node.r,
    chunks: node.c,
    random: node.n,
    seed: node.s,
    limit: node.l,
    limitAffectsType: node.d,
  };
}

function parseColorEventV3(node: z.infer<typeof v3ColorEventSchema>): LightColorEvent {
  return {
    relativeJsonTime: node.b,
    color: node.c,
    brightness: node.s,
    usePrevious: node.i === 2 ? 1 : 0,
    easing: node.i === 0 ? -1 : 0,
    frequency: node.f,
    strobeBrightness: node.sb,
    strobeFade: node.sf,
    customData: node.customData,
  };
}

function parseRotationEventV3(node: z.infer<typeof v3RotationEventSchema>): LightRotationEvent {
  return {
    relativeJsonTime: node.b,
    rotation: node.r,
    direction: node.o,
    easing: node.e,
    loop: node.l,
    usePrevious: node.p,
    customData: node.customData,
  };
}

function parseTranslationEventV3(node: z.infer<typeof v3TranslationEventSchema>): LightTranslationEvent {
  return {
    relativeJsonTime: node.b,
    translation: node.t,
    easing: node.e,
    usePrevious: node.p,
    customData: node.customData,
  };
}

function parseBoxBase<T>(node: V3BoxBase, events: T[], distribution: number): EventBox<T> {
  return {
    indexFilter: parseIndexFilter(node.f),
    beatDistribution: node.w,
    beatDistributionType: node.d,
    distribution,
    distributionType: node.t,
    affectFirst: node.b,
    easing: node.i,
    events,
  };
}

function parseGroup<T>(node: V3Group, boxes: T[]): EventBoxGroup<T> {
  return {
    jsonTime: node.b,
    songBpmTime: 0,
    id: node.g,
    boxes,
    customData: node.customData,
  };
}

export function parseV3Gls(input: unknown, difficulty: Difficulty): void {
  const root = v3GlsSchema.parse(input);

  for (const group of root.lightColorEventBoxGroups) {
    const boxes = group.e.map((box): LightColorEventBox => parseBoxBase(box, box.e.map(parseColorEventV3), box.r));
    difficulty.lightColorEventBoxGroups.push(parseGroup(group, boxes));
  }

  for (const group of root.lightRotationEventBoxGroups) {
    const boxes = group.e.map(
      (box): LightTransformEventBox<LightRotationEvent> => ({
        ...parseBoxBase(box, box.l.map(parseRotationEventV3), box.s),
        axis: box.a,
        flip: box.r,
      }),
    );
    difficulty.lightRotationEventBoxGroups.push(parseGroup(group, boxes));
  }

  for (const group of root.lightTranslationEventBoxGroups) {
    const boxes = group.e.map(
      (box): LightTransformEventBox<LightTranslationEvent> => ({
        ...parseBoxBase(box, box.l.map(parseTranslationEventV3), box.s),
        axis: box.a,
        flip: box.r,
      }),
    );
    difficulty.lightTranslationEventBoxGroups.push(parseGroup(group, boxes));
  }

  const floatEvents = root._fxEventsCollection._fl.map(
    (event): FloatFxEvent => ({
      relativeJsonTime: event.b,
      value: event.v,
      easing: event.i,
      usePrevious: event.p,
    }),
  );
  for (const group of root.vfxEventBoxGroups) {
    const boxes = group.e.map((box) =>
      parseBoxBase(
        box,
        box.l.map((index) => ({ ...at(floatEvents, index, 'float FX event') })),
        box.s,
      ),
    );
    difficulty.fxEventBoxGroups.push({ ...parseGroup(group, boxes), type: group.t });
  }
}

function parseV4BoxData(node: V4BoxData) {
  return {
    beatDistribution: node.w,
    beatDistributionType: node.d,
    distribution: node.s,
    distributionType: node.t,
    affectFirst: node.b,
    easing: node.e,
    axis: node.a,
    flip: node.f,
  };
}

function v4Groups(root: V4Gls, type: number, boxData: V4BoxData[], filters: IndexFilter[]) {
  return root.eventBoxGroups
    .filter((group) => group.t === type)
    .map((group) => ({
      jsonTime: group.b,
      songBpmTime: 0,
      id: group.g,
      customData: group.customData,
      boxes: group.e.map((box) => ({
        indexFilter: { ...at(filters, box.f, 'index filter') },
        ...parseV4BoxData(at(boxData, box.e, 'event box')),
        events: box.l,
      })),
    }));
}

export function loadV4Gls(input: unknown, difficulty: Difficulty): void {
  const root = v4GlsSchema.parse(input);
  const filters = root.indexFilters.map(parseIndexFilter);

  difficulty.lightColorEventBoxGroups.push(
    ...v4Groups(root, 1, root.lightColorEventBoxes, filters).map((group) => ({
      ...group,
      boxes: group.boxes.map((box): LightColorEventBox => {
        return {
          indexFilter: box.indexFilter,
          beatDistribution: box.beatDistribution,
          beatDistributionType: box.beatDistributionType,
          distribution: box.distribution,
          distributionType: box.distributionType,
          affectFirst: box.affectFirst,
          easing: box.easing,
          events: box.events.map((event) => {
            const data = at(root.lightColorEvents, event.i, 'event');
            return {
              relativeJsonTime: event.b,
              color: data.c,
              brightness: data.b,
              easing: data.e,
              usePrevious: data.p,
              frequency: data.f,
              strobeBrightness: data.sb,
              strobeFade: data.sf,
            };
          }),
        };
      }),
    })),
  );

  difficulty.lightRotationEventBoxGroups.push(
    ...v4Groups(root, 2, root.lightRotationEventBoxes, filters).map((group) => ({
      ...group,
      boxes: group.boxes.map(
        (box): LightTransformEventBox<LightRotationEvent> => ({
          ...box,
          axis: box.axis,
          flip: box.flip,
          events: box.events.map((event) => {
            const data = at(root.lightRotationEvents, event.i, 'event');
            return {
              relativeJsonTime: event.b,
              rotation: data.r,
              direction: data.d,
              easing: data.e,
              loop: data.l,
              usePrevious: data.p,
            };
          }),
        }),
      ),
    })),
  );

  difficulty.lightTranslationEventBoxGroups.push(
    ...v4Groups(root, 3, root.lightTranslationEventBoxes, filters).map((group) => ({
      ...group,
      boxes: group.boxes.map(
        (box): LightTransformEventBox<LightTranslationEvent> => ({
          ...box,
          axis: box.axis,
          flip: box.flip,
          events: box.events.map((event) => {
            const data = at(root.lightTranslationEvents, event.i, 'event');
            return {
              relativeJsonTime: event.b,
              translation: data.t,
              easing: data.e,
              usePrevious: data.p,
            };
          }),
        }),
      ),
    })),
  );

  difficulty.fxEventBoxGroups.push(
    ...v4Groups(root, 4, root.fxEventBoxes, filters).map((group) => ({
      ...group,
      type: 0,
      boxes: group.boxes.map((box): EventBox<FloatFxEvent> => {
        return {
          indexFilter: box.indexFilter,
          beatDistribution: box.beatDistribution,
          beatDistributionType: box.beatDistributionType,
          distribution: box.distribution,
          distributionType: box.distributionType,
          affectFirst: box.affectFirst,
          easing: box.easing,
          events: box.events.map((event) => {
            const data = at(root.floatFxEvents, event.i, 'event');
            return {
              relativeJsonTime: event.b,
              value: data.v,
              easing: data.e,
              usePrevious: data.p,
            };
          }),
        };
      }),
    })),
  );
}
