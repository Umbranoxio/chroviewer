import type { ReplayPose } from './types';

export interface ReplayFrameSample {
  from: ReplayPose;
  to: ReplayPose;
  amount: number;
}

export function sampleReplayFrames(frames: ReplayPose[], time: number): ReplayFrameSample | null {
  const first = frames[0];
  const last = frames.at(-1);
  if (first === undefined || last === undefined) return null;
  if (time <= first.time) return { from: first, to: first, amount: 0 };
  if (time >= last.time) return { from: last, to: last, amount: 0 };
  let low = 0;
  let high = frames.length - 1;
  while (low + 1 < high) {
    const middle = Math.floor((low + high) / 2);
    const frame = frames[middle];
    if (frame !== undefined && frame.time <= time) low = middle;
    else high = middle;
  }
  const from = frames[low] ?? first;
  const to = frames[high] ?? last;
  const duration = to.time - from.time;
  return { from, to, amount: duration <= 0 ? 0 : (time - from.time) / duration };
}
