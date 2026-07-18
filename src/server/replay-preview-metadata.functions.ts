import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';

import { fetchReplayPreviewScore } from './replay-preview-data.server';

export const getReplayPreviewTitle = createServerFn({ method: 'GET' })
  .validator(z.object({ scoreId: z.string().regex(/^\d{1,20}$/) }))
  .handler(async ({ data: { scoreId } }) => {
    const result = await fetchReplayPreviewScore(scoreId);
    if (result.isErr()) return 'ScoreSaber Replay';

    const { score, leaderboard } = result.value;
    const map = leaderboard.map;
    const songTitle = map.songSubName === '' ? map.songName : `${map.songName} ${map.songSubName}`;
    return `Replay - ${score.player.name} (${(score.accuracy * 100).toFixed(2)}% / ${score.pp.toFixed(2)}pp) [${songTitle}]`;
  });
