import { secondsToSongBpmTime, songBpmTimeToSeconds } from '../../core/beatmap/bpm';
import type { Bookmark, Difficulty } from '../../core/beatmap/types';
import type { Replay } from '../../core/replay/types';

export type TimelineMarkerKind = 'miss' | 'bad-cut' | 'pause' | 'bookmark';

export interface TimelineMarker {
  id: string;
  kind: TimelineMarkerKind;
  time: number;
  beat: number;
  duration?: number;
  lane?: number;
  text?: string;
  color?: string;
}

function bookmarkColor(bookmark: Bookmark) {
  const clamp = (channel: number) => Math.min(Math.max(channel, 0), 1);
  const [red, green, blue, alpha] = bookmark.color;
  return `rgb(${String(Math.round(clamp(red) * 255))} ${String(Math.round(clamp(green) * 255))} ${String(Math.round(clamp(blue) * 255))} / ${String(clamp(alpha))})`;
}

export function buildTimelineMarkers(
  replay: Replay | null,
  difficulty: Difficulty | null,
  songBpm: number,
  showBookmarks: boolean,
) {
  const markers: TimelineMarker[] = [];
  for (const [index, note] of (replay?.notes ?? []).entries()) {
    if (note.eventType !== 2 && note.eventType !== 3) continue;
    markers.push({
      id: `note-${String(index)}`,
      kind: note.eventType === 2 ? 'bad-cut' : 'miss',
      time: note.time,
      beat: secondsToSongBpmTime(note.time, songBpm),
      lane: note.noteId.lineIndex + 1,
    });
  }
  for (const [index, pause] of (replay?.pauses ?? []).entries()) {
    markers.push({
      id: `pause-${String(index)}`,
      kind: 'pause',
      time: pause.time,
      beat: secondsToSongBpmTime(pause.time, songBpm),
      duration: Number(pause.duration) / 1000,
    });
  }
  if (showBookmarks) {
    for (const [index, bookmark] of (difficulty?.bookmarks ?? []).entries()) {
      markers.push({
        id: `bookmark-${String(index)}`,
        kind: 'bookmark',
        time: songBpmTimeToSeconds(bookmark.songBpmTime, songBpm),
        beat: bookmark.songBpmTime,
        text: bookmark.name,
        color: bookmarkColor(bookmark),
      });
    }
  }
  return markers.sort((left, right) => left.time - right.time);
}

export const TIMELINE_LANE_COUNT = 4;

export function markerProgress(marker: Pick<TimelineMarker, 'time'>, duration: number) {
  return duration <= 0 ? 0 : Math.min(Math.max(marker.time / duration, 0), 1);
}

export function markerTopPercent(marker: Pick<TimelineMarker, 'lane'>) {
  if (marker.lane === undefined) return 50;
  const clampedLane = Math.min(Math.max(marker.lane, 1), TIMELINE_LANE_COUNT);
  return ((clampedLane - 0.5) / TIMELINE_LANE_COUNT) * 100;
}

export function findMarkerAtPosition(
  markers: readonly TimelineMarker[],
  duration: number,
  x: number,
  y: number,
  width: number,
  height: number,
  hitRadius = 5,
): TimelineMarker | null {
  if (width <= 0 || height <= 0 || markers.length === 0) return null;

  let startIndex = 0;
  let endTime = Number.POSITIVE_INFINITY;
  if (duration <= 0) {
    if (Math.abs(x) > hitRadius) return null;
  } else {
    if (x - hitRadius > 0) {
      const minTime = ((x - hitRadius) / width) * duration;
      let low = 0;
      let high = markers.length;
      while (low < high) {
        const middle = (low + high) >>> 1;
        if ((markers[middle]?.time ?? 0) < minTime) low = middle + 1;
        else high = middle;
      }
      startIndex = low;
    }
    if (x + hitRadius < width) {
      endTime = ((x + hitRadius) / width) * duration;
    }
  }

  const radiusSq = hitRadius * hitRadius;
  let best: TimelineMarker | null = null;
  let bestDistSq = radiusSq;
  for (let index = startIndex; index < markers.length; index++) {
    const marker = markers[index];
    if (marker === undefined || marker.time > endTime) break;
    const dx = markerProgress(marker, duration) * width - x;
    const dy = (markerTopPercent(marker) / 100) * height - y;
    const distSq = dx * dx + dy * dy;
    if (distSq <= bestDistSq + 1e-6) {
      best = marker;
      bestDistSq = distSq;
    }
  }
  return best;
}
