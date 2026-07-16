import { Result } from 'better-result';
import { z } from 'zod';

import { env } from '../../env';
import type { LiveTarget } from './live-types';

const browserSessionSchema = z.object({
  authToken: z.string().min(1),
  playerId: z.string().min(1),
});

export async function fetchLiveBrowserSession(target: LiveTarget) {
  const url = new URL('/api/v2/live/ludus/session', env.VITE_SCORESABER_API_URL);
  const body =
    target.tournamentId === undefined
      ? undefined
      : JSON.stringify({
          tournamentId: target.tournamentId,
          clientType: 'SPECTATOR',
          targetMatchId: target.matchId,
        });
  const response = await Result.tryPromise(() =>
    fetch(url, {
      method: 'POST',
      credentials: 'include',
      headers: body === undefined ? undefined : { 'content-type': 'application/json' },
      body,
    }),
  );
  if (response.isErr() || !response.value.ok) return null;
  const json = await Result.tryPromise(() => response.value.json());
  if (json.isErr()) return null;
  const parsed = browserSessionSchema.safeParse(json.value);
  return parsed.success ? parsed.data : null;
}
