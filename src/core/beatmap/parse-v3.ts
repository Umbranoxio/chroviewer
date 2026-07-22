import { z } from 'zod';

import { parseV3ChromaEnvironment } from '../chroma-environment';
import { parseNoodleBeatmap } from '../noodle-data';
import { parseV3Gls } from './parse-gls';
import {
  createDifficulty,
  ExecutionTime,
  NoteType,
  sortByJsonTime,
  type Arc,
  type BasicEvent,
  type BpmEvent,
  type Chain,
  type Difficulty,
  type Note,
  type Obstacle,
  type RotationEvent,
} from './types';
import {
  beatSaberBooleanSchema as booleanSchema,
  beatSaberIntegerSchema as integerSchema,
  beatSaberJsonObjectSchema as customDataSchema,
  beatSaberNumberSchema as numberSchema,
  beatSaberStringSchema,
} from './value-schema';

const requiredNumberSchema = z.preprocess((value) => {
  if (value === undefined) return undefined;
  return numberSchema.parse(value);
}, z.number());
const colorNoteSchema = z.object({
  b: numberSchema,
  x: integerSchema,
  y: integerSchema,
  c: integerSchema,
  d: integerSchema,
  a: integerSchema,
  customData: customDataSchema.optional().catch(undefined),
});
const bombNoteSchema = z.object({
  b: numberSchema,
  x: integerSchema,
  y: integerSchema,
  customData: customDataSchema.optional().catch(undefined),
});
const obstacleSchema = z.object({
  b: numberSchema,
  x: integerSchema,
  y: integerSchema,
  d: numberSchema,
  w: integerSchema,
  h: integerSchema,
  customData: customDataSchema.optional().catch(undefined),
});
const arcSchema = z.object({
  b: numberSchema,
  c: integerSchema,
  x: integerSchema,
  y: integerSchema,
  d: integerSchema,
  mu: numberSchema,
  tb: numberSchema,
  tx: integerSchema,
  ty: integerSchema,
  tc: integerSchema,
  tmu: numberSchema,
  m: integerSchema,
  customData: customDataSchema.optional().catch(undefined),
});
const chainSchema = z.object({
  b: numberSchema,
  c: integerSchema,
  x: integerSchema,
  y: integerSchema,
  d: integerSchema,
  tb: numberSchema,
  tx: integerSchema,
  ty: integerSchema,
  sc: integerSchema,
  s: numberSchema,
  customData: customDataSchema.optional().catch(undefined),
});
const basicEventSchema = z.object({
  b: numberSchema,
  et: integerSchema,
  i: integerSchema,
  f: numberSchema,
  customData: customDataSchema.optional().catch(undefined),
});
const colorBoostEventSchema = z.object({
  b: numberSchema,
  o: booleanSchema,
  customData: customDataSchema.optional().catch(undefined),
});
const rotationEventSchema = z.object({
  b: numberSchema,
  e: integerSchema,
  r: numberSchema,
  customData: customDataSchema.optional().catch(undefined),
});
const bpmEventSchema = z.object({ b: numberSchema, m: requiredNumberSchema });
const bookmarkSchema = z.object({
  b: numberSchema,
  n: beatSaberStringSchema,
  c: z.array(numberSchema).min(3).max(4).optional().catch(undefined),
});
const customDifficultyDataSchema = z.looseObject({
  bookmarks: z.array(bookmarkSchema).catch([]),
  fakeColorNotes: z.array(colorNoteSchema).catch([]),
  fakeBombNotes: z.array(bombNoteSchema).catch([]),
  fakeObstacles: z.array(obstacleSchema).catch([]),
  fakeBurstSliders: z.array(chainSchema).catch([]),
});
const v3DifficultySchema = z
  .looseObject({
    version: beatSaberStringSchema,
    colorNotes: z.array(colorNoteSchema).catch([]),
    bombNotes: z.array(bombNoteSchema).catch([]),
    basicBeatmapEvents: z.array(basicEventSchema).catch([]),
    colorBoostBeatmapEvents: z.array(colorBoostEventSchema).catch([]),
    rotationEvents: z.array(rotationEventSchema).catch([]),
    bpmEvents: z.array(bpmEventSchema).catch([]),
    obstacles: z.array(obstacleSchema).catch([]),
    sliders: z.array(arcSchema).catch([]),
    burstSliders: z.array(chainSchema).catch([]),
    customData: customDifficultyDataSchema.optional().catch(undefined),
  })
  .catch({
    version: '',
    colorNotes: [],
    bombNotes: [],
    basicBeatmapEvents: [],
    colorBoostBeatmapEvents: [],
    rotationEvents: [],
    bpmEvents: [],
    obstacles: [],
    sliders: [],
    burstSliders: [],
  });

type V3Arc = z.infer<typeof arcSchema>;
type V3BasicEvent = z.infer<typeof basicEventSchema>;
type V3BombNote = z.infer<typeof bombNoteSchema>;
type V3Chain = z.infer<typeof chainSchema>;
type V3ColorBoostEvent = z.infer<typeof colorBoostEventSchema>;
type V3ColorNote = z.infer<typeof colorNoteSchema>;
type V3Obstacle = z.infer<typeof obstacleSchema>;
type V3RotationEvent = z.infer<typeof rotationEventSchema>;

function parseColorNote(node: V3ColorNote, customFake: boolean): Note {
  return {
    jsonTime: node.b,
    songBpmTime: 0,
    posX: node.x,
    posY: node.y,
    type: node.c,
    cutDirection: node.d,
    angleOffset: node.a,
    rotation: 0,
    customFake,
    customData: node.customData,
  };
}

function parseBombNote(node: V3BombNote, customFake: boolean): Note {
  return {
    jsonTime: node.b,
    songBpmTime: 0,
    posX: node.x,
    posY: node.y,
    type: NoteType.Bomb,
    cutDirection: 0,
    angleOffset: 0,
    rotation: 0,
    customFake,
    customData: node.customData,
  };
}

function parseObstacle(node: V3Obstacle, customFake: boolean): Obstacle {
  const posY = node.y;
  return {
    jsonTime: node.b,
    songBpmTime: 0,
    rotation: 0,
    posX: node.x,
    posY,
    type: posY >= 2 ? 1 : 0,
    duration: node.d,
    durationSongBpmTime: 0,
    width: node.w,
    height: node.h,
    customFake,
    customData: node.customData,
  };
}

function parseArc(node: V3Arc): Arc {
  return {
    jsonTime: node.b,
    songBpmTime: 0,
    color: node.c,
    posX: node.x,
    posY: node.y,
    cutDirection: node.d,
    angleOffset: 0,
    rotation: 0,
    headControlPointLengthMultiplier: node.mu,
    tailJsonTime: node.tb,
    tailSongBpmTime: 0,
    tailPosX: node.tx,
    tailPosY: node.ty,
    tailCutDirection: node.tc,
    tailControlPointLengthMultiplier: node.tmu,
    tailRotation: 0,
    midAnchorMode: node.m,
    customData: node.customData,
  };
}

function parseChain(node: V3Chain, customFake: boolean): Chain {
  return {
    jsonTime: node.b,
    songBpmTime: 0,
    color: node.c,
    posX: node.x,
    posY: node.y,
    cutDirection: node.d,
    angleOffset: 0,
    rotation: 0,
    tailJsonTime: node.tb,
    tailSongBpmTime: 0,
    tailPosX: node.tx,
    tailPosY: node.ty,
    tailRotation: 0,
    sliceCount: node.sc,
    squish: node.s,
    customFake,
    customData: node.customData,
  };
}

function parseBasicEvent(node: V3BasicEvent): BasicEvent {
  return {
    jsonTime: node.b,
    songBpmTime: 0,
    type: node.et,
    value: node.i,
    floatValue: node.f,
    customData: node.customData,
  };
}

function parseColorBoostEvent(node: V3ColorBoostEvent): BasicEvent {
  return {
    jsonTime: node.b,
    songBpmTime: 0,
    type: 5,
    value: node.o ? 1 : 0,
    floatValue: 0,
    customData: node.customData,
  };
}

function parseRotationEvent(node: V3RotationEvent): RotationEvent {
  return {
    jsonTime: node.b,
    songBpmTime: 0,
    executionTime: node.e === 0 ? ExecutionTime.Early : ExecutionTime.Late,
    rotation: node.r,
    customData: node.customData,
  };
}

function parseBpmEvent(node: z.infer<typeof bpmEventSchema>): BpmEvent {
  return {
    jsonTime: node.b,
    songBpmTime: 0,
    bpm: node.m,
  };
}

export function parseV3Difficulty(input: unknown): Difficulty {
  const root = v3DifficultySchema.parse(input);
  const version = root.version;
  const difficulty = createDifficulty(version === '' ? '3.3.0' : version);

  for (const note of root.colorNotes) difficulty.notes.push(parseColorNote(note, false));
  for (const note of root.bombNotes) difficulty.notes.push(parseBombNote(note, false));
  for (const event of root.basicBeatmapEvents) difficulty.events.push(parseBasicEvent(event));
  for (const event of root.colorBoostBeatmapEvents) difficulty.events.push(parseColorBoostEvent(event));
  for (const event of root.rotationEvents) difficulty.rotationEvents.push(parseRotationEvent(event));
  for (const event of root.bpmEvents) difficulty.bpmEvents.push(parseBpmEvent(event));
  for (const obstacle of root.obstacles) difficulty.obstacles.push(parseObstacle(obstacle, false));
  for (const arc of root.sliders) difficulty.arcs.push(parseArc(arc));
  for (const chain of root.burstSliders) difficulty.chains.push(parseChain(chain, false));
  parseV3Gls(root, difficulty);

  const customData = root.customData;
  if (customData !== undefined) {
    difficulty.chromaEnvironment = parseV3ChromaEnvironment(customData);
    difficulty.noodle = parseNoodleBeatmap(customData, 3);
    for (const bookmark of customData.bookmarks) {
      difficulty.bookmarks.push({
        jsonTime: bookmark.b,
        songBpmTime: 0,
        name: bookmark.n,
        color: [bookmark.c?.[0] ?? 1, bookmark.c?.[1] ?? 1, bookmark.c?.[2] ?? 1, bookmark.c?.[3] ?? 1],
      });
    }
    for (const note of customData.fakeColorNotes) difficulty.notes.push(parseColorNote(note, true));
    for (const note of customData.fakeBombNotes) difficulty.notes.push(parseBombNote(note, true));
    for (const obstacle of customData.fakeObstacles) difficulty.obstacles.push(parseObstacle(obstacle, true));
    for (const chain of customData.fakeBurstSliders) difficulty.chains.push(parseChain(chain, true));
  }

  sortByJsonTime(difficulty.notes);
  sortByJsonTime(difficulty.events);
  sortByJsonTime(difficulty.rotationEvents);
  sortByJsonTime(difficulty.bpmEvents);
  sortByJsonTime(difficulty.obstacles);
  sortByJsonTime(difficulty.chains);
  sortByJsonTime(difficulty.arcs);
  sortByJsonTime(difficulty.lightColorEventBoxGroups);
  sortByJsonTime(difficulty.lightRotationEventBoxGroups);
  sortByJsonTime(difficulty.lightTranslationEventBoxGroups);
  sortByJsonTime(difficulty.fxEventBoxGroups);

  return difficulty;
}
