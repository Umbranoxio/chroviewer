import { Group, MathUtils, type Mesh, type MeshBasicMaterial, PlaneGeometry, RingGeometry } from 'three';
import type { Text } from 'troika-three-text';

import type { HitScoreVisualizerConfig } from '../../../core/replay/hit-score-visualizer';
import { buildReplayTimeline, type ReplayTimeline } from '../../../core/replay/replay-display';
import { firstComboBreakTime, replayScoreAt, type ReplayScoreState } from '../../../core/replay/scoring';
import type { Replay } from '../../../core/replay/types';
import { comboBreakAnimationAt } from './combo-break-animation';
import { FlyingScoreHud } from './flying-score-hud';
import {
  disposeHudText,
  formatAccuracy,
  formatScore,
  formatTime,
  hudShape,
  hudText,
  italicizeHudText,
  rankFor,
  replayDuration,
} from './primitives';

const scoreStackCenterX = -3.2;

export class ReplayGameplayHud {
  readonly root = new Group();

  private readonly scoreHud = new Group();
  private readonly comboPanel = new Group();
  private readonly combo = hudText('0', 0.46, [0, -0.165, 0]);
  private readonly comboLabel = hudText('COMBO', 0.33, [0, 0.165, 0]);
  private readonly score = hudText('0', 0.33, [-3.2, 1.17, -6.99]);
  private readonly rank = hudText('SS', 0.66, [-3.2, 0.48, -6.98]);
  private readonly accuracy = hudText('100.00%', 0.27, [-3.2, 0.88, -6.98]);
  private readonly multiplierNumber = hudText('1', 0.6, [3.28, 1.68, -6.97]);
  private readonly multiplierX = hudText('x', 0.3, [3.01, 1.83, -6.97]);
  private readonly songTime = hudText('0:00', 0.24, [2.92, 0.76, -6.97]);
  private readonly songDuration = hudText('0:00', 0.24, [3.48, 0.76, -6.97]);
  private readonly energyFill: Mesh<PlaneGeometry, MeshBasicMaterial>;
  private readonly songProgressFill: Mesh<PlaneGeometry, MeshBasicMaterial>;
  private readonly multiplierProgress: Mesh<RingGeometry, MeshBasicMaterial>;
  private readonly comboTopLine: Mesh<PlaneGeometry, MeshBasicMaterial>;
  private readonly comboBottomLine: Mesh<PlaneGeometry, MeshBasicMaterial>;
  private readonly textMeshes: Text[];
  private readonly shapes: Mesh<PlaneGeometry | RingGeometry, MeshBasicMaterial>[];
  private readonly flyingScores = new FlyingScoreHud();
  private timeline: ReplayTimeline | null = null;
  private comboBreakTime: number | null = null;
  private songDurationSeconds: number | null = null;
  private scoreStackLayout = '';

  constructor() {
    this.root.visible = false;
    this.root.renderOrder = 1000;
    this.comboPanel.position.set(-3.2, 1.775, -6.99);
    this.comboPanel.add(this.combo, this.comboLabel);
    italicizeHudText(this.comboLabel);
    italicizeHudText(this.multiplierNumber);
    italicizeHudText(this.multiplierX);
    this.rank.fillOpacity = 0.5;
    this.accuracy.fillOpacity = 0.5;
    this.songDuration.fillOpacity = 0.5;
    for (const text of [this.multiplierNumber, this.multiplierX, this.songTime, this.songDuration]) {
      text.outlineWidth = text.fontSize * 0.012;
      text.outlineColor = 0xffffff;
      text.outlineOpacity = text.fillOpacity;
    }
    this.textMeshes = [
      this.combo,
      this.comboLabel,
      this.score,
      this.rank,
      this.accuracy,
      this.multiplierNumber,
      this.multiplierX,
      this.songTime,
      this.songDuration,
    ];
    this.scoreHud.add(
      this.comboPanel,
      this.score,
      this.rank,
      this.accuracy,
      this.multiplierNumber,
      this.multiplierX,
      this.songTime,
      this.songDuration,
    );
    this.root.add(this.scoreHud, this.flyingScores.root);

    this.comboTopLine = hudShape(new PlaneGeometry(1, 0.04));
    this.comboTopLine.position.set(-3.2, 2.18, -7);
    this.comboBottomLine = hudShape(new PlaneGeometry(1, 0.04));
    this.comboBottomLine.position.set(-3.2, 1.41, -7);

    const energyBackground = hudShape(new PlaneGeometry(1.94, 0.09), 0.75, 0x000000);
    energyBackground.position.set(0, -0.64, -7.75);
    energyBackground.renderOrder = 999;
    const energyGeometry = new PlaneGeometry(1.908, 0.06).translate(0.954, 0, 0);
    this.energyFill = hudShape(energyGeometry);
    this.energyFill.position.set(-0.954, -0.64, -7.73);
    const emptyEnergyIcon = hudShape(new PlaneGeometry(0.12, 0.12), 0.25);
    emptyEnergyIcon.position.set(-1.1, -0.64, -7.73);
    emptyEnergyIcon.rotation.z = Math.PI / 4;
    const fullEnergyIcon = hudShape(new PlaneGeometry(0.12, 0.12), 0.25);
    fullEnergyIcon.position.set(1.06, -0.64, -7.73);
    fullEnergyIcon.rotation.z = Math.PI / 4;

    const multiplierBackground = hudShape(new RingGeometry(0.47, 0.5, 64), 0.25);
    multiplierBackground.position.set(3.2, 1.7, -7);
    multiplierBackground.renderOrder = 999;
    this.multiplierProgress = hudShape(new RingGeometry(0.47, 0.5, 64, 1, Math.PI / 2, -Math.PI * 2));
    this.multiplierProgress.position.set(3.2, 1.7, -6.97);

    const songProgressBackground = hudShape(new PlaneGeometry(1, 0.06), 0.25);
    songProgressBackground.position.set(3.2, 0.98, -6.99);
    const songProgressGeometry = new PlaneGeometry(1, 0.06).translate(0.5, 0, 0);
    this.songProgressFill = hudShape(songProgressGeometry);
    this.songProgressFill.position.set(2.7, 0.98, -6.97);
    const songTimeSeparator = hudShape(new PlaneGeometry(0.02, 0.18), 0.5);
    songTimeSeparator.position.set(3.2, 0.76, -6.99);

    this.scoreHud.add(
      this.comboTopLine,
      this.comboBottomLine,
      energyBackground,
      this.energyFill,
      emptyEnergyIcon,
      fullEnergyIcon,
      multiplierBackground,
      this.multiplierProgress,
      songProgressBackground,
      this.songProgressFill,
      songTimeSeparator,
    );
    this.shapes = [
      this.comboTopLine,
      this.comboBottomLine,
      energyBackground,
      this.energyFill,
      emptyEnergyIcon,
      fullEnergyIcon,
      multiplierBackground,
      this.multiplierProgress,
      songProgressBackground,
      this.songProgressFill,
      songTimeSeparator,
    ];
  }

  setReplay(replay: Replay | null, hitScoreVisualizer?: HitScoreVisualizerConfig | null) {
    this.timeline =
      replay === null
        ? null
        : hitScoreVisualizer === undefined
          ? buildReplayTimeline(replay)
          : buildReplayTimeline(replay, hitScoreVisualizer);
    this.comboBreakTime = replay === null ? null : firstComboBreakTime(replay);
    this.root.visible = replay !== null;
    this.scoreHud.visible = replay !== null && replay.scores.length > 0;
    this.flyingScores.clear();
    this.updateComboBreak(0);
    if (this.timeline !== null) {
      this.refreshDuration();
      this.updateState(replayScoreAt(this.timeline, 0));
    }
  }

  setSongDuration(duration: number | null) {
    this.songDurationSeconds = duration;
    this.refreshDuration();
  }

  setEnabled(enabled: boolean) {
    this.root.visible = enabled && this.timeline !== null;
  }

  setHitScoreVisualizer(hitScoreVisualizer: HitScoreVisualizerConfig | null) {
    if (this.timeline === null) return;
    this.timeline = { ...this.timeline, hitScoreVisualizer };
    this.flyingScores.clear();
  }

  refreshTimeline() {
    const timeline = this.timeline;
    if (timeline === null) return;
    this.timeline = buildReplayTimeline(timeline.replay, timeline.hitScoreVisualizer);
    this.comboBreakTime = firstComboBreakTime(timeline.replay);
    this.refreshDuration();
  }

  update(time: number) {
    const timeline = this.timeline;
    if (timeline === null) return;
    this.updateState(replayScoreAt(timeline, time));
    const duration = replayDuration(timeline.replay, this.songDurationSeconds);
    this.setText(this.songTime, formatTime(time));
    this.songProgressFill.scale.x = duration === 0 ? 0 : Math.min(Math.max(time / duration, 0), 1);
    this.flyingScores.update(timeline, time);
    this.updateComboBreak(time);
  }

  dispose() {
    this.flyingScores.clear();
    for (const text of this.textMeshes) disposeHudText(text);
    for (const shape of this.shapes) {
      shape.geometry.dispose();
      shape.material.dispose();
    }
  }

  private updateState(state: ReplayScoreState) {
    this.setText(this.combo, String(state.combo));
    this.updateScoreStack(formatScore(state.score), formatAccuracy(state.accuracy), rankFor(state.accuracy));
    this.setText(this.multiplierNumber, String(state.multiplier));
    this.energyFill.scale.x = state.energy;
    const progress = Math.min(Math.max(state.multiplierProgress, 0), 1);
    this.multiplierProgress.geometry.setDrawRange(0, Math.floor(progress * 64) * 6);
  }

  private refreshDuration() {
    const replay = this.timeline?.replay;
    if (replay === undefined) return;
    this.setText(this.songDuration, formatTime(replayDuration(replay, this.songDurationSeconds)));
  }

  private updateComboBreak(time: number) {
    const elapsed = this.comboBreakTime === null ? null : time - this.comboBreakTime;
    const state = comboBreakAnimationAt(elapsed);
    this.comboTopLine.visible = state.linesVisible;
    this.comboBottomLine.visible = state.linesVisible;
    this.comboTopLine.material.opacity = state.lineAlpha;
    this.comboBottomLine.material.opacity = state.lineAlpha;
    this.comboTopLine.position.x = -3.2 + state.topLineX;
    this.comboBottomLine.position.x = -3.2 + state.bottomLineX;
    this.comboTopLine.scale.x = state.lineScaleX;
    this.comboBottomLine.scale.x = state.lineScaleX;
    this.comboPanel.scale.set(state.comboScaleX, state.comboScaleY, 1);
    this.comboPanel.rotation.z = MathUtils.degToRad(state.comboRotationDegrees);
    this.comboPanel.position.z = -6.99 - state.comboDepth;
  }

  private updateScoreStack(score: string, accuracy: string, rank: string) {
    const layout = `${score}\0${accuracy}\0${rank}`;
    if (layout === this.scoreStackLayout) return;
    this.scoreStackLayout = layout;
    this.score.text = score;
    this.accuracy.text = accuracy;
    this.rank.text = rank;

    const texts = [this.score, this.accuracy, this.rank];
    let pending = texts.length;
    const align = () => {
      if (--pending > 0) return;
      for (const text of texts) {
        const bounds = text.textRenderInfo?.visibleBounds;
        if (bounds !== undefined) {
          const opticalOffset = text === this.accuracy ? 0.03 : 0;
          text.position.x = scoreStackCenterX - (bounds[0] + bounds[2]) / 2 + opticalOffset;
        }
      }
    };
    for (const text of texts) text.sync(align);
  }

  private setText(mesh: Text, text: string) {
    if (mesh.text === text) return;
    mesh.text = text;
    mesh.sync();
  }
}
