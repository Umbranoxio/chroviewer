import { z } from 'zod';

import type { BpmEvent } from './types';
import { beatSaberIntegerSchema, beatSaberNumberSchema } from './value-schema';

const audioDataSchema = z.object({
  version: z.string().catch(''),
  songSampleCount: beatSaberIntegerSchema,
  songFrequency: beatSaberIntegerSchema,
  bpmData: z
    .array(
      z.object({
        si: beatSaberIntegerSchema,
        ei: beatSaberIntegerSchema,
        sb: beatSaberNumberSchema,
        eb: beatSaberNumberSchema,
      }),
    )
    .catch([]),
});

export interface BpmRegion {
  startSampleIndex: number;
  endSampleIndex: number;
  startBeat: number;
  endBeat: number;
}

export interface AudioData {
  version: string;
  sampleCount: number;
  frequency: number;
  bpmRegions: BpmRegion[];
}

export function parseAudioData(text: string): AudioData {
  const root = audioDataSchema.parse(JSON.parse(text));
  return {
    version: root.version,
    sampleCount: root.songSampleCount,
    frequency: root.songFrequency,
    bpmRegions: root.bpmData.map((region) => ({
      startSampleIndex: region.si,
      endSampleIndex: region.ei,
      startBeat: region.sb,
      endBeat: region.eb,
    })),
  };
}

export function bpmEventsFromAudioData(audioData: AudioData): BpmEvent[] {
  return audioData.bpmRegions.map((region) => {
    const samples = region.endSampleIndex - region.startSampleIndex;
    const beats = region.endBeat - region.startBeat;
    const rawBpm = (beats / samples) * audioData.frequency * 60;
    const roundedBpm = Math.round(rawBpm);
    const roundedBpmSamples = ((beats * 60) / roundedBpm) * audioData.frequency;
    const useRounded = Math.abs(roundedBpmSamples - samples) < 1.1;
    return { jsonTime: region.startBeat, songBpmTime: 0, bpm: useRounded ? roundedBpm : rawBpm };
  });
}
