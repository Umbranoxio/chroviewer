import type { Obstacle } from '../beatmap/types';

export const LANE_SIZE = 0.6;
export const Y_OFFSET = 0.25;
const PLAYER_Y_OFFSET = 0.6;
const OBSTACLE_Y_OFFSET = -0.15;
export const Z_OFFSET = 0.65;

export const NOTE_Y_OFFSET = Y_OFFSET + PLAYER_Y_OFFSET;
export const WALL_Y_OFFSET = Y_OFFSET + OBSTACLE_Y_OFFSET;

export interface GridPosition {
  x: number;
  y: number;
}

export function objectPosition(posX: number, posY: number, coordinates?: readonly [number, number]): GridPosition {
  if (coordinates !== undefined) {
    return { x: (coordinates[0] + 0.5) * LANE_SIZE, y: coordinates[1] * LANE_SIZE };
  }
  return gridPosition(posX, posY);
}

export function gridPosition(posX: number, posY: number): GridPosition {
  let position = posX - 1.5;
  let layer = posY;

  if (posX >= 1000) position = posX / 1000 - 2.5;
  else if (posX <= -1000) position = posX / 1000 - 0.5;

  if (posY >= 1000 || posY <= -1000) layer = posY / 1000 - 1;

  return { x: position * LANE_SIZE, y: layer * LANE_SIZE };
}

export function cutDirectionEuler(cutDirection: number): number {
  switch (cutDirection) {
    case 0:
      return 180;
    case 1:
      return 0;
    case 2:
      return -90;
    case 3:
      return 90;
    case 4:
      return -135;
    case 5:
      return 135;
    case 6:
      return -45;
    case 7:
      return 45;
    default:
      return 0;
  }
}

export function directionalize(cutDirection: number, angleOffset: number): number {
  let euler = cutDirectionEuler(cutDirection);
  if (angleOffset !== 0) euler += angleOffset;
  else if (cutDirection >= 1000) euler += 360 - (cutDirection - 1000);
  return euler;
}

export interface ObstacleBounds {
  width: number;
  height: number;
  position: number;
  startHeight: number;
}

const meUnitsToFullHeightWall = 1000 / 3.5;
const meStartHeightMultiplier = 1.35;

export function obstacleBounds(
  obstacle: Obstacle,
  majorVersion: number,
  coordinates?: readonly [number, number],
): ObstacleBounds {
  let position = obstacle.posX - 2;
  const vanillaYLimit = majorVersion === 4 ? 4 : 2;
  const clampedY = Math.min(Math.max(obstacle.posY, 0), vanillaYLimit);
  let startHeight = clampedY;
  let height = Math.min(obstacle.height, 5 - clampedY);
  let width = obstacle.width;

  if (obstacle.width >= 1000) width = (obstacle.width - 1000) / 1000;
  if (obstacle.posX >= 1000) position = (obstacle.posX - 1000) / 1000 - 2;
  else if (obstacle.posX <= -1000) position = (obstacle.posX - 1000) / 1000;

  if (obstacle.type > 1 && obstacle.type < 1000) {
    startHeight = obstacle.type / (750 / 3.5);
    height = 3.5;
  } else if (obstacle.type >= 1000 && obstacle.type <= 4000) {
    startHeight = 0;
    height = (obstacle.type - 1000) / meUnitsToFullHeightWall;
  } else if (obstacle.type > 4000) {
    const modifiedType = obstacle.type - 4001;
    startHeight = ((modifiedType % 1000) / meUnitsToFullHeightWall) * meStartHeightMultiplier;
    height = modifiedType / 1000 / meUnitsToFullHeightWall;
  }

  if (coordinates !== undefined) {
    position = coordinates[0];
    startHeight = coordinates[1];
  }

  return { width, height, position, startHeight };
}

export interface ObstaclePlacement {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function obstaclePlacement(bounds: ObstacleBounds): ObstaclePlacement {
  return {
    x: (bounds.position + bounds.width / 2) * LANE_SIZE,
    y: (bounds.startHeight + Math.min(bounds.height, 0)) * LANE_SIZE + WALL_Y_OFFSET,
    width: Math.abs(bounds.width) * LANE_SIZE,
    height: Math.abs(bounds.height) * LANE_SIZE,
  };
}
