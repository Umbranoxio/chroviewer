import { useEffect, useRef, useState } from 'react';

import { Pause, Play } from 'lucide-react';
import { useTranslations } from 'use-intl';

import { HitsoundPlayer } from '../../core/clock/hitsounds';
import { SettingRow } from './components/setting-row';

import { Button } from '@/components/ui/button';

interface AudioOffsetCalibrationProps {
  active: boolean;
  audioOffsetMs: number;
}

const travelDurationMs = 750;
const scheduleAheadMs = 50;

export function AudioOffsetCalibration({ active, audioOffsetMs }: AudioOffsetCalibrationProps) {
  const t = useTranslations('settings.general');
  const [running, setRunning] = useState(false);
  const [player] = useState(() => new HitsoundPlayer());
  const markerRef = useRef<HTMLDivElement>(null);
  const centerRef = useRef<HTMLDivElement>(null);
  const audioOffsetRef = useRef(audioOffsetMs);
  audioOffsetRef.current = audioOffsetMs;

  useEffect(() => {
    if (!active) setRunning(false);
  }, [active]);

  useEffect(() => {
    if (!running) return;

    const startedAt = performance.now();
    const firstHitAt = startedAt + travelDurationMs / 2;
    let nextVisualHitAt = firstHitAt;
    let nextSoundHitAt = firstHitAt;
    let frame = 0;

    function update(now: number) {
      const cycle = ((now - startedAt) / travelDurationMs) % 2;
      const progress = cycle <= 1 ? cycle : 2 - cycle;
      if (markerRef.current !== null) markerRef.current.style.left = `${progress * 100}%`;

      while (nextVisualHitAt <= now) {
        centerRef.current?.animate(
          [
            { opacity: 0.5, transform: 'scale(1)' },
            { opacity: 1, transform: 'scale(1.3)' },
            { opacity: 0.5, transform: 'scale(1)' },
          ],
          { duration: 240, easing: 'ease-in-out' },
        );
        nextVisualHitAt += travelDurationMs;
      }

      while (nextSoundHitAt + audioOffsetRef.current <= now + scheduleAheadMs) {
        const soundAt = nextSoundHitAt + audioOffsetRef.current;
        if (soundAt >= now - scheduleAheadMs) player.play(true, (soundAt - now) / 1000);
        nextSoundHitAt += travelDurationMs;
      }

      frame = requestAnimationFrame(update);
    }

    frame = requestAnimationFrame(update);
    return () => {
      cancelAnimationFrame(frame);
      player.stop();
      if (markerRef.current !== null) markerRef.current.style.left = '0%';
    };
  }, [player, running]);

  useEffect(
    () => () => {
      player.dispose();
    },
    [player],
  );

  return (
    <div>
      <SettingRow label={t('audioCalibration')} detail={t('audioCalibrationDescription')}>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            if (!running) player.resume();
            setRunning((current) => !current);
          }}
        >
          {running ? <Pause /> : <Play />}
          {t(running ? 'stopAudioCalibration' : 'startAudioCalibration')}
        </Button>
      </SettingRow>
      <div className="px-2 py-3" aria-hidden>
        <div className="bg-muted relative h-1.5 rounded-full">
          <div className="bg-foreground/40 absolute top-1/2 left-0 h-4 w-0.5 -translate-y-1/2 rounded-full" />
          <div className="bg-foreground/40 absolute top-1/2 right-0 h-4 w-0.5 -translate-y-1/2 rounded-full" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
            <div ref={centerRef} className="border-primary bg-background size-5 rounded-full border-2 opacity-50" />
          </div>
          <div
            ref={markerRef}
            className="bg-primary absolute top-1/2 left-0 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full shadow-sm"
          />
        </div>
      </div>
    </div>
  );
}
