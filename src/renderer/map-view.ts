import { Result } from 'better-result';
import { BufferAttribute, BufferGeometry, Group, Mesh, PerspectiveCamera, Scene, type WebGLRenderer } from 'three';

import { HeckBaseProviderRuntime } from '../core/animation/base-provider';
import { songBpmTimeToSeconds } from '../core/beatmap/bpm';
import type { InfoColorScheme } from '../core/beatmap/info';
import type { ChromaEnvironmentData } from '../core/chroma-environment';
import { DEFAULT_COLORS, resolveColorScheme, type ColorScheme, type Rgb } from '../core/colors';
import { isForcedLightshowMode, type LightshowMode } from '../core/lighting/basic-light';
import { sampleNoodlePlayerTrack } from '../core/noodle-runtime';
import { applyReplayHeightEvents, applyReplayNoteEvents, type MapRenderData } from '../core/placement/map-render-data';
import type { HitScoreVisualizerConfig } from '../core/replay/hit-score-visualizer';
import type { Replay, ReplayHeightEvent, ReplayNoteEvent } from '../core/replay/types';
import {
  DEFAULT_REPLAY_CAMERA_SETTINGS,
  type ReplayCameraSettings,
  type ReplaySaberSettings,
} from '../core/viewer-settings';
import { BloomfogPipeline } from './bloomfog/pipeline';
import { fixedCameraPosition, GAMEPLAY_CAMERA_FAR } from './camera';
import {
  EnvironmentLoadAborted,
  environmentLoadFailure,
  type EnvironmentLoadFailure,
} from './environment/environment-error';
import { loadEnvironment } from './environment/environment-loader';
import type { LoadedEnvironment } from './environment/environment-runtime';
import { EnvironmentLightRuntime } from './map/environment-light-runtime';
import { MapObjectRenderer } from './map/map-object-renderer';
import { NoodlePlayerTransform } from './map/noodle-player-transform';
import { createMirrorMaterial, createSkyboxMaterial } from './materials/scene-materials';
import { collectMirrorConsumers, hasVisibleMirrorConsumer } from './mirror/mirror-consumers';
import {
  AFTER_SCREEN_DISPLACEMENT_LAYER,
  MAIN_ONLY_LAYER,
  PlanarMirror,
  SCREEN_DISPLACEMENT_LAYER,
} from './mirror/planar-mirror';
import { PostBloomPipeline } from './post-bloom/pipeline';
import { DEFAULT_QUALITY } from './quality';
import type { RenderView } from './renderer-lifecycle';
import type { ReplayCameraMode } from './replay/replay-camera';
import { ReplayView } from './replay/replay-view';

function fullscreenTriangle() {
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
  return geometry;
}

export class MapView implements RenderView {
  private readonly scene = new Scene();
  private readonly camera = new PerspectiveCamera(
    DEFAULT_REPLAY_CAMERA_SETTINGS.replayCameraFov,
    1,
    0.1,
    GAMEPLAY_CAMERA_FAR,
  );
  private readonly playerCameraRoot = new Group();
  private readonly playerCameraHead = new Group();
  private readonly noodlePlayerTransform = new NoodlePlayerTransform();
  private readonly mapRoot = new Group();
  private readonly baseProviders = new HeckBaseProviderRuntime(
    (name, beat) => this.baseProvider(name, beat),
    (beat) => songBpmTimeToSeconds(beat, this.data?.songBpm ?? 120),
  );

  private readonly pipeline: BloomfogPipeline;
  private readonly postBloom: PostBloomPipeline;
  private readonly mirror: PlanarMirror;
  private readonly skybox: Mesh;
  private readonly replayView: ReplayView;
  private readonly mapObjects: MapObjectRenderer;
  private readonly environmentLights = new EnvironmentLightRuntime();
  private environment: LoadedEnvironment | null = null;
  private environmentMirrorConsumers: Mesh[] = [];
  private environmentRequest: {
    id: string;
    chromaEnvironment?: ChromaEnvironmentData;
    controller: AbortController;
    result: Promise<Result<void, EnvironmentLoadFailure>>;
  } | null = null;

  private lightshowMode: LightshowMode = 'full';
  private colors: ColorScheme = DEFAULT_COLORS;
  private songDuration = 0;

  private data: MapRenderData | null = null;
  private beatSource: () => number = () => 0;

  constructor(
    quality = DEFAULT_QUALITY,
    private readonly onEnvironmentLoadSettled: () => void = () => undefined,
  ) {
    this.pipeline = new BloomfogPipeline();
    this.postBloom = new PostBloomPipeline();
    this.mirror = new PlanarMirror(quality, 6, 400);
    this.camera.position.set(...fixedCameraPosition(DEFAULT_REPLAY_CAMERA_SETTINGS.previewCameraDistance));
    this.scene.matrixAutoUpdate = false;
    this.scene.matrixWorldAutoUpdate = false;
    this.camera.layers.enable(MAIN_ONLY_LAYER);
    this.camera.layers.enable(SCREEN_DISPLACEMENT_LAYER);
    this.camera.layers.enable(AFTER_SCREEN_DISPLACEMENT_LAYER);
    this.playerCameraHead.add(this.camera);
    this.playerCameraRoot.add(this.playerCameraHead);
    this.scene.add(this.playerCameraRoot);

    const fog = this.pipeline.fogUniforms;
    this.mapObjects = new MapObjectRenderer(this.mapRoot, fog, this.postBloom.screenDisplacementTexture, this.camera);

    this.skybox = new Mesh(fullscreenTriangle(), createSkyboxMaterial(fog));
    this.skybox.frustumCulled = false;
    this.skybox.renderOrder = -1000;
    this.scene.add(this.skybox);

    this.mirror.mesh.material = createMirrorMaterial(fog, this.mirror.reflectionTexture);
    this.mirror.mesh.position.set(0, 0, -150);
    this.mirror.mesh.visible = false;
    this.scene.add(this.mirror.mesh);

    this.scene.add(this.mapRoot);
    const directionalLights = this.environmentLights.directionalLights;
    this.replayView = new ReplayView(
      this.camera,
      fog,
      {
        directions: directionalLights.directions,
        colors: directionalLights.colors,
        positions: directionalLights.positions,
        radii: directionalLights.radii,
      },
      () => {
        this.mirror.updateMaterials(this.scene);
      },
    );
    this.replayView.hudRoot.traverse((object) => {
      object.layers.set(MAIN_ONLY_LAYER);
    });
    this.scene.add(this.replayView.hudRoot);
    this.scene.add(this.replayView.root);
    this.mirror.updateMaterials(this.scene);
    void this.replayView.loadHeadset();
  }

  setEnvironment(id: string, chromaEnvironment?: ChromaEnvironmentData): Promise<Result<void, EnvironmentLoadFailure>> {
    if (this.environment?.data.id === id && this.environment.chromaEnvironment === chromaEnvironment) {
      this.environmentRequest?.controller.abort();
      this.environmentRequest = null;
      return Promise.resolve(Result.ok(undefined));
    }
    if (this.environmentRequest?.id === id && this.environmentRequest.chromaEnvironment === chromaEnvironment) {
      return this.environmentRequest.result;
    }
    this.environmentRequest?.controller.abort();
    const controller = new AbortController();
    const result = this.loadAndApplyEnvironment(id, controller, chromaEnvironment);
    this.environmentRequest = { id, chromaEnvironment, controller, result };
    return result;
  }

  private async loadAndApplyEnvironment(
    id: string,
    controller: AbortController,
    chromaEnvironment?: ChromaEnvironmentData,
  ): Promise<Result<void, EnvironmentLoadFailure>> {
    const loadResult = await Result.tryPromise({
      try: () =>
        loadEnvironment(
          id,
          {
            fog: this.pipeline.fogUniforms,
            reflectionTexture: this.mirror.reflectionTexture,
            directionalLights: {
              directions: { value: this.environmentLights.directionalLights.directions },
              colors: { value: this.environmentLights.directionalLights.colors },
              positions: { value: this.environmentLights.directionalLights.positions },
              radii: { value: this.environmentLights.directionalLights.radii },
            },
            songTime: this.environmentLights.songTime,
          },
          controller.signal,
          chromaEnvironment,
        ),
      catch: (cause) => environmentLoadFailure(id, cause),
    });
    if (loadResult.isErr()) {
      if (this.environmentRequest?.controller === controller) {
        this.environmentRequest = null;
        this.onEnvironmentLoadSettled();
      }
      return Result.err(loadResult.error);
    }

    const environment = loadResult.value;
    if (controller.signal.aborted || this.environmentRequest?.controller !== controller) {
      environment.dispose();
      return Result.err(
        new EnvironmentLoadAborted({
          environmentId: id,
          message: `environment ${id} load was cancelled`,
        }),
      );
    }
    if (this.environment !== null) {
      this.scene.remove(this.environment.root);
      this.environment.dispose();
    }
    this.environment = environment;
    this.environmentRequest = null;
    this.environmentMirrorConsumers = collectMirrorConsumers(environment.root);
    this.scene.add(environment.root);
    this.environmentLights.setEnvironment(environment);
    this.mirror.updateMaterials(this.scene);
    this.pipeline.setFogParams(environment.data.fogParams);
    const hasCustomEnvironment =
      chromaEnvironment !== undefined &&
      (Object.keys(chromaEnvironment.materials).length > 0 ||
        chromaEnvironment.enhancements.length > 0 ||
        chromaEnvironment.animations.length > 0 ||
        chromaEnvironment.componentAnimations.length > 0 ||
        chromaEnvironment.fogTrackEvents.length > 0);
    this.pipeline.setBackgroundGradient(hasCustomEnvironment ? environment.backgroundGradient : null);
    this.onEnvironmentLoadSettled();
    return Result.ok(undefined);
  }

  setBeatSource(source: () => number) {
    this.beatSource = source;
  }

  setLightshowMode(mode: LightshowMode) {
    this.lightshowMode = mode;
    this.environmentLights.setLightshowMode(mode);
    const forced = isForcedLightshowMode(mode);
    this.mapRoot.visible = !forced;
    this.replayView.setLightshowMode(mode);
    this.mapObjects.invalidate();
  }

  clear() {
    this.clearMap();
    this.setSongDuration(null);
    this.setReplay(null);
  }

  setReplay(replay: Replay | null, hitScoreVisualizer?: HitScoreVisualizerConfig | null) {
    this.replayView.setReplay(replay, hitScoreVisualizer);
    this.baseProviders.reset();
    this.mapObjects.invalidate();
  }

  setHitScoreVisualizer(hitScoreVisualizer: HitScoreVisualizerConfig | null) {
    this.replayView.setHitScoreVisualizer(hitScoreVisualizer);
  }

  setSongDuration(duration: number | null) {
    this.songDuration = duration ?? 0;
    this.replayView.setSongDuration(duration);
  }

  appendReplayNoteEvents(events: ReplayNoteEvent[]) {
    if (this.data !== null && events.length > 0) {
      applyReplayNoteEvents(this.data, events);
      this.mapObjects.invalidate();
    }
    this.replayView.refreshTimeline();
  }

  appendReplayHeightEvents(events: ReplayHeightEvent[]) {
    if (this.data === null || events.length === 0) return;
    applyReplayHeightEvents(this.data, events);
    this.mapObjects.invalidate();
  }

  setReplayCameraMode(mode: ReplayCameraMode) {
    this.replayView.setCameraMode(mode);
  }

  setReplayCameraSettings(settings: ReplayCameraSettings) {
    this.replayView.setCameraSettings(settings);
  }

  setReplaySaberSettings(settings: ReplaySaberSettings) {
    this.replayView.setSaberSettings(settings);
  }

  setScreenDisplacementEffects(enabled: boolean) {
    this.postBloom.setScreenDisplacementEnabled(enabled);
    this.mapObjects.setScreenDisplacementEffects(enabled);
  }

  setPreviewNotesLookAtPlayer(enabled: boolean) {
    this.mapObjects.setPreviewNotesLookAtPlayer(enabled);
  }

  setPreviewHitNotes(enabled: boolean) {
    this.mapObjects.setPreviewHitNotes(enabled);
  }

  setPreviewHitLine(enabled: boolean) {
    this.mapObjects.setPreviewHitLine(enabled);
  }

  setMap(data: MapRenderData, override?: InfoColorScheme) {
    this.clearMap();
    this.data = data;
    this.replayView.setMapHasNotes(data.notes.length > 0);
    this.replayView.setNoodleTrailLocalSpace(data.noodle.localSpaceSaberTrail);

    const colors = this.resolveMapColors(override);
    this.colors = colors;
    this.baseProviders.reset();
    this.environmentLights.setMap(data, colors);
    this.replayView.setColors(colors);
    this.mapObjects.setMap(data, colors);
    this.mirror.updateMaterials(this.scene);
  }

  refreshMapColors(override?: InfoColorScheme) {
    if (this.data === null) return;
    const colors = this.resolveMapColors(override);
    this.colors = colors;
    this.baseProviders.reset();
    this.environmentLights.setColors(colors);
    this.replayView.setColors(colors);
    this.mapObjects.setColors(colors);
  }

  private resolveMapColors(override?: InfoColorScheme) {
    return this.environment === null ? DEFAULT_COLORS : resolveColorScheme(this.environment.data.colorScheme, override);
  }

  private clearMap() {
    this.mapObjects.clear();
    this.data = null;
    this.replayView.setMapHasNotes(false);
    this.replayView.setNoodleTrailLocalSpace(false);
    this.environmentLights.clearMap();
    this.mirror.updateMaterials(this.scene);
  }

  private baseProvider(name: string, beat: number): readonly number[] | undefined {
    const data = this.data;
    const color = (value: Rgb) => [value[0], value[1], value[2], 1] as const;
    const colors = this.colors;
    if (name === 'baseNote0Color') return color(data?.leftHanded === true ? colors.rightNote : colors.leftNote);
    if (name === 'baseNote1Color') return color(data?.leftHanded === true ? colors.leftNote : colors.rightNote);
    if (name === 'baseObstaclesColor') return color(colors.obstacle);
    if (name === 'baseSaberAColor') return color(colors.leftNote);
    if (name === 'baseSaberBColor') return color(colors.rightNote);
    if (name === 'baseEnvironmentColor0') return color(colors.environmentLeft);
    if (name === 'baseEnvironmentColor1') return color(colors.environmentRight);
    if (name === 'baseEnvironmentColorW') return color(colors.environmentWhite);
    if (name === 'baseEnvironmentColor0Boost') return color(colors.environmentLeftBoost);
    if (name === 'baseEnvironmentColor1Boost') return color(colors.environmentRightBoost);
    if (name === 'baseEnvironmentColorWBoost') return color(colors.environmentWhiteBoost);
    const seconds = songBpmTimeToSeconds(beat, data?.songBpm ?? 120);
    if (name === 'baseSongTime') return [seconds];
    if (name === 'baseSongLength') return [this.songDuration];
    if (name === 'basePlayerHeight') return [this.playerHeightAt(seconds)];
    if (data !== null) {
      const movement = data.movementStateAt?.(beat);
      if (name === 'baseNoteJumpMovementSpeed') return [movement?.noteJumpSpeed ?? data.noteJumpSpeed ?? 0];
      if (name === 'baseNoteJumpStartBeatOffset') return [data.noteStartBeatOffset ?? 0];
      if (name === 'baseJumpDistance') return [movement?.jumpDistance ?? 0];
    }
    return this.replayView.baseProvider(name, seconds);
  }

  private playerHeightAt(time: number) {
    const data = this.data;
    if (data === null) return 1.8;
    let low = 0;
    let high = data.replayHeights.length;
    while (low < high) {
      const middle = (low + high) >>> 1;
      if ((data.replayHeights[middle]?.time ?? Number.POSITIVE_INFINITY) <= time) low = middle + 1;
      else high = middle;
    }
    return data.replayHeights[low - 1]?.height ?? data.initialPlayerHeight;
  }

  private update(now: number) {
    const data = this.data;
    if (this.environment !== null) {
      const fog = this.environmentLights.update(now, this.baseProviders);
      if (fog !== undefined) this.pipeline.setFogParams(fog);
    }
    if (data === null) return;
    if (isForcedLightshowMode(this.lightshowMode)) return;
    const replayTime = songBpmTimeToSeconds(now, data.songBpm);
    this.playerCameraRoot.position.set(0, 0, 0);
    this.playerCameraRoot.quaternion.identity();
    this.playerCameraRoot.scale.set(1, 1, 1);
    this.playerCameraHead.position.set(0, 0, 0);
    this.playerCameraHead.quaternion.identity();
    this.playerCameraHead.scale.set(1, 1, 1);
    const rootTrack = sampleNoodlePlayerTrack(data.noodle, 'Root', now, this.baseProviders, data.leftHanded);
    const headTrack = sampleNoodlePlayerTrack(data.noodle, 'Head', now, this.baseProviders, data.leftHanded);
    if (!this.replayView.hasReplay || this.replayView.cameraMode === 'static') {
      this.noodlePlayerTransform.apply(this.playerCameraRoot, rootTrack, data.leftHanded);
      this.noodlePlayerTransform.apply(this.playerCameraHead, headTrack, data.leftHanded);
    }
    this.replayView.update(
      replayTime,
      this.replayView.hasReplay
        ? {
            root: rootTrack,
            head: headTrack,
            leftHand: sampleNoodlePlayerTrack(data.noodle, 'LeftHand', now, this.baseProviders, data.leftHanded),
            rightHand: sampleNoodlePlayerTrack(data.noodle, 'RightHand', now, this.baseProviders, data.leftHanded),
          }
        : undefined,
      data.leftHanded,
    );
    this.mapObjects.update(now, this.replayView, this.baseProviders);
  }

  render(renderer: WebGLRenderer) {
    const now = this.environment === null && this.data === null ? 0 : this.beatSource();
    this.update(now);
    this.scene.updateMatrixWorld();
    if (this.environment?.applyConstraints() === true) this.scene.updateMatrixWorld();
    this.environment?.syncInstancedMeshes();
    if (this.environment !== null) this.environmentLights.updateWorldLights(now);
    if (hasVisibleMirrorConsumer(this.environmentMirrorConsumers, this.camera)) {
      this.mirror.render(renderer, this.scene, this.camera, (mirrorRenderer, mirrorCamera) => {
        this.pipeline.render(mirrorRenderer, mirrorCamera, this.environmentLights.lightSegments);
      });
    }
    this.pipeline.render(renderer, this.camera, this.environmentLights.lightSegments);
    this.postBloom.render(renderer, this.scene, this.camera, this.mapRoot.visible && this.mapObjects.wallsVisible);
  }

  contextRestored() {
    this.pipeline.invalidate();
  }

  setSize(width: number, height: number) {
    this.replayView.setCameraAspect(width / Math.max(height, 1));
    this.postBloom.setSize(width, height);
  }

  dispose() {
    this.environmentRequest?.controller.abort();
    this.environmentRequest = null;
    if (this.environment !== null) {
      this.scene.remove(this.environment.root);
      this.environment.dispose();
    }
    this.mapObjects.dispose();
    this.replayView.dispose();
    for (const object of [this.skybox, this.mirror.mesh]) {
      if (!Array.isArray(object.material)) object.material.dispose();
    }
    this.skybox.geometry.dispose();
    this.mirror.dispose();
    this.pipeline.dispose();
    this.postBloom.dispose();
  }
}
