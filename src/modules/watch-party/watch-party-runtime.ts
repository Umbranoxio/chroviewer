import { env } from '../../env';
import type { LiveChatMessage } from '../live/generated/proto/scoresaber/live/v1/chat_pb';
import type {
  WatchPartyParticipant,
  WatchPartySelfCapabilities,
  WatchPartyState,
} from '../live/generated/proto/scoresaber/live/v1/watch_party_pb';
import { reconnectDelays } from '../live/live-runtime';
import { ludusWebSocketUrl } from '../live/ludus-protocol';
import { createWatchPartyClockEstimator, type WatchPartyClockEstimator } from './watch-party-clock';
import type { WatchPartySession } from './watch-party-session';
import type { WatchPartyRevisionState } from './watch-party-state';

export { reconnectDelays as watchPartyReconnectDelays };

export interface WatchPartyRuntime {
  clock: WatchPartyClockEstimator;
  connectionId: string;
  heartbeatId: number;
  heartbeatIntervalMs: number;
  lastReceivedSequence: bigint;
  mapLoadGeneration: number;
  mapLoadingKey: string;
  mapReadyKey: string;
  matchId: string;
  messages: LiveChatMessage[];
  outgoingSequence: bigint;
  pendingChatMessageIds: string[];
  pendingHeartbeats: Map<bigint, number>;
  reconnectAttempt: number;
  reconnectId: number;
  revision: WatchPartyRevisionState;
  roster: WatchPartyParticipant[];
  selfCapabilities: WatchPartySelfCapabilities | undefined;
  session: WatchPartySession | null;
  socket: WebSocket | null;
  state: WatchPartyState | undefined;
  websocketUrl: string;
}

export function createWatchPartyRuntime(): WatchPartyRuntime {
  return {
    clock: createWatchPartyClockEstimator(),
    connectionId: '',
    heartbeatId: 0,
    heartbeatIntervalMs: 5000,
    lastReceivedSequence: 0n,
    mapLoadGeneration: 0,
    mapLoadingKey: '',
    mapReadyKey: '',
    matchId: '',
    messages: [],
    outgoingSequence: 1n,
    pendingChatMessageIds: [],
    pendingHeartbeats: new Map(),
    reconnectAttempt: 0,
    reconnectId: 0,
    revision: { baselineAccepted: false, revision: 0n },
    roster: [],
    selfCapabilities: undefined,
    session: null,
    socket: null,
    state: undefined,
    websocketUrl: ludusWebSocketUrl(env.VITE_LUDUS_URL),
  };
}
