import type { CutScore } from './scoring';
import type { ReplayNoteEvent } from './types';

export interface HitScoreDisplay {
  text: string;
  color: string;
  runs: HitScoreTextRun[];
}

export interface HitScoreTextRun {
  text: string;
  scale: number;
  color?: string;
  baselineOffset?: number;
  underline?: boolean;
}

interface ColoredText {
  text: string;
  color: string;
}

interface Judgment extends ColoredText {
  threshold: number;
  fade: boolean;
}

interface Segment {
  threshold: number;
  text: string;
}

interface TimeSegment extends Segment {
  threshold: number;
}

interface BadCutDisplay extends ColoredText {
  type: number;
}

export interface HitScoreVisualizerConfig {
  fixedPosition?: readonly [number, number, number];
  targetPositionOffset?: readonly [number, number, number];
  displayMode: number;
  judgments: Judgment[];
  chainHeadJudgments: Judgment[];
  chainLinkDisplay: ColoredText;
  beforeSegments: Segment[];
  accuracySegments: Segment[];
  afterSegments: Segment[];
  timeSegments: TimeSegment[];
  badCuts: BadCutDisplay[];
  misses: ColoredText[];
  timePrecision: number;
  timeOffset: number;
}

const richTextTag = /<([^>]*)>/g;

export function hitScoreTextRuns(value: string) {
  const runs: HitScoreTextRun[] = [];
  const sizes = [1];
  const colors: (string | undefined)[] = [undefined];
  const scripts = [{ scale: 1, baselineOffset: 0 }];
  let underlineDepth = 0;
  let offset = 0;
  function append(text: string) {
    if (text === '') return;
    const script = scripts.at(-1) ?? scripts[0];
    if (script === undefined) return;
    const scale = (sizes.at(-1) ?? 1) * script.scale;
    if (scale === 0) return;
    const color = colors.at(-1);
    const baselineOffset = script.baselineOffset === 0 ? undefined : script.baselineOffset;
    const underline = underlineDepth === 0 ? undefined : true;
    const previous = runs.at(-1);
    if (
      previous?.scale === scale &&
      previous.color === color &&
      previous.baselineOffset === baselineOffset &&
      previous.underline === underline
    ) {
      previous.text += text;
    } else {
      runs.push({
        text,
        scale,
        ...(color === undefined ? {} : { color }),
        ...(baselineOffset === undefined ? {} : { baselineOffset }),
        ...(underline === undefined ? {} : { underline }),
      });
    }
  }
  for (const match of value.matchAll(richTextTag)) {
    const index = match.index;
    append(value.slice(offset, index));
    const tag = match[1]?.trim() ?? '';
    if (/^\/size$/i.test(tag)) {
      if (sizes.length > 1) sizes.pop();
    } else {
      const size = /^size\s*=\s*["']?([\d.]+)(%)?["']?$/i.exec(tag);
      const color = /^color\s*=\s*["']?(#[\da-f]{3,8}|[a-z]+)["']?$/i.exec(tag);
      if (size !== null) {
        const value = Number(size[1]);
        sizes.push(size[2] === '%' ? ((sizes.at(-1) ?? 1) * value) / 100 : value === 0 ? 0 : (sizes.at(-1) ?? 1));
      } else if (/^\/color$/i.test(tag)) {
        if (colors.length > 1) colors.pop();
      } else if (color !== null) {
        colors.push(color[1]);
      } else if (/^sup$/i.test(tag)) {
        const current = scripts.at(-1) ?? scripts[0];
        if (current !== undefined)
          scripts.push({ scale: current.scale * 0.5, baselineOffset: current.baselineOffset + 0.25 });
      } else if (/^\/sup$/i.test(tag)) {
        if (scripts.length > 1) scripts.pop();
      } else if (/^sub$/i.test(tag)) {
        const current = scripts.at(-1) ?? scripts[0];
        if (current !== undefined)
          scripts.push({ scale: current.scale * 0.5, baselineOffset: current.baselineOffset - 0.25 });
      } else if (/^\/sub$/i.test(tag)) {
        if (scripts.length > 1) scripts.pop();
      } else if (/^u$/i.test(tag)) {
        underlineDepth++;
      } else if (/^\/u$/i.test(tag)) {
        underlineDepth = Math.max(underlineDepth - 1, 0);
      }
    }
    offset = index + match[0].length;
  }
  append(value.slice(offset));
  return runs;
}

function styledDisplay(text: string, color: string): HitScoreDisplay {
  const runs = hitScoreTextRuns(text);
  return { text: runs.map((run) => run.text).join(''), color, runs };
}

const defaultDisplay = styledDisplay('', '#cccccc');

function nativeFailureDisplay(note: ReplayNoteEvent) {
  if (note.eventType === 3) return styledDisplay('MISS', '#ff0000');
  if (note.eventType === 2 || note.eventType === 4) return styledDisplay('X', '#ff0000');
  return defaultDisplay;
}

class PayloadReader {
  private readonly view: DataView;
  private offset = 0;

  constructor(private readonly payload: Uint8Array) {
    this.view = new DataView(payload.buffer, payload.byteOffset, payload.byteLength);
  }

  byte() {
    this.require(1);
    return this.view.getUint8(this.offset++);
  }

  ushort() {
    this.require(2);
    const value = this.view.getUint16(this.offset, true);
    this.offset += 2;
    return value;
  }

  float() {
    this.require(4);
    const value = this.view.getFloat32(this.offset, true);
    this.offset += 4;
    return value;
  }

  vector(): readonly [number, number, number] {
    return [this.float(), this.float(), this.float()];
  }

  string() {
    const length = this.ushort();
    if (length > 512) throw new Error('HSV string is too large');
    this.require(length);
    const value = new TextDecoder().decode(this.payload.subarray(this.offset, this.offset + length));
    this.offset += length;
    return value;
  }

  color() {
    const channels: [number, number, number] = [this.byte(), this.byte(), this.byte()];
    this.byte();
    return `#${channels.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`;
  }

  list<T>(read: () => T) {
    const count = this.byte();
    if (count > 32) throw new Error('HSV list is too large');
    return Array.from({ length: count }, read);
  }

  finished() {
    return this.offset === this.payload.length;
  }

  private require(length: number) {
    if (length > this.payload.length - this.offset) throw new Error('HSV payload is truncated');
  }
}

export function decodeHitScoreVisualizer(payload: Uint8Array | undefined): HitScoreVisualizerConfig | null {
  if (payload === undefined || payload.length === 0 || payload.length > 128 * 1024) return null;
  try {
    const reader = new PayloadReader(payload);
    const major = reader.byte();
    const minor = reader.byte();
    reader.byte();
    if (major !== 3 || minor > 7) return null;
    const displayMode = reader.byte();
    if (displayMode > 5) return null;
    const flags = reader.byte();
    const fixedPosition = (flags & 1) !== 0 ? reader.vector() : undefined;
    const targetPositionOffset = (flags & 2) !== 0 ? reader.vector() : undefined;
    const timePrecision = reader.byte();
    const timeOffset = reader.byte();
    const judgments = reader.list(() => ({
      threshold: reader.ushort(),
      text: reader.string(),
      color: reader.color(),
      fade: reader.byte() !== 0,
    }));
    const chainHeadJudgments = reader.list(() => ({
      threshold: reader.ushort(),
      text: reader.string(),
      color: reader.color(),
      fade: reader.byte() !== 0,
    }));
    const chainLinkDisplay =
      (flags & 16) !== 0 ? { text: reader.string(), color: reader.color() } : { text: '<u>%s', color: '#ffffff' };
    const segments = () => reader.list(() => ({ threshold: reader.ushort(), text: reader.string() }));
    const beforeSegments = segments();
    const accuracySegments = segments();
    const afterSegments = segments();
    const timeSegments = reader.list(() => ({ threshold: reader.float(), text: reader.string() }));
    const badCuts = reader.list(() => ({ text: reader.string(), color: reader.color(), type: reader.byte() }));
    const misses = reader.list(() => ({ text: reader.string(), color: reader.color() }));
    if (!reader.finished() || judgments.length === 0 || chainHeadJudgments.length === 0) return null;
    return {
      displayMode,
      fixedPosition,
      targetPositionOffset,
      judgments,
      chainHeadJudgments,
      chainLinkDisplay,
      beforeSegments,
      accuracySegments,
      afterSegments,
      timeSegments,
      badCuts,
      misses,
      timePrecision,
      timeOffset,
    } satisfies HitScoreVisualizerConfig;
  } catch {
    return null;
  }
}

function segmentText(segments: Segment[], score: number) {
  return segments.find((segment) => score >= segment.threshold)?.text ?? '';
}

function directionArrow(note: ReplayNoteEvent) {
  const diagonal = Math.SQRT1_2;
  const bases: readonly (readonly [number, number])[] = [
    [0, -1],
    [-diagonal, -diagonal],
    [-1, 0],
    [-diagonal, diagonal],
  ];
  let closest = 0;
  let closestDot = Number.NEGATIVE_INFINITY;
  let closestSignedDot = 0;
  for (let index = 0; index < bases.length; index++) {
    const base = bases[index];
    if (base === undefined) continue;
    const dot = note.cutNormal.x * base[0] + note.cutNormal.y * base[1];
    if (Math.abs(dot) <= closestDot) continue;
    closest = index + 4;
    closestDot = Math.abs(dot);
    closestSignedDot = dot;
  }
  const base = bases[closest - 4];
  const notePosition = note.notePosition;
  const towardNote =
    base !== undefined && notePosition !== undefined
      ? base[0] * (notePosition.x - note.cutPoint.x) + base[1] * (notePosition.y - note.cutPoint.y)
      : closestSignedDot;
  if (towardNote <= 0) closest -= 4;
  return ['↑', '↗', '→', '↘', '↓', '↙', '←', '↖'][closest] ?? '';
}

function fadeColor(from: string, to: string, amount: number) {
  const channel = (color: string, offset: number) => Number.parseInt(color.slice(offset, offset + 2), 16);
  const result = [1, 3, 5].map((offset) =>
    Math.round(channel(from, offset) + (channel(to, offset) - channel(from, offset)) * amount),
  );
  return `#${result.map((value) => value.toString(16).padStart(2, '0')).join('')}`;
}

function formatTemplate(template: string, config: HitScoreVisualizerConfig, cut: CutScore, note: ReplayNoteEvent) {
  const timeDependence = Math.abs(note.cutNormal.z);
  const timeText = (timeDependence * 10 ** config.timeOffset).toFixed(config.timePrecision);
  return template.replace(/%([bcatBCATdsp%n])/g, (_match, specifier: string) => {
    if (specifier === 'b') return String(cut.before);
    if (specifier === 'c') return String(cut.accuracy);
    if (specifier === 'a') return String(cut.after);
    if (specifier === 't') return timeText;
    if (specifier === 'B') return segmentText(config.beforeSegments, cut.before);
    if (specifier === 'C') return segmentText(config.accuracySegments, cut.accuracy);
    if (specifier === 'A') return segmentText(config.afterSegments, cut.after);
    if (specifier === 'T')
      return (
        config.timeSegments.find((segment) => timeDependence >= segment.threshold)?.text.replace('%t', timeText) ?? ''
      );
    if (specifier === 'd') return directionArrow(note);
    if (specifier === 's') return String(cut.total);
    if (specifier === 'p') return String(Math.round((cut.total / cut.maximum) * 100));
    if (specifier === 'n') return '\n';
    return '%';
  });
}

function judgmentDisplay(config: HitScoreVisualizerConfig, cut: CutScore, note: ReplayNoteEvent) {
  if (note.noteId.gameplayType === 3) {
    return styledDisplay(
      formatTemplate(config.chainLinkDisplay.text, config, cut, note),
      config.chainLinkDisplay.color,
    );
  }
  const judgments = note.noteId.gameplayType === 2 ? config.chainHeadJudgments : config.judgments;
  const index = Math.max(
    judgments.findIndex((judgment) => cut.total >= judgment.threshold),
    0,
  );
  const judgment = judgments[index] ?? judgments[0];
  if (judgment === undefined) return defaultDisplay;
  let text = formatTemplate(judgment.text, config, cut, note);
  if (config.displayMode === 2) text = judgment.text;
  else if (config.displayMode === 3) text = String(cut.total);
  else if (config.displayMode === 4) text = `${String(cut.total)}\n${judgment.text}`;
  else if (config.displayMode === 5) text = `${judgment.text}\n${directionArrow(note)}`;
  else if (config.displayMode === 0) text = `${judgment.text}\n${String(cut.total)}`;
  const previous = judgments[index - 1];
  const color =
    judgment.fade && previous !== undefined
      ? fadeColor(
          judgment.color,
          previous.color,
          (cut.total - judgment.threshold) / (previous.threshold - judgment.threshold),
        )
      : judgment.color;
  return styledDisplay(text, color);
}

export function hitScoreDisplay(
  config: HitScoreVisualizerConfig | null,
  note: ReplayNoteEvent,
  cut: CutScore | undefined,
  eventIndex: number,
): HitScoreDisplay {
  if (cut !== undefined)
    return config === null ? styledDisplay(String(cut.total), '#cccccc') : judgmentDisplay(config, cut, note);
  if (config === null) {
    return nativeFailureDisplay(note);
  }
  const candidates =
    note.eventType === 3
      ? config.misses
      : config.badCuts.filter(
          (display) => display.type === 0 || display.type === (note.eventType === 4 ? 3 : note.directionOk ? 2 : 1),
        );
  const candidate = candidates[eventIndex % Math.max(candidates.length, 1)];
  return candidate === undefined ? nativeFailureDisplay(note) : styledDisplay(candidate.text, candidate.color);
}
