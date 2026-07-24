import { easing } from './easing';

export function eventProgress(beat: number, startBeat: number, duration: number, repeat: number, easingName?: string) {
  if (duration <= 0) return 1;
  const elapsed = Math.max(beat - startBeat, 0);
  const iterations = repeat + 1;
  if (elapsed >= duration * iterations) return 1;
  return easing((elapsed % duration) / duration, easingName);
}

export function eventProviderBeat(beat: number, startBeat: number, duration: number, repeat: number) {
  if (duration <= 0) return startBeat;
  return Math.min(beat, startBeat + duration * (repeat + 1));
}
