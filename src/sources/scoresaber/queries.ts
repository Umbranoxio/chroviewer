import { queryOptions, skipToken } from '@tanstack/react-query';

import { fetchScoreSaberPlayer } from './provider';

export function scoreSaberPlayerQueryOptions(playerId: string | undefined) {
  return queryOptions({
    queryKey: ['scoresaber', 'player', playerId],
    queryFn:
      playerId === undefined
        ? skipToken
        : async ({ signal }) => {
            const result = await fetchScoreSaberPlayer(playerId, { signal });
            if (result.isErr()) throw result.error;
            return result.value;
          },
    retry: false,
    staleTime: 5 * 60 * 1000,
  });
}
