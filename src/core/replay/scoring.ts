import type { Replay, ReplayNoteEvent } from './types';

interface ScoreDefinition {
  center: number;
  beforeMin: number;
  beforeMax: number;
  afterMin: number;
  afterMax: number;
  fixed: number;
}

export interface CutScore {
  before: number;
  after: number;
  accuracy: number;
  total: number;
  maximum: number;
}

export interface ReplayScoreState {
  score: number;
  maximumScore: number;
  accuracy: number;
  combo: number;
  maxCombo: number;
  multiplier: number;
  multiplierProgress: number;
  energy: number;
  misses: number;
  badCuts: number;
  bombCuts: number;
  wallsHit: number;
}

export interface ReplayTimelineEvent {
  id: number;
  time: number;
  kind: 'note' | 'wall';
  note?: ReplayNoteEvent;
  cutScore?: CutScore;
}

export interface ReplayScoreTimeline {
  replay: Replay;
  events: ReplayTimelineEvent[];
  final: ReplayScoreState;
  stateIndex: ReplayStateIndex;
}

type OrderedReplayTimelineEvent = ReplayTimelineEvent & { index: number };

interface ReplayStateIndex {
  badCuts: Uint32Array;
  bombCuts: Uint32Array;
  maxCombos: Float64Array;
  misses: Uint32Array;
  scoringNotes: Uint32Array;
}

const definitions: Record<number, ScoreDefinition> = {
  3: { center: 15, beforeMin: 0, beforeMax: 70, afterMin: 0, afterMax: 30, fixed: 0 },
  4: { center: 15, beforeMin: 0, beforeMax: 70, afterMin: 30, afterMax: 30, fixed: 0 },
  5: { center: 15, beforeMin: 70, beforeMax: 70, afterMin: 0, afterMax: 30, fixed: 0 },
  6: { center: 15, beforeMin: 0, beforeMax: 70, afterMin: 0, afterMax: 0, fixed: 0 },
  7: { center: 0, beforeMin: 0, beforeMax: 0, afterMin: 0, afterMax: 0, fixed: 20 },
  8: { center: 15, beforeMin: 70, beforeMax: 70, afterMin: 30, afterMax: 30, fixed: 0 },
  9: { center: 15, beforeMin: 70, beforeMax: 70, afterMin: 30, afterMax: 30, fixed: 0 },
  10: { center: 0, beforeMin: 0, beforeMax: 0, afterMin: 0, afterMax: 0, fixed: 20 },
  11: { center: 15, beforeMin: 0, beforeMax: 70, afterMin: 30, afterMax: 30, fixed: 0 },
  12: { center: 15, beforeMin: 70, beforeMax: 70, afterMin: 30, afterMax: 30, fixed: 0 },
};

function clamp(value: number, minimum: number, maximum: number) {
  return Math.max(minimum, Math.min(maximum, value));
}

function roundToEven(value: number) {
  const lower = Math.floor(value);
  const fraction = value - lower;
  if (fraction < 0.5) return lower;
  if (fraction > 0.5) return lower + 1;
  return lower % 2 === 0 ? lower : lower + 1;
}

function cutScore(note: ReplayNoteEvent): CutScore | undefined {
  if (note.eventType !== 1) return undefined;
  const definition = definitions[(note.noteId.scoringType ?? 1) + 2];
  if (definition === undefined) return undefined;
  const before = clamp(
    roundToEven(definition.beforeMax * note.beforeCutRating),
    definition.beforeMin,
    definition.beforeMax,
  );
  const after = clamp(roundToEven(definition.afterMax * note.afterCutRating), definition.afterMin, definition.afterMax);
  const accuracy = roundToEven(definition.center * (1 - clamp(note.cutDistanceToCenter / 0.3, 0, 1)));
  return {
    before,
    after,
    accuracy,
    total: before + after + accuracy + definition.fixed,
    maximum: definition.beforeMax + definition.afterMax + definition.center + definition.fixed,
  };
}

function upperBound<T>(values: T[], time: number, selectTime: (value: T) => number) {
  let low = 0;
  let high = values.length;
  while (low < high) {
    const middle = low + Math.floor((high - low) / 2);
    const value = values[middle];
    if (value !== undefined && selectTime(value) <= time) low = middle + 1;
    else high = middle;
  }
  return low;
}

function oldMaximumScore(noteCount: number) {
  let score = 0;
  let multiplier = 1;
  while (multiplier < 8) {
    if (noteCount < multiplier * 2) {
      score += multiplier * noteCount;
      noteCount = 0;
      break;
    }
    score += multiplier * multiplier * 2 + multiplier;
    noteCount -= multiplier * 2;
    multiplier *= 2;
  }
  return (score + noteCount * multiplier) * 115;
}

function buildReplayStateIndex(replay: Replay): ReplayStateIndex {
  const scoringNotes = new Uint32Array(replay.notes.length + 1);
  const misses = new Uint32Array(replay.notes.length + 1);
  const badCuts = new Uint32Array(replay.notes.length + 1);
  const bombCuts = new Uint32Array(replay.notes.length + 1);
  for (let index = 0; index < replay.notes.length; index++) {
    const eventType = replay.notes[index]?.eventType;
    const next = index + 1;
    scoringNotes[next] =
      (scoringNotes[index] ?? 0) + (eventType !== undefined && eventType >= 1 && eventType <= 3 ? 1 : 0);
    misses[next] = (misses[index] ?? 0) + (eventType === 3 ? 1 : 0);
    badCuts[next] = (badCuts[index] ?? 0) + (eventType === 2 ? 1 : 0);
    bombCuts[next] = (bombCuts[index] ?? 0) + (eventType === 4 ? 1 : 0);
  }

  const maxCombos = new Float64Array(replay.combos.length + 1);
  for (let index = 0; index < replay.combos.length; index++) {
    maxCombos[index + 1] = Math.max(maxCombos[index] ?? 0, replay.combos[index]?.combo ?? 0);
  }
  return { badCuts, bombCuts, maxCombos, misses, scoringNotes };
}

function replayStateAt(replay: Replay, stateIndex: ReplayStateIndex, time: number): ReplayScoreState {
  const scoreCount = upperBound(replay.scores, time, (event) => event.time);
  const comboCount = upperBound(replay.combos, time, (event) => event.time);
  const multiplierCount = upperBound(replay.multipliers, time, (event) => event.time);
  const energyCount = upperBound(replay.energies, time, (event) => event.time);
  const noteCount = upperBound(replay.notes, time, (event) => event.time);
  const wallCount = upperBound(replay.walls, time, (event) => event.time);
  const scoreEvent = replay.scores[scoreCount - 1];
  const score = scoreEvent?.score ?? 0;
  const scoringNoteCount = stateIndex.scoringNotes[noteCount] ?? 0;
  const maximumScore = scoreEvent?.immediateMaxPossibleScore ?? oldMaximumScore(scoringNoteCount);
  const combo = replay.combos[comboCount - 1]?.combo ?? 0;
  const multiplierEvent = replay.multipliers[multiplierCount - 1];
  return {
    score,
    maximumScore,
    accuracy: maximumScore === 0 ? 1 : score / maximumScore,
    combo,
    maxCombo: stateIndex.maxCombos[comboCount] ?? 0,
    multiplier: multiplierEvent?.multiplier ?? 1,
    multiplierProgress: multiplierEvent?.nextMultiplierProgress ?? 0,
    energy: clamp(replay.energies[energyCount - 1]?.energy ?? 0.5, 0, 1),
    misses: stateIndex.misses[noteCount] ?? 0,
    badCuts: stateIndex.badCuts[noteCount] ?? 0,
    bombCuts: stateIndex.bombCuts[noteCount] ?? 0,
    wallsHit: wallCount,
  };
}

export function buildReplayScoreTimeline(replay: Replay): ReplayScoreTimeline {
  const events: OrderedReplayTimelineEvent[] = [
    ...replay.notes.map<OrderedReplayTimelineEvent>((note, index) => ({
      id: -1,
      kind: 'note',
      time: note.time,
      note,
      cutScore: cutScore(note),
      index,
    })),
    ...replay.walls.map<OrderedReplayTimelineEvent>((wall, index) => ({
      id: -1,
      kind: 'wall',
      time: wall.time,
      index,
    })),
  ].sort(
    (left, right) =>
      left.time - right.time || (left.kind === right.kind ? left.index - right.index : left.kind === 'note' ? -1 : 1),
  );
  events.forEach((event, id) => {
    event.id = id;
  });
  const lastTime = Math.max(
    replay.poses.at(-1)?.time ?? 0,
    replay.scores.at(-1)?.time ?? 0,
    replay.notes.at(-1)?.time ?? 0,
  );
  const stateIndex = buildReplayStateIndex(replay);
  return {
    replay,
    events,
    final: replayStateAt(replay, stateIndex, lastTime),
    stateIndex,
  };
}

export function replayScoreAt(timeline: ReplayScoreTimeline, time: number) {
  return replayStateAt(timeline.replay, timeline.stateIndex, time);
}

export function replayEventIndexAfter(timeline: ReplayScoreTimeline, time: number) {
  return upperBound(timeline.events, time, (event) => event.time);
}

export function firstComboBreakTime(replay: Replay) {
  let time: number | null = null;
  for (const note of replay.notes) {
    if (note.eventType !== 2 && note.eventType !== 3 && note.eventType !== 4) continue;
    if (time === null || note.time < time) time = note.time;
  }
  for (const wall of replay.walls) {
    if (time === null || wall.time < time) time = wall.time;
  }
  return time;
}
