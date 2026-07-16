import { useEffect, useRef, useState, type RefObject } from 'react';

import { Result } from 'better-result';

import { songBpmTimeToSeconds } from '../../core/beatmap/bpm';
import type { HitsoundEvent } from '../../core/clock/hitsounds';
import { createAudioClock, createSilentClock, type SongClock } from '../../core/clock/song-clock';
import type { LightshowMode } from '../../core/lighting/basic-light';
import type { ViewerSettings } from '../../core/viewer-settings';
import { useHitsoundPlayback } from './use-hitsound-playback';

interface LoadSongOptions {
  audioData: ArrayBuffer | null;
  fallbackDuration: number;
  hitsoundEvents: HitsoundEvent[];
  onAudioDecodeError: () => void;
  songBpm: number;
  volume: number;
}

interface UseSongTransportOptions {
  lightshowModeRef: RefObject<LightshowMode>;
  settings: ViewerSettings;
  settingsRef: RefObject<ViewerSettings>;
}

export function useSongTransport({ lightshowModeRef, settings, settingsRef }: UseSongTransportOptions) {
  const clockRef = useRef<SongClock | null>(null);
  const [duration, setDuration] = useState(0);
  const [time, setTime] = useState(0);
  const [started, setStarted] = useState(false);
  const [audioBlocked, setAudioBlocked] = useState(false);
  const [beatStepNumerator, setBeatStepNumerator] = useState(1);
  const [beatStepDenominator, setBeatStepDenominator] = useState(4);
  const [playing, setPlaying] = useState(false);
  const [playbackRate, setPlaybackRateState] = useState(1);
  const hitsounds = useHitsoundPlayback({
    clockRef,
    lightshowModeRef,
    settingsRef,
    volume: settings.masterMuted ? 0 : settings.masterVolume * settings.hitsoundVolume,
  });

  useEffect(() => {
    clockRef.current?.setVolume(
      settings.masterMuted || settings.songMuted ? 0 : settings.masterVolume * settings.songVolume,
    );
  }, [settings.masterMuted, settings.masterVolume, settings.songMuted, settings.songVolume]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      const clock = clockRef.current;
      if (clock === null) return;
      setTime(clock.currentTime());
      setPlaying(clock.isPlaying());
    }, 100);
    return () => {
      window.clearInterval(interval);
    };
  }, []);

  useEffect(
    () => () => {
      disposeClock();
    },
    [],
  );

  function disposeClock() {
    clockRef.current?.dispose();
    clockRef.current = null;
  }

  function clear() {
    hitsounds.clear();
    disposeClock();
    setDuration(0);
    setTime(0);
    setStarted(false);
    setAudioBlocked(false);
    setPlaying(false);
  }

  async function load(options: LoadSongOptions) {
    disposeClock();
    let clock: SongClock;
    const audioData = options.audioData;
    if (audioData === null) {
      clock = createSilentClock(options.fallbackDuration, options.songBpm);
    } else {
      const result = await Result.tryPromise(() =>
        createAudioClock({ audioData: audioData.slice(0), songBpm: options.songBpm, volume: options.volume }),
      );
      if (result.isErr()) {
        clock = createSilentClock(options.fallbackDuration, options.songBpm);
        options.onAudioDecodeError();
      } else {
        clock = result.value;
      }
    }
    clock.setRate(playbackRate);
    clockRef.current = clock;
    hitsounds.load(options.hitsoundEvents);
    setDuration(clock.duration);
    setTime(0);
    setStarted(false);
    setAudioBlocked(false);
    setPlaying(false);
    return clock;
  }

  function play() {
    const clock = clockRef.current;
    if (clock === null) return undefined;
    if (clock.isPlaying()) return true;
    if (clock.currentTime() >= clock.duration) {
      clock.seek(0);
      hitsounds.seek(0);
      setTime(0);
    }
    if (settings.hitsounds) hitsounds.resume();
    clock.play();
    const nextPlaying = clock.isPlaying();
    setStarted(true);
    setAudioBlocked(clock.audioBlocked());
    setPlaying(nextPlaying);
    return nextPlaying;
  }

  function togglePlay() {
    const clock = clockRef.current;
    if (clock === null) return undefined;
    if (!clock.isPlaying()) return play();
    clock.pause();
    setPlaying(false);
    return false;
  }

  async function unlockAudio() {
    const clock = clockRef.current;
    if (clock === null) return false;
    const unlocked = await clock.unlockAudio();
    setAudioBlocked(!unlocked || clock.audioBlocked());
    return unlocked;
  }

  function seek(target: number) {
    const clock = clockRef.current;
    if (clock === null) return;
    const next = Math.min(Math.max(target, 0), clock.duration);
    clock.seek(next);
    hitsounds.seek(next);
    setTime(next);
  }

  function seekBeats(beats: number, songBpm: number) {
    const clock = clockRef.current;
    if (clock === null) return;
    seek(clock.currentTime() + songBpmTimeToSeconds(beats, songBpm));
  }

  function setHitsoundEvents(events: HitsoundEvent[]) {
    hitsounds.load(events);
    hitsounds.seek(clockRef.current?.currentTime() ?? 0);
  }

  function setPlaybackRate(rate: number) {
    setPlaybackRateState(rate);
    clockRef.current?.setRate(rate);
  }

  return {
    audioBlocked,
    beatStepDenominator,
    beatStepNumerator,
    clear,
    clockRef,
    duration,
    ended: duration > 0 && time >= duration && !playing,
    load,
    playbackRate,
    play,
    playing,
    seek,
    seekBeats,
    setBeatStepDenominator,
    setBeatStepNumerator,
    setHitsoundEvents,
    setPlaybackRate,
    started,
    time,
    togglePlay,
    unlockAudio,
  };
}
