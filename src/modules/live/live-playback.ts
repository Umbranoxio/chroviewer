import type { SongClock } from '../../core/clock/song-clock';
import type { ReplayPauseEvent } from './generated/proto/scoresaber/live/v1/replay_stream_pb';
import { increasePlaybackDelay, pruneLiveReplay, type LiveRuntime } from './live-runtime';
import type { LiveStatus } from './live-types';

export interface ScheduledReplayPause {
  event: ReplayPauseEvent;
  queuedPoseFrameCount: number;
}

export function scheduleReplayPause(
  queue: ScheduledReplayPause[],
  event: ReplayPauseEvent,
  receivedPoseFrameCount: number,
) {
  const scheduled = { event, queuedPoseFrameCount: receivedPoseFrameCount };
  const index = queue.findIndex((candidate) => candidate.event.timeSeconds > event.timeSeconds);
  if (index === -1) queue.push(scheduled);
  else queue.splice(index, 0, scheduled);
}

export function replayPauseReady(
  scheduled: ScheduledReplayPause,
  currentTime: number,
  latestFrameTime: number,
  receivedPoseFrameCount: number,
  streamPaused: boolean,
) {
  const event = scheduled.event;
  const reachedEventTime = currentTime + 0.001 >= event.timeSeconds;
  if (event.paused) return reachedEventTime;
  if (!streamPaused && !reachedEventTime) return false;
  return receivedPoseFrameCount > scheduled.queuedPoseFrameCount && latestFrameTime >= event.timeSeconds;
}

interface LivePlaybackActions {
  pause(): void;
  resume(): boolean;
  seek(time: number): void;
  updateStatus(status: LiveStatus): void;
}

export function tickLivePlayback(
  runtime: LiveRuntime,
  clock: SongClock | null,
  selectedKey: string,
  actions: LivePlaybackActions,
) {
  const replay = runtime.replay;
  if (replay === null || clock === null || !runtime.mapLoaded || selectedKey === '') return;
  if (runtime.playbackClock !== clock) {
    runtime.playbackClock = clock;
    clock.setRate(runtime.playbackRate);
  }
  const firstFrameTime = replay.poses[0]?.time;
  if (firstFrameTime === undefined || runtime.latestFrameTime <= 0) return;
  const currentTime = clock.currentTime();
  processPauseEvents(runtime, currentTime, actions);
  if (runtime.streamPaused) return;
  if (runtime.streamEnding && currentTime >= Math.max(runtime.latestSongTime, runtime.latestFrameTime) - 0.02) {
    actions.pause();
    actions.updateStatus('waiting');
    return;
  }
  if (runtime.playbackStarted && clock.isPlaying() && !runtime.streamEnding && currentTime >= runtime.latestFrameTime) {
    increasePlaybackDelay(runtime);
    actions.seek(Math.max(firstFrameTime, Math.max(0, runtime.latestFrameTime - 0.02)));
    actions.pause();
    actions.updateStatus('buffering');
    return;
  }
  if (runtime.playbackAttemptPending) tryLivePlayback(runtime, clock, firstFrameTime, actions);
  pruneLiveReplay(runtime, currentTime);
}

function tryLivePlayback(runtime: LiveRuntime, clock: SongClock, firstFrameTime: number, actions: LivePlaybackActions) {
  runtime.playbackAttemptPending = false;
  const currentTime = clock.currentTime();
  const currentResumeBuffer = Math.max(0.75, runtime.playbackDelay * 0.85);
  if (
    runtime.playbackStarted &&
    clock.isPlaying() &&
    !runtime.streamEnding &&
    runtime.latestFrameTime - currentTime < currentResumeBuffer
  ) {
    increasePlaybackDelay(runtime);
  }

  const resumeBuffer = Math.max(0.75, runtime.playbackDelay * 0.85);
  const targetTime = Math.max(firstFrameTime, runtime.latestFrameTime - runtime.playbackDelay);
  const availableBuffer = runtime.latestFrameTime - firstFrameTime;
  if (!runtime.playbackStarted && !runtime.streamEnding && availableBuffer < 0.75) {
    actions.updateStatus('buffering');
    return;
  }

  let restartAt = clock.isPlaying() ? null : currentTime;
  if (!runtime.playbackStarted) {
    runtime.playbackStarted = true;
    restartAt = targetTime;
  } else if (!runtime.streamEnding && currentTime >= runtime.latestFrameTime) {
    increasePlaybackDelay(runtime);
    actions.seek(Math.max(firstFrameTime, runtime.latestFrameTime - runtime.playbackDelay));
    actions.pause();
    actions.updateStatus('buffering');
    return;
  } else if (!clock.isPlaying() && currentTime > targetTime + 0.1) {
    restartAt = targetTime;
  } else if (currentTime > runtime.latestFrameTime + 0.1 || targetTime - currentTime > 5) {
    restartAt = targetTime;
  }

  if (!clock.isPlaying() && !runtime.streamEnding && runtime.latestFrameTime - currentTime < resumeBuffer) {
    actions.updateStatus('buffering');
    return;
  }
  if (restartAt !== null) actions.seek(restartAt);
  if ((restartAt === null || actions.resume()) && clock.isPlaying()) actions.updateStatus('watching');
}

function processPauseEvents(runtime: LiveRuntime, time: number, actions: LivePlaybackActions) {
  while (runtime.pendingPauseEvents.length > 0) {
    const scheduled = runtime.pendingPauseEvents[0];
    if (scheduled === undefined) return;
    const event = scheduled.event;
    if (
      !replayPauseReady(scheduled, time, runtime.latestFrameTime, runtime.receivedPoseFrameCount, runtime.streamPaused)
    ) {
      return;
    }
    runtime.pendingPauseEvents.shift();
    runtime.streamPaused = event.paused;
    actions.seek(event.timeSeconds);
    if (event.paused) {
      actions.pause();
      actions.updateStatus('paused');
    } else if (actions.resume()) {
      actions.updateStatus('watching');
    }
  }
}
