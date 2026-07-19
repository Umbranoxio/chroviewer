import {
  WatchPartyPlaybackState,
  type WatchPartyState,
} from '../live/generated/proto/scoresaber/live/v1/watch_party_pb';
import { normalizeWatchPartyDifficulty } from './watch-party-map';

export interface WatchPartyRevisionState {
  baselineAccepted: boolean;
  revision: bigint;
}

export function acceptWatchPartyRevision(current: WatchPartyRevisionState, revision: bigint) {
  if (!current.baselineAccepted) {
    return { accepted: true, next: { baselineAccepted: true, revision } };
  }
  if (revision <= current.revision) return { accepted: false, next: current };
  return { accepted: true, next: { baselineAccepted: true, revision } };
}

export function watchPartyTargetTime(state: WatchPartyState, estimatedServerNowUnixMs: number, duration: number) {
  let target = state.anchorSongSeconds;
  if (
    state.playbackState === WatchPartyPlaybackState.PLAYING &&
    state.anchorServerUnixMs > 0n &&
    estimatedServerNowUnixMs > Number(state.anchorServerUnixMs)
  ) {
    const rate = state.playbackRate > 0 ? state.playbackRate : 1;
    target += ((estimatedServerNowUnixMs - Number(state.anchorServerUnixMs)) / 1000) * rate;
  }
  return Math.min(Math.max(target, 0), Math.max(0, duration));
}

export function sameWatchPartyMap(left: WatchPartyState['map'], right: WatchPartyState['map']) {
  if (left === undefined || right === undefined) return left === right;
  return (
    left.beatSaverId.toLowerCase() === right.beatSaverId.toLowerCase() &&
    left.hash.toLowerCase() === right.hash.toLowerCase() &&
    left.characteristic.toLowerCase() === right.characteristic.toLowerCase() &&
    normalizeWatchPartyDifficulty(left.difficulty) === normalizeWatchPartyDifficulty(right.difficulty)
  );
}
