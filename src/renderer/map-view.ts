import { Result } from 'better-result';
import { BufferAttribute, BufferGeometry, Group, Mesh, PerspectiveCamera, Scene, type WebGLRenderer } from 'three';

import { songBpmTimeToSeconds } from '../core/beatmap/bpm';
import type { InfoColorScheme } from '../core/beatmap/info';
import { DEFAULT_COLORS, resolveColorScheme } from '../core/colors';
import { isForcedLightshowMode, type LightshowMode } from '../core/lighting/basic-light';
import { applyReplayNoteEvents, type MapRenderData } from '../core/placement/map-render-data';
import type { Replay, ReplayNoteEvent } from '../core/replay/types';
import {
  DEFAULT_REPLAY_CAMERA_SETTINGS,
  type ReplayCameraSettings,
  type ReplaySaberSettings,
} from '../core/viewer-settings';
import { BloomfogPipeline } from './bloomfog/pipeline';
import { fixedCameraPosition } from './camera';
import {
  EnvironmentLoadAborted,
  environmentLoadFailure,
  type EnvironmentLoadFailure,
} from './environment/environment-error';
import { loadEnvironment } from './environment/environment-loader';
import type { LoadedEnvironment } from './environment/environment-runtime';
import { EnvironmentLightRuntime } from './map/environment-light-runtime';
import { MapObjectRenderer } from './map/map-object-renderer';
import { createMirrorMaterial, createSkyboxMaterial } from './materials/scene-materials';
import { MAIN_ONLY_LAYER, PlanarMirror, SCREEN_DISPLACEMENT_LAYER } from './mirror/planar-mirror';
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
  private readonly camera = new PerspectiveCamera(DEFAULT_REPLAY_CAMERA_SETTINGS.replayCameraFov, 1, 0.1, 500);
  private readonly mapRoot = new Group();

  private readonly pipeline: BloomfogPipeline;
  private readonly postBloom: PostBloomPipeline;
  private readonly mirror: PlanarMirror;
  private readonly skybox: Mesh;
  private readonly replayView: ReplayView;
  private readonly mapObjects: MapObjectRenderer;
  private readonly environmentLights = new EnvironmentLightRuntime();
  private environment: LoadedEnvironment | null = null;
  private environmentUsesMirror = false;
  private environmentRequest: {
    id: string;
    controller: AbortController;
    result: Promise<Result<void, EnvironmentLoadFailure>>;
  } | null = null;

  private lightshowMode: LightshowMode = 'full';

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
    this.scene.matrixWorldAutoUpdate = false;
    this.camera.layers.enable(MAIN_ONLY_LAYER);
    this.camera.layers.enable(SCREEN_DISPLACEMENT_LAYER);
    this.scene.add(this.camera);

    const fog = this.pipeline.fogUniforms;
    this.mapObjects = new MapObjectRenderer(this.mapRoot, fog, this.postBloom.screenDisplacementTexture);

    this.skybox = new Mesh(fullscreenTriangle(), createSkyboxMaterial(fog));
    this.skybox.frustumCulled = false;
    this.skybox.renderOrder = -1000;
    this.skybox.layers.set(MAIN_ONLY_LAYER);
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

  setEnvironment(id: string): Promise<Result<void, EnvironmentLoadFailure>> {
    if (this.environment?.data.id === id) {
      this.environmentRequest?.controller.abort();
      this.environmentRequest = null;
      return Promise.resolve(Result.ok(undefined));
    }
    if (this.environmentRequest?.id === id) return this.environmentRequest.result;
    this.environmentRequest?.controller.abort();
    const controller = new AbortController();
    const result = this.loadAndApplyEnvironment(id, controller);
    this.environmentRequest = { id, controller, result };
    return result;
  }

  private async loadAndApplyEnvironment(
    id: string,
    controller: AbortController,
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
    this.environmentUsesMirror = environment.data.objects.some((object) =>
      object.materials?.some((name) => name !== null && environment.data.materials[name]?.family === 'mirror'),
    );
    this.scene.add(environment.root);
    this.environmentLights.setEnvironment(environment);
    this.mirror.updateMaterials(this.scene);
    this.pipeline.setFogParams(environment.data.fogParams);
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

  setReplay(replay: Replay | null) {
    this.replayView.setReplay(replay);
    this.mapObjects.invalidate();
  }

  setSongDuration(duration: number | null) {
    this.replayView.setSongDuration(duration);
  }

  appendReplayNoteEvents(events: ReplayNoteEvent[]) {
    if (this.data !== null && events.length > 0) {
      applyReplayNoteEvents(this.data, events);
      this.mapObjects.invalidate();
    }
    this.replayView.refreshTimeline();
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

  setMap(data: MapRenderData, override?: InfoColorScheme) {
    this.clearMap();
    this.data = data;
    this.replayView.setMapHasNotes(data.notes.length > 0);

    const colors = this.resolveMapColors(override);
    this.environmentLights.setMap(data, colors);
    this.replayView.setColors(colors);
    this.mapObjects.setMap(data, colors);
    this.mirror.updateMaterials(this.scene);
  }

  refreshMapColors(override?: InfoColorScheme) {
    const data = this.data;
    if (data === null) return;
    const colors = this.resolveMapColors(override);
    this.environmentLights.setColors(colors);
    this.replayView.setColors(colors);
    this.mapObjects.clear();
    this.mapObjects.setMap(data, colors);
    this.mirror.updateMaterials(this.scene);
  }

  private resolveMapColors(override?: InfoColorScheme) {
    return this.environment === null ? DEFAULT_COLORS : resolveColorScheme(this.environment.data.colorScheme, override);
  }

  private clearMap() {
    this.mapObjects.clear();
    this.data = null;
    this.replayView.setMapHasNotes(false);
    this.environmentLights.clearMap();
    this.mirror.updateMaterials(this.scene);
  }

  private update() {
    const data = this.data;
    if (this.environment !== null) this.environmentLights.update(this.beatSource());
    if (data === null) return;
    if (isForcedLightshowMode(this.lightshowMode)) return;
    const now = this.beatSource();
    const replayTime = songBpmTimeToSeconds(now, data.songBpm);
    this.replayView.update(replayTime);
    this.mapObjects.update(now, this.replayView);
  }

  render(renderer: WebGLRenderer) {
    this.update();
    this.scene.updateMatrixWorld();
    if (this.environment?.applyConstraints() === true) this.scene.updateMatrixWorld();
    if (this.environment !== null) this.environmentLights.updateWorldLights(this.beatSource());
    this.pipeline.render(renderer, this.camera, this.environmentLights.lightSegments);
    if (this.environmentUsesMirror) this.mirror.render(renderer, this.scene, this.camera);
    this.postBloom.render(renderer, this.scene, this.camera, this.mapRoot.visible && this.mapObjects.wallsVisible);
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
