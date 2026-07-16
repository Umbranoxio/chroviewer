import { songBpmTimeToSeconds } from '../beatmap/bpm';
import type { ReplayNoteEventType } from '../replay/types';

export interface HitsoundEvent {
  time: number;
  good: boolean;
}

interface HitsoundNote {
  beat: number;
  replayEndTime?: number;
  replayEventType?: ReplayNoteEventType;
}

export function buildHitsoundEvents(notes: HitsoundNote[], songBpm: number) {
  const events = notes
    .flatMap((note): HitsoundEvent[] => {
      if (note.replayEventType === 0 || note.replayEventType === 3 || note.replayEventType === 4) return [];
      if (note.replayEventType === 2) {
        return [{ time: note.replayEndTime ?? songBpmTimeToSeconds(note.beat, songBpm), good: false }];
      }
      return [{ time: songBpmTimeToSeconds(note.beat, songBpm), good: true }];
    })
    .sort((left, right) => left.time - right.time);
  const collapsed: HitsoundEvent[] = [];
  for (const event of events) {
    const previous = collapsed.at(-1);
    if (previous !== undefined && Math.abs(previous.time - event.time) <= 1e-6) {
      previous.good &&= event.good;
    } else {
      collapsed.push(event);
    }
  }
  return collapsed;
}

export function firstHitsoundAfter(events: HitsoundEvent[], time: number) {
  let low = 0;
  let high = events.length;
  while (low < high) {
    const middle = (low + high) >>> 1;
    if ((events[middle]?.time ?? Infinity) <= time) low = middle + 1;
    else high = middle;
  }
  return low;
}

export class HitsoundPlayer {
  private context: AudioContext | null = null;
  private volume = 1;

  setVolume(volume: number) {
    this.volume = Math.min(Math.max(volume, 0), 1);
  }

  resume() {
    this.context ??= new AudioContext();
    void this.context.resume();
  }

  play(good: boolean, delay = 0) {
    const context = this.context;
    if (context === null || this.volume === 0) return;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const start = context.currentTime + Math.max(delay, 0);
    oscillator.type = good ? 'sine' : 'square';
    oscillator.frequency.setValueAtTime(good ? 880 : 180, start);
    gain.gain.setValueAtTime((good ? 1 : 0.67) * this.volume, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + (good ? 0.035 : 0.07));
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(start);
    oscillator.stop(start + (good ? 0.04 : 0.075));
  }

  dispose() {
    if (this.context !== null) void this.context.close();
    this.context = null;
  }
}
