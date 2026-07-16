import type { NjsEvent } from '../beatmap/types';
import { easingFromId, type EasingFunction } from '../easing';

export interface SpawnState {
  noteJumpSpeed: number;
  halfJumpDuration: number;
  halfJumpDurationInBeats: number;
  jumpDuration: number;
  jumpDistance: number;
  halfJumpDistance: number;
}

export interface SpawnProvider {
  baseHalfJumpDurationInBeats: number;
  maxHalfJumpDurationInBeats: number;
  stateAt(songBpmTime: number): SpawnState;
}

interface Segment {
  start: number;
  end: number;
  relativeNjs: number;
  nextRelativeNjs: number;
  easing: EasingFunction;
}

const collapseEasingId = (id: number) => (id >= 4 && id <= 18 ? 0 : id);

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

function calculateHalfJumpDuration(noteJumpSpeed: number, startBeatOffset: number, bpm: number) {
  let halfJumpDuration = 4;
  const secondsPerBeat = 60 / bpm;
  while (noteJumpSpeed * secondsPerBeat * halfJumpDuration > 17.999) halfJumpDuration /= 2;
  return Math.max(halfJumpDuration + startBeatOffset, 0.25);
}

export function createSpawnProvider(
  njsEvents: NjsEvent[],
  baseNoteJumpSpeed: number,
  noteStartBeatOffset: number,
  songBpm: number,
  recordedJumpDistance?: number,
): SpawnProvider {
  const oneBeatDuration = 60 / songBpm;
  const baseHalfJumpDurationInBeats =
    recordedJumpDistance !== undefined && recordedJumpDistance > 0 && baseNoteJumpSpeed > 0
      ? recordedJumpDistance / baseNoteJumpSpeed / 2 / oneBeatDuration
      : calculateHalfJumpDuration(baseNoteJumpSpeed, noteStartBeatOffset, songBpm);

  const events: NjsEvent[] = [
    { jsonTime: 0, songBpmTime: 0, usePrevious: 0, easing: 0, relativeNjs: 0 },
    ...[...njsEvents].sort((a, b) => a.songBpmTime - b.songBpmTime),
  ];

  let maxHalfJumpDurationInBeats = 0;
  const resolved: number[] = [];
  for (const event of events) {
    const insertRelativeNjs = event.usePrevious === 1 ? 0 : event.relativeNjs;
    const factor = Math.min((baseNoteJumpSpeed + insertRelativeNjs) / baseNoteJumpSpeed, 1);
    maxHalfJumpDurationInBeats = Math.max(maxHalfJumpDurationInBeats, Math.ceil(baseHalfJumpDurationInBeats / factor));
    const previous = resolved[resolved.length - 1] ?? 0;
    resolved.push(event.usePrevious === 1 ? previous : event.relativeNjs);
  }

  const segments: Segment[] = events.map((event, i) => {
    const next = events[i + 1];
    const relativeNjs = resolved[i] ?? 0;
    return {
      start: event.songBpmTime,
      end: next?.songBpmTime ?? Infinity,
      relativeNjs,
      nextRelativeNjs: next === undefined ? relativeNjs : (resolved[i + 1] ?? 0),
      easing: easingFromId(next === undefined ? 0 : collapseEasingId(next.easing)),
    };
  });

  function stateFor(noteJumpSpeed: number): SpawnState {
    const factor = Math.min(noteJumpSpeed / baseNoteJumpSpeed, 1);
    const halfJumpDuration = (oneBeatDuration * baseHalfJumpDurationInBeats) / factor;
    const jumpDuration = halfJumpDuration * 2;
    const jumpDistance = noteJumpSpeed * jumpDuration;
    return {
      noteJumpSpeed,
      halfJumpDuration,
      halfJumpDurationInBeats: baseHalfJumpDurationInBeats / factor,
      jumpDuration,
      jumpDistance,
      halfJumpDistance: jumpDistance / 2,
    };
  }

  function stateAt(songBpmTime: number): SpawnState {
    let active: Segment | undefined;
    for (const segment of segments) {
      if (segment.start > songBpmTime) break;
      active = segment;
    }
    if (active === undefined) return stateFor(baseNoteJumpSpeed);
    const span = active.end - active.start;
    const normalized = Number.isFinite(span) && span > 0 ? (songBpmTime - active.start) / span : 0;
    const noteJumpSpeed = Math.max(
      baseNoteJumpSpeed + lerp(active.relativeNjs, active.nextRelativeNjs, active.easing(normalized)),
      0.01,
    );
    return stateFor(noteJumpSpeed);
  }

  return { baseHalfJumpDurationInBeats, maxHalfJumpDurationInBeats, stateAt };
}
