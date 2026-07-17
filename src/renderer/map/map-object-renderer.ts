import {
  Matrix4,
  Mesh,
  Quaternion,
  RepeatWrapping,
  ShaderMaterial,
  TextureLoader,
  Vector3,
  type BufferGeometry,
  type Group,
  type Material,
  type Texture,
} from 'three';

import { secondsToSongBpmTime, songBpmTimeToSeconds } from '../../core/beatmap/bpm';
import type { ColorScheme, Rgb } from '../../core/colors';
import { NOTE_Y_OFFSET, Y_OFFSET, Z_OFFSET } from '../../core/placement/grid';
import {
  aheadDistance,
  isVisible,
  isVisibleBeforeHit,
  spawnFlipProgress,
  spawnFlipYOffset,
  spawnProgress,
  spawnRotationProgress,
  wallAheadDistance,
  wallSpawnScale,
  type ObjectMotion,
} from '../../core/placement/jump-path';
import type { ArcInstance, MapRenderData, NoteInstance } from '../../core/placement/map-render-data';
import type { ReplayPose } from '../../core/replay/types';
import type { FogUniforms } from '../bloomfog/pipeline';
import {
  createArcMaterial,
  createBombMaterial,
  createDirectionalMaterial,
  createNoteMaterial,
  createObstacleDisplacementMaterial,
  createObstacleMaterial,
  createObstacleOutlineMaterial,
} from '../materials/map-object-materials';
import { SCREEN_DISPLACEMENT_LAYER } from '../mirror/planar-mirror';
import { NoteLookRotation } from '../note-look-rotation';
import { createNoteReflection } from '../note-reflection';
import {
  arcCrossedStripGeometry,
  arrowGeometry,
  bombGeometry,
  chainLinkGeometry,
  dotGeometry,
  noteBodyGeometry,
  wallCoreGeometry,
  wallFrameGeometry,
} from '../object-geometry';
import type { ReplayView } from '../replay/replay-view';
import { wallTransform } from '../wall-transform';
import { ActiveWindowIndex } from './active-window-index';
import { InstancedGroup } from './instanced-group';

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

const zAxis = new Vector3(0, 0, 1);
const yAxis = new Vector3(0, 1, 0);
const mapPlayerCenter = new Vector3(0, 1.7, 0);
const degToRad = Math.PI / 180;
const noteModelScale = 1;
const previewRotationFps = 90;
const white: Rgb = [1, 1, 1];
const bombGray: Rgb = [64 / 255, 64 / 255, 64 / 255];

export class MapObjectRenderer {
  private readonly noteReflection = createNoteReflection();
  private readonly sliderMistNoise = new TextureLoader().load(
    `${import.meta.env.BASE_URL}textures/slider-mist-noise.png`,
  );
  private readonly obstacleDisplacementNoise = new TextureLoader().load(
    `${import.meta.env.BASE_URL}textures/obstacle-displacement-noise.png`,
  );
  private readonly matrix = new Matrix4();
  private readonly position = new Vector3();
  private readonly poseHeadPosition = new Vector3();
  private readonly quaternion = new Quaternion();
  private readonly noteLookRotation = new NoteLookRotation();
  private readonly scale = new Vector3();
  private readonly noteLookStates = new Map<NoteInstance, NoteLookState>();

  private data: MapRenderData | null = null;
  private colors: ColorScheme | null = null;
  private noteBodies: InstancedGroup[] = [];
  private arrows: InstancedGroup[] = [];
  private dots: InstancedGroup[] = [];
  private bombs: InstancedGroup | null = null;
  private links: InstancedGroup[] = [];
  private wallCores: InstancedGroup | null = null;
  private wallFrames: InstancedGroup | null = null;
  private wallCoreLowMaterial: Material | null = null;
  private wallCoreHighMaterial: Material | null = null;
  private screenDisplacementEffects = true;
  private previewNotesLookAtPlayer = false;
  private instanceGroups: InstancedGroup[] = [];
  private arcEntries: ArcEntry[] = [];
  private noteReplayWindows: ActiveWindowIndex | null = null;
  private notePreviewWindows: ActiveWindowIndex | null = null;
  private bombWindows: ActiveWindowIndex | null = null;
  private linkReplayWindows: ActiveWindowIndex | null = null;
  private linkPreviewWindows: ActiveWindowIndex | null = null;
  private wallWindows: ActiveWindowIndex | null = null;
  private arcWindows: ActiveWindowIndex | null = null;
  private objectBeat = Number.NaN;
  private ownedMaterials: Material[] = [];

  constructor(
    private readonly root: Group,
    private readonly fog: FogUniforms,
    private readonly screenDisplacementTexture: { value: Texture },
  ) {
    this.sliderMistNoise.wrapS = RepeatWrapping;
    this.sliderMistNoise.wrapT = RepeatWrapping;
    this.obstacleDisplacementNoise.wrapS = RepeatWrapping;
    this.obstacleDisplacementNoise.wrapT = RepeatWrapping;
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
    const bombMaterial = createBombMaterial(this.fog, this.noteReflection);
    const wallCoreLowMaterial = createObstacleMaterial(this.fog, colors.obstacle);
    const wallCoreHighMaterial = createObstacleDisplacementMaterial(
      this.fog,
      colors.obstacle,
      this.screenDisplacementTexture,
      this.obstacleDisplacementNoise,
    );
    this.wallCoreLowMaterial = wallCoreLowMaterial;
    this.wallCoreHighMaterial = wallCoreHighMaterial;
    const wallFrameMaterial = createObstacleOutlineMaterial(this.fog, colors.obstacle);
    this.ownedMaterials = [
      ...noteMaterials,
      ...directionalMaterials,
      bombMaterial,
      wallCoreLowMaterial,
      wallCoreHighMaterial,
      wallFrameMaterial,
    ];

    this.noteBodies = noteMaterials.map(
      (material) => new InstancedGroup(noteBodyGeometry(), material, data.capacity.notes),
    );
    this.arrows = directionalMaterials.map(
      (material) => new InstancedGroup(arrowGeometry(), material, data.capacity.notes),
    );
    this.dots = directionalMaterials.map(
      (material) => new InstancedGroup(dotGeometry(), material, data.capacity.notes),
    );
    this.bombs = new InstancedGroup(bombGeometry(), bombMaterial, data.capacity.bombs);
    this.links = noteMaterials.map(
      (material) => new InstancedGroup(chainLinkGeometry(), material, data.capacity.chainLinks),
    );
    this.wallCores = new InstancedGroup(wallCoreGeometry(), wallCoreLowMaterial, data.capacity.walls);
    this.wallFrames = new InstancedGroup(wallFrameGeometry(), wallFrameMaterial, data.capacity.walls);
    this.instanceGroups = [
      ...this.noteBodies,
      ...this.arrows,
      ...this.dots,
      this.bombs,
      ...this.links,
      this.wallCores,
      this.wallFrames,
    ];
    for (const group of this.instanceGroups) this.root.add(group.mesh);
    this.setScreenDisplacementEffects(this.screenDisplacementEffects);

    this.arcEntries = data.arcs.map((arc) => {
      const color = arcColors[arc.colorIndex] ?? colors.leftNote;
      const material = createArcMaterial(this.fog, arc.customColor ?? color, this.sliderMistNoise, { ...arc });
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
      (index) => data.notes[index]?.despawnBeat ?? -Infinity,
      true,
    );
    this.notePreviewWindows = new ActiveWindowIndex(
      data.notes.length,
      (index) => data.notes[index]?.enterBeat ?? Infinity,
      (index) => data.notes[index]?.beat ?? -Infinity,
      false,
    );
    this.bombWindows = new ActiveWindowIndex(
      data.bombs.length,
      (index) => data.bombs[index]?.enterBeat ?? Infinity,
      (index) => data.bombs[index]?.despawnBeat ?? -Infinity,
      true,
    );
    this.linkReplayWindows = new ActiveWindowIndex(
      data.chainLinks.length,
      (index) => data.chainLinks[index]?.enterBeat ?? Infinity,
      (index) => data.chainLinks[index]?.despawnBeat ?? -Infinity,
      true,
    );
    this.linkPreviewWindows = new ActiveWindowIndex(
      data.chainLinks.length,
      (index) => data.chainLinks[index]?.enterBeat ?? Infinity,
      (index) => data.chainLinks[index]?.beat ?? -Infinity,
      false,
    );
    this.wallWindows = new ActiveWindowIndex(
      data.walls.length,
      (index) => data.walls[index]?.enterBeat ?? Infinity,
      (index) => data.walls[index]?.despawnBeat ?? -Infinity,
      true,
    );
    this.arcWindows = new ActiveWindowIndex(
      data.arcs.length,
      (index) => data.arcs[index]?.spawnBeat ?? Infinity,
      (index) => data.arcs[index]?.despawnBeat ?? -Infinity,
      true,
    );
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

  invalidate() {
    this.objectBeat = Number.NaN;
    this.noteLookStates.clear();
  }

  get wallsVisible() {
    return (this.wallCores?.mesh.count ?? 0) > 0;
  }

  update(now: number, replayView: ReplayView) {
    const data = this.data;
    const colors = this.colors;
    if (data === null || colors === null) return;
    this.root.position.z = data.tracksPlayerZ && replayView.hasPoses ? replayView.headPosition.z : 0;
    if (now === this.objectBeat) return;
    this.objectBeat = now;
    const replayTime = songBpmTimeToSeconds(now, data.songBpm);
    for (const group of this.instanceGroups) group.begin();
    const replayLoaded = replayView.hasReplay;
    const poseFrames = replayView.poseFrames;

    const activeNotes = (replayLoaded ? this.noteReplayWindows : this.notePreviewWindows)?.at(now) ?? [];
    for (let colorIndex = 0; colorIndex < 2; colorIndex++) {
      for (const index of activeNotes) {
        const note = data.notes[index];
        if (note?.colorIndex !== colorIndex) continue;
        const visible = replayLoaded ? isVisible(note, now) : isVisibleBeforeHit(note, now);
        if (!visible || (note.replayEndTime !== undefined && replayTime >= note.replayEndTime)) continue;
        const jump = spawnProgress(note, now);
        const x = note.startX + (note.x - note.startX) * spawnFlipProgress(note, now);
        const y = note.startY + (note.y - note.startY) * jump + spawnFlipYOffset(note, now, note.flipYSide);
        const rotation = note.rotationDeg * spawnRotationProgress(note, now);
        const noteTime = songBpmTimeToSeconds(note.beat, data.songBpm);
        if (note.lookAtPlayer && (replayLoaded || this.previewNotesLookAtPlayer)) {
          this.composeLookNoteAt(
            note,
            now,
            x,
            y,
            noteTime,
            replayTime,
            data.songBpm,
            poseFrames,
            replayView.headPosition,
            data.tracksPlayerZ,
            noteModelScale,
          );
        } else {
          this.composeAt(note, now, x, y, rotation, noteModelScale);
        }
        const color = note.customColor ?? (note.colorIndex === 1 ? colors.rightNote : colors.leftNote);
        this.noteBodies[colorIndex]?.push(this.matrix, color);
        if (note.dot) this.dots[colorIndex]?.push(this.matrix, white);
        else this.arrows[colorIndex]?.push(this.matrix, white);
      }
    }

    for (const index of this.bombWindows?.at(now) ?? []) {
      const bomb = data.bombs[index];
      if (bomb === undefined) continue;
      if (!isVisible(bomb, now) || (bomb.replayEndTime !== undefined && replayTime >= bomb.replayEndTime)) continue;
      const y = bomb.startY + (bomb.y - bomb.startY) * spawnProgress(bomb, now);
      this.composeAt(bomb, now, bomb.x, y, 0, 1);
      this.bombs?.push(this.matrix, bomb.customColor ?? bombGray);
    }

    const activeLinks = (replayLoaded ? this.linkReplayWindows : this.linkPreviewWindows)?.at(now) ?? [];
    for (let colorIndex = 0; colorIndex < 2; colorIndex++) {
      for (const index of activeLinks) {
        const link = data.chainLinks[index];
        if (link?.colorIndex !== colorIndex) continue;
        const visible = replayLoaded ? isVisible(link, now) : isVisibleBeforeHit(link, now);
        if (!visible || (link.replayEndTime !== undefined && replayTime >= link.replayEndTime)) continue;
        const jump = spawnProgress(link, now);
        const y = Y_OFFSET + (link.y - Y_OFFSET) * jump;
        const rotation = link.rotationDeg * spawnRotationProgress(link, now);
        this.composeAt(link, now, link.x, y, rotation, noteModelScale);
        const color = link.customColor ?? (link.colorIndex === 1 ? colors.rightNote : colors.leftNote);
        this.links[colorIndex]?.push(this.matrix, color);
      }
    }

    for (const index of this.wallWindows?.at(now) ?? []) {
      const wall = data.walls[index];
      if (wall === undefined) continue;
      if (!isVisible(wall, now)) continue;
      const reveal = wallSpawnScale(wall, now);
      if (reveal === 0) continue;
      const transform = wallTransform(wall, wallAheadDistance(wall, wall.pullBeat, now), reveal);
      this.position.fromArray(transform.position);
      this.quaternion.setFromAxisAngle(yAxis, transform.yawDeg * degToRad);
      this.scale.fromArray(transform.outlineScale);
      this.matrix.compose(this.position, this.quaternion, this.scale);
      const color = wall.customColor ?? colors.obstacle;
      this.wallFrames?.push(this.matrix, color);
      this.scale.fromArray(transform.coreScale);
      this.matrix.compose(this.position, this.quaternion, this.scale);
      this.wallCores?.push(this.matrix, color);
    }

    for (const index of this.arcWindows?.current ?? []) {
      const entry = this.arcEntries[index];
      if (entry !== undefined) entry.mesh.visible = false;
    }
    for (const index of this.arcWindows?.at(now) ?? []) {
      const entry = this.arcEntries[index];
      if (entry === undefined) continue;
      const arc = entry.arc;
      entry.mesh.visible = true;
      const headAhead = Z_OFFSET + (arc.headBeat - now) * arc.unitsPerBeat;
      entry.mesh.position.set(0, NOTE_Y_OFFSET, -headAhead);
      entry.mesh.scale.set(1, 1, 1);
      const nowBeat = entry.mesh.material.uniforms._PlaybackBeat;
      const timeSeconds = entry.mesh.material.uniforms._ClockSeconds;
      if (nowBeat !== undefined) nowBeat.value = now;
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
    this.noteBodies = this.arrows = this.dots = this.links = [];
    this.bombs = this.wallCores = this.wallFrames = null;
    this.wallCoreLowMaterial = this.wallCoreHighMaterial = null;
    this.instanceGroups = [];
    this.arcEntries = [];
    this.noteReplayWindows = this.notePreviewWindows = this.bombWindows = null;
    this.linkReplayWindows = this.linkPreviewWindows = null;
    this.wallWindows = this.arcWindows = null;
    this.ownedMaterials = [];
    this.noteLookStates.clear();
    this.data = null;
    this.colors = null;
    this.objectBeat = Number.NaN;
  }

  dispose() {
    this.clear();
    this.noteReflection.dispose();
    this.sliderMistNoise.dispose();
    this.obstacleDisplacementNoise.dispose();
  }

  private composeAt(motion: ObjectMotion, now: number, x: number, y: number, rotationDeg: number, scale: number) {
    this.position.set(x, y, -aheadDistance(motion, now));
    this.quaternion.setFromAxisAngle(zAxis, rotationDeg * degToRad);
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
    songBpm: number,
    poseFrames: readonly ReplayPose[],
    currentHeadPosition: Vector3,
    tracksPlayerZ: boolean,
    scale: number,
  ) {
    const state = this.noteLookState(note, poseFrames);
    if (poseFrames.length > 0) {
      this.advanceReplayNoteLook(state, note, noteTime, replayTime, songBpm, poseFrames, tracksPlayerZ);
    } else {
      this.advancePreviewNoteLook(state, note, noteTime, now, songBpm);
    }

    this.position.set(x, y, -aheadDistance(note, now));
    const sampleTime = poseFrames.length > 0 ? replayTime : songBpmTimeToSeconds(now, songBpm);
    if (Math.abs(sampleTime - state.lastSampleTime) < 1e-6) {
      this.quaternion.copy(state.rotation);
    } else {
      this.noteLookRotation.apply(
        this.quaternion,
        state.rotation,
        note.rotationDeg,
        noteTime,
        note.x,
        this.position,
        note.y,
        poseFrames.length > 0
          ? this.poseHeadPosition.set(
              currentHeadPosition.x,
              currentHeadPosition.y,
              tracksPlayerZ ? 0 : currentHeadPosition.z,
            )
          : mapPlayerCenter,
        (now - note.spawnBeat) / (note.hjdBeats * 2),
      );
    }
    this.scale.setScalar(scale);
    this.matrix.compose(this.position, this.quaternion, this.scale);
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
    songBpm: number,
    poseFrames: readonly ReplayPose[],
    tracksPlayerZ: boolean,
  ) {
    if (replayTime < state.lastSampleTime) this.resetNoteLookState(state, note, true);
    let poseIndex =
      state.lastSampleTime === Number.NEGATIVE_INFINITY
        ? firstPoseAtOrAfter(poseFrames, songBpmTimeToSeconds(note.spawnBeat, songBpm))
        : firstPoseAfter(poseFrames, state.lastSampleTime);
    while (!state.finished) {
      const frame = poseFrames[poseIndex];
      if (frame === undefined || frame.time > replayTime) return;
      if (frame.time >= noteTime) {
        state.finished = true;
        return;
      }
      const beat = secondsToSongBpmTime(frame.time, songBpm);
      this.setNotePosition(note, beat);
      this.poseHeadPosition.set(
        frame.head.position.x,
        frame.head.position.y,
        tracksPlayerZ ? 0 : -frame.head.position.z,
      );
      this.noteLookRotation.apply(
        state.rotation,
        state.rotation,
        note.rotationDeg,
        noteTime,
        note.x,
        this.position,
        note.y,
        this.poseHeadPosition,
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
    songBpm: number,
  ) {
    const step = secondsToSongBpmTime(1 / previewRotationFps, songBpm);
    while (!state.finished && state.nextPreviewBeat <= now) {
      if (state.nextPreviewBeat >= note.beat) {
        state.finished = true;
        return;
      }
      this.setNotePosition(note, state.nextPreviewBeat);
      this.noteLookRotation.apply(
        state.rotation,
        state.rotation,
        note.rotationDeg,
        noteTime,
        note.x,
        this.position,
        note.y,
        mapPlayerCenter,
        (state.nextPreviewBeat - note.spawnBeat) / (note.hjdBeats * 2),
      );
      state.lastSampleTime = songBpmTimeToSeconds(state.nextPreviewBeat, songBpm);
      state.nextPreviewBeat += step;
    }
  }

  private setNotePosition(note: NoteInstance, now: number) {
    const jump = spawnProgress(note, now);
    const x = note.startX + (note.x - note.startX) * spawnFlipProgress(note, now);
    const y = note.startY + (note.y - note.startY) * jump + spawnFlipYOffset(note, now, note.flipYSide);
    this.position.set(x, y, -aheadDistance(note, now));
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
