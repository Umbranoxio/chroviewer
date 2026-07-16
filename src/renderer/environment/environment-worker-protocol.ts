import type { EnvironmentData } from './types';

export interface EnvironmentWorkerRequest {
  id: string;
  url: string;
}

export type EnvironmentWorkerResponse = { ok: true; data: EnvironmentData } | { ok: false; error: string };
