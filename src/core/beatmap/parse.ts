import { z } from 'zod';

import { bpmEventsFromAudioData, parseAudioData } from './audio-data';
import { recomputeSongBpmTimes } from './bpm';
import { parseV2Difficulty } from './parse-v2';
import { parseV3Difficulty } from './parse-v3';
import { loadV4Bookmarks, loadV4Lightshow, parseV4Difficulty } from './parse-v4';
import type { Difficulty } from './types';
import { beatSaberStringSchema } from './value-schema';

const versionSchema = z
  .object({
    version: beatSaberStringSchema.optional(),
    _version: beatSaberStringSchema.optional(),
  })
  .catch({});

export interface DifficultyExtras {
  lightshowText?: string;
  audioDataText?: string;
  bookmarkText?: string;
}

export function parseDifficulty(text: string, songBpm: number, extras: DifficultyExtras = {}): Difficulty {
  const root: unknown = JSON.parse(text);
  const versionNode = versionSchema.parse(root);
  const rawVersion = versionNode.version ?? versionNode._version ?? '';
  const version = rawVersion === '' ? '2.0.0' : rawVersion;

  let difficulty: Difficulty;
  switch (version[0]) {
    case '2':
      difficulty = parseV2Difficulty(root);
      break;
    case '3':
      difficulty = parseV3Difficulty(root);
      break;
    case '4': {
      difficulty = parseV4Difficulty(root);
      if (extras.lightshowText !== undefined) {
        loadV4Lightshow(JSON.parse(extras.lightshowText), difficulty);
      }
      if (extras.audioDataText !== undefined) {
        difficulty.bpmEvents = bpmEventsFromAudioData(parseAudioData(extras.audioDataText));
      }
      if (extras.bookmarkText !== undefined) {
        loadV4Bookmarks(JSON.parse(extras.bookmarkText), difficulty);
      }
      break;
    }
    default:
      throw new Error(`unsupported beatmap version "${version}"`);
  }

  recomputeSongBpmTimes(difficulty, songBpm);
  return difficulty;
}
