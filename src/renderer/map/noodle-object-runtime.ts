import type { PointSampleContext } from '../../core/animation/point-definition';
import type { Rgb } from '../../core/colors';
import type { NoodleObjectData, NoodleBeatmapData } from '../../core/noodle-data';
import { sampleNoodleObject, type NoodleTransform } from '../../core/noodle-runtime';

interface NoodleObjectMotion {
  noodle?: NoodleObjectData;
  enterBeat?: number;
  spawnBeat: number;
  despawnBeat: number;
}

export function sampleNoodleRenderObject(
  object: NoodleObjectMotion,
  data: NoodleBeatmapData,
  now: number,
  duration: number,
  context: PointSampleContext | undefined,
  leftHanded: boolean,
  addedBeat = object.enterBeat,
) {
  return sampleNoodleObject(
    object.noodle,
    data,
    now,
    (now - object.spawnBeat) / duration,
    context,
    leftHanded,
    addedBeat,
  );
}

export function noodleMovementBeat(
  object: NoodleObjectMotion,
  now: number,
  transform: NoodleTransform,
  duration: number,
) {
  return transform.time === undefined || now < object.spawnBeat ? now : object.spawnBeat + transform.time * duration;
}

export function noodleObjectVisible(
  object: NoodleObjectMotion,
  now: number,
  movementBeat: number,
  transform: NoodleTransform,
) {
  return (
    now >= (object.enterBeat ?? object.spawnBeat) &&
    (transform.time === undefined ? now : movementBeat) < object.despawnBeat
  );
}

export function animatedNoodleColor(color: NoodleTransform['color'], fallback: Rgb): Rgb {
  return color === undefined ? fallback : [color[0], color[1], color[2]];
}
