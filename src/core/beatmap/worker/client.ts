import type { WorkerOperation, WorkerRequest, WorkerResponse, WorkerSuccess } from './protocol';

export interface ParseDifficultyOptions {
  lightshowText?: string;
  audioDataText?: string;
  bookmarkText?: string;
}

export interface BeatmapParserWorker {
  onmessage: ((event: MessageEvent<WorkerResponse>) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
  onmessageerror: ((event: MessageEvent) => void) | null;
  postMessage(message: WorkerRequest, transfer?: Transferable[]): void;
  terminate(): void;
}

interface PendingRequest {
  kind: WorkerOperation;
  resolve: (response: WorkerSuccess) => void;
  reject: (error: Error) => void;
}

export class BeatmapParser {
  private readonly worker: BeatmapParserWorker;
  private nextId = 0;
  private readonly pending = new Map<number, PendingRequest>();
  private failure: Error | null = null;

  constructor(worker?: BeatmapParserWorker) {
    this.worker = worker ?? new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
    this.worker.onmessage = (event) => {
      const pending = this.pending.get(event.data.id);
      if (pending === undefined) return;
      this.pending.delete(event.data.id);
      if (!event.data.ok) {
        pending.reject(new Error(event.data.error));
      } else if (event.data.kind !== pending.kind) {
        pending.reject(new Error(`mismatched worker response: expected ${pending.kind}, received ${event.data.kind}`));
      } else {
        pending.resolve(event.data);
      }
    };
    this.worker.onerror = (event) => {
      this.fail(new Error(event.message || 'beatmap parser worker failed'));
    };
    this.worker.onmessageerror = () => {
      this.fail(new Error('beatmap parser worker returned an unreadable response'));
    };
  }

  private fail(error: Error) {
    if (this.failure !== null) return;
    this.failure = error;
    for (const pending of this.pending.values()) pending.reject(error);
    this.pending.clear();
  }

  private request(message: WorkerRequest, transfer: Transferable[] = []): Promise<WorkerSuccess> {
    if (this.failure !== null) return Promise.reject(this.failure);
    return new Promise((resolve, reject) => {
      this.pending.set(message.id, { kind: message.kind, resolve, reject });
      this.worker.postMessage(message, transfer);
    });
  }

  async parseInfo(text: string) {
    const response = await this.request({ id: this.nextId++, kind: 'info', text });
    if (response.kind !== 'info') throw new Error('mismatched worker response');
    return response.result;
  }

  async parseDifficulty(text: string, songBpm: number, options: ParseDifficultyOptions = {}) {
    const response = await this.request({
      id: this.nextId++,
      kind: 'difficulty',
      text,
      songBpm,
      lightshowText: options.lightshowText,
      audioDataText: options.audioDataText,
      bookmarkText: options.bookmarkText,
    });
    if (response.kind !== 'difficulty') throw new Error('mismatched worker response');
    return response.result;
  }

  async parseReplay(data: ArrayBuffer) {
    const response = await this.request({ id: this.nextId++, kind: 'replay', data }, [data]);
    if (response.kind !== 'replay') throw new Error('mismatched worker response');
    return response.result;
  }

  dispose() {
    this.fail(new Error('beatmap parser disposed'));
    this.worker.terminate();
  }
}
