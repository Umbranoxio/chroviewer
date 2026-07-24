import type { BeatmapCustomData, Difficulty, Note, Obstacle } from '../beatmap/types';
import { parseNoodleObject } from '../noodle-data';
import { createSpawnProvider } from './variable-njs';

interface LegacyTimingOptions {
  noteJumpSpeed: number;
  noteStartBeatOffset: number;
  songBpm: number;
  oldMap: boolean;
}

export interface LegacyNoodleTimingObjects {
  notes: Set<Note>;
  obstacles: Set<Obstacle>;
}

function usesHistoricalFloor(
  difficulty: Difficulty,
  customData: BeatmapCustomData | undefined,
  options: LegacyTimingOptions,
) {
  const noodle = parseNoodleObject(customData, 2, difficulty.noodle.pointDefinitions);
  if (noodle?.uninteractable !== true || (noodle.noteJumpSpeed === undefined && noodle.noteSpawnOffset === undefined)) {
    return false;
  }
  const speed = noodle.noteJumpSpeed ?? options.noteJumpSpeed;
  if (speed <= 0) return false;
  const offset = noodle.noteSpawnOffset ?? options.noteStartBeatOffset;
  const events = noodle.noteJumpSpeed === undefined ? difficulty.njsEvents : [];
  const modern = createSpawnProvider(events, speed, offset, options.songBpm);
  const legacy = createSpawnProvider(events, speed, offset, options.songBpm, undefined, 1);
  return modern.baseHalfJumpDurationInBeats !== legacy.baseHalfJumpDurationInBeats;
}

export function legacyNoodleTimingObjects(
  difficulty: Difficulty,
  options: LegacyTimingOptions,
): LegacyNoodleTimingObjects {
  const result = { notes: new Set<Note>(), obstacles: new Set<Obstacle>() };
  if (!options.oldMap || difficulty.noodle.version !== 2) return result;

  for (const note of difficulty.notes) {
    if (note.customFake && usesHistoricalFloor(difficulty, note.customData, options)) result.notes.add(note);
  }
  for (const obstacle of difficulty.obstacles) {
    if (obstacle.customFake && usesHistoricalFloor(difficulty, obstacle.customData, options)) {
      result.obstacles.add(obstacle);
    }
  }
  return result;
}
