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
  pause(): void;
  seek(songTime: number): void;
  setRate(rate: number): void;
  setVolume(volume: number): void;
  unlockAudio(): Promise<boolean>;
  dispose(): void;
}

export interface ClockDriver {
  now(): number;
  start?(songTime: number, rate: number): void;
  stop?(): void;
  setRate?(rate: number): void;
  setVolume?(volume: number): void;
  audioBlocked?(): boolean;
  unlockAudio?(): Promise<boolean>;
  dispose?(): void;
}

export function createClock(duration: number, songBpm: number, driver: ClockDriver): SongClock {
  let state = createTransport();

  const clamp = (songTime: number) => Math.min(Math.max(songTime, 0), duration);

  function syncEnd() {
    const now = driver.now();
    if (state.playing && songTimeAt(state, now) >= duration) {
      state = transportSeek(transportPause(state, now), now, duration);
      driver.stop?.();
    }
  }

  function currentTime() {
    syncEnd();
    return clamp(songTimeAt(state, driver.now()));
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
      driver.start?.(state.anchorSongTime, state.rate);
    },
    pause: () => {
      if (!state.playing) return;
      state = transportPause(state, driver.now());
      driver.stop?.();
    },
    seek: (songTime: number) => {
      const target = clamp(songTime);
      state = transportSeek(state, driver.now(), target);
      if (state.playing) {
        driver.stop?.();
        driver.start?.(target, state.rate);
      }
    },
    setRate: (rate: number) => {
      state = transportSetRate(state, driver.now(), rate);
      if (state.playing) driver.setRate?.(rate);
    },
    setVolume: (volume: number) => {
      driver.setVolume?.(Math.min(Math.max(volume, 0), 1));
    },
    unlockAudio: async () => {
      const wasBlocked = driver.audioBlocked?.() ?? false;
      const unlocked = (await driver.unlockAudio?.()) ?? true;
      if (wasBlocked && unlocked && state.playing) {
        const songTime = clamp(songTimeAt(state, driver.now()));
        driver.stop?.();
        driver.start?.(songTime, state.rate);
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
}

export async function createAudioClock({
  audioData,
  songBpm,
  volume = 1,
  context,
}: AudioClockOptions): Promise<SongClock> {
  const ownsContext = context === undefined;
  const ctx = context ?? new AudioContext();
  const buffer = await ctx.decodeAudioData(audioData);
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
    start: (songTime, rate) => {
      void ctx.resume();
      source = ctx.createBufferSource();
      source.buffer = buffer;
      source.playbackRate.value = rate;
      source.connect(gain);
      source.onended = () => {
        source = undefined;
      };
      source.start(0, Math.min(songTime, buffer.duration));
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

  return createClock(buffer.duration, songBpm, driver);
}
