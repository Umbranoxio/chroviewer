import { Result } from 'better-result';
import { z } from 'zod';

import { env } from '../../env';
import { extractMapArchive } from '../archive';
import { requestArrayBuffer, requestJson } from '../http';
import { SourceError } from '../source-error';
import type { BeatSaverMapSource, DownloadProgressHandler, FetchRequest, SourceResult } from '../source-types';
import type { GetMapByIdData } from './generated/api-contracts';

interface ResolveOptions {
  onProgress?: DownloadProgressHandler;
  request?: FetchRequest;
  signal?: AbortSignal;
}

type BeatSaverVersionContract = Required<Pick<NonNullable<GetMapByIdData['versions']>[number], 'downloadURL' | 'hash'>>;

type BeatSaverMapContract = Required<Pick<GetMapByIdData, 'id'>> & {
  versions: [BeatSaverVersionContract, ...BeatSaverVersionContract[]];
};

const beatSaverVersionSchema = z.object({
  hash: z.hash('sha1'),
  downloadURL: z.url(),
});

const beatSaverMapSchema = z.object({
  id: z.string().min(1),
  versions: z.tuple([beatSaverVersionSchema], beatSaverVersionSchema),
}) satisfies z.ZodType<BeatSaverMapContract>;

export function beatSaverKey(input: string) {
  const value = input.trim();
  if (/^[0-9a-f]+$/i.test(value)) return value.toLowerCase();
  const normalized = /^[a-z]+:\/\//i.test(value) ? value : `https://${value}`;
  if (!URL.canParse(normalized)) return null;
  const url = new URL(normalized);
  if (!/(^|\.)beatsaver\.com$/i.test(url.hostname)) return null;
  return /\/(?:maps|beatmap)\/([0-9a-f]+)/i.exec(url.pathname)?.[1]?.toLowerCase() ?? null;
}

export function fetchBeatSaverMap(input: string, options: ResolveOptions = {}) {
  const key = beatSaverKey(input);
  return key === null
    ? Promise.resolve(
        Result.err(
          new SourceError({
            message: 'enter a BeatSaver key or map URL',
            source: 'beatsaver',
            operation: 'parse-map-reference',
          }),
        ),
      )
    : fetchBeatSaver(`/maps/id/${key}`, `BeatSaver map ${key}`, options);
}

export function fetchBeatSaverHash(hash: string, options: ResolveOptions = {}) {
  return /^[0-9a-f]{40}$/i.test(hash)
    ? fetchBeatSaver(`/maps/hash/${hash}`, `BeatSaver hash ${hash}`, options)
    : Promise.resolve(
        Result.err(
          new SourceError({
            message: 'invalid Beat Saber map hash',
            source: 'beatsaver',
            operation: 'parse-map-hash',
          }),
        ),
      );
}

async function fetchBeatSaver(
  path: string,
  label: string,
  options: ResolveOptions,
): Promise<SourceResult<BeatSaverMapSource>> {
  return Result.gen(async function* () {
    const response = yield* Result.await(
      requestJson(`${env.VITE_BEATSAVER_API_URL}${path}`, beatSaverMapSchema, {
        ...options,
        source: 'beatsaver',
        label,
        operation: 'load-map-metadata',
      }),
    );
    const version = response.versions[0];
    const archive = yield* Result.await(
      requestArrayBuffer(version.downloadURL, {
        ...options,
        source: 'beatsaver',
        label: `BeatSaver download ${response.id}`,
        operation: 'download-map-archive',
      }),
    );
    const files = yield* Result.await(extractMapArchive(new Uint8Array(archive)));
    if (!files.some((file) => file.name.toLowerCase() === 'info.dat')) {
      return Result.err(
        new SourceError({
          message: `BeatSaver map ${response.id} archive has no Info.dat`,
          source: 'beatsaver',
          operation: 'validate-map-archive',
        }),
      );
    }
    return Result.ok({
      key: response.id,
      hash: version.hash,
      files,
    });
  });
}
