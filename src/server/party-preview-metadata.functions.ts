import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';

import { fetchPartyPreviewPlayer } from './party-preview-data.server';

export const getPartyPreviewMetadata = createServerFn({ method: 'GET' })
  .validator(z.object({ playerId: z.string().regex(/^\d{1,20}$/) }))
  .handler(async ({ data: { playerId } }) => {
    const result = await fetchPartyPreviewPlayer(playerId);
    if (result.isErr()) {
      return {
        title: 'Join this watch party',
        description: 'Watch Beat Saber together live on ScoreSaber Watch',
        playerName: null,
        avatarUrl: null,
      };
    }
    return {
      title: `Join ${result.value.name}'s watch party`,
      description: 'Watch Beat Saber together live on ScoreSaber Watch',
      playerName: result.value.name,
      avatarUrl: result.value.avatar,
    };
  });
