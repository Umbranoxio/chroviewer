import { Group, Object3D, PerspectiveCamera, Quaternion, ShaderMaterial, Vector3, type BufferGeometry } from 'three';

import { DEFAULT_COLORS, type ColorScheme, type Rgb } from '../../core/colors';
import { isForcedLightshowMode, type LightshowMode } from '../../core/lighting/basic-light';
import { sampleReplayFrames } from '../../core/replay/sampling';
import type { Replay, ReplayTransform } from '../../core/replay/types';
import {
  DEFAULT_REPLAY_TRAIL_SETTINGS,
  type ReplayCameraSettings,
  type ReplayTrailSettings,
} from '../../core/viewer-settings';
import type { FogUniforms } from '../bloomfog/pipeline';
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
  setReplaySaberTrailSettings,
  updateReplaySaberTrail,
  type ReplaySaberTrail,
} from './saber';

function saberCoreColor([red, green, blue]: Rgb): Rgb {
  return [0.55 + red * 0.45, 0.55 + green * 0.45, 0.55 + blue * 0.45];
}

export class ReplayView {
  readonly root = new Group();

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
  private readonly position = new Vector3();
  private readonly replayGeometries: BufferGeometry[] = [];
  private readonly replayMaterials: ShaderMaterial[] = [];
  private readonly replayTrails: ReplaySaberTrail[] = [];
  private readonly replaySaberColorMaterials: { blade: ShaderMaterial; core: ShaderMaterial }[] = [];
  private replayTrailTime = Number.NEGATIVE_INFINITY;
  private replayTrailLength = DEFAULT_REPLAY_TRAIL_SETTINGS.replayTrailLength;
  private replay: Replay | null = null;
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
      saber.root.add(trailBase, tip);
      offset.add(saber.root);
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
    this.root.add(this.replayHeadset.root, this.replayLeftHand, this.replayRightHand);
    this.root.visible = false;
  }

  get hudRoot() {
    return this.gameplayHud.root;
  }

  get headPosition() {
    return this.replayHeadset.root.position;
  }

  get hasReplay() {
    return this.replay !== null;
  }

  get hasPoses() {
    return this.replay !== null && this.replay.poses.length > 0;
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

  setReplay(replay: Replay | null) {
    this.replay = replay;
    this.gameplayHud.setReplay(replay);
    this.gameplayHud.setEnabled(!isForcedLightshowMode(this.lightshowMode));
    this.clearTrails();
    this.cameraController.reset();
    this.root.visible = !isForcedLightshowMode(this.lightshowMode) && this.hasPoses;
    this.replayLeftOffset.position.set(0, 0, 0);
    this.replayLeftOffset.quaternion.identity();
    this.replayRightOffset.position.set(0, 0, 0);
    this.replayRightOffset.quaternion.identity();
    this.cameraController.setReplayPresence(this.hasReplay);
    this.replayHeadset.root.visible = this.cameraController.cameraMode !== 'first-person';
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

  setTrailSettings(settings: ReplayTrailSettings) {
    if (settings.replayTrailLength !== this.replayTrailLength) this.clearTrails();
    this.replayTrailLength = settings.replayTrailLength;
    this.replayLeftTrailBase.position.z = this.replayLeftTip.position.z + settings.replayTrailLength;
    this.replayRightTrailBase.position.z = this.replayRightTip.position.z + settings.replayTrailLength;
    for (const trail of this.replayTrails) setReplaySaberTrailSettings(trail, settings);
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

  update(time: number) {
    if (this.replay === null) return;
    this.gameplayHud.update(time);
    const sample = sampleReplayFrames(this.replay.poses, time);
    if (sample === null) return;
    this.sampleTransform(this.replayHeadset.root, sample.from.head, sample.to.head, sample.amount);
    this.sampleTransform(this.replayLeftHand, sample.from.leftHand, sample.to.leftHand, sample.amount);
    this.sampleTransform(this.replayRightHand, sample.from.rightHand, sample.to.rightHand, sample.amount);
    this.updateTrails(time);
    this.cameraController.update(this.replayHeadset.root, time);
  }

  private applyTransform(target: Object3D, transform: ReplayTransform) {
    target.position.set(transform.position.x, transform.position.y, -transform.position.z);
    target.quaternion.set(-transform.rotation.x, -transform.rotation.y, transform.rotation.z, transform.rotation.w);
  }

  private sampleTransform(target: Object3D, from: ReplayTransform, to: ReplayTransform, amount: number) {
    this.applyTransform(target, from);
    this.replayPosition.set(to.position.x, to.position.y, -to.position.z);
    target.position.lerp(this.replayPosition, amount);
    this.replayQuaternion.set(-to.rotation.x, -to.rotation.y, to.rotation.z, to.rotation.w);
    target.quaternion.slerp(this.replayQuaternion, amount);
  }

  private clearTrails() {
    this.replayTrailTime = Number.NEGATIVE_INFINITY;
    for (const trail of this.replayTrails) clearReplaySaberTrail(trail);
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
