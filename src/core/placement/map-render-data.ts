import { songBpmTimeToSeconds } from '../beatmap/bpm';
import type { Difficulty } from '../beatmap/types';
import { NoteType } from '../beatmap/types';
import { beatSaberNumberSchema } from '../beatmap/value-schema';
import { chromaColor } from '../chroma';
import type { Rgb } from '../colors';
import type { ReplayHeightEvent, ReplayNoteEvent, ReplayNoteEventType } from '../replay/types';
import { createSpawnProvider, type SpawnState } from '../spawn/variable-njs';
import { arcPath, type ArcPathPoint } from './arc-spline';
import { chainLinks } from './chain-links';
import { directionalize, gridPosition, NOTE_Y_OFFSET, obstacleBounds, obstaclePlacement, Y_OFFSET } from './grid';
import { maxConcurrent, preJumpTravelBeats, wallTailGraceBeats, type ObjectMotion } from './jump-path';
import { buildNoteFormation } from './note-formation';

export interface NoteInstance extends ObjectMotion {
  x: number;
  y: number;
  lineLayer: number;
  startX: number;
  startY: number;
  flipYSide: number;
  rotationDeg: number;
  colorIndex: number;
  dot: boolean;
  lookAtPlayer: boolean;
  customColor?: Rgb;
  replayEndTime?: number;
  replayEventType?: ReplayNoteEventType;
  replayIdentity?: NoteReplayIdentity;
}

export interface BombInstance extends ObjectMotion {
  x: number;
  y: number;
  lineLayer: number;
  startY: number;
  customColor?: Rgb;
  replayEndTime?: number;
  replayIdentity?: BombReplayIdentity;
}

export interface WallInstance extends ObjectMotion {
  x: number;
  y: number;
  rotationDeg: number;
  width: number;
  height: number;
  lengthUnits: number;
  pullBeat: number;
  customColor?: Rgb;
}

export interface ChainLinkInstance extends ObjectMotion {
  x: number;
  y: number;
  rotationDeg: number;
  colorIndex: number;
  customColor?: Rgb;
  replayEndTime?: number;
  replayEventType?: ReplayNoteEventType;
  replayIdentity?: ChainReplayIdentity;
}

interface NoteReplayIdentity {
  time: number;
  lineLayer: number;
  lineIndex: number;
  colorType: number;
  cutDirection: number;
}

interface BombReplayIdentity {
  time: number;
  lineLayer: number;
  lineIndex: number;
}

interface ChainReplayIdentity {
  time: number;
  colorType: number;
}

export interface ArcInstance {
  headBeat: number;
  tailBeat: number;
  spawnBeat: number;
  despawnBeat: number;
  hjdBeats: number;
  unitsPerBeat: number;
  zDistance: number;
  pathLength: number;
  headFadeLength: number;
  tailFadeLength: number;
  random: number;
  colorIndex: number;
  customColor?: Rgb;
  points: ArcPathPoint[];
}

export interface MapRenderData {
  notes: NoteInstance[];
  bombs: BombInstance[];
  walls: WallInstance[];
  chainLinks: ChainLinkInstance[];
  arcs: ArcInstance[];
  capacity: { notes: number; bombs: number; walls: number; chainLinks: number };
  endBeat: number;
  songBpm: number;
  lightEvents: Difficulty['events'];
  bpmEvents: Difficulty['bpmEvents'];
  lightColorEventBoxGroups: Difficulty['lightColorEventBoxGroups'];
  lightRotationEventBoxGroups: Difficulty['lightRotationEventBoxGroups'];
  lightTranslationEventBoxGroups: Difficulty['lightTranslationEventBoxGroups'];
  fxEventBoxGroups: Difficulty['fxEventBoxGroups'];
  environmentRemoval: string[];
  initialPlayerHeight: number;
  replayHeights: ReplayHeightEvent[];
}

export interface MapRenderOptions {
  noteJumpSpeed: number;
  noteStartBeatOffset: number;
  songBpm: number;
  recordedJumpDistance?: number;
  leftHanded?: boolean;
  replayNotes?: ReplayNoteEvent[];
  initialPlayerHeight?: number;
  replayHeights?: ReplayHeightEvent[];
  environmentRemoval?: string[];
}

const anyCutDirection = 8;
const chainLinkScoringTypes = new Set([5, 8]);
const defaultPlayerHeight = 1.8;

function jumpOffsetYForPlayerHeight(playerHeight: number) {
  return Math.min(Math.max((playerHeight - defaultPlayerHeight) * 0.5, -0.2), 0.6);
}

function playerHeightAt(events: readonly ReplayHeightEvent[], time: number, initialHeight: number) {
  let low = 0;
  let high = events.length;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    const event = events[middle];
    if (event !== undefined && event.time <= time) low = middle + 1;
    else high = middle;
  }
  return events[low - 1]?.height ?? initialHeight;
}

function noteJumpY(lineLayer: number, jumpOffsetY: number) {
  if (lineLayer === 0) return 0.85 + jumpOffsetY;
  if (lineLayer === 1) return 1.4 + jumpOffsetY;
  if (lineLayer === 2) return 1.9 + jumpOffsetY;
  return gridPosition(0, lineLayer).y + NOTE_Y_OFFSET + jumpOffsetY;
}

function objectJumpY(
  object: Pick<NoteInstance | BombInstance, 'enterBeat' | 'lineLayer'>,
  songBpm: number,
  initialHeight: number,
  heightEvents: readonly ReplayHeightEvent[],
) {
  const spawnTime = songBpmTimeToSeconds(object.enterBeat, songBpm);
  return noteJumpY(
    object.lineLayer,
    jumpOffsetYForPlayerHeight(playerHeightAt(heightEvents, spawnTime, initialHeight)),
  );
}

function approximately(left: number, right: number) {
  return Math.abs(left - right) < Math.max(1e-6 * Math.max(Math.abs(left), Math.abs(right)), Number.EPSILON * 8);
}

function objectColor(customData: Difficulty['notes'][number]['customData']): Rgb | undefined {
  const color = chromaColor(customData);
  return color === undefined ? undefined : [color[0], color[1], color[2]];
}

function mirrorCutDirection(cutDirection: number) {
  if (cutDirection === 2) return 3;
  if (cutDirection === 3) return 2;
  if (cutDirection === 4) return 5;
  if (cutDirection === 5) return 4;
  if (cutDirection === 6) return 7;
  if (cutDirection === 7) return 6;
  return cutDirection;
}

function motionFor(state: SpawnState, beat: number, leadInBeats: number, despawnBeat?: number): ObjectMotion {
  const spawnBeat = beat - state.halfJumpDurationInBeats;
  return {
    beat,
    enterBeat: spawnBeat - leadInBeats,
    spawnBeat,
    despawnBeat: despawnBeat ?? beat + state.halfJumpDurationInBeats,
    hjdBeats: state.halfJumpDurationInBeats,
    unitsPerBeat: state.halfJumpDistance / state.halfJumpDurationInBeats,
  };
}

export function buildMapRenderData(difficulty: Difficulty, options: MapRenderOptions): MapRenderData {
  const provider = createSpawnProvider(
    difficulty.njsEvents,
    options.noteJumpSpeed,
    options.noteStartBeatOffset,
    options.songBpm,
    options.recordedJumpDistance,
  );
  const majorVersion = Number.parseInt(difficulty.version, 10);
  const leadInBeats = preJumpTravelBeats(options.songBpm);
  const formedNotes = buildNoteFormation(difficulty, options.songBpm);
  const replayNotes = [...(options.replayNotes ?? [])];
  const initialPlayerHeight = options.initialPlayerHeight ?? defaultPlayerHeight;
  const replayHeights = [...(options.replayHeights ?? [])];
  function takeReplayEvent(matches: (event: ReplayNoteEvent) => boolean) {
    const index = replayNotes.findIndex(matches);
    if (index < 0) return undefined;
    return replayNotes.splice(index, 1)[0];
  }

  const notes: NoteInstance[] = [];
  const bombs: BombInstance[] = [];
  const chainHeads = new Set(
    difficulty.chains.map(
      (chain) => `${String(chain.songBpmTime)}:${String(chain.posX)}:${String(chain.posY)}:${String(chain.color)}`,
    ),
  );
  for (const { note, formation } of formedNotes) {
    const state = provider.stateAt(note.songBpmTime);
    const motion = motionFor(state, note.songBpmTime, leadInBeats);
    const grid = gridPosition(note.posX, note.posY);
    const x = options.leftHanded === true ? -grid.x : grid.x;
    const startGrid = gridPosition(formation.startLineIndex, formation.startLineLayer);
    const startX = options.leftHanded === true ? -startGrid.x : startGrid.x;
    const startY = startGrid.y + Y_OFFSET;
    const noteTime = songBpmTimeToSeconds(note.songBpmTime, options.songBpm);
    const customColor = objectColor(note.customData);
    if (note.type === NoteType.Bomb) {
      const lineIndex = options.leftHanded === true ? 3 - note.posX : note.posX;
      const replayEvent = note.customFake
        ? undefined
        : takeReplayEvent(
            (event) =>
              event.eventType === 4 &&
              approximately(event.noteId.time, noteTime) &&
              event.noteId.lineIndex === lineIndex &&
              event.noteId.lineLayer === note.posY,
          );
      bombs.push({
        ...motion,
        x,
        y: objectJumpY({ ...motion, lineLayer: note.posY }, options.songBpm, initialPlayerHeight, replayHeights),
        lineLayer: note.posY,
        startY,
        customColor,
        replayEndTime: replayEvent?.time,
        replayIdentity: note.customFake ? undefined : { time: noteTime, lineIndex, lineLayer: note.posY },
      });
    } else {
      const lineIndex = options.leftHanded === true ? 3 - note.posX : note.posX;
      const colorType = options.leftHanded === true ? 1 - note.type : note.type;
      const cutDirection = options.leftHanded === true ? mirrorCutDirection(note.cutDirection) : note.cutDirection;
      const replayEvent = note.customFake
        ? undefined
        : takeReplayEvent(
            (event) =>
              event.eventType >= 1 &&
              event.eventType <= 3 &&
              (event.noteId.scoringType === undefined || !chainLinkScoringTypes.has(event.noteId.scoringType)) &&
              approximately(event.noteId.time, noteTime) &&
              event.noteId.lineIndex === lineIndex &&
              event.noteId.lineLayer === note.posY &&
              event.noteId.colorType === colorType &&
              event.noteId.cutDirection === cutDirection,
          );
      notes.push({
        ...motion,
        x,
        y: objectJumpY({ ...motion, lineLayer: note.posY }, options.songBpm, initialPlayerHeight, replayHeights),
        lineLayer: note.posY,
        startX,
        startY,
        flipYSide: formation.flipYSide,
        rotationDeg:
          (majorVersion === 2 && note.customData?._cutDirection !== undefined
            ? beatSaberNumberSchema.parse(note.customData._cutDirection)
            : directionalize(note.cutDirection, note.angleOffset)) * (options.leftHanded === true ? -1 : 1),
        colorIndex:
          options.leftHanded === true ? (note.type === NoteType.Blue ? 0 : 1) : note.type === NoteType.Blue ? 1 : 0,
        dot: note.cutDirection === anyCutDirection,
        lookAtPlayer:
          replayEvent?.noteId.gameplayType === undefined
            ? !chainHeads.has(
                `${String(note.songBpmTime)}:${String(note.posX)}:${String(note.posY)}:${String(note.type)}`,
              )
            : replayEvent.noteId.gameplayType === 0,
        customColor,
        replayEndTime: replayEvent?.time,
        replayEventType: replayEvent?.eventType,
        replayIdentity: note.customFake
          ? undefined
          : {
              time: noteTime,
              lineIndex,
              lineLayer: note.posY,
              colorType,
              cutDirection,
            },
      });
    }
  }

  const walls: WallInstance[] = [];
  for (const obstacle of difficulty.obstacles) {
    const state = provider.stateAt(obstacle.songBpmTime);
    const unitsPerBeat = state.halfJumpDistance / state.halfJumpDurationInBeats;
    const motion = motionFor(
      state,
      obstacle.songBpmTime,
      leadInBeats,
      obstacle.songBpmTime + obstacle.durationSongBpmTime + state.halfJumpDurationInBeats,
    );
    const placement = obstaclePlacement(obstacleBounds(obstacle, majorVersion));
    walls.push({
      ...motion,
      x: options.leftHanded === true ? -placement.x : placement.x,
      y: placement.y,
      rotationDeg: obstacle.rotation * (options.leftHanded === true ? -1 : 1),
      width: placement.width,
      height: placement.height,
      lengthUnits: obstacle.durationSongBpmTime * unitsPerBeat,
      pullBeat: obstacle.songBpmTime + obstacle.durationSongBpmTime + wallTailGraceBeats(options.songBpm),
      customColor: objectColor(obstacle.customData),
    });
  }

  const links: ChainLinkInstance[] = [];
  for (const chain of difficulty.chains) {
    const state = provider.stateAt(chain.songBpmTime);
    const hjdBeats = state.halfJumpDurationInBeats;
    const unitsPerBeat = state.halfJumpDistance / hjdBeats;
    const head = gridPosition(chain.posX, chain.posY);
    const colorIndex = chain.color === 1 ? 1 : 0;
    for (const link of chainLinks(chain)) {
      const beat = chain.songBpmTime + (chain.tailSongBpmTime - chain.songBpmTime) * link.t;
      const noteTime = songBpmTimeToSeconds(beat, options.songBpm);
      const replayColorType = options.leftHanded === true ? 1 - chain.color : chain.color;
      const replayEvent = chain.customFake
        ? undefined
        : takeReplayEvent(
            (event) =>
              event.eventType >= 1 &&
              event.eventType <= 3 &&
              (event.noteId.scoringType === undefined || chainLinkScoringTypes.has(event.noteId.scoringType)) &&
              approximately(event.noteId.time, noteTime) &&
              event.noteId.colorType === replayColorType,
          );
      links.push({
        beat,
        enterBeat: chain.songBpmTime - hjdBeats - leadInBeats,
        spawnBeat: chain.songBpmTime - hjdBeats,
        despawnBeat: chain.tailSongBpmTime + hjdBeats,
        hjdBeats,
        unitsPerBeat,
        x: (head.x + link.x) * (options.leftHanded === true ? -1 : 1),
        y: head.y + NOTE_Y_OFFSET + link.y,
        rotationDeg: link.rotationDeg * (options.leftHanded === true ? -1 : 1),
        colorIndex: options.leftHanded === true ? 1 - colorIndex : colorIndex,
        customColor: objectColor(chain.customData),
        replayEndTime: replayEvent?.time,
        replayEventType: replayEvent?.eventType,
        replayIdentity: chain.customFake ? undefined : { time: noteTime, colorType: replayColorType },
      });
    }
  }

  const arcs: ArcInstance[] = [];
  for (const [index, arc] of difficulty.arcs.entries()) {
    const state = provider.stateAt(arc.songBpmTime);
    const unitsPerBeat = state.halfJumpDistance / state.halfJumpDurationInBeats;
    const zDistance = (arc.tailSongBpmTime - arc.songBpmTime) * unitsPerBeat;
    function hasNote(beat: number, posX: number, posY: number) {
      return difficulty.notes.some(
        (note) =>
          note.type === arc.color && approximately(note.songBpmTime, beat) && note.posX === posX && note.posY === posY,
      );
    }
    const hasHeadNote = hasNote(arc.songBpmTime, arc.posX, arc.posY);
    const hasTailNote = hasNote(arc.tailSongBpmTime, arc.tailPosX, arc.tailPosY);
    const path = arcPath(arc, zDistance, hasHeadNote, hasTailNote);
    const points =
      options.leftHanded === true
        ? path.points.map((point) => ({
            ...point,
            x: -point.x,
            tangent: { ...point.tangent, x: -point.tangent.x },
            normal: { ...point.normal, x: -point.normal.x },
          }))
        : path.points;
    arcs.push({
      headBeat: arc.songBpmTime,
      tailBeat: arc.tailSongBpmTime,
      spawnBeat: arc.songBpmTime - state.halfJumpDurationInBeats,
      despawnBeat: arc.tailSongBpmTime + state.halfJumpDurationInBeats,
      hjdBeats: state.halfJumpDurationInBeats,
      unitsPerBeat,
      zDistance,
      pathLength: path.length,
      headFadeLength: hasHeadNote ? 0.4 : 1,
      tailFadeLength: hasTailNote ? 0.4 : 1,
      random: (index * 0.61803398875) % 1,
      colorIndex: options.leftHanded === true ? (arc.color === 1 ? 0 : 1) : arc.color === 1 ? 1 : 0,
      customColor: objectColor(arc.customData),
      points,
    });
  }

  let endBeat = 0;
  for (const list of [notes, bombs, walls, links]) {
    for (const item of list) endBeat = Math.max(endBeat, item.despawnBeat);
  }
  for (const arc of arcs) endBeat = Math.max(endBeat, arc.despawnBeat);

  return {
    notes,
    bombs,
    walls,
    chainLinks: links,
    arcs,
    capacity: {
      notes: maxConcurrent(notes),
      bombs: maxConcurrent(bombs),
      walls: maxConcurrent(walls),
      chainLinks: maxConcurrent(links),
    },
    endBeat,
    songBpm: options.songBpm,
    lightEvents: difficulty.events,
    bpmEvents: difficulty.bpmEvents,
    lightColorEventBoxGroups: difficulty.lightColorEventBoxGroups,
    lightRotationEventBoxGroups: difficulty.lightRotationEventBoxGroups,
    lightTranslationEventBoxGroups: difficulty.lightTranslationEventBoxGroups,
    fxEventBoxGroups: difficulty.fxEventBoxGroups,
    environmentRemoval: options.environmentRemoval ?? [],
    initialPlayerHeight,
    replayHeights,
  };
}

export function applyReplayHeightEvents(data: MapRenderData, events: ReplayHeightEvent[]) {
  if (events.length === 0) return;
  data.replayHeights.push(...events);
  for (const object of [...data.notes, ...data.bombs]) {
    object.y = objectJumpY(object, data.songBpm, data.initialPlayerHeight, data.replayHeights);
  }
}

export function applyReplayNoteEvents(data: MapRenderData, events: ReplayNoteEvent[]) {
  for (const event of events) {
    const identity = event.noteId;
    if (event.eventType === 4) {
      const bomb = data.bombs.find((candidate) => {
        const target = candidate.replayIdentity;
        return (
          target !== undefined &&
          candidate.replayEndTime === undefined &&
          approximately(target.time, identity.time) &&
          target.lineIndex === identity.lineIndex &&
          target.lineLayer === identity.lineLayer
        );
      });
      if (bomb !== undefined) bomb.replayEndTime = event.time;
      continue;
    }
    if (event.eventType < 1 || event.eventType > 3) continue;

    if (identity.scoringType !== undefined && chainLinkScoringTypes.has(identity.scoringType)) {
      const link = data.chainLinks.find((candidate) => {
        const target = candidate.replayIdentity;
        return (
          target !== undefined &&
          candidate.replayEndTime === undefined &&
          approximately(target.time, identity.time) &&
          target.colorType === identity.colorType
        );
      });
      if (link !== undefined) {
        link.replayEndTime = event.time;
        link.replayEventType = event.eventType;
      }
      continue;
    }

    const note = data.notes.find((candidate) => {
      const target = candidate.replayIdentity;
      return (
        target !== undefined &&
        candidate.replayEndTime === undefined &&
        approximately(target.time, identity.time) &&
        target.lineIndex === identity.lineIndex &&
        target.lineLayer === identity.lineLayer &&
        target.colorType === identity.colorType &&
        target.cutDirection === identity.cutDirection
      );
    });
    if (note === undefined) continue;
    note.replayEndTime = event.time;
    note.replayEventType = event.eventType;
    if (identity.gameplayType !== undefined) note.lookAtPlayer = identity.gameplayType === 0;
  }
}
