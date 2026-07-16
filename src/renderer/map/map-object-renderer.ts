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

import { songBpmTimeToSeconds } from '../../core/beatmap/bpm';
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
import type { ArcInstance, MapRenderData } from '../../core/placement/map-render-data';
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
import { InstancedGroup } from './instanced-group';

interface ArcEntry {
  mesh: Mesh<BufferGeometry, ShaderMaterial>;
  arc: ArcInstance;
}

const zAxis = new Vector3(0, 0, 1);
const yAxis = new Vector3(0, 1, 0);
const mapPlayerCenter = new Vector3(0, 1.7, 0);
const degToRad = Math.PI / 180;
const noteModelScale = 1;
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
  private readonly quaternion = new Quaternion();
  private readonly noteLookRotation = new NoteLookRotation();
  private readonly scale = new Vector3();

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
  private instanceGroups: InstancedGroup[] = [];
  private arcEntries: ArcEntry[] = [];
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
    const noteBodyMaterials = [
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
      ...noteBodyMaterials,
      ...directionalMaterials,
      bombMaterial,
      wallCoreLowMaterial,
      wallCoreHighMaterial,
      wallFrameMaterial,
    ];

    this.noteBodies = noteBodyMaterials.map(
      (material) => new InstancedGroup(noteBodyGeometry(), material, data.capacity.notes),
    );
    this.arrows = directionalMaterials.map(
      (material) => new InstancedGroup(arrowGeometry(), material, data.capacity.notes),
    );
    this.dots = directionalMaterials.map(
      (material) => new InstancedGroup(dotGeometry(), material, data.capacity.notes),
    );
    this.bombs = new InstancedGroup(bombGeometry(), bombMaterial, data.capacity.bombs);
    this.links = noteBodyMaterials.map(
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
  }

  setScreenDisplacementEffects(enabled: boolean) {
    this.screenDisplacementEffects = enabled;
    if (this.wallCores === null) return;
    const material = enabled ? this.wallCoreHighMaterial : this.wallCoreLowMaterial;
    if (material !== null) this.wallCores.mesh.material = material;
    this.wallCores.mesh.layers.set(enabled ? SCREEN_DISPLACEMENT_LAYER : 0);
  }

  invalidate() {
    this.objectBeat = Number.NaN;
  }

  get wallsVisible() {
    return (this.wallCores?.mesh.count ?? 0) > 0;
  }

  update(now: number, replayView: ReplayView) {
    const data = this.data;
    const colors = this.colors;
    if (data === null || colors === null) return;
    if (now === this.objectBeat) return;
    this.objectBeat = now;
    const replayTime = songBpmTimeToSeconds(now, data.songBpm);
    for (const group of this.instanceGroups) group.begin();
    const replayLoaded = replayView.hasReplay;
    const noteLookTarget = replayView.hasPoses ? replayView.headPosition : mapPlayerCenter;

    for (const note of data.notes) {
      const visible = replayLoaded ? isVisible(note, now) : isVisibleBeforeHit(note, now);
      if (!visible || (note.replayEndTime !== undefined && replayTime >= note.replayEndTime)) continue;
      const jump = spawnProgress(note, now);
      const x = note.startX + (note.x - note.startX) * spawnFlipProgress(note, now);
      const y = note.startY + (note.y - note.startY) * jump + spawnFlipYOffset(note, now, note.flipYSide);
      const rotation = note.rotationDeg * spawnRotationProgress(note, now);
      const noteTime = songBpmTimeToSeconds(note.beat, data.songBpm);
      if (note.lookAtPlayer) {
        this.composeLookNoteAt(note, now, x, y, note.rotationDeg, noteTime, note.y, noteLookTarget, noteModelScale);
      } else {
        this.composeAt(note, now, x, y, rotation, noteModelScale);
      }
      const color = note.customColor ?? (note.colorIndex === 1 ? colors.rightNote : colors.leftNote);
      this.noteBodies[note.colorIndex]?.push(this.matrix, color);
      if (note.lookAtPlayer) {
        this.composeLookNoteAt(note, now, x, y, note.rotationDeg, noteTime, note.y, noteLookTarget, 1);
      } else {
        this.composeAt(note, now, x, y, rotation, 1);
      }
      if (note.dot) this.dots[note.colorIndex]?.push(this.matrix, white);
      else this.arrows[note.colorIndex]?.push(this.matrix, white);
    }

    for (const bomb of data.bombs) {
      if (!isVisible(bomb, now) || (bomb.replayEndTime !== undefined && replayTime >= bomb.replayEndTime)) continue;
      const y = bomb.startY + (bomb.y - bomb.startY) * spawnProgress(bomb, now);
      this.composeAt(bomb, now, bomb.x, y, 0, 1);
      this.bombs?.push(this.matrix, bomb.customColor ?? bombGray);
    }

    for (const link of data.chainLinks) {
      const visible = replayLoaded ? isVisible(link, now) : isVisibleBeforeHit(link, now);
      if (!visible || (link.replayEndTime !== undefined && replayTime >= link.replayEndTime)) continue;
      const jump = spawnProgress(link, now);
      const y = Y_OFFSET + (link.y - Y_OFFSET) * jump;
      const rotation = link.rotationDeg * spawnRotationProgress(link, now);
      this.composeAt(link, now, link.x, y, rotation, noteModelScale);
      const color = link.customColor ?? (link.colorIndex === 1 ? colors.rightNote : colors.leftNote);
      this.links[link.colorIndex]?.push(this.matrix, color);
    }

    for (const wall of data.walls) {
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

    for (const entry of this.arcEntries) {
      const arc = entry.arc;
      const visible = now >= arc.spawnBeat && now <= arc.despawnBeat;
      entry.mesh.visible = visible;
      if (!visible) continue;
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
    this.noteBodies = [];
    this.arrows = [];
    this.dots = [];
    this.links = [];
    this.bombs = this.wallCores = this.wallFrames = null;
    this.wallCoreLowMaterial = this.wallCoreHighMaterial = null;
    this.instanceGroups = [];
    this.arcEntries = [];
    this.ownedMaterials = [];
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
    motion: ObjectMotion,
    now: number,
    x: number,
    y: number,
    rotationDeg: number,
    noteTime: number,
    noteEndY: number,
    lookTarget: Vector3,
    scale: number,
  ) {
    this.position.set(x, y, -aheadDistance(motion, now));
    this.noteLookRotation.apply(
      this.quaternion,
      rotationDeg,
      noteTime,
      this.position,
      noteEndY,
      lookTarget,
      (now - motion.spawnBeat) / (motion.hjdBeats * 2),
    );
    this.scale.setScalar(scale);
    this.matrix.compose(this.position, this.quaternion, this.scale);
  }
}
