import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';

import { fetchMapPreviewData } from './map-preview-data.server';

export const getMapPreviewMetadata = createServerFn({ method: 'GET' })
  .validator(z.object({ mapKey: z.string().regex(/^[0-9a-f]{1,16}$/i) }))
  .handler(async ({ data: { mapKey } }) => {
    const result = await fetchMapPreviewData(mapKey);
    if (result.isErr()) {
      return {
        title: 'BeatSaver Map',
        description: 'Preview this Beat Saber map in ChroViewer',
      };
    }

    const { metadata, stats } = result.value;
    const songTitle = metadata.songSubName === '' ? metadata.songName : `${metadata.songName} ${metadata.songSubName}`;
    const duration = `${String(Math.floor(metadata.duration / 60))}:${String(metadata.duration % 60).padStart(2, '0')}`;
    return {
      title: `${songTitle} - ${metadata.songAuthorName}`,
      description: `Mapped by ${metadata.levelAuthorName} | ${duration} | ${String(metadata.bpm)} BPM | ${(stats.score * 100).toFixed(1)}% rating`,
    };
  });
