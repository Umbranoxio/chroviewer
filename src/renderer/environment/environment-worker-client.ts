import type { EnvironmentWorkerResponse } from './environment-worker-protocol';
import type { EnvironmentData } from './types';

export function loadEnvironmentData(id: string, signal?: AbortSignal) {
  const worker = new Worker(new URL('./environment-worker.ts', import.meta.url), { type: 'module' });
  return new Promise<EnvironmentData>((resolve, reject) => {
    function dispose() {
      signal?.removeEventListener('abort', abort);
      worker.terminate();
    }

    function abort() {
      dispose();
      reject(
        signal?.reason instanceof Error
          ? signal.reason
          : new DOMException('environment load was cancelled', 'AbortError'),
      );
    }

    if (signal?.aborted === true) {
      abort();
      return;
    }
    signal?.addEventListener('abort', abort, { once: true });
    worker.onmessage = (event: MessageEvent<EnvironmentWorkerResponse>) => {
      dispose();
      if (event.data.ok) resolve(event.data.data);
      else reject(new Error(event.data.error));
    };
    worker.onerror = (event) => {
      dispose();
      reject(new Error(event.message || 'environment worker failed'));
    };
    worker.onmessageerror = () => {
      dispose();
      reject(new Error('environment worker returned unreadable data'));
    };
    worker.postMessage({
      id,
      url: `${import.meta.env.BASE_URL}environments/${id}.json`,
    });
  });
}
