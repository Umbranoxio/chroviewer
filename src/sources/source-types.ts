import type { Result } from 'better-result';

import type { SourceError } from './source-error';

export interface MapSourceFile {
  name: string;
  text: () => Promise<string>;
  arrayBuffer?: () => Promise<ArrayBuffer>;
}

export interface BeatSaverMapSource {
  key: string;
  hash: string;
  files: MapSourceFile[];
}

export interface MapLookup {
  label: string;
  hash: string;
}

export interface ScoreSaberLeaderboard {
  id: number;
  difficulty: number;
  gameMode: string;
}

export interface ScoreSaberReplayPlayer {
  id: string;
  name: string;
  avatar: string;
  country: string;
  rank?: number;
  countryRank?: number;
}

export interface ScoreSaberReplaySource {
  scoreId: string;
  hash: string;
  difficulty: number;
  characteristic: string;
  player: ScoreSaberReplayPlayer;
  replay: ArrayBuffer;
}

export type FetchRequest = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
export type DownloadProgress = number | null;
export type DownloadProgressHandler = (progress: DownloadProgress) => void;
export type SourceResult<T> = Result<T, SourceError>;
