import { z } from 'zod';

import { parseV3ChromaEnvironment } from '../chroma-environment';
import { parseNoodleBeatmap } from '../noodle-data';
import { loadV4Gls } from './parse-gls';
import { createDifficulty, NoteType, sortByJsonTime, type Difficulty } from './types';
import {
  beatSaberIntegerSchema as integerSchema,
  beatSaberJsonObjectSchema as customDataSchema,
  beatSaberNumberSchema as numberSchema,
  beatSaberStringSchema,
} from './value-schema';
const noteDataSchema = z.object({
  x: integerSchema,
  y: integerSchema,
  c: integerSchema,
  d: integerSchema,
  a: integerSchema,
});
const bombDataSchema = z.object({ x: integerSchema, y: integerSchema });
const obstacleDataSchema = z.object({
  x: integerSchema,
  y: integerSchema,
  d: numberSchema,
  w: integerSchema,
  h: integerSchema,
});
const arcDataSchema = z.object({ m: numberSchema, tm: numberSchema, a: integerSchema });
const chainDataSchema = z.object({ tx: integerSchema, ty: integerSchema, c: integerSchema, s: numberSchema });
const njsEventDataSchema = z.object({ p: integerSchema, e: integerSchema, d: numberSchema });
const rotationDataSchema = z.object({ t: integerSchema, r: numberSchema });
const beatAndIndexSchema = z.object({ b: numberSchema, i: integerSchema });
const v4DifficultySchema = z
  .looseObject({
    version: beatSaberStringSchema,
    colorNotesData: z.array(noteDataSchema).catch([]),
    bombNotesData: z.array(bombDataSchema).catch([]),
    obstaclesData: z.array(obstacleDataSchema).catch([]),
    arcsData: z.array(arcDataSchema).catch([]),
    chainsData: z.array(chainDataSchema).catch([]),
    njsEventData: z.array(njsEventDataSchema).catch([]),
    spawnRotationsData: z.array(rotationDataSchema).catch([]),
    customData: customDataSchema.optional().catch(undefined),
    colorNotes: z.array(beatAndIndexSchema.extend({ r: integerSchema })).catch([]),
    bombNotes: z.array(beatAndIndexSchema.extend({ r: integerSchema })).catch([]),
    obstacles: z.array(beatAndIndexSchema.extend({ r: numberSchema })).catch([]),
    arcs: z
      .array(
        z.object({
          hb: numberSchema,
          hi: integerSchema,
          ti: integerSchema,
          ai: integerSchema,
          hr: integerSchema,
          tb: numberSchema,
          tr: integerSchema,
        }),
      )
      .catch([]),
    chains: z
      .array(
        z.object({
          hb: numberSchema,
          i: integerSchema,
          ci: integerSchema,
          hr: integerSchema,
          tb: numberSchema,
          tr: integerSchema,
        }),
      )
      .catch([]),
    njsEvents: z.array(beatAndIndexSchema).catch([]),
    spawnRotations: z.array(beatAndIndexSchema).catch([]),
  })
  .catch({
    version: '',
    colorNotesData: [],
    bombNotesData: [],
    obstaclesData: [],
    arcsData: [],
    chainsData: [],
    njsEventData: [],
    spawnRotationsData: [],
    colorNotes: [],
    bombNotes: [],
    obstacles: [],
    arcs: [],
    chains: [],
    njsEvents: [],
    spawnRotations: [],
    customData: undefined,
  });
const v4LightshowSchema = z
  .looseObject({
    basicEventsData: z.array(z.object({ t: integerSchema, i: integerSchema, f: numberSchema })).catch([]),
    colorBoostEventsData: z.array(z.object({ b: integerSchema })).catch([]),
    basicEvents: z.array(beatAndIndexSchema).catch([]),
    colorBoostEvents: z.array(beatAndIndexSchema).catch([]),
  })
  .catch({ basicEventsData: [], colorBoostEventsData: [], basicEvents: [], colorBoostEvents: [] });
const v4BookmarksSchema = z
  .object({
    color: beatSaberStringSchema.catch(''),
    bookmarks: z
      .array(
        z.object({
          beat: numberSchema,
          text: beatSaberStringSchema.catch(''),
          label: beatSaberStringSchema.optional(),
        }),
      )
      .catch([]),
  })
  .catch({ color: '', bookmarks: [] });

interface NoteData {
  posX: number;
  posY: number;
  color: number;
  cutDirection: number;
  angleOffset: number;
}

interface BombData {
  posX: number;
  posY: number;
}

interface ObstacleData {
  posX: number;
  posY: number;
  duration: number;
  width: number;
  height: number;
}

interface ArcData {
  headControlPointLengthMultiplier: number;
  tailControlPointLengthMultiplier: number;
  midAnchorMode: number;
}

interface ChainData {
  tailPosX: number;
  tailPosY: number;
  sliceCount: number;
  squish: number;
}

interface NjsEventData {
  usePrevious: number;
  easing: number;
  relativeNjs: number;
}

interface RotationData {
  executionTime: number;
  rotation: number;
}

function at<T>(list: T[], index: number, name: string): T {
  const item = list[index];
  if (item === undefined) throw new Error(`missing ${name} common data at index ${String(index)}`);
  return item;
}

function readNoteData(node: z.infer<typeof noteDataSchema>): NoteData {
  return {
    posX: node.x,
    posY: node.y,
    color: node.c,
    cutDirection: node.d,
    angleOffset: node.a,
  };
}

export function parseV4Difficulty(input: unknown): Difficulty {
  const root = v4DifficultySchema.parse(input);
  const version = root.version;
  const difficulty = createDifficulty(version === '' ? '4.1.0' : version);
  if (root.customData !== undefined) {
    difficulty.chromaEnvironment = parseV3ChromaEnvironment(root.customData);
    difficulty.noodle = parseNoodleBeatmap(root.customData, 3);
  }

  const notesData = root.colorNotesData.map(readNoteData);
  const bombsData = root.bombNotesData.map((node): BombData => ({ posX: node.x, posY: node.y }));
  const obstaclesData = root.obstaclesData.map((node): ObstacleData => {
    return {
      posX: node.x,
      posY: node.y,
      duration: node.d,
      width: node.w,
      height: node.h,
    };
  });
  const arcsData = root.arcsData.map((node): ArcData => {
    return {
      headControlPointLengthMultiplier: node.m,
      tailControlPointLengthMultiplier: node.tm,
      midAnchorMode: node.a,
    };
  });
  const chainsData = root.chainsData.map((node): ChainData => {
    return {
      tailPosX: node.tx,
      tailPosY: node.ty,
      sliceCount: node.c,
      squish: node.s,
    };
  });
  const njsEventsData = root.njsEventData.map((node): NjsEventData => {
    return {
      usePrevious: node.p,
      easing: node.e,
      relativeNjs: node.d,
    };
  });
  const rotationsData = root.spawnRotationsData.map(
    (node): RotationData => ({ executionTime: node.t, rotation: node.r }),
  );

  for (const node of root.colorNotes) {
    const data = at(notesData, node.i, 'note');
    difficulty.notes.push({
      jsonTime: node.b,
      songBpmTime: 0,
      posX: data.posX,
      posY: data.posY,
      type: data.color,
      cutDirection: data.cutDirection,
      angleOffset: data.angleOffset,
      rotation: node.r,
      customFake: false,
    });
  }

  for (const node of root.bombNotes) {
    const data = at(bombsData, node.i, 'bomb');
    difficulty.notes.push({
      jsonTime: node.b,
      songBpmTime: 0,
      posX: data.posX,
      posY: data.posY,
      type: NoteType.Bomb,
      cutDirection: 0,
      angleOffset: 0,
      rotation: node.r,
      customFake: false,
    });
  }

  for (const node of root.obstacles) {
    const data = at(obstaclesData, node.i, 'obstacle');
    difficulty.obstacles.push({
      jsonTime: node.b,
      songBpmTime: 0,
      rotation: node.r,
      posX: data.posX,
      posY: data.posY,
      type: data.posY >= 2 ? 1 : 0,
      duration: data.duration,
      durationSongBpmTime: 0,
      width: data.width,
      height: data.height,
      customFake: false,
    });
  }

  for (const node of root.arcs) {
    const head = at(notesData, node.hi, 'arc head');
    const tail = at(notesData, node.ti, 'arc tail');
    const data = at(arcsData, node.ai, 'arc');
    difficulty.arcs.push({
      jsonTime: node.hb,
      songBpmTime: 0,
      color: head.color,
      posX: head.posX,
      posY: head.posY,
      cutDirection: head.cutDirection,
      angleOffset: head.angleOffset,
      rotation: node.hr,
      headControlPointLengthMultiplier: data.headControlPointLengthMultiplier,
      tailJsonTime: node.tb,
      tailSongBpmTime: 0,
      tailPosX: tail.posX,
      tailPosY: tail.posY,
      tailCutDirection: tail.cutDirection,
      tailControlPointLengthMultiplier: data.tailControlPointLengthMultiplier,
      tailRotation: node.tr,
      midAnchorMode: data.midAnchorMode,
    });
  }

  for (const node of root.chains) {
    const head = at(notesData, node.i, 'chain head');
    const data = at(chainsData, node.ci, 'chain');
    difficulty.chains.push({
      jsonTime: node.hb,
      songBpmTime: 0,
      color: head.color,
      posX: head.posX,
      posY: head.posY,
      cutDirection: head.cutDirection,
      angleOffset: head.angleOffset,
      rotation: node.hr,
      tailJsonTime: node.tb,
      tailSongBpmTime: 0,
      tailPosX: data.tailPosX,
      tailPosY: data.tailPosY,
      tailRotation: node.tr,
      sliceCount: data.sliceCount,
      squish: data.squish,
      customFake: false,
    });
  }

  for (const node of root.njsEvents) {
    const data = at(njsEventsData, node.i, 'njs event');
    difficulty.njsEvents.push({
      jsonTime: node.b,
      songBpmTime: 0,
      usePrevious: data.usePrevious,
      easing: data.easing,
      relativeNjs: data.relativeNjs,
    });
  }

  for (const node of root.spawnRotations) {
    const data = at(rotationsData, node.i, 'spawn rotation');
    difficulty.rotationEvents.push({
      jsonTime: node.b,
      songBpmTime: 0,
      executionTime: Math.min(Math.max(data.executionTime, 0), 1),
      rotation: data.rotation,
    });
  }

  sortByJsonTime(difficulty.notes);
  sortByJsonTime(difficulty.events);
  sortByJsonTime(difficulty.obstacles);
  sortByJsonTime(difficulty.chains);
  sortByJsonTime(difficulty.arcs);
  sortByJsonTime(difficulty.njsEvents);

  return difficulty;
}

export function loadV4Bookmarks(input: unknown, difficulty: Difficulty) {
  const root = v4BookmarksSchema.parse(input);
  const hex = root.color.replace(/^#/, '');
  const color: [number, number, number, number] = /^[0-9a-f]{6}$/i.test(hex)
    ? [
        Number.parseInt(hex.slice(0, 2), 16) / 255,
        Number.parseInt(hex.slice(2, 4), 16) / 255,
        Number.parseInt(hex.slice(4, 6), 16) / 255,
        1,
      ]
    : [0, 1, 1, 1];
  for (const bookmark of root.bookmarks) {
    difficulty.bookmarks.push({
      jsonTime: bookmark.beat,
      songBpmTime: 0,
      name: bookmark.text === '' ? (bookmark.label ?? '') : bookmark.text,
      color,
    });
  }
}

export function loadV4Lightshow(input: unknown, difficulty: Difficulty): void {
  const root = v4LightshowSchema.parse(input);
  const basicEventsData = root.basicEventsData.map((node) => ({
    type: node.t,
    value: node.i,
    floatValue: node.f,
  }));
  const colorBoostEventsData = root.colorBoostEventsData.map((node) => ({ boost: node.b }));

  for (const node of root.basicEvents) {
    const data = at(basicEventsData, node.i, 'basic event');
    difficulty.events.push({
      jsonTime: node.b,
      songBpmTime: 0,
      type: data.type,
      value: data.value,
      floatValue: data.floatValue,
    });
  }

  for (const node of root.colorBoostEvents) {
    const data = at(colorBoostEventsData, node.i, 'color boost event');
    difficulty.events.push({
      jsonTime: node.b,
      songBpmTime: 0,
      type: 5,
      value: data.boost,
      floatValue: 0,
    });
  }

  loadV4Gls(root, difficulty);

  sortByJsonTime(difficulty.events);
  sortByJsonTime(difficulty.lightColorEventBoxGroups);
  sortByJsonTime(difficulty.lightRotationEventBoxGroups);
  sortByJsonTime(difficulty.lightTranslationEventBoxGroups);
  sortByJsonTime(difficulty.fxEventBoxGroups);
}
