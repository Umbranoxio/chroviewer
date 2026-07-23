import {
  Matrix4,
  Mesh,
  PlaneGeometry,
  Quaternion,
  RepeatWrapping,
  ShaderMaterial,
  TextureLoader,
  Vector3,
  type BufferGeometry,
  type Camera,
  type Group,
  type Material,
  type Texture,
} from 'three';

import type { PointSampleContext } from '../../core/animation/point-definition';
import { secondsToSongBpmTime, songBpmTimeToSeconds } from '../../core/beatmap/bpm';
import { BOMB_COLOR, type ColorScheme, type Rgb } from '../../core/colors';
import { noodleTrackControlsTime, sampleNoodlePlayerTrack, type NoodleTransform } from '../../core/noodle-runtime';
import { NOTE_Y_OFFSET, Y_OFFSET, Z_OFFSET } from '../../core/placement/grid';
import {
  aheadDistance,
  isVisibleBeforeHit,
  noteJumpAheadDistance,
  spawnFlipProgress,
  spawnFlipYOffset,
  spawnProgress,
  spawnRotationProgress,
  wallAheadDistance,
  wallSpawnScale,
} from '../../core/placement/jump-path';
import type {
  ArcInstance,
  BombInstance,
  ChainLinkInstance,
  MapRenderData,
  NoteInstance,
  WallInstance,
} from '../../core/placement/map-render-data';
import type { ReplayPose } from '../../core/replay/types';
import type { FogUniforms } from '../bloomfog/pipeline';
import {
  createArcMaterial,
  createArrowGlowMaterial,
  createBombMaterial,
  createCircleGlowMaterial,
  createDecorativeArrowGlowMaterial,
  createDecorativeDirectionalMaterial,
  createDirectionalMaterial,
  createHitLineMaterial,
  createLegacySolidObstacleMaterial,
  createNoteMaterial,
  createObstacleDisplacementMaterial,
  createObstacleFakeGlowMaterial,
  createObstacleMaterial,
  createObstacleOutlineMaterial,
} from '../materials/map-object-materials';
import { linearColor, shaderColorUniform, shaderUniformValue } from '../materials/shared';
import { AFTER_SCREEN_DISPLACEMENT_LAYER, SCREEN_DISPLACEMENT_LAYER } from '../mirror/planar-mirror';
import { NoteLookRotation } from '../note-look-rotation';
import { createNoteReflection } from '../note-reflection';
import {
  arcCrossedStripGeometry,
  arrowGeometry,
  arrowGlowGeometry,
  bombGeometry,
  chainLinkGeometry,
  circleGlowGeometry,
  noteBodyGeometry,
  wallCoreGeometry,
  wallFrameGeometry,
} from '../object-geometry';
import type { ReplayView } from '../replay/replay-view';
import { wallTransform } from '../wall-transform';
import { ActiveWindowIndex } from './active-window-index';
import { InstancedGroup } from './instanced-group';
import {
  animatedNoodleColor,
  noodleMovementBeat,
  noodleObjectVisible,
  sampleNoodleRenderObject,
} from './noodle-object-runtime';
import { NoodleObjectTransform } from './noodle-object-transform';

interface ArcEntry {
  mesh: Mesh<BufferGeometry, ShaderMaterial>;
  arc: ArcInstance;
}

interface NoteLookState {
  rotation: Quaternion;
  nextPreviewBeat: number;
  lastSampleTime: number;
  finished: boolean;
  usesReplayPoses: boolean;
}

interface WallCoreEntry {
  matrix: Matrix4;
  color: readonly [number, number, number, number?];
  dissolve: number;
  cutoutSeed: number;
  uvScale: Rgb;
  distance: number;
}

const zAxis = new Vector3(0, 0, 1);
const yAxis = new Vector3(0, 1, 0);
const mapPlayerCenter = new Vector3(0, 1.7, 0);
const degToRad = Math.PI / 180;
const noteModelScale = 1;
const previewRotationFps = 90;
const white: Rgb = [1, 1, 1];
const unitScale: Rgb = [1, 1, 1];

export class MapObjectRenderer {
  private readonly hitLine = new Mesh(new PlaneGeometry(2.5, 0.025), createHitLineMaterial());
  private readonly noteReflection = createNoteReflection();
  private readonly sliderMistNoise = new TextureLoader().load(
    `${import.meta.env.BASE_URL}textures/slider-mist-noise.png`,
  );
  private readonly obstacleDisplacementNoise = new TextureLoader().load(
    `${import.meta.env.BASE_URL}textures/obstacle-displacement-noise.png`,
  );
  private readonly matrix = new Matrix4();
  private readonly wallRootMatrix = new Matrix4();
  private readonly wallGeometryMatrix = new Matrix4();
  private readonly position = new Vector3();
  private readonly wallOffset = new Vector3();
  private readonly spawnPosition = new Vector3();
  private readonly poseHeadPosition = new Vector3();
  private readonly cameraPosition = new Vector3();
  private readonly wallWorldPosition = new Vector3();
  private readonly quaternion = new Quaternion();
  private readonly noteLookRotation = new NoteLookRotation();
  private readonly scale = new Vector3();
  private readonly pose = {
    matrix: this.matrix,
    position: this.position,
    quaternion: this.quaternion,
    scale: this.scale,
  };
  private readonly noodleObjectTransform = new NoodleObjectTransform();
  private readonly wallEdgeScale: [number, number, number] = [1, 1, 1];
  private readonly noteLookStates = new Map<NoteInstance, NoteLookState>();

  private data: MapRenderData | null = null;
  private colors: ColorScheme | null = null;
  private noteBodies: InstancedGroup[] = [];
  private arrows: InstancedGroup[] = [];
  private decorativeArrows: InstancedGroup[] = [];
  private arrowGlows: InstancedGroup[] = [];
  private decorativeArrowGlows: InstancedGroup[] = [];
  private circleGlows: InstancedGroup[] = [];
  private bombs: InstancedGroup | null = null;
  private links: InstancedGroup[] = [];
  private wallCores: InstancedGroup | null = null;
  private legacySolidWallCores: InstancedGroup | null = null;
  private wallFrames: InstancedGroup | null = null;
  private wallFakeGlows: InstancedGroup | null = null;
  private wallCoreLowMaterial: Material | null = null;
  private wallCoreHighMaterial: Material | null = null;
  private wallCoreEntries: WallCoreEntry[] = [];
  private screenDisplacementEffects = true;
  private previewHitNotes = true;
  private previewHitLine = false;
  private previewNotesLookAtPlayer = false;
  private instanceGroups: InstancedGroup[] = [];
  private arcEntries: ArcEntry[] = [];
  private noteReplayWindows: ActiveWindowIndex | null = null;
  private bombWindows: ActiveWindowIndex | null = null;
  private linkReplayWindows: ActiveWindowIndex | null = null;
  private wallWindows: ActiveWindowIndex | null = null;
  private arcWindows: ActiveWindowIndex | null = null;
  private objectBeat = Number.NaN;
  private ownedMaterials: Material[] = [];
  private noteColorMaterials: ShaderMaterial[] = [];
  private obstacleColorMaterials: ShaderMaterial[] = [];

  constructor(
    private readonly root: Group,
    private readonly fog: FogUniforms,
    private readonly screenDisplacementTexture: { value: Texture },
    private readonly camera: Camera,
  ) {
    this.sliderMistNoise.wrapS = RepeatWrapping;
    this.sliderMistNoise.wrapT = RepeatWrapping;
    this.obstacleDisplacementNoise.wrapS = RepeatWrapping;
    this.obstacleDisplacementNoise.wrapT = RepeatWrapping;
    this.hitLine.name = 'preview-hit-line';
    this.hitLine.geometry.rotateX(-Math.PI / 2);
    this.hitLine.position.set(0, 0.01, -Z_OFFSET);
    this.hitLine.visible = false;
    this.root.add(this.hitLine);
  }

  setMap(data: MapRenderData, colors: ColorScheme) {
    this.data = data;
    this.colors = colors;
    const arcColors: Rgb[] = [colors.leftNote, colors.rightNote];
    const noteMaterials = [
      createNoteMaterial(this.fog, colors.leftNote, this.noteReflection),
      createNoteMaterial(this.fog, colors.rightNote, this.noteReflection),
    ];
    const directionalMaterials = [createDirectionalMaterial(this.fog), createDirectionalMaterial(this.fog)];
    const usesDecorativeArrows = data.notes.some((note) => note.noodle !== undefined && !note.interactable);
    const decorativeDirectionalMaterials = usesDecorativeArrows
      ? [createDecorativeDirectionalMaterial(this.fog), createDecorativeDirectionalMaterial(this.fog)]
      : [];
    const arrowGlowMaterials = [createArrowGlowMaterial(this.fog), createArrowGlowMaterial(this.fog)];
    const decorativeArrowGlowMaterials = usesDecorativeArrows
      ? [createDecorativeArrowGlowMaterial(this.fog), createDecorativeArrowGlowMaterial(this.fog)]
      : [];
    const circleGlowMaterials = [createCircleGlowMaterial(this.fog), createCircleGlowMaterial(this.fog)];
    const bombMaterial = createBombMaterial(this.fog, this.noteReflection);
    const wallCoreLowMaterial = createObstacleMaterial(this.fog, colors.obstacle);
    const wallCoreHighMaterial = createObstacleDisplacementMaterial(
      this.fog,
      colors.obstacle,
      this.screenDisplacementTexture,
      this.obstacleDisplacementNoise,
    );
    const legacySolidWallCoreMaterial = data.walls.some((wall) => wall.legacySolidCore === true)
      ? createLegacySolidObstacleMaterial(colors.obstacle)
      : null;
    this.wallCoreLowMaterial = wallCoreLowMaterial;
    this.wallCoreHighMaterial = wallCoreHighMaterial;
    const wallFrameMaterial = createObstacleOutlineMaterial(this.fog, colors.obstacle);
    const wallFakeGlowMaterial = createObstacleFakeGlowMaterial(this.fog, colors.obstacle);
    this.noteColorMaterials = noteMaterials;
    this.obstacleColorMaterials = [
      wallCoreLowMaterial,
      wallCoreHighMaterial,
      ...(legacySolidWallCoreMaterial === null ? [] : [legacySolidWallCoreMaterial]),
      wallFrameMaterial,
      wallFakeGlowMaterial,
    ];
    this.ownedMaterials = [
      ...noteMaterials,
      ...directionalMaterials,
      ...decorativeDirectionalMaterials,
      ...arrowGlowMaterials,
      ...decorativeArrowGlowMaterials,
      ...circleGlowMaterials,
      bombMaterial,
      wallCoreLowMaterial,
      wallCoreHighMaterial,
      ...(legacySolidWallCoreMaterial === null ? [] : [legacySolidWallCoreMaterial]),
      wallFrameMaterial,
      wallFakeGlowMaterial,
    ];

    this.noteBodies = noteMaterials.map(
      (material) => new InstancedGroup(noteBodyGeometry(), material, data.capacity.notes),
    );
    this.arrows = directionalMaterials.map(
      (material) => new InstancedGroup(arrowGeometry(), material, data.capacity.notes),
    );
    this.decorativeArrows = decorativeDirectionalMaterials.map(
      (material) => new InstancedGroup(arrowGeometry(), material, data.capacity.notes),
    );
    this.arrowGlows = arrowGlowMaterials.map(
      (material) => new InstancedGroup(arrowGlowGeometry(), material, data.capacity.notes),
    );
    this.decorativeArrowGlows = decorativeArrowGlowMaterials.map(
      (material) => new InstancedGroup(arrowGlowGeometry(), material, data.capacity.notes),
    );
    this.circleGlows = circleGlowMaterials.map(
      (material) => new InstancedGroup(circleGlowGeometry(), material, data.capacity.notes),
    );
    this.bombs = new InstancedGroup(bombGeometry(), bombMaterial, data.capacity.bombs);
    this.links = noteMaterials.map(
      (material) => new InstancedGroup(chainLinkGeometry(), material, data.capacity.chainLinks),
    );
    this.wallCores = new InstancedGroup(wallCoreGeometry(), wallCoreLowMaterial, data.capacity.walls);
    this.legacySolidWallCores =
      legacySolidWallCoreMaterial === null
        ? null
        : new InstancedGroup(wallCoreGeometry(), legacySolidWallCoreMaterial, data.capacity.walls);
    this.wallFrames = new InstancedGroup(wallFrameGeometry(), wallFrameMaterial, data.capacity.walls, true);
    this.wallFakeGlows = new InstancedGroup(wallFrameGeometry(), wallFakeGlowMaterial, data.capacity.walls, true);
    this.wallCores.mesh.userData.mirrorExcluded = true;
    if (this.legacySolidWallCores !== null) this.legacySolidWallCores.mesh.userData.mirrorExcluded = true;
    this.wallFakeGlows.mesh.userData.mirrorExcluded = true;
    for (const group of [...this.arrowGlows, ...this.decorativeArrowGlows]) {
      group.mesh.layers.set(AFTER_SCREEN_DISPLACEMENT_LAYER);
    }
    this.wallFakeGlows.mesh.layers.set(AFTER_SCREEN_DISPLACEMENT_LAYER);
    this.instanceGroups = [
      ...this.noteBodies,
      ...this.arrows,
      ...this.decorativeArrows,
      ...this.arrowGlows,
      ...this.decorativeArrowGlows,
      ...this.circleGlows,
      this.bombs,
      ...this.links,
      this.wallCores,
      ...(this.legacySolidWallCores === null ? [] : [this.legacySolidWallCores]),
      this.wallFrames,
      this.wallFakeGlows,
    ];
    for (const group of this.instanceGroups) this.root.add(group.mesh);
    this.setScreenDisplacementEffects(this.screenDisplacementEffects);

    this.arcEntries = data.arcs.map((arc) => {
      const color = arcColors[arc.colorIndex] ?? colors.leftNote;
      const material = createArcMaterial(this.fog, arc.customColor ?? color, this.sliderMistNoise, {
        ...arc,
        disableGravity: arc.noodle?.disableGravity,
      });
      this.ownedMaterials.push(material);
      const mesh = new Mesh(arcCrossedStripGeometry(arc.points), material);
      mesh.frustumCulled = false;
      mesh.visible = false;
      this.root.add(mesh);
      return { mesh, arc };
    });
    this.noteReplayWindows = new ActiveWindowIndex(
      data.notes.length,
      (index) => data.notes[index]?.enterBeat ?? Infinity,
      (index) => {
        const note = data.notes[index];
        return noodleTrackControlsTime(note?.noodle, data.noodle) ? Infinity : (note?.despawnBeat ?? -Infinity);
      },
      true,
    );
    this.bombWindows = new ActiveWindowIndex(
      data.bombs.length,
      (index) => data.bombs[index]?.enterBeat ?? Infinity,
      (index) => {
        const bomb = data.bombs[index];
        return noodleTrackControlsTime(bomb?.noodle, data.noodle) ? Infinity : (bomb?.despawnBeat ?? -Infinity);
      },
      true,
    );
    this.linkReplayWindows = new ActiveWindowIndex(
      data.chainLinks.length,
      (index) => data.chainLinks[index]?.enterBeat ?? Infinity,
      (index) => {
        const link = data.chainLinks[index];
        return noodleTrackControlsTime(link?.noodle, data.noodle) ? Infinity : (link?.despawnBeat ?? -Infinity);
      },
      true,
    );
    this.wallWindows = new ActiveWindowIndex(
      data.walls.length,
      (index) => data.walls[index]?.enterBeat ?? Infinity,
      (index) => {
        const wall = data.walls[index];
        return noodleTrackControlsTime(wall?.noodle, data.noodle) ? Infinity : (wall?.despawnBeat ?? -Infinity);
      },
      true,
    );
    this.arcWindows = new ActiveWindowIndex(
      data.arcs.length,
      (index) => data.arcs[index]?.spawnBeat ?? Infinity,
      (index) => {
        const arc = data.arcs[index];
        return noodleTrackControlsTime(arc?.noodle, data.noodle) ? Infinity : (arc?.despawnBeat ?? -Infinity);
      },
      true,
    );
  }

  setColors(colors: ColorScheme) {
    this.colors = colors;
    [colors.leftNote, colors.rightNote].forEach((color, index) => {
      const material = this.noteColorMaterials[index];
      if (material !== undefined)
        shaderColorUniform(material, '_Color')
          ?.setRGB(...color)
          .convertSRGBToLinear();
    });
    for (const material of this.obstacleColorMaterials) {
      shaderColorUniform(material, '_Color')
        ?.setRGB(...colors.obstacle)
        .convertSRGBToLinear();
    }
    const arcColors = [linearColor(colors.leftNote), linearColor(colors.rightNote)];
    for (const { arc, mesh } of this.arcEntries) {
      if (arc.customColor !== undefined) continue;
      const color = arcColors[arc.colorIndex] ?? arcColors[0];
      if (color === undefined) continue;
      shaderUniformValue(mesh.material, '_ArcColor')?.set(color.r, color.g, color.b, 1);
    }
    this.invalidate();
  }

  setScreenDisplacementEffects(enabled: boolean) {
    this.screenDisplacementEffects = enabled;
    if (this.wallCores === null) return;
    const material = enabled ? this.wallCoreHighMaterial : this.wallCoreLowMaterial;
    if (material !== null) this.wallCores.mesh.material = material;
    this.wallCores.mesh.layers.set(enabled ? SCREEN_DISPLACEMENT_LAYER : 0);
  }

  setPreviewNotesLookAtPlayer(enabled: boolean) {
    if (enabled === this.previewNotesLookAtPlayer) return;
    this.previewNotesLookAtPlayer = enabled;
    this.invalidate();
  }

  setPreviewHitNotes(enabled: boolean) {
    if (enabled === this.previewHitNotes) return;
    this.previewHitNotes = enabled;
    this.invalidate();
  }

  setPreviewHitLine(enabled: boolean) {
    if (enabled === this.previewHitLine) return;
    this.previewHitLine = enabled;
    this.invalidate();
  }

  invalidate() {
    this.objectBeat = Number.NaN;
    this.noteLookStates.clear();
  }

  get wallsVisible() {
    return (this.wallCores?.mesh.count ?? 0) > 0 || (this.legacySolidWallCores?.mesh.count ?? 0) > 0;
  }

  update(now: number, replayView: ReplayView, context?: PointSampleContext) {
    const data = this.data;
    const colors = this.colors;
    if (data === null || colors === null) return;
    this.root.position.z = data.tracksPlayerZ && replayView.hasPoses ? replayView.trackedHeadZ : 0;
    if (now === this.objectBeat) return;
    this.objectBeat = now;
    this.root.updateWorldMatrix(true, false);
    this.camera.getWorldPosition(this.cameraPosition);
    const replayTime = songBpmTimeToSeconds(now, data.songBpm);
    for (const group of this.instanceGroups) group.begin();
    const replayLoaded = replayView.hasReplay;
    const hitPreviewNotes = !replayLoaded && this.previewHitNotes;
    this.hitLine.visible = !replayLoaded && this.previewHitLine;
    const poseFrames = replayView.poseFrames;

    const activeNotes = this.noteReplayWindows?.at(now) ?? [];
    for (let colorIndex = 0; colorIndex < 2; colorIndex++) {
      for (const index of activeNotes) {
        const note = data.notes[index];
        if (note?.colorIndex !== colorIndex) continue;
        const duration = note.hjdBeats * 2;
        const noodle = sampleNoodleRenderObject(note, data.noodle, now, duration, context, data.leftHanded);
        const movementBeat = noodleMovementBeat(note, now, noodle, duration);
        const jump = spawnProgress(note, movementBeat);
        const x = note.startX + (note.x - note.startX) * spawnFlipProgress(note, movementBeat);
        const y = note.noodle?.disableGravity
          ? note.y
          : note.startY + (note.y - note.startY) * jump + spawnFlipYOffset(note, movementBeat, note.flipYSide);
        const rotation =
          note.rotationDeg * (note.noodle?.disableLook === true ? 1 : spawnRotationProgress(note, movementBeat));
        const interactable = noodle.interactable === undefined ? note.interactable : noodle.interactable >= 1;
        const visible =
          noodleObjectVisible(note, now, movementBeat, noodle) &&
          (!hitPreviewNotes || !interactable || isVisibleBeforeHit(note, movementBeat));
        if (!visible || (note.replayEndTime !== undefined && replayTime >= note.replayEndTime)) continue;
        const bodyDissolve = noodle.dissolve ?? 1;
        const arrowDissolve = noodle.dissolveArrow ?? 1;
        const noteTime = songBpmTimeToSeconds(note.beat, data.songBpm);
        if (note.lookAtPlayer && !note.noodle?.disableLook && (replayLoaded || this.previewNotesLookAtPlayer)) {
          this.composeLookNoteAt(
            note,
            movementBeat,
            x,
            y,
            noteTime,
            replayTime,
            data,
            poseFrames,
            replayView.headPosition,
            replayView,
            noteModelScale,
            noodle.time !== undefined,
            noodle,
            context,
          );
        } else {
          this.composeAt(note, movementBeat, x, y, rotation, noteModelScale, true);
          const preJumpPosition =
            now < note.spawnBeat && noodle.definitePosition !== undefined
              ? this.spawnPosition.set(note.startX, note.startY, -aheadDistance(note, note.spawnBeat))
              : undefined;
          this.noodleObjectTransform.apply(
            this.pose,
            note.noodle,
            noodle,
            note.x,
            note.y,
            data.leftHanded,
            note.worldRotation,
            preJumpPosition,
            true,
          );
        }
        const color = animatedNoodleColor(
          noodle.color,
          note.customColor ?? (note.colorIndex === 1 ? colors.rightNote : colors.leftNote),
        );
        if (bodyDissolve > 0) this.noteBodies[colorIndex]?.push(this.matrix, color, bodyDissolve, index + 1);
        const faceVisible = noodle.dissolveArrow !== undefined || movementBeat < note.spawnBeat + duration * 0.75;
        if (arrowDissolve > 0 && faceVisible) {
          if (note.dot) {
            this.circleGlows[colorIndex]?.push(this.matrix, color, arrowDissolve, -index - 1);
          } else {
            const decorative = !interactable && noodle.dissolveArrow !== undefined && arrowDissolve > bodyDissolve;
            const arrows = decorative ? this.decorativeArrows : this.arrows;
            const arrowGlows = decorative ? this.decorativeArrowGlows : this.arrowGlows;
            arrows[colorIndex]?.push(this.matrix, white, arrowDissolve, -index - 1);
            arrowGlows[colorIndex]?.push(this.matrix, color, arrowDissolve, -index - 1);
          }
        }
      }
    }

    for (const index of this.bombWindows?.at(now) ?? []) {
      const bomb = data.bombs[index];
      if (bomb === undefined) continue;
      const duration = bomb.hjdBeats * 2;
      const noodle = sampleNoodleRenderObject(bomb, data.noodle, now, duration, context, data.leftHanded);
      const movementBeat = noodleMovementBeat(bomb, now, noodle, duration);
      if (
        !noodleObjectVisible(bomb, now, movementBeat, noodle) ||
        (bomb.replayEndTime !== undefined && replayTime >= bomb.replayEndTime)
      ) {
        continue;
      }
      const y = bomb.noodle?.disableGravity
        ? bomb.y
        : bomb.startY + (bomb.y - bomb.startY) * spawnProgress(bomb, movementBeat);
      if ((noodle.dissolve ?? 1) <= 0) continue;
      this.composeAt(bomb, movementBeat, bomb.x, y, 0, 1, true);
      const preJumpPosition =
        now < bomb.spawnBeat && noodle.definitePosition !== undefined
          ? this.spawnPosition.set(bomb.x, bomb.startY, -aheadDistance(bomb, bomb.spawnBeat))
          : undefined;
      this.noodleObjectTransform.apply(
        this.pose,
        bomb.noodle,
        noodle,
        bomb.x,
        bomb.y,
        data.leftHanded,
        bomb.worldRotation,
        preJumpPosition,
      );
      this.bombs?.push(
        this.matrix,
        animatedNoodleColor(noodle.color, bomb.customColor ?? BOMB_COLOR),
        noodle.dissolve ?? 1,
        index + 1,
      );
    }

    const activeLinks = this.linkReplayWindows?.at(now) ?? [];
    for (let colorIndex = 0; colorIndex < 2; colorIndex++) {
      for (const index of activeLinks) {
        const link = data.chainLinks[index];
        if (link?.colorIndex !== colorIndex) continue;
        const duration = link.hjdBeats * 2;
        const noodle = sampleNoodleRenderObject(link, data.noodle, now, duration, context, data.leftHanded);
        const movementBeat = noodleMovementBeat(link, now, noodle, duration);
        const jump = spawnProgress(link, movementBeat);
        const y = link.noodle?.disableGravity ? link.y : Y_OFFSET + (link.y - Y_OFFSET) * jump;
        const rotation = link.rotationDeg * spawnRotationProgress(link, movementBeat);
        const interactable = noodle.interactable === undefined ? link.interactable : noodle.interactable >= 1;
        const visible =
          noodleObjectVisible(link, now, movementBeat, noodle) &&
          (!hitPreviewNotes || !interactable || isVisibleBeforeHit(link, movementBeat));
        if (!visible || (link.replayEndTime !== undefined && replayTime >= link.replayEndTime)) continue;
        if ((noodle.dissolve ?? 1) <= 0) continue;
        this.composeAt(link, movementBeat, link.x, y, rotation, noteModelScale);
        const preJumpPosition =
          now < link.spawnBeat && noodle.definitePosition !== undefined
            ? this.spawnPosition.set(link.x, Y_OFFSET, -aheadDistance(link, link.spawnBeat))
            : undefined;
        this.noodleObjectTransform.apply(
          this.pose,
          link.noodle,
          noodle,
          link.x,
          link.y,
          data.leftHanded,
          link.worldRotation,
          preJumpPosition,
          true,
        );
        const color = animatedNoodleColor(
          noodle.color,
          link.customColor ?? (link.colorIndex === 1 ? colors.rightNote : colors.leftNote),
        );
        this.links[colorIndex]?.push(this.matrix, color, noodle.dissolve ?? 1, index + 1);
      }
    }

    let wallCoreCount = 0;
    for (const index of this.wallWindows?.at(now) ?? []) {
      const wall = data.walls[index];
      if (wall === undefined) continue;
      const duration = wall.hjdBeats * 2 + (wall.durationBeats ?? wall.pullBeat - wall.beat);
      const noodle = sampleNoodleRenderObject(wall, data.noodle, now, duration, context, data.leftHanded);
      const movementBeat = noodleMovementBeat(wall, now, noodle, duration);
      if (!noodleObjectVisible(wall, now, movementBeat, noodle)) continue;
      const reveal =
        wall.durationBeats !== undefined && wall.durationBeats < 0
          ? 1
          : wallSpawnScale(wall, movementBeat, data.movementStateAt?.(now).halfJumpDurationInBeats);
      if (reveal === 0) continue;
      if ((noodle.dissolve ?? 1) <= 0) continue;
      const transform = wallTransform(wall, wallAheadDistance(wall, wall.pullBeat, movementBeat), reveal);
      this.setWallRootPosition(wall, transform.position, reveal, this.position);
      this.quaternion.setFromAxisAngle(yAxis, transform.yawDeg * degToRad);
      this.noodleObjectTransform.applyWorldRotation(this.pose, wall.worldRotation);
      this.scale.set(1, 1, 1);
      const preJumpPosition =
        now < wall.spawnBeat && noodle.definitePosition !== undefined
          ? this.setWallRootPosition(
              wall,
              wallTransform(wall, wallAheadDistance(wall, wall.pullBeat, wall.spawnBeat), 1).position,
              1,
              this.spawnPosition,
            )
          : undefined;
      this.noodleObjectTransform.apply(
        this.pose,
        wall.noodle,
        noodle,
        wall.x,
        wall.y,
        data.leftHanded,
        wall.worldRotation,
        preJumpPosition,
      );
      let obstacleEdgeScale: Rgb | undefined;
      if (wall.legacyPrefabScaling === true) {
        this.wallEdgeScale[0] = Math.abs(this.scale.x);
        this.wallEdgeScale[1] = Math.abs(this.scale.y);
        this.wallEdgeScale[2] = Math.abs(this.scale.z);
        obstacleEdgeScale = this.wallEdgeScale;
      }
      this.wallRootMatrix.copy(this.matrix);
      this.wallOffset.set(0, (wall.height * reveal) / 2, -Math.abs(wall.lengthUnits) / 2);
      this.quaternion.identity();
      this.scale.fromArray(transform.outlineScale);
      this.wallGeometryMatrix.compose(this.wallOffset, this.quaternion, this.scale);
      this.matrix.copy(this.wallRootMatrix).multiply(this.wallGeometryMatrix);
      const color = noodle.color ?? wall.customColor ?? colors.obstacle;
      if (wall.legacySolidCore === true && noodle.color === undefined) {
        this.legacySolidWallCores?.push(this.matrix, color, noodle.dissolve ?? 1, index + 1);
        continue;
      }
      this.wallFrames?.push(this.matrix, color, noodle.dissolve ?? 1, index + 1, unitScale, obstacleEdgeScale);
      this.scale.set(
        transform.outlineScale[0] + 0.01,
        transform.outlineScale[1] + 0.01,
        transform.outlineScale[2] + 0.01,
      );
      this.wallGeometryMatrix.compose(this.wallOffset, this.quaternion, this.scale);
      this.matrix.copy(this.wallRootMatrix).multiply(this.wallGeometryMatrix);
      this.wallFakeGlows?.push(this.matrix, color, noodle.dissolve ?? 1, index + 1, unitScale, obstacleEdgeScale);
      this.scale.fromArray(transform.coreScale);
      this.wallGeometryMatrix.compose(this.wallOffset, this.quaternion, this.scale);
      this.matrix.copy(this.wallRootMatrix).multiply(this.wallGeometryMatrix);
      let core = this.wallCoreEntries[wallCoreCount];
      if (core === undefined) {
        core = {
          matrix: new Matrix4(),
          color,
          dissolve: 1,
          cutoutSeed: 1,
          uvScale: transform.coreScale,
          distance: 0,
        };
        this.wallCoreEntries.push(core);
      }
      core.matrix.copy(this.matrix);
      core.color = color;
      core.dissolve = noodle.dissolve ?? 1;
      core.cutoutSeed = index + 1;
      core.uvScale = transform.coreScale;
      this.wallWorldPosition.setFromMatrixPosition(this.matrix).applyMatrix4(this.root.matrixWorld);
      core.distance = this.wallWorldPosition.distanceToSquared(this.cameraPosition);
      wallCoreCount++;
    }
    this.wallCoreEntries.length = wallCoreCount;
    this.wallCoreEntries.sort((left, right) => right.distance - left.distance);
    for (const core of this.wallCoreEntries) {
      this.wallCores?.push(core.matrix, core.color, core.dissolve, core.cutoutSeed, core.uvScale);
    }

    for (const index of this.arcWindows?.current ?? []) {
      const entry = this.arcEntries[index];
      if (entry !== undefined) entry.mesh.visible = false;
    }
    for (const index of this.arcWindows?.at(now) ?? []) {
      const entry = this.arcEntries[index];
      if (entry === undefined) continue;
      const arc = entry.arc;
      const duration = arc.hjdBeats * 1.5 + arc.tailBeat - arc.headBeat;
      const noodle = sampleNoodleRenderObject(arc, data.noodle, now, duration, context, data.leftHanded, arc.spawnBeat);
      const movementBeat = noodleMovementBeat(arc, now, noodle, duration);
      entry.mesh.visible = noodleObjectVisible(arc, now, movementBeat, noodle) && (noodle.dissolve ?? 1) > 0;
      if (!entry.mesh.visible) continue;
      const headAhead = Z_OFFSET + (arc.headBeat - movementBeat) * arc.unitsPerBeat;
      this.position.set(0, NOTE_Y_OFFSET, -headAhead);
      this.quaternion.identity();
      this.noodleObjectTransform.applyWorldRotation(this.pose, arc.worldRotation);
      entry.mesh.position.copy(this.position);
      entry.mesh.quaternion.copy(this.quaternion);
      this.scale.set(1, 1, 1);
      entry.mesh.scale.copy(this.scale);
      const preJumpPosition =
        now < arc.spawnBeat && noodle.definitePosition !== undefined
          ? this.spawnPosition.set(0, NOTE_Y_OFFSET, -(Z_OFFSET + (arc.headBeat - arc.spawnBeat) * arc.unitsPerBeat))
          : undefined;
      this.noodleObjectTransform.apply(
        this.pose,
        arc.noodle,
        noodle,
        0,
        0,
        data.leftHanded,
        arc.worldRotation,
        preJumpPosition,
      );
      entry.mesh.position.copy(this.position);
      entry.mesh.quaternion.copy(this.quaternion);
      entry.mesh.scale.copy(this.scale);
      const dissolve = entry.mesh.material.uniforms._NoodleDissolve;
      if (dissolve !== undefined) dissolve.value = noodle.dissolve ?? 1;
      const color = animatedNoodleColor(
        noodle.color,
        arc.customColor ?? (arc.colorIndex === 1 ? colors.rightNote : colors.leftNote),
      );
      const linear = linearColor(color);
      shaderUniformValue(entry.mesh.material, '_ArcColor')?.set(linear.r, linear.g, linear.b, noodle.color?.[3] ?? 1);
      const nowBeat = entry.mesh.material.uniforms._PlaybackBeat;
      const timeSeconds = entry.mesh.material.uniforms._ClockSeconds;
      if (nowBeat !== undefined) nowBeat.value = movementBeat;
      if (timeSeconds !== undefined) timeSeconds.value = (now * 60) / data.songBpm;
    }
    for (const group of this.instanceGroups) group.end();
  }

  clear() {
    for (const group of this.instanceGroups) {
      this.root.remove(group.mesh);
      group.dispose();
    }
    for (const entry of this.arcEntries) {
      this.root.remove(entry.mesh);
      entry.mesh.geometry.dispose();
    }
    for (const material of this.ownedMaterials) material.dispose();
    this.noteBodies = this.arrows = this.decorativeArrows = this.arrowGlows = this.decorativeArrowGlows = [];
    this.circleGlows = this.links = [];
    this.bombs = this.wallCores = this.legacySolidWallCores = this.wallFrames = this.wallFakeGlows = null;
    this.wallCoreLowMaterial = this.wallCoreHighMaterial = null;
    this.wallCoreEntries = [];
    this.instanceGroups = [];
    this.arcEntries = [];
    this.noteReplayWindows = this.bombWindows = null;
    this.linkReplayWindows = null;
    this.wallWindows = this.arcWindows = null;
    this.ownedMaterials = [];
    this.noteColorMaterials = [];
    this.obstacleColorMaterials = [];
    this.noteLookStates.clear();
    this.hitLine.visible = false;
    this.data = null;
    this.colors = null;
    this.objectBeat = Number.NaN;
  }

  dispose() {
    this.clear();
    this.root.remove(this.hitLine);
    this.hitLine.geometry.dispose();
    this.hitLine.material.dispose();
    this.noteReflection.dispose();
    this.sliderMistNoise.dispose();
    this.obstacleDisplacementNoise.dispose();
  }

  private composeAt(
    motion: NoteInstance | BombInstance | ChainLinkInstance,
    now: number,
    x: number,
    y: number,
    rotationDeg: number,
    scale: number,
    terminalRetreat = false,
  ) {
    const distance = terminalRetreat ? noteJumpAheadDistance(motion, now) : aheadDistance(motion, now);
    this.position.set(x, y, -distance);
    this.quaternion.setFromAxisAngle(zAxis, rotationDeg * degToRad);
    this.noodleObjectTransform.applyWorldRotation(this.pose, motion.worldRotation);
    this.scale.setScalar(scale);
    this.matrix.compose(this.position, this.quaternion, this.scale);
  }

  private composeLookNoteAt(
    note: NoteInstance,
    now: number,
    x: number,
    y: number,
    noteTime: number,
    replayTime: number,
    data: MapRenderData,
    poseFrames: readonly ReplayPose[],
    currentHeadPosition: Vector3,
    replayView: ReplayView,
    scale: number,
    timeControlled: boolean,
    noodle: NoodleTransform,
    context?: PointSampleContext,
  ) {
    const state = this.noteLookState(note, poseFrames);
    if (timeControlled) {
      if (replayTime < state.lastSampleTime) this.resetNoteLookState(state, note, poseFrames.length > 0);
    } else if (poseFrames.length > 0) {
      this.advanceReplayNoteLook(state, note, noteTime, replayTime, data, poseFrames, replayView, context);
    } else {
      this.advancePreviewNoteLook(state, note, noteTime, now, data, context);
    }

    this.composeAt(note, now, x, y, 0, scale, true);
    const preJumpPosition =
      now < note.spawnBeat && noodle.definitePosition !== undefined
        ? this.spawnPosition.set(note.startX, note.startY, -aheadDistance(note, note.spawnBeat))
        : undefined;
    this.noodleObjectTransform.apply(
      this.pose,
      note.noodle,
      noodle,
      note.x,
      note.y,
      data.leftHanded,
      note.worldRotation,
      preJumpPosition,
      true,
    );
    const sampleTime = poseFrames.length > 0 ? replayTime : songBpmTimeToSeconds(now, data.songBpm);
    if (Math.abs(sampleTime - state.lastSampleTime) < 1e-6) {
      this.quaternion.copy(state.rotation);
    } else {
      this.noteLookRotation.apply(
        this.quaternion,
        state.rotation,
        this.quaternion,
        note.rotationDeg,
        noteTime,
        note.x,
        this.position,
        note.y,
        poseFrames.length > 0
          ? this.poseHeadPosition.set(
              currentHeadPosition.x,
              currentHeadPosition.y,
              currentHeadPosition.z - this.root.position.z,
            )
          : mapPlayerCenter,
        this.noodleObjectTransform.worldCorrection,
        (now - note.spawnBeat) / (note.hjdBeats * 2),
      );
      if (timeControlled) {
        state.rotation.copy(this.quaternion);
        state.lastSampleTime = replayTime;
      }
    }
    this.noodleObjectTransform.applyChildRotation(this.pose, this.quaternion);
  }

  private noteLookState(note: NoteInstance, poseFrames: readonly ReplayPose[]) {
    let state = this.noteLookStates.get(note);
    const usesReplayPoses = poseFrames.length > 0;
    if (state !== undefined) {
      if (state.usesReplayPoses !== usesReplayPoses) this.resetNoteLookState(state, note, usesReplayPoses);
      return state;
    }
    state = {
      rotation: new Quaternion(),
      nextPreviewBeat: note.spawnBeat,
      lastSampleTime: Number.NEGATIVE_INFINITY,
      finished: false,
      usesReplayPoses,
    };
    this.noteLookStates.set(note, state);
    return state;
  }

  private advanceReplayNoteLook(
    state: NoteLookState,
    note: NoteInstance,
    noteTime: number,
    replayTime: number,
    data: MapRenderData,
    poseFrames: readonly ReplayPose[],
    replayView: ReplayView,
    context?: PointSampleContext,
  ) {
    if (replayTime < state.lastSampleTime) this.resetNoteLookState(state, note, true);
    let poseIndex =
      state.lastSampleTime === Number.NEGATIVE_INFINITY
        ? firstPoseAtOrAfter(poseFrames, songBpmTimeToSeconds(note.spawnBeat, data.songBpm))
        : firstPoseAfter(poseFrames, state.lastSampleTime);
    while (!state.finished) {
      const frame = poseFrames[poseIndex];
      if (frame === undefined || frame.time > replayTime) return;
      if (frame.time >= noteTime) {
        state.finished = true;
        return;
      }
      const beat = secondsToSongBpmTime(frame.time, data.songBpm);
      this.composeLookNoteBaseAt(note, beat, data, context);
      replayView.headPositionForPose(
        frame.head,
        this.poseHeadPosition,
        {
          root: sampleNoodlePlayerTrack(data.noodle, 'Root', beat, context, data.leftHanded),
          head: sampleNoodlePlayerTrack(data.noodle, 'Head', beat, context, data.leftHanded),
        },
        data.leftHanded,
      );
      this.poseHeadPosition.z -= this.root.position.z;
      this.noteLookRotation.apply(
        state.rotation,
        state.rotation,
        this.quaternion,
        note.rotationDeg,
        noteTime,
        note.x,
        this.position,
        note.y,
        this.poseHeadPosition,
        this.noodleObjectTransform.worldCorrection,
        (beat - note.spawnBeat) / (note.hjdBeats * 2),
      );
      state.lastSampleTime = frame.time;
      poseIndex += 1;
    }
  }

  private resetNoteLookState(state: NoteLookState, note: NoteInstance, usesReplayPoses: boolean) {
    state.rotation.identity();
    state.nextPreviewBeat = note.spawnBeat;
    state.lastSampleTime = Number.NEGATIVE_INFINITY;
    state.finished = false;
    state.usesReplayPoses = usesReplayPoses;
  }

  private advancePreviewNoteLook(
    state: NoteLookState,
    note: NoteInstance,
    noteTime: number,
    now: number,
    data: MapRenderData,
    context?: PointSampleContext,
  ) {
    const step = secondsToSongBpmTime(1 / previewRotationFps, data.songBpm);
    while (!state.finished && state.nextPreviewBeat <= now) {
      if (state.nextPreviewBeat >= note.beat) {
        state.finished = true;
        return;
      }
      this.composeLookNoteBaseAt(note, state.nextPreviewBeat, data, context);
      this.noteLookRotation.apply(
        state.rotation,
        state.rotation,
        this.quaternion,
        note.rotationDeg,
        noteTime,
        note.x,
        this.position,
        note.y,
        mapPlayerCenter,
        this.noodleObjectTransform.worldCorrection,
        (state.nextPreviewBeat - note.spawnBeat) / (note.hjdBeats * 2),
      );
      state.lastSampleTime = songBpmTimeToSeconds(state.nextPreviewBeat, data.songBpm);
      state.nextPreviewBeat += step;
    }
  }

  private composeLookNoteBaseAt(note: NoteInstance, now: number, data: MapRenderData, context?: PointSampleContext) {
    const duration = note.hjdBeats * 2;
    const noodle = sampleNoodleRenderObject(note, data.noodle, now, duration, context, data.leftHanded);
    const movementBeat = noodleMovementBeat(note, now, noodle, duration);
    const jump = spawnProgress(note, movementBeat);
    const x = note.startX + (note.x - note.startX) * spawnFlipProgress(note, movementBeat);
    const y = note.noodle?.disableGravity
      ? note.y
      : note.startY + (note.y - note.startY) * jump + spawnFlipYOffset(note, movementBeat, note.flipYSide);
    this.composeAt(note, movementBeat, x, y, 0, noteModelScale, true);
    const preJumpPosition =
      now < note.spawnBeat && noodle.definitePosition !== undefined
        ? this.spawnPosition.set(note.startX, note.startY, -aheadDistance(note, note.spawnBeat))
        : undefined;
    this.noodleObjectTransform.apply(
      this.pose,
      note.noodle,
      noodle,
      note.x,
      note.y,
      data.leftHanded,
      note.worldRotation,
      preJumpPosition,
      true,
    );
  }

  private setWallRootPosition(
    wall: WallInstance,
    center: readonly [number, number, number],
    reveal: number,
    target: Vector3,
  ) {
    this.quaternion.setFromAxisAngle(yAxis, -wall.rotationDeg * degToRad);
    this.wallOffset
      .set(0, (wall.height * reveal) / 2, -Math.abs(wall.lengthUnits) / 2)
      .applyQuaternion(this.quaternion);
    return target.fromArray(center).sub(this.wallOffset);
  }
}

function firstPoseAtOrAfter(frames: readonly ReplayPose[], time: number) {
  let low = 0;
  let high = frames.length;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    const frame = frames[middle];
    if (frame !== undefined && frame.time < time) low = middle + 1;
    else high = middle;
  }
  return low;
}

function firstPoseAfter(frames: readonly ReplayPose[], time: number) {
  let low = 0;
  let high = frames.length;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    const frame = frames[middle];
    if (frame !== undefined && frame.time <= time) low = middle + 1;
    else high = middle;
  }
  return low;
}
