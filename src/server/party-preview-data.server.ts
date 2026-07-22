import { Result } from 'better-result';

import { fetchScoreSaberPlayer } from '../sources/scoresaber/provider';
import type { ScoreSaberReplayPlayer, SourceResult } from '../sources/source-types';

const playerCacheTtlMs = 60 * 60 * 1000;
const playerCacheLimit = 128;
const playerTimeoutMs = 1_800;

interface PlayerCacheEntry {
  expires: number;
  player: ScoreSaberReplayPlayer;
}

const playerCache = new Map<string, PlayerCacheEntry>();
const playerRequests = new Map<string, Promise<SourceResult<ScoreSaberReplayPlayer>>>();

export function fetchPartyPreviewPlayer(playerId: string): Promise<SourceResult<ScoreSaberReplayPlayer>> {
  const cached = playerCache.get(playerId);
  if (cached !== undefined && cached.expires >= Date.now()) {
    playerCache.delete(playerId);
    playerCache.set(playerId, cached);
    return Promise.resolve(Result.ok(cached.player));
  }
  if (cached !== undefined) playerCache.delete(playerId);

  const pending = playerRequests.get(playerId);
  if (pending !== undefined) return pending;

  const request = fetchScoreSaberPlayer(playerId, { signal: AbortSignal.timeout(playerTimeoutMs) });
  playerRequests.set(playerId, request);
  void request.then(
    (result) => {
      playerRequests.delete(playerId);
      if (result.isErr()) return;
      playerCache.delete(playerId);
      playerCache.set(playerId, { expires: Date.now() + playerCacheTtlMs, player: result.value });
      for (const oldest of playerCache.keys()) {
        if (playerCache.size <= playerCacheLimit) break;
        playerCache.delete(oldest);
      }
    },
    () => {
      playerRequests.delete(playerId);
    },
  );
  return request;
}
