import type { InfoColorScheme, InfoDifficulty } from '../../core/beatmap/info';
import type { Difficulty } from '../../core/beatmap/types';
import type { MapRenderData } from '../../core/placement/map-render-data';

export interface MapMeta {
  title: string;
  subtitle: string;
  author: string;
  mapper: string;
}

export interface DifficultyRow {
  key: string;
  label: string;
  difficulty?: Difficulty;
  infoDifficulty?: InfoDifficulty;
  environmentId?: string;
  colorScheme?: InfoColorScheme;
  replayMatch?: boolean;
}

export interface MapIdentity {
  key: string;
  hash: string;
}

export interface ActiveSelection {
  data: MapRenderData;
  environmentId: string;
  mapColorScheme?: InfoColorScheme;
}

export type ViewerPanel = 'share' | 'shortcuts' | 'speed' | 'lights' | 'camera' | 'volume' | 'record-video' | null;

export type ViewerSource = 'beatsaver' | 'scoresaber';
