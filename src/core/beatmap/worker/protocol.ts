import type { Replay } from '../../replay/types';
import type { MapInfo } from '../info';
import type { Difficulty } from '../types';

export interface WorkerOperations {
  info: {
    request: { text: string };
    response: MapInfo;
  };
  difficulty: {
    request: {
      text: string;
      songBpm: number;
      lightshowText?: string;
      audioDataText?: string;
      bookmarkText?: string;
    };
    response: Difficulty;
  };
  replay: {
    request: { data: ArrayBuffer };
    response: Replay;
  };
}

export type WorkerOperation = keyof WorkerOperations;

export type WorkerRequest = {
  [Kind in WorkerOperation]: { id: number; kind: Kind } & WorkerOperations[Kind]['request'];
}[WorkerOperation];

export type WorkerSuccess = {
  [Kind in WorkerOperation]: {
    id: number;
    ok: true;
    kind: Kind;
    result: WorkerOperations[Kind]['response'];
  };
}[WorkerOperation];

export type WorkerResponse = WorkerSuccess | { id: number; ok: false; error: string };
