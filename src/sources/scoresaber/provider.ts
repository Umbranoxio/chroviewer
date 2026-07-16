import { Result } from 'better-result';
import { z } from 'zod';

import { env } from '../../env';
import { requestArrayBuffer, requestJson } from '../http';
import { SourceError } from '../source-error';
import type {
  FetchRequest,
  DownloadProgressHandler,
  MapLookup,
  ScoreSaberLeaderboard,
  ScoreSaberReplayPlayer,
  ScoreSaberReplaySource,
  SourceResult,
} from '../source-types';
import type {
  LeaderboardControllerGetDifficultiesForHashData,
  LeaderboardControllerGetLeaderboardByIdData,
  PlayerControllerGetPlayerData,
  PlayerControllerGetPlayerScoresData,
  ScoreControllerGetScoreData,
} from './generated/api-contracts';

interface ResolveOptions {
  onProgress?: DownloadProgressHandler;
  request?: FetchRequest;
  signal?: AbortSignal;
}

type ScoreSaberReference =
  | { kind: 'score'; id: string }
  | { kind: 'leaderboard'; id: string }
  | { kind: 'player'; id: string };

interface LeaderboardContract {
  difficulty: Pick<LeaderboardControllerGetLeaderboardByIdData['difficulty'], 'rawDifficulty'>;
  map: Pick<LeaderboardControllerGetLeaderboardByIdData['map'], 'hash' | 'songName'>;
}

type PlayerScoreContract = PlayerControllerGetPlayerScoresData['data'][number];

interface PlayerScoresContract {
  data: {
    leaderboard: {
      difficulty: Pick<PlayerScoreContract['leaderboard']['difficulty'], 'rawDifficulty'>;
      map: Pick<PlayerScoreContract['leaderboard']['map'], 'hash' | 'songName'>;
    };
  }[];
}

type LeaderboardDifficultyContract = Pick<
  LeaderboardControllerGetDifficultiesForHashData[number],
  'difficulty' | 'gameMode' | 'id'
>;

interface ScoreContract {
  leaderboard: {
    difficulty: Pick<ScoreControllerGetScoreData['leaderboard']['difficulty'], 'difficulty' | 'gameMode'>;
    map: Pick<ScoreControllerGetScoreData['leaderboard']['map'], 'hash'>;
  };
  score: Pick<ScoreControllerGetScoreData['score'], 'hasReplay' | 'id'> & {
    player: Pick<ScoreControllerGetScoreData['score']['player'], 'avatar' | 'country' | 'id' | 'name'>;
  };
}

type PlayerContract = Pick<PlayerControllerGetPlayerData, 'avatar' | 'country' | 'id' | 'name'> & {
  stats: Pick<PlayerControllerGetPlayerData['stats'], 'countryRank' | 'rank'>;
};

const leaderboardSchema = z.object({
  difficulty: z.object({ rawDifficulty: z.string() }),
  map: z.object({
    hash: z.hash('sha1'),
    songName: z.string(),
  }),
}) satisfies z.ZodType<LeaderboardContract>;

const playerScoresSchema = z.object({
  data: z.array(z.object({ leaderboard: leaderboardSchema })),
}) satisfies z.ZodType<PlayerScoresContract>;

const leaderboardDifficultiesSchema = z.array(
  z.object({
    id: z.int().nonnegative(),
    difficulty: z.int(),
    gameMode: z.string(),
  }),
) satisfies z.ZodType<LeaderboardDifficultyContract[]>;

const scoreSchema = z.object({
  leaderboard: z.object({
    difficulty: z.object({
      difficulty: z.int(),
      gameMode: z.string().min(1),
    }),
    map: z.object({ hash: z.hash('sha1') }),
  }),
  score: z.object({
    hasReplay: z.boolean(),
    id: z.int().nonnegative(),
    player: z.object({
      avatar: z.string(),
      country: z.string(),
      id: z.string().min(1),
      name: z.string(),
    }),
  }),
}) satisfies z.ZodType<ScoreContract>;

const playerSchema = z.object({
  avatar: z.string(),
  country: z.string(),
  id: z.string().min(1),
  name: z.string(),
  stats: z.object({
    countryRank: z.int().nonnegative(),
    rank: z.int().nonnegative(),
  }),
}) satisfies z.ZodType<PlayerContract>;

function mapLookup(leaderboard: LeaderboardContract): MapLookup {
  const label = leaderboard.difficulty.rawDifficulty.replace(/^_/, '').replaceAll('_', ' ');
  return {
    label: label === '' ? leaderboard.map.songName : `${leaderboard.map.songName} - ${label}`,
    hash: leaderboard.map.hash,
  };
}

export function scoreSaberReference(input: string): ScoreSaberReference | null {
  const value = input.trim();
  const prefixedScore = /^(?:ss|scoresaber):\s*(\d+)$/i.exec(value)?.[1];
  if (prefixedScore !== undefined) return { kind: 'score', id: prefixedScore };
  const normalized = /^[a-z]+:\/\//i.test(value) ? value : `https://${value}`;
  if (!URL.canParse(normalized)) return null;
  const url = new URL(normalized);
  if (!/(^|\.)scoresaber\.com$/i.test(url.hostname)) return null;
  const score = url.searchParams.get('scoreId') ?? /\/(?:score|scores)\/(\d+)/i.exec(url.pathname)?.[1];
  if (score !== undefined && /^\d+$/.test(score)) return { kind: 'score', id: score };
  const leaderboard = /\/leaderboard\/(\d+)/i.exec(url.pathname)?.[1];
  if (leaderboard !== undefined) return { kind: 'leaderboard', id: leaderboard };
  const player = /\/(?:u|profile)\/(\d+)/i.exec(url.pathname)?.[1];
  return player === undefined ? null : { kind: 'player', id: player };
}

export async function lookupScoreSaber(
  input: string,
  options: ResolveOptions = {},
): Promise<SourceResult<MapLookup[]>> {
  const reference = scoreSaberReference(input);
  if (reference === null || reference.kind === 'score') {
    return Result.err(
      new SourceError({
        message: 'enter a ScoreSaber leaderboard or player URL',
        source: 'scoresaber',
        operation: 'parse-map-lookup',
      }),
    );
  }
  if (reference.kind === 'leaderboard') {
    const leaderboard = await requestJson(
      `${env.VITE_SCORESABER_API_URL}/api/v2/leaderboards/${reference.id}`,
      leaderboardSchema,
      {
        ...options,
        source: 'scoresaber',
        label: `ScoreSaber leaderboard ${reference.id}`,
        operation: 'load-leaderboard',
      },
    );
    return leaderboard.map((value) => [mapLookup(value)]);
  }
  const scores = await requestJson(
    `${env.VITE_SCORESABER_API_URL}/api/v2/players/${reference.id}/scores?limit=50&sort=recent`,
    playerScoresSchema,
    {
      ...options,
      source: 'scoresaber',
      label: `ScoreSaber player ${reference.id}`,
      operation: 'load-player-scores',
    },
  );
  if (scores.isErr()) return Result.err(scores.error);
  const unique = new Map<string, MapLookup>();
  for (const score of scores.value.data) {
    const lookup = mapLookup(score.leaderboard);
    if (!unique.has(lookup.hash.toLowerCase())) unique.set(lookup.hash.toLowerCase(), lookup);
  }
  return unique.size === 0
    ? Result.err(
        new SourceError({
          message: `ScoreSaber player ${reference.id} has no recent map scores`,
          source: 'scoresaber',
          operation: 'load-player-scores',
        }),
      )
    : Result.ok([...unique.values()]);
}

export async function fetchScoreSaberLeaderboards(
  hash: string,
  options: ResolveOptions = {},
): Promise<SourceResult<ScoreSaberLeaderboard[]>> {
  if (!/^[0-9a-f]{40}$/i.test(hash)) {
    return Result.err(
      new SourceError({
        message: 'invalid Beat Saber map hash',
        source: 'scoresaber',
        operation: 'parse-map-hash',
      }),
    );
  }
  const leaderboards = await requestJson(
    `${env.VITE_SCORESABER_API_URL}/api/v2/leaderboards/hash/${hash}`,
    leaderboardDifficultiesSchema,
    {
      ...options,
      source: 'scoresaber',
      label: `ScoreSaber map ${hash}`,
      operation: 'load-map-leaderboards',
    },
  );
  return leaderboards.map((values) =>
    values.map(({ id, difficulty, gameMode }) => ({
      id,
      difficulty,
      gameMode,
    })),
  );
}

function replayMetadata(score: ScoreContract, requestedScoreId: string) {
  const scoreId = String(score.score.id || requestedScoreId);
  const gameMode = score.leaderboard.difficulty.gameMode;
  const characteristic = gameMode.startsWith('Solo') ? gameMode.slice(4) || 'Standard' : gameMode;
  if (!score.score.hasReplay) {
    return Result.err(
      new SourceError({
        message: `ScoreSaber score ${requestedScoreId} has no replay`,
        source: 'scoresaber',
        operation: 'validate-score',
      }),
    );
  }
  const player = score.score.player;
  return Result.ok({
    scoreId,
    hash: score.leaderboard.map.hash,
    difficulty: score.leaderboard.difficulty.difficulty,
    characteristic,
    playerId: player.id,
    player: {
      id: player.id,
      name: player.name,
      avatar: player.avatar,
      country: player.country,
    },
  });
}

function replayPlayer(player: PlayerContract, fallback: ScoreSaberReplayPlayer) {
  return {
    id: player.id || fallback.id,
    name: player.name || fallback.name,
    avatar: player.avatar || fallback.avatar,
    country: player.country || fallback.country,
    rank: player.stats.rank > 0 ? player.stats.rank : undefined,
    countryRank: player.stats.countryRank > 0 ? player.stats.countryRank : undefined,
  };
}

export async function fetchScoreSaberPlayer(
  playerId: string,
  options: ResolveOptions = {},
): Promise<SourceResult<ScoreSaberReplayPlayer>> {
  if (!/^\d+$/.test(playerId)) {
    return Result.err(
      new SourceError({
        message: 'invalid ScoreSaber player ID',
        source: 'scoresaber',
        operation: 'parse-player-id',
      }),
    );
  }
  const player = await requestJson(`${env.VITE_SCORESABER_API_URL}/api/v2/players/${playerId}`, playerSchema, {
    ...options,
    source: 'scoresaber',
    label: `ScoreSaber player ${playerId}`,
    operation: 'load-player',
  });
  return player.map((value) => replayPlayer(value, { id: playerId, name: 'Player', avatar: '', country: '' }));
}

export async function fetchScoreSaberReplay(
  scoreId: string,
  options: ResolveOptions = {},
): Promise<SourceResult<ScoreSaberReplaySource>> {
  if (!/^\d+$/.test(scoreId)) {
    return Result.err(
      new SourceError({
        message: 'invalid ScoreSaber score ID',
        source: 'scoresaber',
        operation: 'parse-score-id',
      }),
    );
  }
  return Result.gen(async function* () {
    const score = yield* Result.await(
      requestJson(`${env.VITE_SCORESABER_API_URL}/api/v2/scores/${scoreId}?includeScoreStats=false`, scoreSchema, {
        ...options,
        source: 'scoresaber',
        label: `ScoreSaber score ${scoreId}`,
        operation: 'load-score',
      }),
    );
    const metadata = yield* replayMetadata(score, scoreId);
    const [replay, player] = await Promise.all([
      requestArrayBuffer(`${env.VITE_SCORESABER_API_URL}/api/v2/scores/${metadata.scoreId}/replay`, {
        ...options,
        source: 'scoresaber',
        label: `ScoreSaber replay ${metadata.scoreId}`,
        operation: 'download-replay',
      }),
      requestJson(`${env.VITE_SCORESABER_API_URL}/api/v2/players/${metadata.playerId}`, playerSchema, {
        ...options,
        source: 'scoresaber',
        label: `ScoreSaber player ${metadata.playerId}`,
        operation: 'load-player',
      }),
    ]);
    if (replay.isErr()) return replay;
    return Result.ok({
      scoreId: metadata.scoreId,
      hash: metadata.hash,
      difficulty: metadata.difficulty,
      characteristic: metadata.characteristic,
      player: player.isOk() ? replayPlayer(player.value, metadata.player) : metadata.player,
      replay: replay.value,
    });
  });
}
