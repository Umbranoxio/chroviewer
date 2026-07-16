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
