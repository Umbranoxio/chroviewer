import { Result } from 'better-result';

import { secondsToSongBpmTime } from '../beatmap/bpm';
import {
  createTransport,
  songTimeAt,
  transportPause,
  transportPlay,
  transportSeek,
  transportSetRate,
} from './transport';

export interface SongClock {
  duration: number;
  audioBlocked(): boolean;
  isPlaying(): boolean;
  getRate(): number;
  currentTime(): number;
  currentBeat(): number;
  play(): void;
  setRange(start: number, end: number): void;
  getStart(): number;
  getEnd(): number;
  pause(): void;
  seek(songTime: number): void;
  setRate(rate: number): void;
  setVolume(volume: number): void;
  setAudioOffset(offset: number): void;
  unlockAudio(): Promise<boolean>;
  dispose(): void;
}

export interface ClockDriver {
  now(): number;
  start?(songTime: number, rate: number, audioOffset: number): void;
  stop?(): void;
  setRate?(rate: number): void;
  setVolume?(volume: number): void;
  audioBlocked?(): boolean;
  unlockAudio?(): Promise<boolean>;
  dispose?(): void;
}

export function createClock(duration: number, songBpm: number, driver: ClockDriver): SongClock {
  let state = createTransport();
  let audioOffset = 0;

  state.end = duration;

  const clampState = (songTime: number) => Math.min(Math.max(songTime, state.start), state.end);
  const clampSong = (songTime: number) => Math.min(Math.max(songTime, 0), duration);

  function syncEnd() {
    const now = driver.now();
    if (state.playing && songTimeAt(state, now) >= state.end) {
      state = transportSeek(transportPause(state, now), now, state.end);
      driver.stop?.();
    }
  }

  function currentTime() {
    syncEnd();
    return clampState(songTimeAt(state, driver.now()));
  }

  return {
    duration,
    audioBlocked: () => driver.audioBlocked?.() ?? false,
    isPlaying: () => {
      syncEnd();
      return state.playing;
    },
    getRate: () => state.rate,
    currentTime,
    currentBeat: () => secondsToSongBpmTime(currentTime(), songBpm),
    play: () => {
      syncEnd();
      if (state.playing) return;
      state = transportPlay(state, driver.now());
      driver.start?.(state.anchorSongTime, state.rate, audioOffset);
    },
    getEnd: () => state.end,
    getStart: () => state.start,
    setRange: (start, end) => {
      syncEnd();
      if (state.playing) return;
      state.end = clampSong(end);
      state.start = clampSong(start);
      state.anchorSongTime = clampState(state.anchorSongTime);
    },
    pause: () => {
      if (!state.playing) return;
      state = transportPause(state, driver.now());
      driver.stop?.();
    },
    seek: (songTime: number) => {
      const target = clampState(songTime);
      state = transportSeek(state, driver.now(), target);
      if (state.playing) {
        driver.stop?.();
        driver.start?.(target, state.rate, audioOffset);
      }
    },
    setRate: (rate: number) => {
      state = transportSetRate(state, driver.now(), rate);
      if (!state.playing) return;
      if (audioOffset === 0) {
        driver.setRate?.(rate);
      } else {
        driver.stop?.();
        driver.start?.(state.anchorSongTime, rate, audioOffset);
      }
    },
    setVolume: (volume: number) => {
      driver.setVolume?.(Math.min(Math.max(volume, 0), 1));
    },
    setAudioOffset: (offset: number) => {
      if (offset === audioOffset) return;
      audioOffset = offset;
      if (!state.playing) return;
      const songTime = clamp(songTimeAt(state, driver.now()));
      driver.stop?.();
      driver.start?.(songTime, state.rate, audioOffset);
    },
    unlockAudio: async () => {
      const wasBlocked = driver.audioBlocked?.() ?? false;
      const unlocked = (await driver.unlockAudio?.()) ?? true;
      if (wasBlocked && unlocked && state.playing) {
        const songTime = clampSong(songTimeAt(state, driver.now()));
        driver.stop?.();
        driver.start?.(songTime, state.rate, audioOffset);
      }
      return unlocked;
    },
    dispose: () => {
      driver.stop?.();
      driver.dispose?.();
    },
  };
}

export function createSilentClock(
  duration: number,
  songBpm: number,
  now: () => number = () => performance.now() / 1000,
): SongClock {
  return createClock(duration, songBpm, { now });
}

export interface AudioClockOptions {
  audioData: ArrayBuffer;
  songBpm: number;
  volume?: number;
  context?: AudioContext;
  audioDestination: MediaStreamAudioDestinationNode;
}

function isOggAudio(audioData: ArrayBuffer) {
  const signature = new Uint8Array(audioData, 0, Math.min(audioData.byteLength, 4));
  return signature[0] === 0x4f && signature[1] === 0x67 && signature[2] === 0x67 && signature[3] === 0x53;
}

async function decodeOggVorbis(ctx: AudioContext, audioData: ArrayBuffer) {
  return Result.tryPromise(async () => {
    const { OggVorbisDecoderWebWorker } = await import('@wasm-audio-decoders/ogg-vorbis');
    const decoder = new OggVorbisDecoderWebWorker();
    try {
      await decoder.ready;
      const decoded = await decoder.decodeFile(new Uint8Array(audioData));
      const buffer = ctx.createBuffer(decoded.channelData.length, decoded.samplesDecoded, decoded.sampleRate);
      for (const [channel, channelData] of decoded.channelData.entries()) {
        buffer.getChannelData(channel).set(channelData);
      }
      return buffer;
    } finally {
      await decoder.free();
    }
  });
}

async function decodeAudio(ctx: AudioContext, audioData: ArrayBuffer) {
  const native = await Result.tryPromise(() => ctx.decodeAudioData(audioData.slice(0)));
  if (native.isOk() || !isOggAudio(audioData)) return native;
  return decodeOggVorbis(ctx, audioData);
}

export async function createAudioClock({
  audioData,
  songBpm,
  volume = 1,
  context,
  audioDestination,
}: AudioClockOptions) {
  const ownsContext = context === undefined;
  const ctx = context ?? new AudioContext();
  const decoded = await decodeAudio(ctx, audioData);
  if (decoded.isErr()) {
    if (ownsContext) void ctx.close();
    return decoded;
  }
  const buffer = decoded.value;
  const gain = ctx.createGain();
  gain.gain.value = Math.min(Math.max(volume, 0), 1);
  gain.connect(ctx.destination);
  let source: AudioBufferSourceNode | undefined;

  function stop() {
    if (source === undefined) return;
    source.onended = null;
    source.stop();
    source.disconnect();
    source = undefined;
  }

  const driver: ClockDriver = {
    now: () => performance.now() / 1000,
    audioBlocked: () => ctx.state !== 'running',
    start: (songTime, rate, audioOffset) => {
      void ctx.resume();
      source = ctx.createBufferSource();
      source.buffer = buffer;
      source.playbackRate.value = rate;
      source.connect(audioDestination);
      source.connect(gain);
      source.onended = () => {
        source = undefined;
      };
      const audioTime = songTime - audioOffset * rate;
      source.start(Math.max(-audioTime / rate, 0), Math.min(Math.max(audioTime, 0), buffer.duration));
    },
    stop,
    setRate: (rate) => {
      if (source !== undefined) source.playbackRate.value = rate;
    },
    setVolume: (nextVolume) => {
      gain.gain.setValueAtTime(nextVolume, ctx.currentTime);
    },
    unlockAudio: async () => {
      await ctx.resume();
      return ctx.state === 'running';
    },
    dispose: () => {
      stop();
      gain.disconnect();
      if (ownsContext) void ctx.close();
    },
  };

  return Result.ok(createClock(buffer.duration, songBpm, driver));
}
