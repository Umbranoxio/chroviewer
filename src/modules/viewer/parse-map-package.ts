import {
  colorSchemeForDifficulty,
  difficultyRank,
  environmentNameForDifficulty,
  type InfoColorScheme,
  type MapInfo,
} from '../../core/beatmap/info';
import type { Difficulty } from '../../core/beatmap/types';
import { DEFAULT_COLORS, type Rgb } from '../../core/colors';
import { convertLegacyScoreSaberReplay } from '../../core/replay/legacy-scoresaber';
import type { Replay, ReplayColor } from '../../core/replay/types';
import { resolveEnvironmentId } from '../../renderer/environment/environment-catalog';
import type { MapSourceFile } from '../../sources/source-types';
import type { DifficultyRow, MapMeta } from './viewer-types';

export interface MapPackageParser {
  parseInfo: (text: string) => Promise<MapInfo>;
  parseDifficulty: (
    text: string,
    songBpm: number,
    options: { lightshowText?: string; audioDataText?: string; bookmarkText?: string },
  ) => Promise<Difficulty>;
}

export interface ParsedMapPackage {
  mapMeta: MapMeta;
  songBpm: number;
  rows: DifficultyRow[];
  cover: { data: ArrayBuffer; type: string } | null;
  audioData: ArrayBuffer | null;
}

function rgb(color: ReplayColor | undefined, fallback: Rgb): Rgb {
  return color === undefined ? fallback : [color.x, color.y, color.z];
}

function replayColorScheme(replay: Replay | null, mapScheme?: InfoColorScheme) {
  const metadata = replay?.metadata;
  if (metadata?.hasPlaySettings !== true) return mapScheme;
  const custom = mapScheme?.customColors;
  const base = {
    leftNote: custom?.leftNote ?? mapScheme?.leftNote ?? DEFAULT_COLORS.leftNote,
    rightNote: custom?.rightNote ?? mapScheme?.rightNote ?? DEFAULT_COLORS.rightNote,
    obstacle: custom?.obstacle ?? mapScheme?.obstacle ?? DEFAULT_COLORS.obstacle,
    environmentLeft:
      custom?.environmentLeft ?? custom?.leftNote ?? mapScheme?.environmentLeft ?? DEFAULT_COLORS.environmentLeft,
    environmentRight:
      custom?.environmentRight ?? custom?.rightNote ?? mapScheme?.environmentRight ?? DEFAULT_COLORS.environmentRight,
    environmentWhite: custom?.environmentWhite ?? mapScheme?.environmentWhite ?? DEFAULT_COLORS.environmentWhite,
    environmentLeftBoost:
      custom?.environmentLeftBoost ??
      custom?.environmentLeft ??
      custom?.leftNote ??
      mapScheme?.environmentLeftBoost ??
      DEFAULT_COLORS.environmentLeftBoost,
    environmentRightBoost:
      custom?.environmentRightBoost ??
      custom?.environmentRight ??
      custom?.rightNote ??
      mapScheme?.environmentRightBoost ??
      DEFAULT_COLORS.environmentRightBoost,
    environmentWhiteBoost:
      custom?.environmentWhiteBoost ?? mapScheme?.environmentWhiteBoost ?? DEFAULT_COLORS.environmentWhiteBoost,
  };
  return {
    name: 'ScoreSaber replay',
    overrideNotes:
      metadata.leftSaberColor !== undefined ||
      metadata.rightSaberColor !== undefined ||
      metadata.obstacleColor !== undefined,
    leftNote: rgb(metadata.leftSaberColor, base.leftNote),
    rightNote: rgb(metadata.rightSaberColor, base.rightNote),
    obstacle: rgb(metadata.obstacleColor, base.obstacle),
    overrideLights:
      metadata.environmentColor0 !== undefined ||
      metadata.environmentColor1 !== undefined ||
      metadata.environmentColorW !== undefined,
    supportsEnvironmentColorBoost:
      metadata.supportsEnvironmentColorBoost ?? mapScheme?.supportsEnvironmentColorBoost ?? true,
    environmentLeft: rgb(metadata.environmentColor0, base.environmentLeft),
    environmentRight: rgb(metadata.environmentColor1, base.environmentRight),
    environmentWhite: rgb(metadata.environmentColorW, base.environmentWhite),
    environmentLeftBoost: rgb(metadata.environmentColor0Boost, base.environmentLeftBoost),
    environmentRightBoost: rgb(metadata.environmentColor1Boost, base.environmentRightBoost),
    environmentWhiteBoost: rgb(metadata.environmentColorWBoost, base.environmentWhiteBoost),
  } satisfies InfoColorScheme;
}

function coverMimeType(name: string) {
  const extension = name.toLowerCase().split('.').at(-1);
  if (extension === 'png') return 'image/png';
  if (extension === 'jpg' || extension === 'jpeg') return 'image/jpeg';
  if (extension === 'webp') return 'image/webp';
  return '';
}

function difficultyLabel(difficulty: MapInfo['difficultySets'][number]['difficulties'][number]) {
  const customLabel = difficulty.customLabel.trim();
  if (customLabel !== '') return customLabel;
  return difficulty.difficulty === 'ExpertPlus' ? 'Expert+' : difficulty.difficulty;
}

export async function parseMapPackage(
  files: MapSourceFile[],
  parser: MapPackageParser,
  replay: Replay | null,
): Promise<ParsedMapPackage> {
  const texts = new Map<string, string>();
  const infoFile = files.findLast((file) => file.name.toLowerCase() === 'info.dat');
  if (infoFile === undefined) throw new Error('drop an Info.dat together with its difficulty .dat files');
  const infoText = await infoFile.text();
  texts.set('info.dat', infoText);

  const info = await parser.parseInfo(infoText);
  const mapper =
    info.levelAuthorName !== ''
      ? info.levelAuthorName
      : [
          ...new Set(
            info.difficultySets.flatMap((set) => set.difficulties.flatMap((difficulty) => difficulty.mappers)),
          ),
        ].join(', ');
  const mapMeta = {
    title: info.songName,
    subtitle: info.songSubName,
    author: info.songAuthorName,
    mapper,
  };

  const fileNames = new Set(files.map((file) => file.name.toLowerCase()));
  const replayDifficulty = replay?.metadata.difficulty;
  const replayCharacteristic = replay?.metadata.characteristic.toLowerCase();
  const replayTextFiles = new Set<string>();
  for (const set of info.difficultySets) {
    for (const difficulty of set.difficulties) {
      if (
        difficultyRank(difficulty.difficulty) !== replayDifficulty ||
        set.characteristic.toLowerCase() !== replayCharacteristic ||
        !/\.(dat|json)$/i.test(difficulty.beatmapFilename) ||
        !fileNames.has(difficulty.beatmapFilename.toLowerCase())
      )
        continue;
      replayTextFiles.add(difficulty.beatmapFilename.toLowerCase());
      replayTextFiles.add(difficulty.lightshowFilename.toLowerCase());
      replayTextFiles.add(difficulty.bookmarkFilename.toLowerCase());
      replayTextFiles.add(info.audioDataFilename.toLowerCase());
    }
  }
  const hasPlayableReplayDifficulty = replayTextFiles.size > 0;
  const textFiles = files.filter(
    (file) =>
      file !== infoFile &&
      /\.(dat|json)$/i.test(file.name) &&
      (!hasPlayableReplayDifficulty || replayTextFiles.has(file.name.toLowerCase())),
  );
  const fileTexts = await Promise.all(textFiles.map((file) => file.text()));
  for (const [index, file] of textFiles.entries()) {
    const text = fileTexts[index];
    if (text !== undefined) texts.set(file.name.toLowerCase(), text);
  }

  const coverFile =
    info.coverImageFilename === ''
      ? undefined
      : files.find((file) => file.name.toLowerCase() === info.coverImageFilename.toLowerCase());
  const coverPromise =
    coverFile?.arrayBuffer === undefined
      ? Promise.resolve(null)
      : coverFile.arrayBuffer().then((data) => ({ data, type: coverMimeType(coverFile.name) }));

  const audioFile = files.find((file) => file.name.toLowerCase() === info.songFilename.toLowerCase());
  const audioDataPromise = audioFile?.arrayBuffer === undefined ? Promise.resolve(null) : audioFile.arrayBuffer();
  const audioDataText = texts.get(info.audioDataFilename.toLowerCase());
  const rowsPromise = Promise.all(
    info.difficultySets.flatMap((set) =>
      set.difficulties.map(async (infoDifficulty): Promise<DifficultyRow> => {
        const label = difficultyLabel(infoDifficulty);
        const key = `${set.characteristic}/${infoDifficulty.difficulty}/${infoDifficulty.beatmapFilename}`;
        const text = texts.get(infoDifficulty.beatmapFilename.toLowerCase());
        const replayMatch =
          replay !== null &&
          replay.metadata.difficulty === difficultyRank(infoDifficulty.difficulty) &&
          replay.metadata.characteristic.toLowerCase() === set.characteristic.toLowerCase();
        if (hasPlayableReplayDifficulty && !replayMatch) return { key, label, infoDifficulty, replayMatch };
        if (text === undefined) return { key, label };
        const difficulty = await parser.parseDifficulty(text, info.beatsPerMinute, {
          lightshowText: texts.get(infoDifficulty.lightshowFilename.toLowerCase()),
          audioDataText,
          bookmarkText: texts.get(infoDifficulty.bookmarkFilename.toLowerCase()),
        });
        if (replayMatch) convertLegacyScoreSaberReplay(replay, difficulty, info.beatsPerMinute);
        const mapScheme = colorSchemeForDifficulty(info, infoDifficulty);
        return {
          key,
          label,
          difficulty,
          infoDifficulty,
          environmentId: resolveEnvironmentId(
            replayMatch && replay.metadata.environment !== ''
              ? replay.metadata.environment
              : environmentNameForDifficulty(info, infoDifficulty),
          ),
          colorScheme: replayMatch ? replayColorScheme(replay, mapScheme) : mapScheme,
          replayMatch,
        };
      }),
    ),
  );

  const [rows, cover, audioData] = await Promise.all([rowsPromise, coverPromise, audioDataPromise]);
  return { mapMeta, songBpm: info.beatsPerMinute, rows, cover, audioData };
}
