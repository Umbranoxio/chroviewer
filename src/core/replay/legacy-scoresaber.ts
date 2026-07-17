import { songBpmTimeToSeconds } from '../beatmap/bpm';
import { NoteType, type Difficulty, type Note } from '../beatmap/types';
import { gridPosition } from '../placement/grid';
import type { LegacyScoreSaberFrame, Replay, ReplayNoteEvent, ReplayPose, ReplayVector3 } from './types';

interface ComboChange {
  frameIndex: number;
  time: number;
  miss: boolean;
  hitCount: number;
}

interface NoteAction {
  time: number;
  hit: boolean;
  baseScore: number;
}

const multipliers = [1, 2, 4, 8];
const hitsForMultiplier = [2, 4, 8, 255];
const cutDirectionAngles = [180, 0, -90, 90, -135, 135, -45, 45];

function clamp(value: number, minimum: number, maximum: number) {
  return Math.max(minimum, Math.min(maximum, value));
}

function advanceCombo(state: { multiplier: number; progress: number }) {
  if (state.multiplier >= multipliers.length - 1) return;
  state.progress++;
  if (state.progress < (hitsForMultiplier[state.multiplier] ?? 255)) return;
  state.multiplier++;
  state.progress = 0;
}

function comboChanges(frames: LegacyScoreSaberFrame[]) {
  const changes: ComboChange[] = [];
  for (let index = 1; index < frames.length; index++) {
    const previous = frames[index - 1];
    const current = frames[index];
    if (previous === undefined || current === undefined || current.combo === previous.combo) continue;
    changes.push({
      frameIndex: index,
      time: current.time,
      miss: current.combo < previous.combo,
      hitCount: current.combo > previous.combo ? current.combo - previous.combo : current.combo,
    });
  }
  return changes;
}

function noteActions(frames: LegacyScoreSaberFrame[], changes: ComboChange[]) {
  const actions: NoteAction[] = [];
  const combo = { multiplier: 0, progress: 0 };

  for (let index = 0; index < changes.length; ) {
    const change = changes[index];
    if (change === undefined) break;
    if (change.miss) {
      if (combo.multiplier > 0) combo.multiplier--;
      combo.progress = 0;
      actions.push({ time: change.time, hit: false, baseScore: 0 });
      index++;
      continue;
    }
    if (change.hitCount === 0) {
      index++;
      continue;
    }

    let chainEnd = index + 1;
    while (chainEnd < changes.length) {
      const current = changes[chainEnd];
      const previous = changes[chainEnd - 1];
      if (
        current === undefined ||
        previous === undefined ||
        current.miss ||
        current.hitCount <= 0 ||
        current.time - previous.time >= 0.04
      )
        break;
      chainEnd++;
    }

    let totalHits = 0;
    for (let chainIndex = index; chainIndex < chainEnd; chainIndex++) {
      totalHits += changes[chainIndex]?.hitCount ?? 0;
    }

    if (totalHits === 1) {
      const scoreBefore = frames[change.frameIndex - 1]?.score ?? 0;
      const scoreEnd =
        chainEnd < changes.length
          ? (frames[(changes[chainEnd]?.frameIndex ?? 1) - 1]?.score ?? scoreBefore)
          : (frames.at(-1)?.score ?? scoreBefore);
      advanceCombo(combo);
      const multiplier = multipliers[combo.multiplier] ?? 1;
      actions.push({
        time: change.time,
        hit: true,
        baseScore: clamp(Math.trunc((scoreEnd - scoreBefore) / multiplier), 0, 115),
      });
      index = chainEnd;
      continue;
    }

    const scoreBefore = frames[(changes[index]?.frameIndex ?? 1) - 1]?.score ?? 0;
    const settledIndex =
      chainEnd < changes.length ? (changes[chainEnd]?.frameIndex ?? frames.length) - 1 : frames.length - 1;
    const totalScore = (frames[settledIndex]?.score ?? scoreBefore) - scoreBefore;
    const temporaryCombo = { ...combo };
    let multiplierSum = 0;
    for (let chainIndex = index; chainIndex < chainEnd; chainIndex++) {
      const hits = changes[chainIndex]?.hitCount ?? 0;
      for (let hit = 0; hit < hits; hit++) {
        advanceCombo(temporaryCombo);
        multiplierSum += multipliers[temporaryCombo.multiplier] ?? 1;
      }
    }
    const averageBase = clamp(Math.round(totalScore / Math.max(1, multiplierSum)), 0, 115);
    const deltas: number[] = [];
    let deltaSum = 0;
    for (let chainIndex = index; chainIndex < chainEnd; chainIndex++) {
      const item = changes[chainIndex];
      if (item === undefined) continue;
      const delta = (frames[item.frameIndex]?.score ?? 0) - (frames[item.frameIndex - 1]?.score ?? 0);
      const perNote = Math.max(1, delta) / item.hitCount;
      deltas.push(perNote);
      deltaSum += perNote * item.hitCount;
    }
    const averageDelta = deltaSum / totalHits;

    for (let chainIndex = index; chainIndex < chainEnd; chainIndex++) {
      const item = changes[chainIndex];
      if (item === undefined) continue;
      const ratio = (deltas[chainIndex - index] ?? 1) / Math.max(1, averageDelta);
      const deviation = clamp(Math.round((ratio - 1) * 15), -5, 5);
      for (let hit = 0; hit < item.hitCount; hit++) {
        advanceCombo(combo);
        const offset = item.hitCount > 1 ? (hit % 2 === 0 ? -1 : 1) : 0;
        actions.push({
          time: item.time,
          hit: true,
          baseScore: clamp(averageBase + deviation + offset, 0, 115),
        });
      }
    }
    index = chainEnd;
  }
  return actions;
}

function closestNote(notes: Note[], times: number[], matched: boolean[], action: NoteAction) {
  let bestIndex = -1;
  let bestDistance = Number.POSITIVE_INFINITY;
  if (!action.hit) {
    for (let index = 0; index < notes.length; index++) {
      if (matched[index] === true || (notes[index]?.cutDirection ?? 8) >= 8) continue;
      const distance = Math.abs((times[index] ?? 0) - action.time);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestIndex = index;
      } else if (distance > bestDistance) break;
    }
    if (bestIndex >= 0 && bestDistance < 1) return bestIndex;
  }
  bestIndex = -1;
  bestDistance = Number.POSITIVE_INFINITY;
  for (let index = 0; index < notes.length; index++) {
    if (matched[index] === true) continue;
    const distance = Math.abs((times[index] ?? 0) - action.time);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = index;
    } else if (distance > bestDistance) break;
  }
  return bestIndex;
}

function closestFrame(frames: ReplayPose[], time: number) {
  let low = 0;
  let high = frames.length - 1;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if ((frames[middle]?.time ?? 0) < time) low = middle + 1;
    else high = middle;
  }
  if (low > 0 && Math.abs((frames[low - 1]?.time ?? 0) - time) < Math.abs((frames[low]?.time ?? 0) - time)) {
    low--;
  }
  return low;
}

function length(vector: ReplayVector3) {
  return Math.hypot(vector.x, vector.y, vector.z);
}

function badCut(frames: ReplayPose[], note: Note, time: number) {
  if (note.cutDirection < 0 || note.cutDirection > 7 || frames.length < 2) return false;
  const frameIndex = closestFrame(frames, time);
  let bestSpeed = 0;
  let bestDirection = { x: 0, y: 0, z: 0 };
  const start = Math.max(1, frameIndex - 10);
  const end = Math.min(frames.length - 1, frameIndex + 10);
  for (let index = start; index <= end; index++) {
    const current = frames[index];
    const previous = frames[index - 1];
    if (current === undefined || previous === undefined || Math.abs(current.time - time) > 0.25) continue;
    const deltaTime = current.time - previous.time;
    if (deltaTime <= 0) continue;
    const currentPosition = note.type === NoteType.Red ? current.rightHand.position : current.leftHand.position;
    const previousPosition = note.type === NoteType.Red ? previous.rightHand.position : previous.leftHand.position;
    const velocity = {
      x: (currentPosition.x - previousPosition.x) / deltaTime,
      y: (currentPosition.y - previousPosition.y) / deltaTime,
      z: (currentPosition.z - previousPosition.z) / deltaTime,
    };
    const speed = length(velocity);
    if (speed > bestSpeed) {
      bestSpeed = speed;
      bestDirection = velocity;
    }
  }
  if (bestSpeed < 1) return false;
  const swingAngle = Math.atan2(bestDirection.x, -bestDirection.y) * (180 / Math.PI);
  const targetAngle = cutDirectionAngles[note.cutDirection] ?? 0;
  const difference = ((((swingAngle - targetAngle) % 360) + 540) % 360) - 180;
  return Math.abs(difference) > 45;
}

function approximateCutPoint(note: Note, playerHeight: number): ReplayVector3 {
  const grid = gridPosition(note.posX, note.posY);
  const heightOffset = clamp((playerHeight - 1.8) * 0.5, -0.2, 0.6);
  const y = note.posY === 0 ? 0.85 : note.posY === 1 ? 1.4 : note.posY === 2 ? 1.9 : grid.y + 0.85;
  return { x: grid.x, y: y + heightOffset, z: 0 };
}

function noteEvent(
  note: Note,
  time: number,
  eventType: 1 | 2 | 3,
  playerHeight: number,
  baseScore = 0,
): ReplayNoteEvent {
  const swingScore = Math.max(0, baseScore - 15);
  const beforeCutRating = eventType === 1 ? Math.min(1, swingScore / 70) : 0;
  const afterCutRating = eventType === 1 && swingScore >= 70 ? clamp((swingScore - 70) / 30, 0, 1) : 0;
  return {
    noteId: {
      time,
      lineLayer: note.posY,
      lineIndex: note.posX,
      colorType: note.type,
      cutDirection: note.cutDirection,
    },
    eventType,
    cutPoint: approximateCutPoint(note, playerHeight),
    cutNormal: { x: 0, y: 0, z: 1 },
    saberDirection: { x: 0, y: 0, z: 1 },
    saberType: note.type,
    directionOk: eventType !== 2,
    saberSpeed: eventType === 3 ? 0 : 5,
    cutAngle: 0,
    cutDistanceToCenter: 0,
    cutDirectionDeviation: 0,
    beforeCutRating,
    afterCutRating,
    time,
    unityTimescale: 1,
    timeSyncTimescale: 1,
  };
}

export function convertLegacyScoreSaberReplay(replay: Replay, difficulty: Difficulty, songBpm: number) {
  const legacy = replay.legacyScoreSaber;
  if (legacy === undefined || legacy.converted) return;
  const notes = difficulty.notes.filter(
    (note) => !note.customFake && (note.type === NoteType.Red || note.type === NoteType.Blue),
  );
  const times = notes.map((note) => songBpmTimeToSeconds(note.songBpmTime, songBpm));
  const matched = notes.map(() => false);
  const events: ReplayNoteEvent[] = [];

  for (const action of noteActions(legacy.frames, comboChanges(legacy.frames))) {
    const index = closestNote(notes, times, matched, action);
    const note = notes[index];
    const time = times[index];
    if (index < 0 || note === undefined || time === undefined) continue;
    matched[index] = true;
    const eventType = action.hit ? 1 : badCut(replay.poses, note, time) ? 2 : 3;
    events.push(noteEvent(note, time, eventType, replay.metadata.initialHeight, action.baseScore));
  }
  for (let index = 0; index < notes.length; index++) {
    const note = notes[index];
    const time = times[index];
    if (matched[index] !== true && note !== undefined && time !== undefined)
      events.push(noteEvent(note, time, 3, replay.metadata.initialHeight));
  }
  events.sort((left, right) => left.time - right.time);
  replay.notes = events;
  legacy.converted = true;
}
