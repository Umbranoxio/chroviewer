import type { RefObject } from 'react';

import type { SongClock } from '../../core/clock/song-clock';
import type { Replay, ReplayHeightEvent, ReplayNoteEvent } from '../../core/replay/types';
import type { ScoreSaberReplayPlayer, SourceResult } from '../../sources/source-types';
import type { LiveChatMessage } from './generated/proto/scoresaber/live/v1/chat_pb';
import type { LudusPlayState } from './generated/proto/scoresaber/live/v1/common_pb';

export type LiveStatus =
  | 'connecting'
  | 'waiting'
  | 'loading'
  | 'buffering'
  | 'watching'
  | 'paused'
  | 'reconnecting'
  | 'error';

export interface LiveTarget {
  playerId: string;
  tournamentId?: string;
  roomId?: string;
  matchId?: string;
  watcherPlayerId?: string;
  authToken?: string;
}

export interface LiveExperienceState {
  audioBlocked: boolean;
  canChat: boolean;
  chatError: boolean;
  messages: LiveChatMessage[];
  pendingChatMessageIds: string[];
  playState: LudusPlayState;
  status: LiveStatus;
  viewerCount: number | null;
}

export interface LiveExperience extends LiveExperienceState {
  player: ScoreSaberReplayPlayer | null;
  sendChatMessage(text: string): boolean;
  unlockAudio(): Promise<boolean>;
}

interface LiveTransport {
  clockRef: RefObject<SongClock | null>;
  seek(time: number): void;
  togglePlay(start: number, end: number): boolean | undefined;
}

export interface LiveExperienceOptions {
  appendReplayHeightEvents: (events: ReplayHeightEvent[]) => void;
  appendReplayNoteEvents: (events: ReplayNoteEvent[]) => void;
  hasLiveMap: (hash: string) => boolean;
  loadLiveReplay: (hash: string, replay: Replay) => Promise<SourceResult<void>>;
  selectedKey: string;
  target: LiveTarget | null;
  transport: LiveTransport;
}
