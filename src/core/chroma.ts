import { z } from 'zod';

import type { BeatmapCustomData } from './beatmap/types';
import { beatSaberNumberSchema } from './beatmap/value-schema';

const chromaColorSchema = z.array(beatSaberNumberSchema).min(3);

export type ChromaColor = readonly [number, number, number, number];

export function chromaColor(customData: BeatmapCustomData | undefined): ChromaColor | undefined {
  const parsed = chromaColorSchema.safeParse(customData?._color ?? customData?.color);
  if (!parsed.success) return undefined;
  const values = parsed.data;
  const red = values[0];
  const green = values[1];
  const blue = values[2];
  if (red === undefined || green === undefined || blue === undefined) return undefined;
  return [red, green, blue, values[3] ?? 1];
}
