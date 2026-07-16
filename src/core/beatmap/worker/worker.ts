import { Result } from 'better-result';

import { parseScoreSaberReplay } from '../../replay/parse-scoresaber';
import { parseInfo } from '../info';
import { parseDifficulty } from '../parse';
import type { WorkerRequest, WorkerResponse, WorkerSuccess } from './protocol';

async function execute(request: WorkerRequest): Promise<WorkerSuccess> {
  if (request.kind === 'info') {
    return { id: request.id, ok: true, kind: request.kind, result: parseInfo(request.text) };
  }
  if (request.kind === 'replay') {
    return {
      id: request.id,
      ok: true,
      kind: request.kind,
      result: await parseScoreSaberReplay(new Uint8Array(request.data)),
    };
  }
  return {
    id: request.id,
    ok: true,
    kind: request.kind,
    result: parseDifficulty(request.text, request.songBpm, {
      lightshowText: request.lightshowText,
      audioDataText: request.audioDataText,
      bookmarkText: request.bookmarkText,
    }),
  };
}

async function handle(request: WorkerRequest): Promise<WorkerResponse> {
  const response = await Result.tryPromise({
    try: () => execute(request),
    catch: (cause) => (cause instanceof Error ? cause : new Error(String(cause))),
  });
  return response.isOk() ? response.value : { id: request.id, ok: false, error: response.error.message };
}

self.addEventListener('message', (event: MessageEvent<WorkerRequest>) => {
  void handle(event.data).then((response) => {
    self.postMessage(response);
  });
});
