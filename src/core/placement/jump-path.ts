import { Z_OFFSET } from './grid';

const leadInSeconds = 0.5;
const leadInDistance = 100;
const wallTailGraceSeconds = 0.15;
const jumpRetreatDistance = 500;

export interface ObjectMotion {
  beat: number;
  enterBeat: number;
  spawnBeat: number;
  despawnBeat: number;
  hjdBeats: number;
  unitsPerBeat: number;
}

export function preJumpTravelBeats(songBpm: number) {
  return (songBpm / 60) * leadInSeconds;
}

export function wallTailGraceBeats(songBpm: number) {
  return (songBpm / 60) * wallTailGraceSeconds;
}

const clamp01 = (value: number) => Math.min(Math.max(value, 0), 1);

function jumpLineDistance(motion: ObjectMotion, nowBeat: number) {
  return Z_OFFSET + (motion.beat - nowBeat) * motion.unitsPerBeat;
}

export function aheadDistance(motion: ObjectMotion, nowBeat: number): number {
  if (nowBeat >= motion.spawnBeat) return jumpLineDistance(motion, nowBeat);

  const travel = clamp01((nowBeat - motion.enterBeat) / (motion.spawnBeat - motion.enterBeat));
  return jumpLineDistance(motion, motion.spawnBeat) + leadInDistance * (1 - travel);
}

export function noteJumpAheadDistance(motion: ObjectMotion, nowBeat: number): number {
  const regularDistance = aheadDistance(motion, nowBeat);
  const jumpDuration = motion.hjdBeats * 2;
  const retreatDuration = jumpDuration * 0.25;
  const retreatBeat = motion.spawnBeat + jumpDuration - retreatDuration;
  if (nowBeat <= retreatBeat || retreatDuration <= 0) return regularDistance;
  const retreat = clamp01((nowBeat - retreatBeat) / retreatDuration);
  return regularDistance - jumpRetreatDistance * retreat ** 3;
}

export function wallAheadDistance(motion: ObjectMotion, pullBeat: number, nowBeat: number): number {
  const regularDistance = aheadDistance(motion, nowBeat);
  const retreatDuration = motion.despawnBeat - pullBeat;
  if (nowBeat <= pullBeat || retreatDuration <= 0) return regularDistance;
  const retreat = clamp01((nowBeat - pullBeat) / retreatDuration);
  return regularDistance - jumpRetreatDistance * retreat ** 3;
}

export function isVisible(motion: ObjectMotion, nowBeat: number): boolean {
  return nowBeat >= motion.enterBeat && nowBeat <= motion.despawnBeat;
}

export function isVisibleBeforeHit(motion: ObjectMotion, nowBeat: number): boolean {
  return isVisible(motion, nowBeat) && nowBeat < motion.beat;
}

function spawnLinearProgress(motion: ObjectMotion, nowBeat: number) {
  return clamp01((nowBeat - motion.spawnBeat) / (motion.beat - motion.spawnBeat));
}

export function spawnProgress(motion: ObjectMotion, nowBeat: number): number {
  const progress = spawnLinearProgress(motion, nowBeat);
  return progress * (2 - progress);
}

export function spawnFlipProgress(motion: ObjectMotion, nowBeat: number) {
  const progress = clamp01(spawnLinearProgress(motion, nowBeat) * 2);
  return progress < 0.5 ? 2 * progress * progress : 1 - (-2 * progress + 2) ** 2 / 2;
}

export function spawnFlipYOffset(motion: ObjectMotion, nowBeat: number, flipYSide: number) {
  const progress = spawnLinearProgress(motion, nowBeat);
  if (flipYSide === 0 || progress >= 0.5) return 0;
  const avoidance = flipYSide > 0 ? flipYSide * 0.45 : flipYSide * 0.15;
  return (0.5 - Math.cos(progress * Math.PI * 4) * 0.5) * avoidance;
}

export function spawnRotationProgress(motion: ObjectMotion, nowBeat: number): number {
  const turn = clamp01(spawnLinearProgress(motion, nowBeat) * 4);
  return Math.sin(turn * Math.PI * 0.5);
}

// the game's ObstacleScaleUp sizes its window from the global movement provider,
// so per-object noodle njs/offset must not stretch the grow duration
export function wallSpawnScale(motion: ObjectMotion, nowBeat: number, globalHjdBeats = motion.hjdBeats): number {
  const growBeats = globalHjdBeats * 0.25;
  const progress = clamp01((nowBeat - motion.spawnBeat) / growBeats);
  return progress * (2 - progress);
}

export function maxConcurrent(windows: { enterBeat: number; despawnBeat: number }[]): number {
  const edges: { beat: number; delta: number }[] = [];
  for (const window of windows) {
    edges.push({ beat: window.enterBeat, delta: 1 });
    edges.push({ beat: window.despawnBeat, delta: -1 });
  }
  edges.sort((a, b) => a.beat - b.beat || a.delta - b.delta);
  let current = 0;
  let max = 0;
  for (const edge of edges) {
    current += edge.delta;
    if (current > max) max = current;
  }
  return max;
}
