import { secondsToSongBpmTime } from '../../core/beatmap/bpm';

export function quantizedBeatAt(time: number, songBpm: number, beatStep: number) {
  return Math.round(secondsToSongBpmTime(time, songBpm) / beatStep) * beatStep;
}
