import type { Arc, Chain, Difficulty, Note, Obstacle } from '../beatmap/types';
import {
  noodleCoordinates,
  noodleTailCoordinates,
  noodleWorldRotation,
  type NoodleCoordinates,
  type NoodleWorldRotation,
} from '../noodle';
import { parseNoodleObject, type NoodleObjectData } from '../noodle-data';
import { noodleTrackControlsInteractability } from '../noodle-runtime';
import { gridPosition, LANE_SIZE, type GridPosition, type ObstacleBounds } from './grid';

type HeckObject = Note | Obstacle | Arc | Chain;

export interface StaticHeckObject {
  noodle?: NoodleObjectData;
  coordinates?: NoodleCoordinates;
  worldRotation?: NoodleWorldRotation;
}

interface ObjectCoordinates {
  head?: NoodleCoordinates;
  tail?: NoodleCoordinates;
}

export class HeckPlacement {
  readonly majorVersion: number;

  private readonly objects = new WeakMap<HeckObject, StaticHeckObject>();
  private readonly coordinates = new WeakMap<HeckObject, ObjectCoordinates>();
  private readonly noodle: Difficulty['noodle'];
  private readonly leftHanded: boolean;

  constructor(difficulty: Pick<Difficulty, 'version' | 'noodle'>, leftHanded = false) {
    this.majorVersion = Number.parseInt(difficulty.version, 10);
    this.noodle = difficulty.noodle;
    this.leftHanded = leftHanded;
  }

  resolve(object: HeckObject) {
    const cached = this.objects.get(object);
    if (cached !== undefined) return cached;

    let worldRotation = noodleWorldRotation(object.customData);
    if (this.leftHanded && worldRotation !== undefined) {
      worldRotation = [worldRotation[0], -worldRotation[1], -worldRotation[2]];
    }
    const coordinates = this.objectCoordinates(object);
    const data: StaticHeckObject = {
      noodle: parseNoodleObject(object.customData, this.majorVersion, this.noodle.pointDefinitions),
      coordinates: coordinates.head,
      worldRotation,
    };
    this.objects.set(object, data);
    return data;
  }

  position(object: HeckObject) {
    return this.positionWithCoordinates(object.posX, object.posY, this.objectCoordinates(object).head);
  }

  tailPosition(object: Arc | Chain) {
    return this.positionWithCoordinates(object.tailPosX, object.tailPosY, this.objectCoordinates(object).tail);
  }

  obstacleBounds(obstacle: Obstacle, bounds: ObstacleBounds) {
    const { coordinates, noodle } = this.resolve(obstacle);
    const result = { ...bounds };
    if (coordinates !== undefined) {
      result.position = coordinates[0] ?? result.position;
      result.startHeight = coordinates[1] ?? result.startHeight;
    }
    if (noodle?.obstacleSize !== undefined) {
      result.width = noodle.obstacleSize[0] ?? result.width;
      result.height = noodle.obstacleSize[1] ?? result.height;
    }
    return result;
  }

  canBecomeInteractable(object: HeckObject) {
    const { noodle } = this.resolve(object);
    if (noodle?.uninteractable !== true || noodle.animation?.interactable != null) return true;
    return noodleTrackControlsInteractability(noodle, this.noodle);
  }

  private positionWithCoordinates(posX: number, posY: number, coordinates: NoodleCoordinates | undefined) {
    const fallback = gridPosition(posX, posY);
    return {
      x: coordinates?.[0] === undefined ? fallback.x : (coordinates[0] + 0.5) * LANE_SIZE,
      y: coordinates?.[1] === undefined ? fallback.y : coordinates[1] * LANE_SIZE,
    } satisfies GridPosition;
  }

  private objectCoordinates(object: HeckObject) {
    const cached = this.coordinates.get(object);
    if (cached !== undefined) return cached;
    const coordinates: ObjectCoordinates = {
      head: noodleCoordinates(object.customData),
      tail: 'tailPosX' in object ? noodleTailCoordinates(object.customData) : undefined,
    };
    this.coordinates.set(object, coordinates);
    return coordinates;
  }
}
