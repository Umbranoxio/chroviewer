import { Group, Mesh, PlaneGeometry, Quaternion, Vector3, type MeshBasicMaterial } from 'three';
import type { Text } from 'troika-three-text';

import type { HitScoreTextRun } from '../../../core/replay/hit-score-visualizer';
import { flyingScoresAt, type ReplayTimeline } from '../../../core/replay/replay-display';
import type { ReplayNoteEvent } from '../../../core/replay/types';
import { MAIN_ONLY_LAYER } from '../../mirror/planar-mirror';
import { disposeHudText, flyingScoreBloomAlpha, flyingScoreMaterial, hudText } from './primitives';

interface FlyingText {
  root: Group;
  texts: Text[];
  indicator?: Mesh<PlaneGeometry, MeshBasicMaterial>;
  start: Vector3;
  target: Vector3;
  rotation: Quaternion;
  failure: boolean;
}

const flyingScoreFontSize = 0.26;
const flyingFailureFontSize = 0.46;

function flyingScoreText(runs: HitScoreTextRun[], color: string, bloomAlpha: number, failure: boolean) {
  const root = new Group();
  const baseFontSize = failure ? flyingFailureFontSize : flyingScoreFontSize;
  const onlyRun = runs.length === 1 ? runs[0] : undefined;
  if (onlyRun !== undefined && !onlyRun.text.includes('\n')) {
    const text = hudText(
      onlyRun.text,
      baseFontSize * onlyRun.scale,
      [0, 0, 0],
      'middle',
      'center',
      true,
      bloomAlpha,
      false,
    );
    text.color = color;
    text.maxWidth = 2.5;
    text.sync();
    root.add(text);
    return { root, texts: [text] };
  }
  const lines: Text[][] = [[]];
  for (const run of runs) {
    const parts = run.text.split('\n');
    for (const [index, part] of parts.entries()) {
      if (part !== '') {
        const text = hudText(
          part,
          baseFontSize * run.scale,
          [0, 0, 0],
          'bottom-baseline',
          'left',
          true,
          bloomAlpha,
          false,
        );
        text.color = color;
        text.maxWidth = 2.5;
        lines.at(-1)?.push(text);
        root.add(text);
      }
      if (index < parts.length - 1) lines.push([]);
    }
  }
  const texts = lines.flat();
  const lineHeights = lines.map((line) => Math.max(baseFontSize, ...line.map((text) => text.fontSize)));
  const totalHeight = lineHeights.reduce((sum, height) => sum + height, 0);
  let top = totalHeight / 2;
  for (const [lineIndex, line] of lines.entries()) {
    const height = lineHeights[lineIndex] ?? baseFontSize;
    const baseline = top - height * 0.8;
    let pending = line.length;
    function layout() {
      if (--pending > 0) return;
      const widths = line.map((text) => {
        const bounds = text.textRenderInfo?.blockBounds;
        return bounds === undefined ? 0 : bounds[2] - bounds[0];
      });
      let x = -widths.reduce((sum, width) => sum + width, 0) / 2;
      for (const [index, text] of line.entries()) {
        text.position.set(x, baseline, 0);
        x += widths[index] ?? 0;
      }
    }
    for (const text of line) text.sync(layout);
    top -= height;
  }
  return { root, texts };
}

function hermite(from: number, to: number, fromSlope: number, toSlope: number, amount: number) {
  const squared = amount * amount;
  const cubed = squared * amount;
  return (
    (2 * cubed - 3 * squared + 1) * from +
    (cubed - 2 * squared + amount) * fromSlope +
    (-2 * cubed + 3 * squared) * to +
    (cubed - squared) * toSlope
  );
}

function flyingMovement(amount: number) {
  const split = 0.18576352;
  if (amount <= split) return hermite(0, 0.62048507, 3.3401878 * split, 1.5404444 * split, amount / split);
  const length = 1 - split;
  return hermite(0.62048507, 1, 1.5404444 * length, 0, (amount - split) / length);
}

function flyingFade(amount: number) {
  if (amount < 0.2) return 3 * (amount / 0.2) ** 2 - 2 * (amount / 0.2) ** 3;
  if (amount <= 0.40029904) return 1;
  const fade = (amount - 0.40029904) / (1 - 0.40029904);
  return 1 - (3 * fade ** 2 - 2 * fade ** 3);
}

function failureMovement(amount: number) {
  const split = 0.15881044;
  if (amount <= split) return hermite(0, 0.7196346, 4.5314064 * split, 1.0496378 * split, amount / split);
  const length = 1 - split;
  return hermite(0.7196346, 1, 1.0496378 * length, 0, (amount - split) / length);
}

function failureFade(amount: number) {
  const split = 0.15138501;
  if (amount <= split) return hermite(0, 1, 0, 0.024424182 * split, amount / split);
  const length = 1 - split;
  return Math.max(0, hermite(1, 0, 0.024424182 * length, 0, (amount - split) / length));
}

export class FlyingScoreHud {
  readonly root = new Group();

  private readonly flying = new Map<number, FlyingText>();
  private readonly start = new Vector3();
  private readonly target = new Vector3();
  private readonly rotation = new Quaternion();
  private readonly inverseRotation = new Quaternion();

  update(timeline: ReplayTimeline, time: number) {
    const active = flyingScoresAt(timeline, time, 0.7);
    const activeIds = new Set(active.map((score) => score.id));
    for (const [id, flying] of this.flying) {
      if (activeIds.has(id)) continue;
      this.disposeFlyingText(flying);
      this.flying.delete(id);
    }
    for (const score of active) {
      const note = timeline.events[score.id]?.note;
      if (note === undefined) continue;
      let flying = this.flying.get(score.id);
      if (flying === undefined) {
        flying = this.createFlyingText(
          score.runs,
          score.color,
          score.showCenterIndicator,
          score.kind !== 'score',
          note,
          timeline,
        );
        this.flying.set(score.id, flying);
        this.root.add(flying.root);
      }
      flying.root.position.lerpVectors(
        flying.start,
        flying.target,
        flying.failure ? failureMovement(score.age) : flyingMovement(score.age),
      );
      flying.root.quaternion.copy(flying.rotation);
      const opacity = (flying.failure ? failureFade(score.age) : flyingFade(score.age)) * score.opacity;
      for (const text of flying.texts) text.fillOpacity = opacity;
      if (flying.indicator !== undefined) flying.indicator.material.opacity = opacity;
    }
  }

  clear() {
    for (const flying of this.flying.values()) this.disposeFlyingText(flying);
    this.flying.clear();
  }

  private createFlyingText(
    runs: HitScoreTextRun[],
    color: string,
    showCenterIndicator: boolean,
    failure: boolean,
    note: ReplayNoteEvent,
    timeline: ReplayTimeline,
  ): FlyingText {
    const bloomAlpha = failure || timeline.hitScoreVisualizer === null ? flyingScoreBloomAlpha : 0;
    const { root, texts } = flyingScoreText(runs, color, bloomAlpha, failure);
    const indicator = showCenterIndicator
      ? new Mesh(new PlaneGeometry(0.32, 0.04), flyingScoreMaterial(color))
      : undefined;
    if (indicator !== undefined) {
      indicator.position.set(0, -0.15, 0.01);
      indicator.renderOrder = 1001;
      indicator.layers.set(MAIN_ONLY_LAYER);
      root.add(indicator);
    }

    const fixedPosition = timeline.hitScoreVisualizer?.fixedPosition;
    const start =
      fixedPosition === undefined
        ? this.start.set(note.cutPoint.x, note.cutPoint.y, -note.cutPoint.z).clone()
        : this.start.set(fixedPosition[0], fixedPosition[1], -fixedPosition[2]).clone();
    const rotation =
      note.worldRotation === undefined
        ? new Quaternion()
        : this.rotation
            .set(-note.worldRotation.x, -note.worldRotation.y, note.worldRotation.z, note.worldRotation.w)
            .clone();
    if (failure) {
      this.inverseRotation.copy(rotation).invert();
      if (note.eventType === 3) {
        if (note.notePosition === undefined) {
          this.start
            .set((note.noteId.lineIndex - 1.5) * 0.6, note.noteId.lineLayer * 0.6 + 0.85, 0)
            .applyQuaternion(rotation);
        } else {
          this.start
            .set(note.notePosition.x, note.notePosition.y, -note.notePosition.z)
            .applyQuaternion(this.inverseRotation);
          this.start.z = 0;
          this.start.applyQuaternion(rotation);
        }
      }
      const failureStart =
        note.eventType === 3
          ? this.start.clone()
          : this.start.set(note.cutPoint.x, note.cutPoint.y, -note.cutPoint.z).clone();
      const local = this.target.copy(failureStart).applyQuaternion(this.inverseRotation);
      const target = this.target
        .set(local.x < 0 ? -2 : 2, 1.3, -15)
        .applyQuaternion(rotation)
        .clone();
      return { root, texts, indicator, start: failureStart, target, rotation, failure };
    }
    if (fixedPosition !== undefined) return { root, texts, indicator, start, target: start.clone(), rotation, failure };
    this.inverseRotation.copy(rotation).invert();
    const local = this.target.copy(start).applyQuaternion(this.inverseRotation);
    local.z = 0;
    local.y = -0.24;
    local.z -= 7.55;
    const target = local.applyQuaternion(rotation).clone();
    const offset = timeline.hitScoreVisualizer?.targetPositionOffset;
    if (offset !== undefined) target.add(this.start.set(offset[0], offset[1], -offset[2]));
    return { root, texts, indicator, start, target, rotation, failure };
  }

  private disposeFlyingText(flying: FlyingText) {
    this.root.remove(flying.root);
    flying.indicator?.geometry.dispose();
    flying.indicator?.material.dispose();
    for (const text of flying.texts) disposeHudText(text);
  }
}
