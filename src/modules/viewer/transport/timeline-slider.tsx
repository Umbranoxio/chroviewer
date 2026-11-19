import { memo, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';

import { CircleOff, Pause, X } from 'lucide-react';
import { useFormatter, useLocale, useTranslations } from 'use-intl';

import { formatDuration } from '../../../i18n/formats';
import {
  findMarkerAtPosition,
  markerProgress,
  markerTopPercent,
  TIMELINE_LANE_COUNT,
  type TimelineMarker,
} from '../timeline-markers';
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

interface MarkerTranslationKeys {
  'bad-cut': 'markerBadCut';
  bookmark: 'markerBookmark';
  miss: 'markerMiss';
  pause: 'markerPause';
}

const markerTranslationKeys: MarkerTranslationKeys = {
  'bad-cut': 'markerBadCut',
  bookmark: 'markerBookmark',
  miss: 'markerMiss',
  pause: 'markerPause',
};

const timelineBoundaries = [0, 1, 2, 3, 4];
const markerRadius = 5;
const spriteKindIndex = {
  miss: 0,
  'bad-cut': 1,
  pause: 2,
} as const;

interface MarkerPaths {
  badge: Path2D;
  miss: Path2D;
  badCut: Path2D;
  pause: Path2D;
  bookmark: Path2D;
}

let cachedMarkerPaths: MarkerPaths | null = null;

function getMarkerPaths(): MarkerPaths {
  if (cachedMarkerPaths !== null) return cachedMarkerPaths;
  const badge = new Path2D();
  badge.arc(0, 0, markerRadius, 0, Math.PI * 2);

  const miss = new Path2D();
  miss.arc(0, 0, 3.33, 0, Math.PI * 2);
  miss.moveTo(-3.33, -3.33);
  miss.lineTo(3.33, 3.33);

  const badCut = new Path2D();
  badCut.moveTo(-2, -2);
  badCut.lineTo(2, 2);
  badCut.moveTo(2, -2);
  badCut.lineTo(-2, 2);

  const pause = new Path2D();
  pause.moveTo(-1.33, -2);
  pause.lineTo(-1.33, 2);
  pause.moveTo(1.33, -2);
  pause.lineTo(1.33, 2);

  const bookmark = new Path2D();
  if (typeof bookmark.roundRect === 'function') bookmark.roundRect(-3, -3, 6, 6, 1.5);
  else bookmark.rect(-3, -3, 6, 6);

  cachedMarkerPaths = { badge, miss, badCut, pause, bookmark };
  return cachedMarkerPaths;
}

function drawMarkersCanvas(
  canvas: HTMLCanvasElement,
  markers: readonly TimelineMarker[],
  duration: number,
  width: number,
  height: number,
) {
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  const pixelWidth = Math.max(1, Math.round(width * dpr));
  const pixelHeight = Math.max(1, Math.round(height * dpr));
  if (canvas.width !== pixelWidth) canvas.width = pixelWidth;
  if (canvas.height !== pixelHeight) canvas.height = pixelHeight;

  const ctx = canvas.getContext('2d');
  if (ctx === null) return;

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, pixelWidth, pixelHeight);
  if (markers.length === 0 || width <= 0 || height <= 0) return;

  const scaleX = pixelWidth / width;
  const scaleY = pixelHeight / height;
  const badgeColor = getComputedStyle(canvas).getPropertyValue('--secondary').trim() || '#333333';
  const paths = getMarkerPaths();
  const laneSlots = TIMELINE_LANE_COUNT + 1;
  const lastDeviceXByLane = new Int32Array(laneSlots).fill(-1);
  const lastKindByLane = new Int8Array(laneSlots).fill(-1);

  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  for (const marker of markers) {
    const x = markerProgress(marker, duration) * width;
    const y = (markerTopPercent(marker) / 100) * height;
    const laneSlot =
      marker.lane === undefined ? TIMELINE_LANE_COUNT : Math.min(Math.max(marker.lane, 1), TIMELINE_LANE_COUNT) - 1;

    if (marker.kind === 'bookmark') {
      lastKindByLane[laneSlot] = -1;
      ctx.setTransform(scaleX, 0, 0, scaleY, x * scaleX, y * scaleY);
      ctx.fillStyle = badgeColor;
      ctx.fill(paths.badge);
      ctx.fillStyle = marker.color ?? '#ffffff';
      ctx.fill(paths.bookmark);
      ctx.strokeStyle = 'rgb(255 255 255 / 0.7)';
      ctx.lineWidth = 1;
      ctx.stroke(paths.bookmark);
      continue;
    }

    const kindIndex = spriteKindIndex[marker.kind];
    const quantizedDeviceX = Math.round(x * dpr);
    if (quantizedDeviceX === lastDeviceXByLane[laneSlot] && kindIndex === lastKindByLane[laneSlot]) continue;
    lastDeviceXByLane[laneSlot] = quantizedDeviceX;
    lastKindByLane[laneSlot] = kindIndex;

    ctx.setTransform(scaleX, 0, 0, scaleY, x * scaleX, y * scaleY);
    ctx.fillStyle = badgeColor;
    ctx.fill(paths.badge);
    if (marker.kind === 'miss') {
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.05;
      ctx.stroke(paths.miss);
    } else if (marker.kind === 'bad-cut') {
      ctx.strokeStyle = '#ff0000';
      ctx.lineWidth = 1.2;
      ctx.stroke(paths.badCut);
    } else {
      ctx.strokeStyle = '#00ffff';
      ctx.lineWidth = 1.2;
      ctx.stroke(paths.pause);
    }
  }
}

const TimelineMarkersCanvas = memo(function TimelineMarkersCanvas({
  markers,
  duration,
}: {
  markers: readonly TimelineMarker[];
  duration: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas === null) return;

    const render = () => {
      const rect = canvas.getBoundingClientRect();
      drawMarkersCanvas(canvas, markers, duration, rect.width, rect.height);
    };

    render();
    const observer = new ResizeObserver(render);
    observer.observe(canvas);
    return () => {
      observer.disconnect();
    };
  }, [duration, markers]);

  return <canvas ref={canvasRef} aria-hidden className="pointer-events-none absolute inset-0 z-10 size-full" />;
});

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
  const [hoveredMarker, setHoveredMarker] = useState<TimelineMarker | null>(null);
  const playheadProgress = duration <= 0 ? 0 : Math.min(Math.max(time / duration, 0), 1) * 100;

  useEffect(() => {
    setHoveredMarker(null);
  }, [markers]);

  function positionAt(event: ReactPointerEvent<HTMLElement>, bounds = event.currentTarget.getBoundingClientRect()) {
    const progress = bounds.width === 0 ? 0 : Math.min(Math.max((event.clientX - bounds.left) / bounds.width, 0), 1);
    return { time: progress * duration, left: Math.min(Math.max(progress * 100, 7), 93) };
  }

  const hoveredTitle = hoveredMarker === null ? null : t(markerTranslationKeys[hoveredMarker.kind]);

  return (
    <div
      className={cn('relative min-w-0 flex-1', !interactive && 'pointer-events-none', className)}
      onPointerMove={(event) => {
        if (!interactive || event.pointerType !== 'mouse') return;
        const bounds = event.currentTarget.getBoundingClientRect();
        const hit = findMarkerAtPosition(
          markers,
          duration,
          event.clientX - bounds.left,
          event.clientY - bounds.top,
          bounds.width,
          bounds.height,
        );
        if (hit !== null) {
          setHoveredMarker((current) => (current?.id === hit.id ? current : hit));
          setPreview((current) => (current === null ? current : null));
          return;
        }
        setHoveredMarker((current) => (current === null ? current : null));
        setPreview(positionAt(event, bounds));
      }}
      onPointerLeave={() => {
        setHoveredMarker(null);
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
            style={{ top: `${String((boundary / TIMELINE_LANE_COUNT) * 100)}%` }}
          />
        ))}
      </div>
      <TimelineMarkersCanvas markers={markers} duration={duration} />
      <span
        aria-hidden
        className="bg-timeline-playhead pointer-events-none absolute inset-y-0 z-20 w-0.5 -translate-x-1/2 animate-none shadow-none transition-none"
        style={{ left: `${String(playheadProgress)}%` }}
      />
      {hoveredMarker !== null && hoveredTitle !== null && (
        <TooltipProvider delayDuration={0}>
          <Tooltip
            key={hoveredMarker.id}
            open
            onOpenChange={(open) => {
              if (!open) setHoveredMarker(null);
            }}
          >
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="secondary"
                size="icon-2xs"
                className="group pointer-events-auto absolute z-20 size-2.5 -translate-x-1/2 -translate-y-[62%] scale-110 rounded-full transition-transform duration-150 ease-out [&_svg]:size-2"
                style={{
                  left: `${String(markerProgress(hoveredMarker, duration) * 100)}%`,
                  top: `${String(markerTopPercent(hoveredMarker))}%`,
                }}
                aria-label={`${hoveredTitle}, ${formatDuration(hoveredMarker.time, locale)}`}
                tabIndex={-1}
                onClick={() => {
                  if (interactive) onSeek(hoveredMarker.time);
                }}
              >
                <MarkerGlyph marker={hoveredMarker} />
              </Button>
            </TooltipTrigger>
            <TooltipContent className="flex flex-col gap-1">
              <span className="font-medium">{hoveredTitle}</span>
              {hoveredMarker.text !== undefined && hoveredMarker.text !== '' && (
                <span className="max-w-56 whitespace-pre-wrap">{hoveredMarker.text}</span>
              )}
              <span className="text-muted-foreground tabular-nums">
                {formatDuration(hoveredMarker.time, locale)} · {format.number(hoveredMarker.beat, 'beat')}
              </span>
              {hoveredMarker.lane !== undefined && (
                <span className="text-muted-foreground">{t('markerLane', { lane: hoveredMarker.lane })}</span>
              )}
              {hoveredMarker.duration !== undefined && (
                <span className="text-muted-foreground">
                  {t('markerPauseLength', { duration: formatDuration(hoveredMarker.duration, locale) })}
                </span>
              )}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
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
