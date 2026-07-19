import { Result } from 'better-result';
import { z } from 'zod';

import { env } from '../../env';

const watchPartyIdentitySchema = z
  .object({
    playerId: z.string().regex(/^\d+$/),
    displayName: z.string(),
  })
  .strict();

const watchPartySessionSchema = z
  .object({
    authToken: z.string().min(1),
    expiresAtUnixMs: z.number().int(),
    owner: watchPartyIdentitySchema,
    viewer: watchPartyIdentitySchema.nullable(),
  })
  .strict();

export type WatchPartySession = z.infer<typeof watchPartySessionSchema>;

export async function fetchWatchPartySession(partyPlayerId: string, signal?: AbortSignal) {
  const url = new URL('/api/v2/live/ludus/watch-party/session', env.VITE_SCORESABER_API_URL);
  const response = await Result.tryPromise(() =>
    fetch(url, {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ partyPlayerId }),
      signal,
    }),
  );
  if (response.isErr()) return Result.err(response.error);
  if (!response.value.ok) return Result.err(new Error(`watch-party session request failed (${response.value.status})`));
  const json = await Result.tryPromise(() => response.value.json());
  if (json.isErr()) return Result.err(json.error);
  const parsed = watchPartySessionSchema.safeParse(json.value);
  return parsed.success ? Result.ok(parsed.data) : Result.err(parsed.error);
}
