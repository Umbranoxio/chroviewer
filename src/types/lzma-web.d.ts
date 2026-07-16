declare module 'lzma-web/dist/lzma.js' {
  interface LzmaWorker {
    decompress(input: Uint8Array, onFinish: (result: Uint8Array | string | null, error?: Error | null) => void): void;
  }

  export function LZMA(workerUrl: string): LzmaWorker;
}
