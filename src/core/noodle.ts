import { z } from 'zod';

import type { BeatmapCustomData } from './beatmap/types';
import { beatSaberNumberSchema } from './beatmap/value-schema';

const rotationSchema = z.array(beatSaberNumberSchema).min(3);

export type NoodleCoordinates = readonly [number | undefined, number | undefined];
export type NoodleWorldRotation = readonly [number, number, number];

function coordinates(value: unknown): NoodleCoordinates | undefined {
  if (!Array.isArray(value)) return undefined;
  const x = value[0] === null || value[0] === undefined ? undefined : beatSaberNumberSchema.parse(value[0]);
  const y = value[1] === null || value[1] === undefined ? undefined : beatSaberNumberSchema.parse(value[1]);
  return x === undefined && y === undefined ? undefined : [x, y];
}

export function noodleCoordinates(customData: BeatmapCustomData | undefined) {
  return coordinates(customData?._position ?? customData?.coordinates);
}

export function noodleTailCoordinates(customData: BeatmapCustomData | undefined) {
  return coordinates(customData?.tailCoordinates);
}

export function noodleWorldRotation(customData: BeatmapCustomData | undefined): NoodleWorldRotation | undefined {
  const value = customData?._rotation ?? customData?.worldRotation;
  if (value === undefined || value === null) return undefined;
  if (!Array.isArray(value)) return [0, beatSaberNumberSchema.parse(value), 0];
  const parsed = rotationSchema.safeParse(value);
  if (!parsed.success) return undefined;
  const [x, y, z] = parsed.data;
  return x === undefined || y === undefined || z === undefined ? undefined : [x, y, z];
}
