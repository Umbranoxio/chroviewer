import type { BpmEvent, Difficulty } from './types';

export function bootstrapBpmEvents(events: BpmEvent[], songBpm: number): BpmEvent[] {
  const kept = events.filter((e) => e.jsonTime >= 0 && e.bpm >= 0);
  if (kept.length === 0) return kept;
  kept.sort((a, b) => a.jsonTime - b.jsonTime);
  const first = kept[0];
  if (first !== undefined && first.jsonTime > 0) {
    kept.unshift({ jsonTime: 0, songBpmTime: 0, bpm: songBpm });
  }
  let prev: BpmEvent | undefined;
  for (const event of kept) {
    event.songBpmTime =
      prev === undefined ? event.jsonTime : prev.songBpmTime + (event.jsonTime - prev.jsonTime) * (songBpm / prev.bpm);
    prev = event;
  }
  return kept;
}

export function createBpmConverter(events: BpmEvent[], songBpm: number): (jsonTime: number) => number {
  return (jsonTime) => {
    for (let i = events.length - 1; i >= 0; i--) {
      const event = events[i];
      if (event !== undefined && event.jsonTime < jsonTime) {
        return event.songBpmTime + (jsonTime - event.jsonTime) * (songBpm / event.bpm);
      }
    }
    return jsonTime;
  };
}

export function secondsToSongBpmTime(seconds: number, songBpm: number): number {
  return (songBpm / 60) * seconds;
}

export function songBpmTimeToSeconds(songBpmTime: number, songBpm: number): number {
  return (60 / songBpm) * songBpmTime;
}

export function recomputeSongBpmTimes(difficulty: Difficulty, songBpm: number): void {
  difficulty.bpmEvents = bootstrapBpmEvents(difficulty.bpmEvents, songBpm);
  const convert = createBpmConverter(difficulty.bpmEvents, songBpm);
  difficulty.bookmarks.sort((left, right) => left.jsonTime - right.jsonTime);
  for (const bookmark of difficulty.bookmarks) {
    bookmark.songBpmTime = convert(bookmark.jsonTime);
  }
  for (const note of difficulty.notes) {
    note.songBpmTime = convert(note.jsonTime);
  }
  for (const obstacle of difficulty.obstacles) {
    obstacle.songBpmTime = convert(obstacle.jsonTime);
    obstacle.durationSongBpmTime = convert(obstacle.jsonTime + obstacle.duration) - obstacle.songBpmTime;
  }
  for (const arc of difficulty.arcs) {
    arc.songBpmTime = convert(arc.jsonTime);
    arc.tailSongBpmTime = convert(arc.tailJsonTime);
  }
  for (const chain of difficulty.chains) {
    chain.songBpmTime = convert(chain.jsonTime);
    chain.tailSongBpmTime = convert(chain.tailJsonTime);
  }
  for (const event of difficulty.events) {
    event.songBpmTime = convert(event.jsonTime);
  }
  for (const rotation of difficulty.rotationEvents) {
    rotation.songBpmTime = convert(rotation.jsonTime);
  }
  for (const njs of difficulty.njsEvents) {
    njs.songBpmTime = convert(njs.jsonTime);
  }
  for (const group of [
    ...difficulty.lightColorEventBoxGroups,
    ...difficulty.lightRotationEventBoxGroups,
    ...difficulty.lightTranslationEventBoxGroups,
    ...difficulty.fxEventBoxGroups,
  ]) {
    group.songBpmTime = convert(group.jsonTime);
  }
}
