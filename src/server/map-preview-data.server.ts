import { z } from 'zod';

import { env } from '../env';
import type { GetMapByIdData } from '../sources/beatsaver/generated/api-contracts';
import { requestJson } from '../sources/http';

type MapPreviewDifficulty = Required<
  Pick<
    NonNullable<NonNullable<GetMapByIdData['versions']>[number]['diffs']>[number],
    'chroma' | 'cinema' | 'me' | 'ne' | 'vivify'
  >
>;

type MapPreviewVersion = Required<Pick<NonNullable<GetMapByIdData['versions']>[number], 'coverURL'>> & {
  diffs: MapPreviewDifficulty[];
};

export interface MapPreviewData {
  metadata: Required<
    Pick<
      NonNullable<GetMapByIdData['metadata']>,
      'bpm' | 'duration' | 'levelAuthorName' | 'songAuthorName' | 'songName' | 'songSubName'
    >
  >;
  stats: Required<Pick<NonNullable<GetMapByIdData['stats']>, 'downvotes' | 'score' | 'upvotes'>>;
  tags: string[];
  versions: [MapPreviewVersion, ...MapPreviewVersion[]];
}

const mapPreviewDifficultySchema = z.object({
  chroma: z.boolean().default(false),
  cinema: z.boolean().default(false),
  me: z.boolean().default(false),
  ne: z.boolean().default(false),
  vivify: z.boolean().default(false),
});

const mapPreviewVersionSchema = z.object({
  coverURL: z.url(),
  diffs: z.array(mapPreviewDifficultySchema),
});

const mapPreviewSchema = z.object({
  metadata: z.object({
    bpm: z.number().positive(),
    duration: z.int().nonnegative(),
    levelAuthorName: z.string(),
    songAuthorName: z.string(),
    songName: z.string(),
    songSubName: z.string(),
  }),
  stats: z.object({
    downvotes: z.int().nonnegative(),
    score: z.number().min(0).max(1),
    upvotes: z.int().nonnegative(),
  }),
  tags: z.array(z.string()),
  versions: z.tuple([mapPreviewVersionSchema], mapPreviewVersionSchema),
}) satisfies z.ZodType<MapPreviewData>;

export function fetchMapPreviewData(mapKey: string) {
  return requestJson(`${env.VITE_BEATSAVER_API_URL}/maps/id/${mapKey}`, mapPreviewSchema, {
    source: 'beatsaver',
    label: `BeatSaver map ${mapKey}`,
    operation: 'load-map-preview',
  });
}
