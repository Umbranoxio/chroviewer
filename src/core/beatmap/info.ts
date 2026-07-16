import { z } from 'zod';

import { DEFAULT_COLORS, type LegacyColorOverrides, type Rgb } from '../colors';
import {
  beatSaberBooleanSchema as booleanSchema,
  beatSaberIntegerSchema as integerSchema,
  beatSaberNumberSchema as numberSchema,
  beatSaberStringSchema as stringSchema,
} from './value-schema';
const rgbSchema = z
  .object({ r: numberSchema, g: numberSchema, b: numberSchema })
  .transform(({ r, g, b }): Rgb => [r, g, b]);
const optionalRgbSchema = rgbSchema.optional().catch(undefined);
const stringArraySchema = z.array(stringSchema).catch([]);

const v2CustomDataSchema = z.object({
  _difficultyLabel: z.string().catch(''),
  _colorLeft: optionalRgbSchema,
  _colorRight: optionalRgbSchema,
  _obstacleColor: optionalRgbSchema,
  _envColorLeft: optionalRgbSchema,
  _envColorRight: optionalRgbSchema,
  _envColorWhite: optionalRgbSchema,
  _envColorLeftBoost: optionalRgbSchema,
  _envColorRightBoost: optionalRgbSchema,
  _envColorWhiteBoost: optionalRgbSchema,
  _environmentRemoval: stringArraySchema.optional(),
  environmentRemoval: stringArraySchema.optional(),
});
const v4CustomDataSchema = z.object({
  difficultyLabel: z.string().catch(''),
  colorLeft: optionalRgbSchema,
  colorRight: optionalRgbSchema,
  obstacleColor: optionalRgbSchema,
  envColorLeft: optionalRgbSchema,
  envColorRight: optionalRgbSchema,
  envColorWhite: optionalRgbSchema,
  envColorLeftBoost: optionalRgbSchema,
  envColorRightBoost: optionalRgbSchema,
  envColorWhiteBoost: optionalRgbSchema,
  _environmentRemoval: stringArraySchema.optional(),
  environmentRemoval: stringArraySchema.optional(),
});

const v2ColorSchemeSchema = z.object({
  useOverride: booleanSchema,
  colorScheme: z
    .object({
      colorSchemeId: stringSchema,
      saberAColor: rgbSchema.catch([0, 0, 0]),
      saberBColor: rgbSchema.catch([0, 0, 0]),
      obstaclesColor: rgbSchema.catch([0, 0, 0]),
      environmentColor0: rgbSchema.catch([0, 0, 0]),
      environmentColor1: rgbSchema.catch([0, 0, 0]),
      environmentColorW: optionalRgbSchema,
      environmentColor0Boost: rgbSchema.catch([0, 0, 0]),
      environmentColor1Boost: rgbSchema.catch([0, 0, 0]),
      environmentColorWBoost: optionalRgbSchema,
    })
    .catch({
      colorSchemeId: '',
      saberAColor: [0, 0, 0],
      saberBColor: [0, 0, 0],
      obstaclesColor: [0, 0, 0],
      environmentColor0: [0, 0, 0],
      environmentColor1: [0, 0, 0],
      environmentColor0Boost: [0, 0, 0],
      environmentColor1Boost: [0, 0, 0],
    }),
});
const v4ColorSchemeSchema = z.object({
  colorSchemeName: stringSchema,
  useOverride: booleanSchema,
  overrideNotes: booleanSchema.optional(),
  saberAColor: stringSchema,
  saberBColor: stringSchema,
  obstaclesColor: stringSchema,
  overrideLights: booleanSchema.optional(),
  environmentColor0: stringSchema,
  environmentColor1: stringSchema,
  environmentColorW: stringSchema.optional(),
  environmentColor0Boost: stringSchema,
  environmentColor1Boost: stringSchema,
  environmentColorWBoost: stringSchema.optional(),
});
const v2DifficultySchema = z.object({
  _difficulty: stringSchema,
  _beatmapFilename: stringSchema,
  _environmentNameIdx: integerSchema,
  _beatmapColorSchemeIdx: integerSchema,
  _noteJumpMovementSpeed: numberSchema,
  _noteJumpStartBeatOffset: numberSchema,
  _customData: v2CustomDataSchema.optional().catch(undefined),
});
const v4DifficultySchema = z.object({
  characteristic: stringSchema,
  difficulty: stringSchema,
  beatmapDataFilename: stringSchema,
  lightshowDataFilename: stringSchema,
  environmentNameIdx: integerSchema,
  beatmapColorSchemeIdx: integerSchema,
  noteJumpMovementSpeed: numberSchema,
  noteJumpStartBeatOffset: numberSchema,
  beatmapAuthors: z
    .object({ mappers: stringArraySchema, lighters: stringArraySchema })
    .catch({ mappers: [], lighters: [] }),
  customData: v4CustomDataSchema.optional().catch(undefined),
});
const v2InfoSchema = z
  .object({
    _version: stringSchema,
    _songName: stringSchema,
    _songSubName: stringSchema,
    _songAuthorName: stringSchema,
    _levelAuthorName: stringSchema,
    _beatsPerMinute: numberSchema,
    _previewStartTime: numberSchema,
    _previewDuration: numberSchema,
    _songFilename: stringSchema,
    _coverImageFilename: stringSchema,
    _environmentName: stringSchema,
    _allDirectionsEnvironmentName: stringSchema,
    _environmentNames: stringArraySchema,
    _colorSchemes: z.array(v2ColorSchemeSchema).catch([]),
    _difficultyBeatmapSets: z
      .array(
        z.object({
          _beatmapCharacteristicName: stringSchema,
          _difficultyBeatmaps: z.array(v2DifficultySchema).catch([]),
        }),
      )
      .catch([]),
  })
  .catch({
    _version: '',
    _songName: '',
    _songSubName: '',
    _songAuthorName: '',
    _levelAuthorName: '',
    _beatsPerMinute: 0,
    _previewStartTime: 0,
    _previewDuration: 0,
    _songFilename: '',
    _coverImageFilename: '',
    _environmentName: '',
    _allDirectionsEnvironmentName: '',
    _environmentNames: [],
    _colorSchemes: [],
    _difficultyBeatmapSets: [],
  });
const v4InfoSchema = z
  .object({
    version: stringSchema,
    song: z.object({ title: stringSchema, subTitle: stringSchema, author: stringSchema }).catch({
      title: '',
      subTitle: '',
      author: '',
    }),
    audio: z
      .object({
        bpm: numberSchema,
        previewStartTime: numberSchema,
        previewDuration: numberSchema,
        songFilename: stringSchema,
        audioDataFilename: stringSchema,
      })
      .catch({ bpm: 0, previewStartTime: 0, previewDuration: 0, songFilename: '', audioDataFilename: '' }),
    coverImageFilename: stringSchema,
    environmentNames: stringArraySchema,
    colorSchemes: z.array(v4ColorSchemeSchema).catch([]),
    difficultyBeatmaps: z.array(v4DifficultySchema).catch([]),
  })
  .catch({
    version: '',
    song: { title: '', subTitle: '', author: '' },
    audio: { bpm: 0, previewStartTime: 0, previewDuration: 0, songFilename: '', audioDataFilename: '' },
    coverImageFilename: '',
    environmentNames: [],
    colorSchemes: [],
    difficultyBeatmaps: [],
  });
const infoVersionSchema = z.object({ version: stringSchema.optional(), _version: stringSchema.optional() }).catch({});

type V2CustomData = z.infer<typeof v2CustomDataSchema>;
type V4CustomData = z.infer<typeof v4CustomDataSchema>;

export interface InfoDifficulty {
  characteristic: string;
  difficulty: string;
  beatmapFilename: string;
  lightshowFilename: string;
  bookmarkFilename: string;
  environmentNameIndex: number;
  colorSchemeIndex: number;
  noteJumpSpeed: number;
  noteStartBeatOffset: number;
  mappers: string[];
  lighters: string[];
  customLabel: string;
  customColors?: LegacyColorOverrides;
  environmentRemoval: string[];
}

export interface InfoDifficultySet {
  characteristic: string;
  difficulties: InfoDifficulty[];
}

export interface MapInfo {
  version: string;
  songName: string;
  songSubName: string;
  songAuthorName: string;
  levelAuthorName: string;
  beatsPerMinute: number;
  previewStartTime: number;
  previewDuration: number;
  songFilename: string;
  audioDataFilename: string;
  coverImageFilename: string;
  environmentName: string;
  allDirectionsEnvironmentName: string;
  environmentNames: string[];
  colorSchemes: InfoColorScheme[];
  difficultySets: InfoDifficultySet[];
}

export interface InfoColorScheme {
  name: string;
  overrideNotes: boolean;
  leftNote: Rgb;
  rightNote: Rgb;
  obstacle: Rgb;
  overrideLights: boolean;
  supportsEnvironmentColorBoost: boolean;
  environmentLeft: Rgb;
  environmentRight: Rgb;
  environmentWhite?: Rgb;
  environmentLeftBoost: Rgb;
  environmentRightBoost: Rgb;
  environmentWhiteBoost?: Rgb;
  customColors?: LegacyColorOverrides;
}

export function difficultyRank(difficulty: string): number {
  switch (difficulty) {
    case 'ExpertPlus':
    case 'Expert+':
      return 9;
    case 'Expert':
      return 7;
    case 'Hard':
      return 5;
    case 'Normal':
      return 3;
    case 'Easy':
      return 1;
    default:
      return -1;
  }
}

export function effectiveNoteJumpSpeed(difficulty: InfoDifficulty): number {
  if (difficulty.noteJumpSpeed !== 0) return difficulty.noteJumpSpeed;
  switch (difficultyRank(difficulty.difficulty)) {
    case 9:
      return 16;
    case 7:
      return 12;
    default:
      return 10;
  }
}

export function environmentNameForDifficulty(info: MapInfo, difficulty: InfoDifficulty): string {
  const indexed = info.environmentNames[difficulty.environmentNameIndex];
  if (indexed !== undefined && indexed !== '') return indexed;
  const fallback =
    difficulty.characteristic === '90Degree' || difficulty.characteristic === '360Degree'
      ? info.allDirectionsEnvironmentName
      : info.environmentName;
  return fallback || 'DefaultEnvironment';
}

export function colorSchemeForDifficulty(info: MapInfo, difficulty: InfoDifficulty) {
  const selected = info.colorSchemes[difficulty.colorSchemeIndex];
  if (difficulty.customColors === undefined) return selected;
  return {
    name: selected?.name ?? 'Chroma',
    overrideNotes: selected?.overrideNotes ?? false,
    leftNote: selected?.leftNote ?? DEFAULT_COLORS.leftNote,
    rightNote: selected?.rightNote ?? DEFAULT_COLORS.rightNote,
    obstacle: selected?.obstacle ?? DEFAULT_COLORS.obstacle,
    overrideLights: selected?.overrideLights ?? false,
    supportsEnvironmentColorBoost: selected?.supportsEnvironmentColorBoost ?? true,
    environmentLeft: selected?.environmentLeft ?? DEFAULT_COLORS.environmentLeft,
    environmentRight: selected?.environmentRight ?? DEFAULT_COLORS.environmentRight,
    environmentWhite: selected?.environmentWhite ?? DEFAULT_COLORS.environmentWhite,
    environmentLeftBoost: selected?.environmentLeftBoost ?? DEFAULT_COLORS.environmentLeftBoost,
    environmentRightBoost: selected?.environmentRightBoost ?? DEFAULT_COLORS.environmentRightBoost,
    environmentWhiteBoost: selected?.environmentWhiteBoost ?? DEFAULT_COLORS.environmentWhiteBoost,
    customColors: difficulty.customColors,
  };
}

function htmlColor(value: string): Rgb {
  const hex = value.replace(/^#/, '');
  if (!/^[0-9a-f]{6}([0-9a-f]{2})?$/i.test(hex)) return [0, 0, 0];
  return [
    Number.parseInt(hex.slice(0, 2), 16) / 255,
    Number.parseInt(hex.slice(2, 4), 16) / 255,
    Number.parseInt(hex.slice(4, 6), 16) / 255,
  ];
}

function customColors(data: V2CustomData | V4CustomData | undefined): LegacyColorOverrides | undefined {
  if (data === undefined) return undefined;
  const v2 = '_difficultyLabel' in data;
  const colors: LegacyColorOverrides = v2
    ? {
        leftNote: data._colorLeft,
        rightNote: data._colorRight,
        obstacle: data._obstacleColor,
        environmentLeft: data._envColorLeft,
        environmentRight: data._envColorRight,
        environmentWhite: data._envColorWhite,
        environmentLeftBoost: data._envColorLeftBoost,
        environmentRightBoost: data._envColorRightBoost,
        environmentWhiteBoost: data._envColorWhiteBoost,
      }
    : {
        leftNote: data.colorLeft,
        rightNote: data.colorRight,
        obstacle: data.obstacleColor,
        environmentLeft: data.envColorLeft,
        environmentRight: data.envColorRight,
        environmentWhite: data.envColorWhite,
        environmentLeftBoost: data.envColorLeftBoost,
        environmentRightBoost: data.envColorRightBoost,
        environmentWhiteBoost: data.envColorWhiteBoost,
      };
  return Object.values(colors).some((color) => color !== undefined) ? colors : undefined;
}

function environmentRemoval(data: V2CustomData | V4CustomData | undefined) {
  return (data?._environmentRemoval ?? data?.environmentRemoval ?? []).filter(Boolean);
}

function parseV2Info(input: unknown): MapInfo {
  const root = v2InfoSchema.parse(input);
  const difficultySets = root._difficultyBeatmapSets.map((set): InfoDifficultySet => {
    const characteristic = set._beatmapCharacteristicName;
    return {
      characteristic,
      difficulties: set._difficultyBeatmaps.map(
        (difficulty): InfoDifficulty => ({
          characteristic,
          difficulty: difficulty._difficulty,
          beatmapFilename: difficulty._beatmapFilename,
          lightshowFilename: '',
          bookmarkFilename: '',
          environmentNameIndex: difficulty._environmentNameIdx,
          colorSchemeIndex: difficulty._beatmapColorSchemeIdx,
          noteJumpSpeed: difficulty._noteJumpMovementSpeed,
          noteStartBeatOffset: difficulty._noteJumpStartBeatOffset,
          mappers: [],
          lighters: [],
          customLabel: difficulty._customData?._difficultyLabel ?? '',
          customColors: customColors(difficulty._customData),
          environmentRemoval: environmentRemoval(difficulty._customData),
        }),
      ),
    };
  });

  return {
    version: root._version,
    songName: root._songName,
    songSubName: root._songSubName,
    songAuthorName: root._songAuthorName,
    levelAuthorName: root._levelAuthorName,
    beatsPerMinute: root._beatsPerMinute,
    previewStartTime: root._previewStartTime,
    previewDuration: root._previewDuration,
    songFilename: root._songFilename,
    audioDataFilename: '',
    coverImageFilename: root._coverImageFilename,
    environmentName: root._environmentName,
    allDirectionsEnvironmentName: root._allDirectionsEnvironmentName,
    environmentNames: root._environmentNames,
    colorSchemes: root._colorSchemes.map(({ colorScheme: color, useOverride }) => ({
      name: color.colorSchemeId,
      overrideNotes: useOverride,
      leftNote: color.saberAColor,
      rightNote: color.saberBColor,
      obstacle: color.obstaclesColor,
      overrideLights: useOverride,
      supportsEnvironmentColorBoost: true,
      environmentLeft: color.environmentColor0,
      environmentRight: color.environmentColor1,
      environmentWhite: color.environmentColorW,
      environmentLeftBoost: color.environmentColor0Boost,
      environmentRightBoost: color.environmentColor1Boost,
      environmentWhiteBoost: color.environmentColorWBoost,
    })),
    difficultySets,
  };
}

function parseV4Info(input: unknown): MapInfo {
  const root = v4InfoSchema.parse(input);
  const setsByCharacteristic = new Map<string, InfoDifficulty[]>();
  for (const entry of root.difficultyBeatmaps) {
    const difficulty: InfoDifficulty = {
      characteristic: entry.characteristic,
      difficulty: entry.difficulty,
      beatmapFilename: entry.beatmapDataFilename,
      lightshowFilename: entry.lightshowDataFilename,
      bookmarkFilename: `ChroMapper.${entry.characteristic}${entry.difficulty}.bookmarks.dat`,
      environmentNameIndex: entry.environmentNameIdx,
      colorSchemeIndex: entry.beatmapColorSchemeIdx,
      noteJumpSpeed: entry.noteJumpMovementSpeed,
      noteStartBeatOffset: entry.noteJumpStartBeatOffset,
      mappers: entry.beatmapAuthors.mappers,
      lighters: entry.beatmapAuthors.lighters,
      customLabel: entry.customData?.difficultyLabel ?? '',
      customColors: customColors(entry.customData),
      environmentRemoval: environmentRemoval(entry.customData),
    };
    const list = setsByCharacteristic.get(entry.characteristic);
    if (list === undefined) setsByCharacteristic.set(entry.characteristic, [difficulty]);
    else list.push(difficulty);
  }

  return {
    version: root.version,
    songName: root.song.title,
    songSubName: root.song.subTitle,
    songAuthorName: root.song.author,
    levelAuthorName: '',
    beatsPerMinute: root.audio.bpm,
    previewStartTime: root.audio.previewStartTime,
    previewDuration: root.audio.previewDuration,
    songFilename: root.audio.songFilename,
    audioDataFilename: root.audio.audioDataFilename,
    coverImageFilename: root.coverImageFilename,
    environmentName: '',
    allDirectionsEnvironmentName: '',
    environmentNames: root.environmentNames,
    colorSchemes: root.colorSchemes.map((color) => ({
      name: color.colorSchemeName,
      overrideNotes: color.overrideNotes ?? color.useOverride,
      leftNote: htmlColor(color.saberAColor),
      rightNote: htmlColor(color.saberBColor),
      obstacle: htmlColor(color.obstaclesColor),
      overrideLights: color.overrideLights ?? color.useOverride,
      supportsEnvironmentColorBoost: true,
      environmentLeft: htmlColor(color.environmentColor0),
      environmentRight: htmlColor(color.environmentColor1),
      environmentWhite: color.environmentColorW === undefined ? undefined : htmlColor(color.environmentColorW),
      environmentLeftBoost: htmlColor(color.environmentColor0Boost),
      environmentRightBoost: htmlColor(color.environmentColor1Boost),
      environmentWhiteBoost:
        color.environmentColorWBoost === undefined ? undefined : htmlColor(color.environmentColorWBoost),
    })),
    difficultySets: [...setsByCharacteristic.entries()].map(([characteristic, difficulties]) => ({
      characteristic,
      difficulties,
    })),
  };
}

export function parseInfo(text: string): MapInfo {
  const input: unknown = JSON.parse(text);
  const version = infoVersionSchema.parse(input);
  return (version.version ?? version._version ?? '').startsWith('4') ? parseV4Info(input) : parseV2Info(input);
}
