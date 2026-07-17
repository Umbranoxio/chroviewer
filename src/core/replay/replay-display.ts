import {
  decodeHitScoreVisualizer,
  hitScoreDisplay,
  type HitScoreTextRun,
  type HitScoreVisualizerConfig,
} from './hit-score-visualizer';
import { buildReplayScoreTimeline, replayEventIndexAfter, type ReplayScoreTimeline } from './scoring';
import type { Replay } from './types';

export interface ReplayTimeline extends ReplayScoreTimeline {
  hitScoreVisualizer: HitScoreVisualizerConfig | null;
}

export interface FlyingScore {
  id: number;
  age: number;
  kind: 'score' | 'bad-cut' | 'miss';
  lane: number;
  text: string;
  runs: HitScoreTextRun[];
  color: string;
  opacity: number;
  showCenterIndicator: boolean;
}

export function buildReplayTimeline(replay: Replay): ReplayTimeline {
  return {
    ...buildReplayScoreTimeline(replay),
    hitScoreVisualizer: decodeHitScoreVisualizer(replay.hsvConfig),
  };
}

export function flyingScoresAt(timeline: ReplayTimeline, time: number, duration = 0.7) {
  const end = replayEventIndexAfter(timeline, time);
  const start = replayEventIndexAfter(timeline, time - duration);
  const scores: FlyingScore[] = [];
  for (let index = start; index < end; index++) {
    const event = timeline.events[index];
    if (event?.kind !== 'note' || event.note === undefined || event.note.eventType === 0) continue;
    const display = hitScoreDisplay(timeline.hitScoreVisualizer, event.note, event.cutScore, event.id);
    if (display.text === '') continue;
    scores.push({
      id: event.id,
      age: Math.max(0, Math.min(1, (time - event.time) / duration)),
      kind: event.cutScore !== undefined ? 'score' : event.note.eventType === 3 ? 'miss' : 'bad-cut',
      lane: event.note.noteId.lineIndex,
      text: display.text,
      runs: display.runs,
      color: display.color,
      opacity:
        timeline.hitScoreVisualizer === null &&
        event.cutScore !== undefined &&
        event.cutScore.total <= event.cutScore.maximum * 0.9
          ? 0.3
          : 1,
      showCenterIndicator:
        timeline.hitScoreVisualizer === null &&
        event.cutScore !== undefined &&
        (timeline.replay.metadata.version === 'ScoreSaberLegacy'
          ? event.cutScore.total === event.cutScore.maximum
          : event.cutScore.accuracy === 15),
    });
  }
  return scores;
}
