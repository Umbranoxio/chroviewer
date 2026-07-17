import { Result, TaggedError } from 'better-result';
import { z } from 'zod';

const cacheDirectoryName = 'maps-v1';
const cacheMetadataFilename = 'metadata.json';
const cacheArchiveFilename = 'map.zip';

const cacheMetadataSchema = z.object({
  version: z.literal(1),
  key: z.string().min(1),
  hash: z.hash('sha1'),
});

export interface CachedMapArchive {
  key: string;
  hash: string;
  archive: ArrayBuffer;
}

export class MapArchiveCacheError extends TaggedError('MapArchiveCacheError')<{
  message: string;
  cause: unknown;
}>() {}

export interface MapArchiveCache {
  get(hash: string): Promise<Result<CachedMapArchive | null, MapArchiveCacheError>>;
  set(map: CachedMapArchive): Promise<Result<void, MapArchiveCacheError>>;
  usage(): Promise<Result<number, MapArchiveCacheError>>;
  clear(): Promise<Result<void, MapArchiveCacheError>>;
  isPersistent(): Promise<Result<boolean, MapArchiveCacheError>>;
  requestPersistence(): Promise<Result<boolean, MapArchiveCacheError>>;
}

function isMissingEntry(error: MapArchiveCacheError) {
  return error.cause instanceof DOMException && error.cause.name === 'NotFoundError';
}

export class OpfsMapArchiveCache implements MapArchiveCache {
  private persistenceRequested = false;

  constructor(private readonly storage: Pick<StorageManager, 'getDirectory' | 'persist' | 'persisted'>) {}

  async get(hash: string) {
    const result = await Result.tryPromise({
      try: async () => {
        const root = await this.storage.getDirectory();
        const maps = await root.getDirectoryHandle(cacheDirectoryName);
        const directory = await maps.getDirectoryHandle(hash.toLowerCase());
        const metadataHandle = await directory.getFileHandle(cacheMetadataFilename);
        const archiveHandle = await directory.getFileHandle(cacheArchiveFilename);
        const metadataFile = await metadataHandle.getFile();
        const metadataJson = await metadataFile.text();
        const metadata = cacheMetadataSchema.parse(JSON.parse(metadataJson));
        if (metadata.hash.toLowerCase() !== hash.toLowerCase()) throw new Error('cached map hash does not match');
        const archiveFile = await archiveHandle.getFile();
        return {
          key: metadata.key,
          hash: metadata.hash,
          archive: await archiveFile.arrayBuffer(),
        };
      },
      catch: (cause) => new MapArchiveCacheError({ message: `cached map ${hash} could not be read`, cause }),
    });
    return result.isErr() && isMissingEntry(result.error) ? Result.ok(null) : result;
  }

  async set(map: CachedMapArchive) {
    return Result.tryPromise({
      try: async () => {
        const root = await this.storage.getDirectory();
        const maps = await root.getDirectoryHandle(cacheDirectoryName, { create: true });
        const directory = await maps.getDirectoryHandle(map.hash.toLowerCase(), { create: true });
        const archiveHandle = await directory.getFileHandle(cacheArchiveFilename, { create: true });
        const archive = await archiveHandle.createWritable();
        await archive.write(map.archive);
        await archive.close();
        const metadataHandle = await directory.getFileHandle(cacheMetadataFilename, { create: true });
        const metadata = await metadataHandle.createWritable();
        await metadata.write(JSON.stringify({ version: 1, key: map.key, hash: map.hash }));
        await metadata.close();
        if (!this.persistenceRequested) {
          this.persistenceRequested = true;
          await this.storage.persist();
        }
      },
      catch: (cause) => new MapArchiveCacheError({ message: `map ${map.hash} could not be cached`, cause }),
    });
  }

  async usage() {
    const directory = await Result.tryPromise({
      try: async () => {
        const root = await this.storage.getDirectory();
        return root.getDirectoryHandle(cacheDirectoryName);
      },
      catch: (cause) => new MapArchiveCacheError({ message: 'map cache could not be opened', cause }),
    });
    if (directory.isErr()) return isMissingEntry(directory.error) ? Result.ok(0) : Result.err(directory.error);
    return Result.tryPromise({
      try: async () => {
        let bytes = 0;
        for await (const [name, entry] of directory.value) {
          if (entry.kind !== 'directory') continue;
          const map = await directory.value.getDirectoryHandle(name);
          const archiveHandle = await map.getFileHandle(cacheArchiveFilename);
          const archive = await archiveHandle.getFile();
          bytes += archive.size;
        }
        return bytes;
      },
      catch: (cause) => new MapArchiveCacheError({ message: 'map cache size could not be read', cause }),
    });
  }

  async clear() {
    const result = await Result.tryPromise({
      try: async () => {
        const root = await this.storage.getDirectory();
        await root.removeEntry(cacheDirectoryName, { recursive: true });
      },
      catch: (cause) => new MapArchiveCacheError({ message: 'map cache could not be cleared', cause }),
    });
    return result.isErr() && isMissingEntry(result.error) ? Result.ok(undefined) : result;
  }

  async isPersistent() {
    return Result.tryPromise({
      try: () => this.storage.persisted(),
      catch: (cause) => new MapArchiveCacheError({ message: 'persistent storage status could not be read', cause }),
    });
  }

  async requestPersistence() {
    this.persistenceRequested = true;
    return Result.tryPromise({
      try: () => this.storage.persist(),
      catch: (cause) => new MapArchiveCacheError({ message: 'persistent storage could not be requested', cause }),
    });
  }
}

const storage =
  typeof navigator === 'undefined' ||
  !Reflect.has(navigator, 'storage') ||
  typeof navigator.storage.getDirectory !== 'function'
    ? null
    : navigator.storage;

export const browserMapArchiveCache = storage === null ? null : new OpfsMapArchiveCache(storage);
