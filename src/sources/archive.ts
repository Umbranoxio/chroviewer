import { Result } from 'better-result';
import { unzip, unzipSync } from 'fflate';

import { SourceError, sourceError } from './source-error';
import type { MapSourceFile, SourceResult } from './source-types';

const decoder = new TextDecoder();

function mapArchiveFiles(entries: Record<string, Uint8Array>) {
  const files = Object.entries(entries).flatMap(([path, bytes]) => {
    const name = path.replaceAll('\\', '/').split('/').at(-1) ?? path;
    if (name === '' || path.includes('__MACOSX/') || name.startsWith('.')) return [];
    return [
      {
        name,
        text: () => Promise.resolve(decoder.decode(bytes)),
        arrayBuffer: () => Promise.resolve(new Uint8Array(bytes).buffer),
      },
    ];
  });
  const names = new Set<string>();
  for (const file of files) {
    const name = file.name.toLowerCase();
    if (names.has(name)) {
      return Result.err(
        new SourceError({
          message: `map archive contains duplicate file ${file.name}`,
          source: 'archive',
          operation: 'validate-map-archive',
        }),
      );
    }
    names.add(name);
  }
  return Result.ok(files);
}

export function extractMapArchive(data: Uint8Array): Promise<SourceResult<MapSourceFile[]>> {
  return new Promise((resolve) => {
    unzip(data, (error, entries) => {
      resolve(
        Result.gen(function* () {
          const extracted = yield* Result.try({
            try: () => (error === null ? entries : unzipSync(data)),
            catch: (cause) =>
              sourceError(cause, {
                message: `invalid map archive: ${cause instanceof Error ? cause.message : 'unknown ZIP error'}`,
                source: 'archive',
                operation: 'extract-map-archive',
              }),
          });
          return mapArchiveFiles(extracted);
        }),
      );
    });
  });
}
