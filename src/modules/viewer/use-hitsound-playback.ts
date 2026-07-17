import { useEffect, useRef, useState, type RefObject } from 'react';

import { firstHitsoundAfter, HitsoundPlayer, type HitsoundEvent } from '../../core/clock/hitsounds';
import type { SongClock } from '../../core/clock/song-clock';
import { isForcedLightshowMode, type LightshowMode } from '../../core/lighting/basic-light';
import type { ViewerSettings } from '../../core/viewer-settings';

interface HitsoundPlaybackOptions {
  audioOffset: number;
  clockRef: RefObject<SongClock | null>;
  lightshowModeRef: RefObject<LightshowMode>;
  settingsRef: RefObject<ViewerSettings>;
  volume: number;
}

export function useHitsoundPlayback({
  audioOffset,
  clockRef,
  lightshowModeRef,
  settingsRef,
  volume,
}: HitsoundPlaybackOptions) {
  const [player] = useState(() => new HitsoundPlayer());
  const eventsRef = useRef<HitsoundEvent[]>([]);
  const timeRef = useRef(0);
  const indexRef = useRef(0);

  useEffect(() => {
    player.setVolume(volume);
  }, [player, volume]);

  useEffect(() => {
    player.stop();
    const clock = clockRef.current;
    const time = clock?.currentTime() ?? 0;
    const scaledAudioOffset = audioOffset * (clock?.getRate() ?? 1);
    timeRef.current = time;
    indexRef.current = firstHitsoundAfter(eventsRef.current, time - scaledAudioOffset);
  }, [audioOffset, clockRef, player]);

  useEffect(() => {
    let frame = 0;

    function schedule() {
      const clock = clockRef.current;
      if (clock !== null) {
        const currentTime = clock.currentTime();
        const rate = clock.getRate();
        const scaledAudioOffset = audioOffset * rate;
        if (!clock.isPlaying()) {
          timeRef.current = currentTime - 1e-6;
          indexRef.current = firstHitsoundAfter(eventsRef.current, timeRef.current - scaledAudioOffset);
        } else {
          const horizon = Math.min(currentTime + 0.04 * rate, clock.duration);
          const events = eventsRef.current;
          let index = indexRef.current;
          if (currentTime > timeRef.current) {
            timeRef.current = currentTime - 1e-6;
            index = firstHitsoundAfter(events, timeRef.current - scaledAudioOffset);
          }
          while (index < events.length) {
            const event = events[index];
            if (event === undefined || event.time + scaledAudioOffset > horizon) break;
            if (
              event.time + scaledAudioOffset > timeRef.current &&
              settingsRef.current.hitsounds &&
              !isForcedLightshowMode(lightshowModeRef.current)
            ) {
              player.play(event.good, (event.time + scaledAudioOffset - currentTime) / rate);
            }
            index++;
          }
          indexRef.current = index;
          timeRef.current = horizon;
        }
      }
      frame = requestAnimationFrame(schedule);
    }

    frame = requestAnimationFrame(schedule);
    return () => {
      cancelAnimationFrame(frame);
    };
  }, [audioOffset, clockRef, lightshowModeRef, settingsRef]);

  useEffect(
    () => () => {
      player.dispose();
    },
    [player],
  );

  function clear() {
    eventsRef.current = [];
    timeRef.current = 0;
    indexRef.current = 0;
  }

  function load(events: HitsoundEvent[]) {
    eventsRef.current = events;
    timeRef.current = 0;
    const rate = clockRef.current?.getRate() ?? 1;
    indexRef.current = firstHitsoundAfter(events, -audioOffset * rate);
  }

  function resume() {
    player.resume();
  }

  function seek(time: number) {
    timeRef.current = time;
    const rate = clockRef.current?.getRate() ?? 1;
    indexRef.current = firstHitsoundAfter(eventsRef.current, time - audioOffset * rate);
  }

  return {
    clear,
    load,
    resume,
    seek,
  };
}
