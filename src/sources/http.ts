import { Result } from 'better-result';
import type { ZodType } from 'zod';

import { SourceError, sourceError } from './source-error';
import type { DownloadProgressHandler, FetchRequest, SourceResult } from './source-types';

interface SourceRequestOptions {
  source: 'beatsaver' | 'scoresaber';
  label: string;
  operation: string;
  onProgress?: DownloadProgressHandler;
  request?: FetchRequest;
  signal?: AbortSignal;
}

async function responseArrayBuffer(response: Response, onProgress?: DownloadProgressHandler) {
  if (onProgress === undefined || response.body === null) {
    const data = await response.arrayBuffer();
    onProgress?.(1);
    return data;
  }
  const contentLength = Number(response.headers.get('content-length'));
  const total = Number.isFinite(contentLength) && contentLength > 0 ? contentLength : null;
  onProgress(total === null ? null : 0);
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let loaded = 0;
  let chunk = await reader.read();
  while (!chunk.done) {
    chunks.push(chunk.value);
    loaded += chunk.value.byteLength;
    onProgress(total === null ? null : Math.min(loaded / total, 1));
    chunk = await reader.read();
  }
  const bytes = new Uint8Array(loaded);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  onProgress(1);
  return bytes.buffer;
}

async function sourceResponse(url: string, options: SourceRequestOptions): Promise<SourceResult<Response>> {
  const result = await Result.tryPromise({
    try: () => (options.request ?? fetch)(url, { signal: options.signal }),
    catch: (cause) =>
      sourceError(cause, {
        message: `${options.label} request failed`,
        source: options.source,
        operation: options.operation,
      }),
  });
  if (result.isErr()) return result;
  if (result.value.ok) return result;
  return Result.err(
    new SourceError({
      message:
        result.value.status === 404
          ? `${options.label} was not found`
          : `${options.label} failed (${String(result.value.status)})`,
      source: options.source,
      operation: options.operation,
      status: result.value.status,
    }),
  );
}

export async function requestJson<T>(
  url: string,
  schema: ZodType<T>,
  options: SourceRequestOptions,
): Promise<SourceResult<T>> {
  return Result.gen(async function* () {
    const response = yield* Result.await(sourceResponse(url, options));
    const json = yield* Result.await(
      Result.tryPromise({
        try: async (): Promise<unknown> => response.json(),
        catch: (cause) =>
          sourceError(cause, {
            message: `${options.label} returned invalid JSON`,
            source: options.source,
            operation: options.operation,
          }),
      }),
    );
    const parsed = schema.safeParse(json);
    return parsed.success
      ? Result.ok(parsed.data)
      : Result.err(
          new SourceError({
            message: `${options.label} returned unexpected data`,
            source: options.source,
            operation: options.operation,
            cause: parsed.error,
          }),
        );
  });
}

export async function requestArrayBuffer(
  url: string,
  options: SourceRequestOptions,
): Promise<SourceResult<ArrayBuffer>> {
  return Result.gen(async function* () {
    const response = yield* Result.await(sourceResponse(url, options));
    const data = yield* Result.await(
      Result.tryPromise({
        try: () => responseArrayBuffer(response, options.onProgress),
        catch: (cause) =>
          sourceError(cause, {
            message: `${options.label} could not be read`,
            source: options.source,
            operation: options.operation,
          }),
      }),
    );
    return Result.ok(data);
  });
}
