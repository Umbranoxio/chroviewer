import { Group, Object3D, PerspectiveCamera, Quaternion, ShaderMaterial, Vector3, type BufferGeometry } from 'three';

import { eulerFromQuaternion } from '../../core/animation/point-definition';
import { DEFAULT_COLORS, type ColorScheme, type Rgb } from '../../core/colors';
import { isForcedLightshowMode, type LightshowMode } from '../../core/lighting/basic-light';
import type { NoodleTransform } from '../../core/noodle-runtime';
import type { HitScoreVisualizerConfig } from '../../core/replay/hit-score-visualizer';
import { sampleReplayFrames } from '../../core/replay/sampling';
import type { Replay, ReplayTransform } from '../../core/replay/types';
import {
  DEFAULT_REPLAY_SABER_SETTINGS,
  type ReplayCameraSettings,
  type ReplaySaberSettings,
} from '../../core/viewer-settings';
import type { FogUniforms } from '../bloomfog/pipeline';
import { NoodlePlayerTransform } from '../map/noodle-player-transform';
import {
  createSaberCoreMaterial,
  createSaberGlowMaterial,
  createSaberTrailMaterial,
} from '../materials/map-object-materials';
import { shaderUniformValue } from '../materials/shared';
import { ReplayGameplayHud } from './hud/gameplay-hud';
import { ReplayCameraController, type ReplayCameraMode } from './replay-camera';
import {
  createReplaySurfaceMaterial,
  ReplayHeadset,
  SABER_GRIP_SURFACE,
  SABER_METAL_SURFACE,
  type ReplayDirectionalLights,
} from './replay-headset';
import {
  clearReplaySaberTrail,
  createReplaySaber,
  createReplaySaberTrail,
  setReplaySaberSettings,
  setReplaySaberTrailSettings,
  updateReplaySaberTrail,
  type ReplaySaberModel,
  type ReplaySaberTrail,
} from './saber';

function saberCoreColor([red, green, blue]: Rgb): Rgb {
  return [0.55 + red * 0.45, 0.55 + green * 0.45, 0.55 + blue * 0.45];
}

export class ReplayView {
  readonly root = new Group();

  private readonly replayPlayerRoot = new Object3D();
  private readonly replayHeadTrack = new Object3D();
  private readonly replayLeftHandTrack = new Object3D();
  private readonly replayRightHandTrack = new Object3D();
  private readonly posePlayerRoot = new Object3D();
  private readonly poseHeadTrack = new Object3D();
  private readonly poseHead = new Object3D();
  private readonly replayLeftHand = new Object3D();
  private readonly replayRightHand = new Object3D();
  private readonly replayLeftOffset = new Object3D();
  private readonly replayRightOffset = new Object3D();
  private readonly replayLeftTip = new Object3D();
  private readonly replayRightTip = new Object3D();
  private readonly replayLeftTrailBase = new Object3D();
  private readonly replayRightTrailBase = new Object3D();
  private readonly gameplayHud = new ReplayGameplayHud();
  private readonly replayHeadset: ReplayHeadset;
  private readonly cameraController: ReplayCameraController;
  private readonly replayPosition = new Vector3();
  private readonly replayQuaternion = new Quaternion();
  private readonly worldQuaternion = new Quaternion();
  private readonly position = new Vector3();
  private readonly worldHeadPosition = new Vector3();
  private readonly noodlePlayerTransform = new NoodlePlayerTransform();
  private readonly replayGeometries: BufferGeometry[] = [];
  private readonly replayMaterials: ShaderMaterial[] = [];
  private readonly replaySabers: ReplaySaberModel[] = [];
  private readonly replayTrails: ReplaySaberTrail[] = [];
  private readonly replaySaberColorMaterials: { blade: ShaderMaterial; core: ShaderMaterial }[] = [];
  private replayTrailTime = Number.NEGATIVE_INFINITY;
  private localSpaceSaberTrail = false;
  private saberSettings = DEFAULT_REPLAY_SABER_SETTINGS;
  private replay: Replay | null = null;
  private hasSampledReplayPose = false;
  private lightshowMode: LightshowMode = 'full';

  constructor(
    camera: PerspectiveCamera,
    fog: FogUniforms,
    directionalLights: ReplayDirectionalLights,
    refreshMirrorMaterials: () => void,
  ) {
    this.cameraController = new ReplayCameraController(camera);
    this.replayHeadset = new ReplayHeadset(fog, directionalLights, refreshMirrorMaterials);
    const metalMaterial = createReplaySurfaceMaterial(fog, directionalLights, SABER_METAL_SURFACE);
    const gripMaterial = createReplaySurfaceMaterial(fog, directionalLights, SABER_GRIP_SURFACE);
    const sabers = [
      {
        color: DEFAULT_COLORS.leftNote,
        offset: this.replayLeftOffset,
        tip: this.replayLeftTip,
        trailBase: this.replayLeftTrailBase,
      },
      {
        color: DEFAULT_COLORS.rightNote,
        offset: this.replayRightOffset,
        tip: this.replayRightTip,
        trailBase: this.replayRightTrailBase,
      },
    ];
    for (const { color, offset, tip, trailBase } of sabers) {
      const bladeMaterial = createSaberGlowMaterial(fog, color, saberCoreColor(color));
      const coreMaterial = createSaberCoreMaterial(fog, saberCoreColor(color));
      const saber = createReplaySaber({
        blade: bladeMaterial,
        core: coreMaterial,
        metal: metalMaterial,
        grip: gripMaterial,
      });
      trailBase.position.copy(saber.trailBase.position);
      tip.position.copy(saber.tip.position);
      saber.root.remove(saber.trailBase, saber.tip);
      saber.trailBase = trailBase;
      saber.tip = tip;
      saber.root.add(trailBase, tip);
      setReplaySaberSettings(saber, this.saberSettings);
      offset.add(saber.root);
      this.replaySabers.push(saber);
      this.replayGeometries.push(...saber.geometries);
      this.replayMaterials.push(bladeMaterial, coreMaterial);
      this.replaySaberColorMaterials.push({ blade: bladeMaterial, core: coreMaterial });
      const trailMaterial = createSaberTrailMaterial(color);
      const trail = createReplaySaberTrail(trailMaterial);
      this.root.add(trail.mesh);
      this.replayGeometries.push(trail.mesh.geometry);
      this.replayMaterials.push(trailMaterial);
      this.replayTrails.push(trail);
    }
    this.replayMaterials.push(metalMaterial, gripMaterial);
    this.replayLeftHand.add(this.replayLeftOffset);
    this.replayRightHand.add(this.replayRightOffset);
    this.replayHeadTrack.add(this.replayHeadset.root);
    this.replayLeftHandTrack.add(this.replayLeftHand);
    this.replayRightHandTrack.add(this.replayRightHand);
    this.replayPlayerRoot.add(this.replayHeadTrack, this.replayLeftHandTrack, this.replayRightHandTrack);
    this.root.add(this.replayPlayerRoot);
    this.poseHeadTrack.add(this.poseHead);
    this.posePlayerRoot.add(this.poseHeadTrack);
    this.root.visible = false;
  }

  get hudRoot() {
    return this.gameplayHud.root;
  }

  get headPosition() {
    this.replayHeadset.root.updateWorldMatrix(true, false);
    return this.replayHeadset.root.getWorldPosition(this.worldHeadPosition);
  }

  headPositionForPose(
    transform: ReplayTransform,
    target: Vector3,
    noodle?: { root: NoodleTransform; head: NoodleTransform },
    leftHanded = false,
  ) {
    this.posePlayerRoot.position.set(0, 0, 0);
    this.posePlayerRoot.quaternion.identity();
    this.posePlayerRoot.scale.set(1, 1, 1);
    this.poseHeadTrack.position.set(0, 0, 0);
    this.poseHeadTrack.quaternion.identity();
    this.poseHeadTrack.scale.set(1, 1, 1);
    this.poseHead.position.set(transform.position.x, transform.position.y, -transform.position.z);
    this.poseHead.quaternion.set(
      -transform.rotation.x,
      -transform.rotation.y,
      transform.rotation.z,
      transform.rotation.w,
    );
    this.poseHead.scale.set(1, 1, 1);
    if (noodle !== undefined) {
      this.noodlePlayerTransform.apply(this.posePlayerRoot, noodle.root, leftHanded);
      this.noodlePlayerTransform.apply(this.poseHeadTrack, noodle.head, leftHanded);
    }
    this.poseHead.updateWorldMatrix(true, false);
    return this.poseHead.getWorldPosition(target);
  }

  get trackedHeadZ() {
    return this.replayHeadset.root.position.z;
  }

  get hasReplay() {
    return this.replay !== null;
  }

  get cameraMode() {
    return this.cameraController.cameraMode;
  }

  get hasPoses() {
    return this.replay !== null && this.replay.poses.length > 0;
  }

  get poseFrames() {
    return this.replay?.poses ?? [];
  }

  loadHeadset() {
    return this.replayHeadset.load();
  }

  setLightshowMode(mode: LightshowMode) {
    this.lightshowMode = mode;
    const forced = isForcedLightshowMode(mode);
    this.root.visible = !forced && this.hasPoses;
    this.gameplayHud.setEnabled(!forced);
    if (forced) {
      this.clearTrails();
    }
    this.cameraController.setForced(forced, this.hasReplay);
    this.replayHeadset.root.visible = this.cameraController.cameraMode !== 'first-person';
  }

  setReplay(replay: Replay | null, hitScoreVisualizer?: HitScoreVisualizerConfig | null) {
    this.replay = replay;
    this.hasSampledReplayPose = false;
    this.gameplayHud.setReplay(replay, hitScoreVisualizer);
    this.gameplayHud.setEnabled(!isForcedLightshowMode(this.lightshowMode));
    this.clearTrails();
    this.cameraController.reset();
    this.root.visible = !isForcedLightshowMode(this.lightshowMode) && this.hasPoses;
    this.applySaberOffsets();
    this.cameraController.setReplayPresence(this.hasReplay);
    this.replayHeadset.root.visible = this.cameraController.cameraMode !== 'first-person';
  }

  setHitScoreVisualizer(hitScoreVisualizer: HitScoreVisualizerConfig | null) {
    this.gameplayHud.setHitScoreVisualizer(hitScoreVisualizer);
  }

  setMapHasNotes(hasMapNotes: boolean) {
    this.cameraController.setMapHasNotes(hasMapNotes);
  }

  setCameraMode(mode: ReplayCameraMode) {
    this.cameraController.setMode(mode);
    this.replayHeadset.root.visible = mode !== 'first-person';
  }

  refreshTimeline() {
    this.gameplayHud.refreshTimeline();
    this.root.visible = !isForcedLightshowMode(this.lightshowMode) && this.hasPoses;
  }

  setSongDuration(duration: number | null) {
    this.gameplayHud.setSongDuration(duration);
  }

  setCameraSettings(settings: ReplayCameraSettings) {
    this.cameraController.setSettings(settings, isForcedLightshowMode(this.lightshowMode), this.hasReplay);
    this.replayHeadset.root.visible = this.cameraController.cameraMode !== 'first-person';
  }

  setSaberSettings(settings: ReplaySaberSettings) {
    this.clearTrails();
    this.saberSettings = { ...settings };
    for (const saber of this.replaySabers) setReplaySaberSettings(saber, settings);
    for (const trail of this.replayTrails) setReplaySaberTrailSettings(trail, settings);
    this.applySaberOffsets();
  }

  setNoodleTrailLocalSpace(enabled: boolean) {
    if (enabled === this.localSpaceSaberTrail) return;
    this.localSpaceSaberTrail = enabled;
    this.clearTrails();
    for (const trail of this.replayTrails) {
      (enabled ? this.replayPlayerRoot : this.root).add(trail.mesh);
    }
  }

  setCameraAspect(aspect: number) {
    this.cameraController.setAspect(aspect);
  }

  setColors(colors: ColorScheme) {
    [colors.leftNote, colors.rightNote].forEach((color, index) => {
      const materials = this.replaySaberColorMaterials[index];
      const bladeColor = shaderUniformValue(materials?.blade, '_Color');
      bladeColor?.setRGB(...color).convertSRGBToLinear();
      const shellCoreColor = shaderUniformValue(materials?.blade, '_CoreColor');
      shellCoreColor?.setRGB(...saberCoreColor(color)).convertSRGBToLinear();
      const coreColor = shaderUniformValue(materials?.core, '_Color');
      coreColor?.setRGB(...saberCoreColor(color)).convertSRGBToLinear();
      const trail = this.replayTrails[index];
      const trailColor = shaderUniformValue(trail?.material, '_Color');
      trailColor?.setRGB(...color).convertSRGBToLinear();
    });
  }

  baseProvider(name: string, time: number): readonly number[] | undefined {
    const replay = this.replay;
    const pose = replay === null ? null : sampleReplayFrames(replay.poses, time);
    const transformName = /^(baseHead|baseLeftHand|baseRightHand)(Local)?(Position|Rotation|Scale)$/.exec(name);
    if (transformName !== null) {
      const target = transformName[1];
      const local = transformName[2] !== undefined;
      const property = transformName[3];
      if (property === 'Scale' && !local) return undefined;
      const object =
        target === 'baseHead'
          ? this.replayHeadset.root
          : target === 'baseLeftHand'
            ? this.replayLeftHand
            : this.replayRightHand;
      if (this.hasSampledReplayPose) {
        if (property === 'Scale') return object.scale.toArray();
        if (property === 'Position') {
          if (local) this.position.copy(object.position);
          else object.getWorldPosition(this.position);
          return [this.position.x, this.position.y, -this.position.z];
        }
        if (local) this.replayQuaternion.copy(object.quaternion);
        else object.getWorldQuaternion(this.replayQuaternion);
        return eulerFromQuaternion([
          -this.replayQuaternion.x,
          -this.replayQuaternion.y,
          this.replayQuaternion.z,
          this.replayQuaternion.w,
        ]);
      }
      if (property === 'Scale') return [1, 1, 1];
      if (pose === null) return property === 'Position' && target === 'baseHead' ? [0, 1.7, 0] : [0, 0, 0];
      const from =
        target === 'baseHead' ? pose.from.head : target === 'baseLeftHand' ? pose.from.leftHand : pose.from.rightHand;
      const to =
        target === 'baseHead' ? pose.to.head : target === 'baseLeftHand' ? pose.to.leftHand : pose.to.rightHand;
      if (property === 'Position') {
        return [
          from.position.x + (to.position.x - from.position.x) * pose.amount,
          from.position.y + (to.position.y - from.position.y) * pose.amount,
          from.position.z + (to.position.z - from.position.z) * pose.amount,
        ];
      }
      this.replayQuaternion
        .set(from.rotation.x, from.rotation.y, from.rotation.z, from.rotation.w)
        .slerp(this.worldQuaternion.set(to.rotation.x, to.rotation.y, to.rotation.z, to.rotation.w), pose.amount);
      return eulerFromQuaternion([
        this.replayQuaternion.x,
        this.replayQuaternion.y,
        this.replayQuaternion.z,
        this.replayQuaternion.w,
      ]);
    }
    if (replay === null) {
      if (name === 'baseMultiplier') return [1];
      if (name === 'baseEnergy') return [0.5];
      return name.startsWith('base') ? [0] : undefined;
    }
    const score = latestAt(replay.scores, time);
    if (name === 'baseCombo') return [latestAt(replay.combos, time)?.combo ?? 0];
    if (name === 'baseMultiplier') return [latestAt(replay.multipliers, time)?.multiplier ?? 1];
    if (name === 'baseEnergy') return [latestAt(replay.energies, time)?.energy ?? 0.5];
    if (name === 'baseMultipliedScore' || name === 'baseModifiedScore') return [score?.score ?? 0];
    if (name === 'baseImmediateMaxPossibleMultipliedScore' || name === 'baseImmediateMaxPossibleModifiedScore') {
      return [score?.immediateMaxPossibleScore ?? 0];
    }
    if (name === 'baseRelativeScore') {
      const maximum = score?.immediateMaxPossibleScore ?? 0;
      return [maximum === 0 ? 0 : (score?.score ?? 0) / maximum];
    }
    return undefined;
  }

  update(
    time: number,
    noodle?: { root: NoodleTransform; head: NoodleTransform; leftHand: NoodleTransform; rightHand: NoodleTransform },
    leftHanded = false,
  ) {
    if (this.replay === null) return;
    this.gameplayHud.update(time);
    const sample = sampleReplayFrames(this.replay.poses, time);
    if (sample === null) return;
    this.replayPlayerRoot.position.set(0, 0, 0);
    this.replayPlayerRoot.quaternion.identity();
    this.replayPlayerRoot.scale.set(1, 1, 1);
    for (const target of [this.replayHeadTrack, this.replayLeftHandTrack, this.replayRightHandTrack]) {
      target.position.set(0, 0, 0);
      target.quaternion.identity();
      target.scale.set(1, 1, 1);
    }
    this.sampleTransform(this.replayHeadset.root, sample.from.head, sample.to.head, sample.amount);
    this.sampleTransform(this.replayLeftHand, sample.from.leftHand, sample.to.leftHand, sample.amount);
    this.sampleTransform(this.replayRightHand, sample.from.rightHand, sample.to.rightHand, sample.amount);
    if (noodle !== undefined) {
      this.noodlePlayerTransform.apply(this.replayPlayerRoot, noodle.root, leftHanded);
      this.noodlePlayerTransform.apply(this.replayHeadTrack, noodle.head, leftHanded);
      this.noodlePlayerTransform.apply(this.replayLeftHandTrack, noodle.leftHand, leftHanded);
      this.noodlePlayerTransform.apply(this.replayRightHandTrack, noodle.rightHand, leftHanded);
    }
    this.hasSampledReplayPose = true;
    this.updateTrails(time);
    this.cameraController.update(this.replayHeadset.root, time);
  }

  private applyTransform(target: Object3D, transform: ReplayTransform) {
    target.position.set(transform.position.x, transform.position.y, -transform.position.z);
    target.quaternion.set(-transform.rotation.x, -transform.rotation.y, transform.rotation.z, transform.rotation.w);
    target.scale.set(1, 1, 1);
  }

  private sampleTransform(target: Object3D, from: ReplayTransform, to: ReplayTransform, amount: number) {
    this.applyTransform(target, from);
    this.replayPosition.set(to.position.x, to.position.y, -to.position.z);
    target.position.lerp(this.replayPosition, amount);
    this.replayQuaternion.set(-to.rotation.x, -to.rotation.y, to.rotation.z, to.rotation.w);
    const sign = target.quaternion.dot(this.replayQuaternion) < 0 ? -1 : 1;
    target.quaternion
      .set(
        target.quaternion.x + (this.replayQuaternion.x * sign - target.quaternion.x) * amount,
        target.quaternion.y + (this.replayQuaternion.y * sign - target.quaternion.y) * amount,
        target.quaternion.z + (this.replayQuaternion.z * sign - target.quaternion.z) * amount,
        target.quaternion.w + (this.replayQuaternion.w * sign - target.quaternion.w) * amount,
      )
      .normalize();
  }

  private clearTrails() {
    this.replayTrailTime = Number.NEGATIVE_INFINITY;
    for (const trail of this.replayTrails) clearReplaySaberTrail(trail);
  }

  private applySaberOffsets() {
    const settings = this.saberSettings;
    for (const offset of [this.replayLeftOffset, this.replayRightOffset]) {
      offset.position.set(settings.saberXOffset, settings.saberYOffset, settings.saberZOffset);
      offset.rotation.set(
        (settings.saberXRotation * Math.PI) / 180,
        (settings.saberYRotation * Math.PI) / 180,
        (settings.saberZRotation * Math.PI) / 180,
      );
    }
  }

  private updateTrails(time: number) {
    if (time < this.replayTrailTime || time - this.replayTrailTime > 0.25) this.clearTrails();
    if (time === this.replayTrailTime) return;
    this.root.updateMatrixWorld(true);
    for (let index = 0; index < 2; index++) {
      const base = index === 0 ? this.replayLeftTrailBase : this.replayRightTrailBase;
      const tip = index === 0 ? this.replayLeftTip : this.replayRightTip;
      const trail = this.replayTrails[index];
      if (trail === undefined) continue;
      base.getWorldPosition(this.position);
      tip.getWorldPosition(this.replayPosition);
      if (this.localSpaceSaberTrail) {
        this.replayPlayerRoot.worldToLocal(this.position);
        this.replayPlayerRoot.worldToLocal(this.replayPosition);
      }
      updateReplaySaberTrail(trail, this.position, this.replayPosition);
    }
    this.replayTrailTime = time;
  }

  dispose() {
    this.replayHeadset.dispose();
    this.gameplayHud.dispose();
    for (const geometry of this.replayGeometries) geometry.dispose();
    for (const material of this.replayMaterials) material.dispose();
  }
}

function latestAt<T extends { time: number }>(events: readonly T[], time: number) {
  let low = 0;
  let high = events.length;
  while (low < high) {
    const middle = (low + high) >>> 1;
    if ((events[middle]?.time ?? Number.POSITIVE_INFINITY) <= time) low = middle + 1;
    else high = middle;
  }
  return events[low - 1];
}
