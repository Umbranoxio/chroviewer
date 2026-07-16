import type { SongClock } from '../../core/clock/song-clock';
import type { Replay } from '../../core/replay/types';
import { env } from '../../env';
import type { ReplayStreamPacket } from './generated/proto/scoresaber/live/v1/replay_stream_pb';
import type { LivePlaybackBuffer } from './generated/proto/scoresaber/live/v1/room_state_pb';
import type { ScheduledReplayPause } from './live-playback';
import type { LiveTarget } from './live-types';
import { ludusWebSocketUrl } from './ludus-protocol';

export const reconnectDelays = [500, 1000, 2000, 4000, 8000, 10_000];
export const maxBufferedPackets = 240;

const retainedHistorySeconds = 30;

export interface LiveRuntime {
  bufferedPackets: ReplayStreamPacket[];
  connectionId: string;
  currentStreamId: string;
  followRequested: boolean;
  heartbeatId: number;
  heartbeatIntervalMs: number;
  lastPlaybackDelayIncreaseAt: number;
  lastPruneAt: number;
  lastReceivedSequence: bigint;
  lastReplaySequence: bigint;
  latestFrameTime: number;
  latestSongTime: number;
  mapLoaded: boolean;
  outgoingSequence: bigint;
  pendingChatMessageIds: string[];
  pendingPauseEvents: ScheduledReplayPause[];
  playbackDelay: number;
  playbackClock: SongClock | null;
  playbackMaxDelay: number;
  playbackMinDelay: number;
  playbackRate: number;
  playbackAttemptPending: boolean;
  playbackRecommendedDelay: number;
  playbackStarted: boolean;
  reconnectAttempt: number;
  reconnectId: number;
  receivedPoseFrameCount: number;
  replay: Replay | null;
  sessionPlayerId: string;
  socket: WebSocket | null;
  streamEnding: boolean;
  streamPaused: boolean;
  targetMatchId: string;
  websocketUrl: string;
}

export function createLiveRuntime(target: LiveTarget): LiveRuntime {
  return {
    bufferedPackets: [],
    connectionId: '',
    currentStreamId: '',
    followRequested: false,
    heartbeatId: 0,
    heartbeatIntervalMs: 5000,
    lastPlaybackDelayIncreaseAt: Number.NEGATIVE_INFINITY,
    lastPruneAt: 0,
    lastReceivedSequence: 0n,
    lastReplaySequence: 0n,
    latestFrameTime: 0,
    latestSongTime: 0,
    mapLoaded: false,
    outgoingSequence: 1n,
    pendingChatMessageIds: [],
    pendingPauseEvents: [],
    playbackDelay: 1,
    playbackClock: null,
    playbackMaxDelay: 6,
    playbackMinDelay: 1,
    playbackRate: 1,
    playbackAttemptPending: false,
    playbackRecommendedDelay: 1.5,
    playbackStarted: false,
    reconnectAttempt: 0,
    reconnectId: 0,
    receivedPoseFrameCount: 0,
    replay: null,
    sessionPlayerId: target.watcherPlayerId ?? '',
    socket: null,
    streamEnding: false,
    streamPaused: false,
    targetMatchId: target.matchId ?? (target.roomId === undefined ? `player:${target.playerId}` : ''),
    websocketUrl: ludusWebSocketUrl(env.VITE_LUDUS_URL),
  };
}

export function applyLivePlaybackBuffer(runtime: LiveRuntime, buffer: LivePlaybackBuffer | undefined) {
  if (buffer === undefined) return;
  runtime.playbackMinDelay = Math.max(0.05, buffer.minDelayMs / 1000);
  runtime.playbackMaxDelay = Math.max(runtime.playbackMinDelay, buffer.maxDelayMs / 1000);
  runtime.playbackRecommendedDelay = Math.min(
    runtime.playbackMaxDelay,
    Math.max(runtime.playbackMinDelay, (buffer.recommendedDelayMs || buffer.minDelayMs) / 1000),
  );
  runtime.playbackDelay = Math.min(runtime.playbackMaxDelay, Math.max(runtime.playbackDelay, runtime.playbackMinDelay));
}

export function resetLiveStream(runtime: LiveRuntime) {
  runtime.currentStreamId = '';
  runtime.lastReplaySequence = 0n;
  runtime.latestFrameTime = 0;
  runtime.latestSongTime = 0;
  runtime.mapLoaded = false;
  runtime.pendingPauseEvents = [];
  runtime.playbackAttemptPending = false;
  runtime.playbackClock = null;
  runtime.playbackRate = 1;
  runtime.playbackStarted = false;
  runtime.receivedPoseFrameCount = 0;
  runtime.replay = null;
  runtime.streamEnding = false;
  runtime.streamPaused = false;
}

export function replayPacketTargetsPlayer(packet: ReplayStreamPacket, playerId: string) {
  let packetPlayerId = packet.playerId;
  if (packetPlayerId === '' && packet.body.case === 'start') {
    packetPlayerId = packet.body.value.player?.playerId ?? '';
  }
  return packetPlayerId === '' || packetPlayerId === playerId;
}

export function acceptLiveReplayPacket(runtime: LiveRuntime, packet: ReplayStreamPacket) {
  if (runtime.currentStreamId !== '' && packet.streamId !== runtime.currentStreamId) return false;
  const sequence =
    packet.body.case === 'chunk' || packet.body.case === 'end' ? (packet.body.value.cursor?.sequence ?? 0n) : 0n;
  if (sequence === 0n) return true;
  if (sequence <= runtime.lastReplaySequence) return false;
  if (runtime.lastReplaySequence > 0n && sequence > runtime.lastReplaySequence + 1n) increasePlaybackDelay(runtime);
  runtime.lastReplaySequence = sequence;
  return true;
}

export function increasePlaybackDelay(runtime: LiveRuntime) {
  const now = performance.now();
  if (now - runtime.lastPlaybackDelayIncreaseAt < 500) return;
  runtime.lastPlaybackDelayIncreaseAt = now;
  runtime.playbackDelay = Math.min(
    runtime.playbackMaxDelay,
    runtime.playbackDelay < runtime.playbackRecommendedDelay
      ? runtime.playbackRecommendedDelay
      : runtime.playbackDelay + 0.35,
  );
}

export function pruneLiveReplay(runtime: LiveRuntime, time: number) {
  const replay = runtime.replay;
  if (replay === null || time - runtime.lastPruneAt < 2) return;
  runtime.lastPruneAt = time;
  const cutoff = time - retainedHistorySeconds;
  if (cutoff <= 0) return;
  let poseIndex = 0;
  while (poseIndex + 1 < replay.poses.length && (replay.poses[poseIndex + 1]?.time ?? 0) < cutoff) poseIndex++;
  if (poseIndex > 0) replay.poses.splice(0, poseIndex);
}
