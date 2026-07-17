import * as z from 'zod/mini';

import type { SharedViewerSettings } from '../../core/share-link';
import { viewerSettingsPatchSchema } from '../../core/viewer-settings';

export type ViewerShareSource =
  | { type: 'map'; mapKey: string; difficultyIndex?: number }
  | { type: 'score'; scoreId: string }
  | { type: 'live'; playerId: string; tournamentId?: string; roomId?: string; matchId?: string };

const searchIdentifierSchema = z.union([z.string(), z.pipe(z.int(), z.transform(String))]);
const mapKeySchema = z.pipe(
  searchIdentifierSchema.check(z.regex(/^[0-9a-f]+$/i)),
  z.transform((value) => value.toLowerCase()),
);
const scoreIdSchema = searchIdentifierSchema.check(z.regex(/^\d+$/));
const loopbackHostnames = new Set(['localhost', '127.0.0.1', '[::1]']);
const replayUrlSchema = z.pipe(
  z.string().check(z.maxLength(4096)),
  z.url({ protocol: /^https?$/ }).check(
    z.refine((value) => {
      const url = new URL(value);
      return url.protocol === 'https:' || loopbackHostnames.has(url.hostname);
    }),
  ),
);
const nonnegativeNumberSchema = z.number().check(z.nonnegative());
const difficultyIndexSchema = z.int().check(z.nonnegative());
const liveIdSchema = searchIdentifierSchema.check(z.minLength(1), z.maxLength(128));
const livePlayerIdSchema = liveIdSchema.check(z.regex(/^\d+$/));

export const viewerSearchSchema = z.pipe(
  z.object({
    map: z.catch(z.optional(mapKeySchema), undefined),
    replayUrl: z.catch(z.optional(replayUrlSchema), undefined),
    scoreId: z.catch(z.optional(scoreIdSchema), undefined),
    difficulty: z.catch(z.optional(difficultyIndexSchema), undefined),
    beat: z.catch(z.optional(nonnegativeNumberSchema), undefined),
    autoplay: z.catch(z.optional(z.boolean()), undefined),
    lightshow: z.catch(z.optional(z.literal('full-lightshow')), undefined),
    settings: z.catch(z.optional(viewerSettingsPatchSchema), undefined),
    playerId: z.catch(z.optional(livePlayerIdSchema), undefined),
    tournamentId: z.catch(z.optional(liveIdSchema), undefined),
    roomId: z.catch(z.optional(liveIdSchema), undefined),
    matchId: z.catch(z.optional(liveIdSchema), undefined),
    watcherPlayerId: z.catch(z.optional(livePlayerIdSchema), undefined),
    authToken: z.catch(z.optional(z.string().check(z.minLength(1), z.maxLength(4096))), undefined),
  }),
  z.transform((search) => {
    if (search.playerId !== undefined) {
      return {
        ...search,
        map: undefined,
        replayUrl: undefined,
        scoreId: undefined,
        difficulty: undefined,
        beat: undefined,
      };
    }
    if (search.replayUrl !== undefined) return { ...search, map: undefined, scoreId: undefined, difficulty: undefined };
    if (search.scoreId !== undefined) return { ...search, map: undefined, difficulty: undefined };
    return search;
  }),
);

export type ViewerSearch = z.infer<typeof viewerSearchSchema>;

export function viewerSearchForShare(
  source: ViewerShareSource,
  beat: number | undefined,
  settings?: SharedViewerSettings,
): ViewerSearch {
  if (source.type === 'live') {
    return {
      playerId: source.playerId,
      tournamentId: source.tournamentId,
      roomId: source.roomId,
      matchId: source.matchId,
      settings,
    };
  }
  const sharedBeat = beat !== undefined && beat > 0 ? Number(beat.toFixed(6)) : undefined;
  return source.type === 'map'
    ? {
        map: source.mapKey,
        difficulty: source.difficultyIndex,
        beat: sharedBeat,
        settings,
      }
    : {
        scoreId: source.scoreId,
        beat: sharedBeat,
        settings,
      };
}
