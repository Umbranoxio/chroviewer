import { useState, type PointerEvent as ReactPointerEvent } from 'react';

import { CircleOff, Pause, X } from 'lucide-react';
import { useFormatter, useLocale, useTranslations } from 'use-intl';

import { formatDuration } from '../../../i18n/formats';
import type { TimelineMarker, TimelineMarkerKind } from '../timeline-markers';
import { quantizedBeatAt } from '../viewer-timeline';

import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

import { cn } from '@/lib/utils';

interface TimelineSliderProps {
  className?: string;
  time: number;
  duration: number;
  songBpm: number;
  beatStep: number;
  reverseScroll?: boolean;
  interactive?: boolean;
  markers: TimelineMarker[];
  onSeek: (time: number) => void;
  onSeekBeats: (beats: number) => void;
}

const markerTranslationKeys = {
  'bad-cut': 'markerBadCut',
  bookmark: 'markerBookmark',
  miss: 'markerMiss',
  pause: 'markerPause',
} as const satisfies Record<TimelineMarkerKind, string>;

const timelineLanes = [1, 2, 3, 4];
const timelineBoundaries = [0, 1, 2, 3, 4];

function laneTop(lane: number) {
  const clampedLane = Math.min(Math.max(lane, 1), timelineLanes.length);
  return ((clampedLane - 0.5) / timelineLanes.length) * 100;
}

function markerTop(marker: TimelineMarker) {
  return marker.lane === undefined ? 50 : laneTop(marker.lane);
}

function MarkerGlyph({ marker }: { marker: TimelineMarker }) {
  if (marker.kind === 'miss') {
    return <CircleOff aria-hidden className="drop-shadow-sm" color="#fff" strokeWidth={3} />;
  }
  if (marker.kind === 'bad-cut') {
    return <X aria-hidden className="drop-shadow-sm" color="#f00" strokeWidth={3.5} />;
  }
  if (marker.kind === 'pause') {
    return <Pause aria-hidden className="drop-shadow-sm" color="#0ff" strokeWidth={3.5} />;
  }
  return (
    <span
      aria-hidden
      className="size-1.5 rounded-sm border border-white/70 shadow-sm"
      style={{ backgroundColor: marker.color }}
    />
  );
}

export function TimelineSlider({
  className,
  time,
  duration,
  songBpm,
  beatStep,
  reverseScroll = false,
  interactive = true,
  markers,
  onSeek,
  onSeekBeats,
}: TimelineSliderProps) {
  const format = useFormatter();
  const locale = useLocale();
  const t = useTranslations('viewer.transport');
  const [preview, setPreview] = useState<{ time: number; left: number } | null>(null);
  const playheadProgress = duration <= 0 ? 0 : Math.min(Math.max(time / duration, 0), 1) * 100;

  function positionAt(event: ReactPointerEvent<HTMLElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    const progress = bounds.width === 0 ? 0 : Math.min(Math.max((event.clientX - bounds.left) / bounds.width, 0), 1);
    return { time: progress * duration, left: Math.min(Math.max(progress * 100, 7), 93) };
  }

  return (
    <div
      className={cn('relative min-w-0 flex-1', !interactive && 'pointer-events-none', className)}
      onPointerMove={(event) => {
        if (interactive && event.pointerType === 'mouse') setPreview(positionAt(event));
      }}
      onPointerLeave={() => {
        setPreview(null);
      }}
      onWheel={(event) => {
        if (!interactive || event.deltaY === 0 || event.ctrlKey || event.metaKey) return;
        onSeekBeats(Math.sign(event.deltaY) * beatStep * (reverseScroll ? -1 : 1));
      }}
    >
      <Slider
        variant="transport"
        aria-label={t('songPosition')}
        aria-valuetext={t('timeRange', {
          current: formatDuration(time, locale),
          duration: formatDuration(duration, locale),
        })}
        min={0}
        max={duration}
        step={0.01}
        value={[time]}
        aria-readonly={!interactive}
        tabIndex={interactive ? undefined : -1}
        onPointerDown={(event) => {
          if (interactive && event.button === 0) onSeek(positionAt(event).time);
        }}
        onValueChange={([value]) => {
          if (interactive && value !== undefined) onSeek(value);
        }}
      />
      <div aria-hidden className="pointer-events-none absolute inset-0">
        {timelineBoundaries.map((boundary) => (
          <span
            key={boundary}
            className="border-border/45 absolute inset-x-0 border-t"
            style={{ top: `${String((boundary / timelineLanes.length) * 100)}%` }}
          />
        ))}
      </div>
      <span
        aria-hidden
        className="bg-timeline-playhead pointer-events-none absolute inset-y-0 z-20 w-0.5 -translate-x-1/2 animate-none shadow-none transition-none"
        style={{ left: `${String(playheadProgress)}%` }}
      />
      <TooltipProvider delayDuration={100}>
        <div className="pointer-events-none absolute inset-0 z-10">
          {markers.map((marker) => {
            const title = t(markerTranslationKeys[marker.kind]);
            const progress = duration <= 0 ? 0 : Math.min(Math.max(marker.time / duration, 0), 1) * 100;
            return (
              <Tooltip key={marker.id}>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="secondary"
                    size="icon-2xs"
                    className="group pointer-events-auto absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full transition-transform duration-150 ease-out hover:z-20 hover:-translate-y-[62%] hover:scale-110 focus-visible:z-20 focus-visible:-translate-y-[62%] focus-visible:scale-110 [&_svg]:size-2"
                    style={{ left: `${String(progress)}%`, top: `${String(markerTop(marker))}%` }}
                    aria-label={`${title}, ${formatDuration(marker.time, locale)}`}
                    tabIndex={interactive ? undefined : -1}
                    onPointerEnter={() => {
                      setPreview(null);
                    }}
                    onPointerMove={(event) => {
                      event.stopPropagation();
                    }}
                    onClick={() => {
                      if (interactive) onSeek(marker.time);
                    }}
                  >
                    <MarkerGlyph marker={marker} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent className="flex flex-col gap-1">
                  <span className="font-medium">{title}</span>
                  {marker.text !== undefined && marker.text !== '' && (
                    <span className="max-w-56 whitespace-pre-wrap">{marker.text}</span>
                  )}
                  <span className="text-muted-foreground tabular-nums">
                    {formatDuration(marker.time, locale)} · {format.number(marker.beat, 'beat')}
                  </span>
                  {marker.lane !== undefined && (
                    <span className="text-muted-foreground">{t('markerLane', { lane: marker.lane })}</span>
                  )}
                  {marker.duration !== undefined && (
                    <span className="text-muted-foreground">
                      {t('markerPauseLength', { duration: formatDuration(marker.duration, locale) })}
                    </span>
                  )}
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>
      </TooltipProvider>
      {preview !== null && (
        <div
          className="border-border bg-popover text-popover-foreground pointer-events-none absolute bottom-full mb-1.5 flex min-w-14 -translate-x-1/2 flex-col items-center gap-0.5 rounded-md border px-2 py-1.5 text-xs leading-none tabular-nums shadow-md"
          style={{ left: `${String(preview.left)}%` }}
          role="tooltip"
        >
          <span>{formatDuration(preview.time, locale)}</span>
          <span className="text-muted-foreground">
            {format.number(quantizedBeatAt(preview.time, songBpm, beatStep), 'beat')}
          </span>
        </div>
      )}
    </div>
  );
}
