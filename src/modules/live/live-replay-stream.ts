import type { ReplayNoteEvent } from '../../core/replay/types';
import {
  ReplayCompletion,
  type ReplayChunk,
  type ReplayStreamPacket,
} from './generated/proto/scoresaber/live/v1/replay_stream_pb';
import type { LiveRoomReplayState } from './generated/proto/scoresaber/live/v1/room_state_pb';
import { scheduleReplayPause } from './live-playback';
import { appendLivePause, applyLiveReplayExtensions, liveNote, livePose } from './live-replay';
import { acceptLiveReplayPacket, type LiveRuntime } from './live-runtime';

export function applyLiveReplayChunk(
  runtime: LiveRuntime,
  chunk: ReplayChunk,
  appendReplayNoteEvents: (events: ReplayNoteEvent[]) => void,
) {
  const replay = runtime.replay;
  if (replay === null) return;
  runtime.playbackAttemptPending = true;
  runtime.latestSongTime = Math.max(runtime.latestSongTime, Number(chunk.cursor?.songTimeMs ?? 0n) / 1000);
  applyLiveReplayExtensions(replay, chunk.replayExtensions, true);
  const events = chunk.events;
  if (events === undefined) return;
  const notes = events.noteEvents.map(liveNote);
  for (const event of events.pauseEvents) {
    appendLivePause(replay, event);
    scheduleReplayPause(runtime.pendingPauseEvents, event, runtime.receivedPoseFrameCount);
  }
  replay.poses.push(...events.poseFrames.map(livePose));
  runtime.receivedPoseFrameCount += events.poseFrames.length;
  replay.heights.push(...events.heightEvents.map((event) => ({ height: event.height, time: event.timeSeconds })));
  replay.notes.push(...notes);
  replay.scores.push(
    ...events.scoreEvents.map((event) => ({
      score: event.score,
      time: event.timeSeconds,
      immediateMaxPossibleScore: event.immediateMaxPossibleScore,
    })),
  );
  replay.combos.push(...events.comboEvents.map((event) => ({ combo: event.combo, time: event.timeSeconds })));
  replay.multipliers.push(
    ...events.multiplierEvents.map((event) => ({
      multiplier: event.multiplier,
      nextMultiplierProgress: event.nextMultiplierProgress,
      time: event.timeSeconds,
    })),
  );
  replay.energies.push(...events.energyEvents.map((event) => ({ energy: event.energy, time: event.timeSeconds })));
  runtime.latestFrameTime = Math.max(runtime.latestFrameTime, replay.poses.at(-1)?.time ?? 0);
  if (
    notes.length > 0 ||
    events.scoreEvents.length > 0 ||
    events.comboEvents.length > 0 ||
    events.multiplierEvents.length > 0 ||
    events.energyEvents.length > 0
  ) {
    appendReplayNoteEvents(notes);
  }
}

export function applyLiveReplayStates(
  runtime: LiveRuntime,
  states: LiveRoomReplayState[],
  playerId: string,
  notifyTimelineChanged: () => void,
) {
  const replay = runtime.replay;
  const state =
    states.find((candidate) => candidate.playerId === playerId) ?? (states.length === 1 ? states[0] : undefined);
  if (replay === null || state === undefined) return;
  const time = Number(state.songTimeMs) / 1000;
  let timelineChanged = false;
  const lastScore = replay.scores.at(-1);
  if (lastScore === undefined || (time >= lastScore.time && lastScore.score !== state.score)) {
    replay.scores.push({
      score: state.score,
      time,
      immediateMaxPossibleScore:
        state.accuracy !== undefined && state.accuracy > 0 ? Math.round(state.score / state.accuracy) : undefined,
    });
    timelineChanged = true;
  }
  if (state.combo !== undefined && replay.combos.at(-1)?.combo !== state.combo) {
    replay.combos.push({ combo: state.combo, time });
    timelineChanged = true;
  }
  if (timelineChanged) notifyTimelineChanged();
}

export function applyLiveReplayEnd(runtime: LiveRuntime, packet: ReplayStreamPacket) {
  const end = packet.body.case === 'end' ? packet.body.value : undefined;
  if (end === undefined || !acceptLiveReplayPacket(runtime, packet)) return 'ignored';
  runtime.latestSongTime = Math.max(runtime.latestSongTime, Number(end.cursor?.songTimeMs ?? 0n) / 1000);
  if (end.completion === ReplayCompletion.FAILED && runtime.replay !== null) {
    runtime.replay.metadata.failTime = runtime.latestSongTime;
  }
  if (end.score !== undefined && runtime.replay !== null) {
    runtime.replay.scores.push({
      score: end.score.modifiedScore || end.score.score,
      time: runtime.latestSongTime,
      immediateMaxPossibleScore: end.score.maxScore || undefined,
    });
    runtime.replay.combos.push({ combo: end.score.combo, time: runtime.latestSongTime });
  }
  runtime.streamEnding = true;
  const waiting = end.completion === ReplayCompletion.QUIT || end.completion === ReplayCompletion.ABORTED;
  runtime.playbackAttemptPending = !waiting;
  return waiting ? 'waiting' : 'ending';
}
