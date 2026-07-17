import { z } from 'zod';

import { env } from '../env';
import { requestJson } from '../sources/http';
import type { ScoreControllerGetScoreData } from '../sources/scoresaber/generated/api-contracts';

export interface ReplayPreviewScore {
  leaderboard: {
    difficulty: Pick<ScoreControllerGetScoreData['leaderboard']['difficulty'], 'difficulty'>;
    map: Pick<
      ScoreControllerGetScoreData['leaderboard']['map'],
      'coverUrl' | 'levelAuthorName' | 'songAuthorName' | 'songName' | 'songSubName'
    >;
    realm: Pick<ScoreControllerGetScoreData['leaderboard']['realm'], 'stars'>;
  };
  score: Pick<
    ScoreControllerGetScoreData['score'],
    'accuracy' | 'badCuts' | 'fullCombo' | 'missedNotes' | 'modifiedScore' | 'pp' | 'rank'
  > & {
    player: Pick<ScoreControllerGetScoreData['score']['player'], 'avatar' | 'country' | 'id' | 'name'>;
  };
}

const replayPreviewScoreSchema = z.object({
  leaderboard: z.object({
    difficulty: z.object({ difficulty: z.int() }),
    map: z.object({
      coverUrl: z.string(),
      levelAuthorName: z.string(),
      songAuthorName: z.string(),
      songName: z.string(),
      songSubName: z.string(),
    }),
    realm: z.object({ stars: z.number() }),
  }),
  score: z.object({
    accuracy: z.number(),
    badCuts: z.int().nonnegative(),
    fullCombo: z.boolean(),
    missedNotes: z.int().nonnegative(),
    modifiedScore: z.int(),
    pp: z.number(),
    rank: z.int(),
    player: z.object({
      avatar: z.string(),
      country: z.string(),
      id: z.string().min(1),
      name: z.string(),
    }),
  }),
}) satisfies z.ZodType<ReplayPreviewScore>;

export function fetchReplayPreviewScore(scoreId: string) {
  return requestJson(
    `${env.VITE_SCORESABER_API_URL}/api/v2/scores/${scoreId}?includeScoreStats=false`,
    replayPreviewScoreSchema,
    {
      source: 'scoresaber',
      label: `ScoreSaber score ${scoreId}`,
      operation: 'load-score-preview',
    },
  );
}
