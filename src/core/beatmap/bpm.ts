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
    let low = 0;
    let high = events.length;
    while (low < high) {
      const middle = (low + high) >>> 1;
      if ((events[middle]?.jsonTime ?? Infinity) < jsonTime) low = middle + 1;
      else high = middle;
    }
    const event = events[low - 1];
    return event === undefined ? jsonTime : event.songBpmTime + (jsonTime - event.jsonTime) * (songBpm / event.bpm);
  };
}

function customEventDuration(events: readonly BpmEvent[], jsonTime: number, duration: number, songBpm: number) {
  let low = 0;
  let high = events.length;
  while (low < high) {
    const middle = (low + high) >>> 1;
    if ((events[middle]?.jsonTime ?? Infinity) <= jsonTime) low = middle + 1;
    else high = middle;
  }
  return duration * (songBpm / (events[low - 1]?.bpm ?? songBpm));
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
  for (const animation of difficulty.chromaEnvironment.animations) {
    animation.songBpmTime = convert(animation.jsonTime);
    animation.durationSongBpmTime = customEventDuration(
      difficulty.bpmEvents,
      animation.jsonTime,
      animation.duration,
      songBpm,
    );
  }
  for (const animation of difficulty.chromaEnvironment.componentAnimations) {
    animation.songBpmTime = convert(animation.jsonTime);
    animation.durationSongBpmTime = customEventDuration(
      difficulty.bpmEvents,
      animation.jsonTime,
      animation.duration,
      songBpm,
    );
  }
  for (const event of difficulty.chromaEnvironment.fogTrackEvents) {
    event.songBpmTime = convert(event.jsonTime);
  }
  for (const event of difficulty.noodle.trackEvents) {
    event.songBpmTime = convert(event.jsonTime);
    event.durationSongBpmTime = customEventDuration(difficulty.bpmEvents, event.jsonTime, event.duration, songBpm);
  }
  for (const event of difficulty.noodle.parentEvents) {
    event.songBpmTime = convert(event.jsonTime);
  }
  for (const event of difficulty.noodle.playerEvents) {
    event.songBpmTime = convert(event.jsonTime);
  }
  for (const groups of [
    difficulty.lightColorEventBoxGroups,
    difficulty.lightRotationEventBoxGroups,
    difficulty.lightTranslationEventBoxGroups,
    difficulty.fxEventBoxGroups,
  ]) {
    for (const group of groups) group.songBpmTime = convert(group.jsonTime);
  }
}
