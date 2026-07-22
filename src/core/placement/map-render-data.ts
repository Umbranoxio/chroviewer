import { secondsToSongBpmTime, songBpmTimeToSeconds } from '../beatmap/bpm';
import type { Difficulty } from '../beatmap/types';
import { NoteType } from '../beatmap/types';
import { chromaColor, type ChromaColor } from '../chroma';
import type { Rgb } from '../colors';
import type { NoodleWorldRotation } from '../noodle';
import type { NoodleObjectData } from '../noodle-data';
import { noodleTrackControlsTime, sampleNoodleObject } from '../noodle-runtime';
import type { ReplayHeightEvent, ReplayNoteEvent, ReplayNoteEventType } from '../replay/types';
import { legacyNoodleTimingObjects } from '../spawn/legacy-noodle-jump';
import { createSpawnProvider, type SpawnState } from '../spawn/variable-njs';
import { arcPath, type ArcPathPoint } from './arc-spline';
import { chainLinks } from './chain-links';
import { gridPosition, NOTE_Y_OFFSET, obstacleBounds, obstaclePlacement, Y_OFFSET } from './grid';
import { HeckPlacement } from './heck-placement';
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
  interactable: boolean;
  tracksPlayerHeight: boolean;
  worldRotation?: NoodleWorldRotation;
  noodle?: NoodleObjectData;
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
  tracksPlayerHeight: boolean;
  worldRotation?: NoodleWorldRotation;
  noodle?: NoodleObjectData;
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
  durationBeats?: number;
  pullBeat: number;
  worldRotation?: NoodleWorldRotation;
  noodle?: NoodleObjectData;
  customColor?: ChromaColor;
  legacySolidCore?: boolean;
}

export interface ChainLinkInstance extends ObjectMotion {
  x: number;
  y: number;
  rotationDeg: number;
  colorIndex: number;
  interactable: boolean;
  worldRotation?: NoodleWorldRotation;
  noodle?: NoodleObjectData;
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
  worldRotation?: NoodleWorldRotation;
  noodle?: NoodleObjectData;
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
  chromaEnvironment?: Difficulty['chromaEnvironment'];
  noodle: Difficulty['noodle'];
  leftHanded: boolean;
  tracksPlayerZ: boolean;
  initialPlayerHeight: number;
  replayHeights: ReplayHeightEvent[];
  legacyNoodleV2Semantics?: boolean;
  noteJumpSpeed?: number;
  noteStartBeatOffset?: number;
  movementStateAt?: (beat: number) => SpawnState;
}

export interface MapRenderOptions {
  noteJumpSpeed: number;
  noteStartBeatOffset: number;
  songBpm: number;
  legacyNoodleV2Semantics?: boolean;
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

function usesLegacySolidObstacleCore(color: ChromaColor | undefined, legacyPrefabScaling: boolean | undefined) {
  return (
    legacyPrefabScaling === true && color !== undefined && Math.max(color[0], color[1], color[2]) > 1 && color[3] < 0
  );
}

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

function samePosition(left: { x: number; y: number }, right: { x: number; y: number }) {
  return approximately(left.x, right.x) && approximately(left.y, right.y);
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

function replayCutDirection(note: Difficulty['notes'][number], majorVersion: number) {
  return majorVersion === 2 && note.cutDirection !== anyCutDirection && note.customData?._cutDirection != null
    ? 1
    : note.cutDirection;
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
  const heck = new HeckPlacement(difficulty, options.leftHanded === true);
  const provider = createSpawnProvider(
    difficulty.njsEvents,
    options.noteJumpSpeed,
    options.noteStartBeatOffset,
    options.songBpm,
    options.recordedJumpDistance,
  );
  const majorVersion = heck.majorVersion;
  const leadInBeats = preJumpTravelBeats(options.songBpm);
  const formedNotes = buildNoteFormation(difficulty, options.songBpm, heck);
  const replayNotes = [...(options.replayNotes ?? [])];
  const initialPlayerHeight = options.initialPlayerHeight ?? defaultPlayerHeight;
  const replayHeights = [...(options.replayHeights ?? [])];
  const objectProviders = new Map<string, ReturnType<typeof createSpawnProvider>>();
  const legacyTiming = legacyNoodleTimingObjects(difficulty, {
    noteJumpSpeed: options.noteJumpSpeed,
    noteStartBeatOffset: options.noteStartBeatOffset,
    songBpm: options.songBpm,
    oldMap: options.legacyNoodleV2Semantics === true,
  });
  function stateAt(beat: number, noodle: NoodleObjectData | undefined, legacyJumpDuration = false) {
    if (noodle?.noteJumpSpeed === undefined && noodle?.noteSpawnOffset === undefined) return provider.stateAt(beat);
    const speed = noodle.noteJumpSpeed ?? options.noteJumpSpeed;
    const offset = noodle.noteSpawnOffset ?? options.noteStartBeatOffset;
    const key = `${String(speed)}:${String(offset)}:${String(legacyJumpDuration)}`;
    let objectProvider = objectProviders.get(key);
    if (objectProvider === undefined) {
      objectProvider = createSpawnProvider(
        noodle.noteJumpSpeed === undefined ? difficulty.njsEvents : [],
        speed,
        offset,
        options.songBpm,
        undefined,
        legacyJumpDuration ? 1 : undefined,
      );
      objectProviders.set(key, objectProvider);
    }
    return objectProvider.stateAt(beat);
  }
  function takeReplayEvent(matches: (event: ReplayNoteEvent) => boolean) {
    const index = replayNotes.findIndex(matches);
    if (index < 0) return undefined;
    return replayNotes.splice(index, 1)[0];
  }

  const notes: NoteInstance[] = [];
  const bombs: BombInstance[] = [];
  function isChainHead(note: Difficulty['notes'][number]) {
    const notePosition = heck.position(note);
    return difficulty.chains.some(
      (chain) =>
        chain.color === note.type &&
        approximately(chain.songBpmTime, note.songBpmTime) &&
        samePosition(heck.position(chain), notePosition),
    );
  }
  for (const { note, formation } of formedNotes) {
    const extension = heck.resolve(note);
    const { noodle, coordinates, worldRotation } = extension;
    const interactable = !note.customFake && noodle?.uninteractable !== true;
    const replayable = !note.customFake && heck.canBecomeInteractable(note);
    const state = stateAt(note.songBpmTime, noodle, legacyTiming.notes.has(note));
    const motion = motionFor(state, note.songBpmTime, leadInBeats);
    const grid = heck.position(note);
    const x = options.leftHanded === true ? -grid.x : grid.x;
    const startGrid = gridPosition(formation.startLineIndex, formation.startLineLayer);
    const startPositionX = formation.flipYSide === 0 && coordinates !== undefined ? grid.x : startGrid.x;
    const startX = options.leftHanded === true ? -startPositionX : startPositionX;
    const startY = startGrid.y + Y_OFFSET;
    const noteTime = songBpmTimeToSeconds(note.songBpmTime, options.songBpm);
    const customColor = objectColor(note.customData);
    const y =
      coordinates?.[1] === undefined
        ? objectJumpY({ ...motion, lineLayer: note.posY }, options.songBpm, initialPlayerHeight, replayHeights)
        : grid.y + NOTE_Y_OFFSET;
    if (note.type === NoteType.Bomb) {
      const lineIndex = options.leftHanded === true ? 3 - note.posX : note.posX;
      const replayEvent = !replayable
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
        y,
        lineLayer: note.posY,
        startY,
        tracksPlayerHeight: coordinates?.[1] === undefined,
        worldRotation,
        noodle,
        customColor,
        replayEndTime: replayEvent?.time,
        replayIdentity: replayable ? { time: noteTime, lineIndex, lineLayer: note.posY } : undefined,
      });
    } else {
      const lineIndex = options.leftHanded === true ? 3 - note.posX : note.posX;
      const colorType = options.leftHanded === true ? 1 - note.type : note.type;
      const sourceCutDirection = replayCutDirection(note, majorVersion);
      const cutDirection = options.leftHanded === true ? mirrorCutDirection(sourceCutDirection) : sourceCutDirection;
      const replayEvent = !replayable
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
        y,
        lineLayer: note.posY,
        startX,
        startY,
        flipYSide: formation.flipYSide,
        rotationDeg: formation.rotationDeg * (options.leftHanded === true ? -1 : 1),
        colorIndex:
          options.leftHanded === true ? (note.type === NoteType.Blue ? 0 : 1) : note.type === NoteType.Blue ? 1 : 0,
        dot: note.cutDirection === anyCutDirection,
        lookAtPlayer:
          replayEvent?.noteId.gameplayType === undefined ? !isChainHead(note) : replayEvent.noteId.gameplayType === 0,
        interactable,
        tracksPlayerHeight: coordinates?.[1] === undefined,
        worldRotation,
        noodle,
        customColor,
        replayEndTime: replayEvent?.time,
        replayEventType: replayEvent?.eventType,
        replayIdentity: !replayable
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
    const extension = heck.resolve(obstacle);
    const { noodle, worldRotation } = extension;
    const state = stateAt(obstacle.songBpmTime, noodle, legacyTiming.obstacles.has(obstacle));
    const unitsPerBeat = state.halfJumpDistance / state.halfJumpDurationInBeats;
    const motion = motionFor(
      state,
      obstacle.songBpmTime,
      leadInBeats,
      obstacle.songBpmTime + obstacle.durationSongBpmTime + state.halfJumpDurationInBeats,
    );
    const bounds = heck.obstacleBounds(obstacle, obstacleBounds(obstacle, majorVersion));
    const placement = obstaclePlacement(bounds);
    const customColor = chromaColor(obstacle.customData);
    walls.push({
      ...motion,
      x: options.leftHanded === true ? -placement.x : placement.x,
      y: placement.y,
      rotationDeg: worldRotation === undefined ? obstacle.rotation * (options.leftHanded === true ? -1 : 1) : 0,
      width: placement.width,
      height: placement.height,
      lengthUnits:
        noodle?.obstacleSize?.[2] === undefined
          ? obstacle.durationSongBpmTime * unitsPerBeat
          : noodle.obstacleSize[2] * 0.6,
      durationBeats: obstacle.durationSongBpmTime,
      pullBeat: obstacle.songBpmTime + obstacle.durationSongBpmTime + wallTailGraceBeats(options.songBpm),
      worldRotation,
      noodle,
      customColor,
      legacySolidCore: usesLegacySolidObstacleCore(customColor, options.legacyNoodleV2Semantics),
    });
  }

  const links: ChainLinkInstance[] = [];
  for (const chain of difficulty.chains) {
    const extension = heck.resolve(chain);
    const { noodle, worldRotation } = extension;
    const interactable = !chain.customFake && noodle?.uninteractable !== true;
    const replayable = !chain.customFake && heck.canBecomeInteractable(chain);
    const state = stateAt(chain.songBpmTime, noodle);
    const hjdBeats = state.halfJumpDurationInBeats;
    const unitsPerBeat = state.halfJumpDistance / hjdBeats;
    const head = heck.position(chain);
    const tail = heck.tailPosition(chain);
    const colorIndex = chain.color === 1 ? 1 : 0;
    for (const link of chainLinks(chain, { head, tail })) {
      const beat = chain.songBpmTime + (chain.tailSongBpmTime - chain.songBpmTime) * link.t;
      const noteTime = songBpmTimeToSeconds(beat, options.songBpm);
      const replayColorType = options.leftHanded === true ? 1 - chain.color : chain.color;
      const replayEvent = !replayable
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
        interactable,
        worldRotation,
        noodle,
        customColor: objectColor(chain.customData),
        replayEndTime: replayEvent?.time,
        replayEventType: replayEvent?.eventType,
        replayIdentity: replayable ? { time: noteTime, colorType: replayColorType } : undefined,
      });
    }
  }

  const arcs: ArcInstance[] = [];
  for (const [index, arc] of difficulty.arcs.entries()) {
    const extension = heck.resolve(arc);
    const { noodle, worldRotation } = extension;
    const state = stateAt(arc.songBpmTime, noodle);
    const unitsPerBeat = state.halfJumpDistance / state.halfJumpDurationInBeats;
    const zDistance = (arc.tailSongBpmTime - arc.songBpmTime) * unitsPerBeat;
    const head = heck.position(arc);
    const tail = heck.tailPosition(arc);
    function hasNote(beat: number, position: { x: number; y: number }) {
      return difficulty.notes.some(
        (note) =>
          note.type === arc.color &&
          approximately(note.songBpmTime, beat) &&
          samePosition(position, heck.position(note)),
      );
    }
    const hasHeadNote = hasNote(arc.songBpmTime, head);
    const hasTailNote = hasNote(arc.tailSongBpmTime, tail);
    const path = arcPath(arc, zDistance, hasHeadNote, hasTailNote, {
      head,
      tail,
    });
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
      worldRotation,
      noodle,
      customColor: objectColor(arc.customData),
      points,
    });
  }

  let endBeat = 0;
  for (const list of [notes, bombs, walls, links]) {
    for (const item of list) endBeat = Math.max(endBeat, item.despawnBeat);
  }
  for (const arc of arcs) endBeat = Math.max(endBeat, arc.despawnBeat);

  propagateInitialLinkedCuts(notes, bombs, options.songBpm, difficulty.noodle);

  return {
    notes,
    bombs,
    walls,
    chainLinks: links,
    arcs,
    capacity: {
      notes: notes.some((note) => noodleTrackControlsTime(note.noodle, difficulty.noodle))
        ? notes.length
        : maxConcurrent(notes),
      bombs: bombs.some((bomb) => noodleTrackControlsTime(bomb.noodle, difficulty.noodle))
        ? bombs.length
        : maxConcurrent(bombs),
      walls: walls.some((wall) => noodleTrackControlsTime(wall.noodle, difficulty.noodle))
        ? walls.length
        : maxConcurrent(walls),
      chainLinks: links.some((link) => noodleTrackControlsTime(link.noodle, difficulty.noodle))
        ? links.length
        : maxConcurrent(links),
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
    chromaEnvironment: difficulty.chromaEnvironment,
    noodle: difficulty.noodle,
    leftHanded: options.leftHanded === true,
    tracksPlayerZ: difficulty.rotationEvents.length === 0,
    initialPlayerHeight,
    replayHeights,
    legacyNoodleV2Semantics: options.legacyNoodleV2Semantics === true,
    noteJumpSpeed: options.noteJumpSpeed,
    noteStartBeatOffset: options.noteStartBeatOffset,
    movementStateAt: (beat) => provider.stateAt(beat),
  };
}

export function applyReplayHeightEvents(data: MapRenderData, events: ReplayHeightEvent[]) {
  if (events.length === 0) return;
  data.replayHeights.push(...events);
  for (const object of [...data.notes, ...data.bombs]) {
    if (object.tracksPlayerHeight) {
      object.y = objectJumpY(object, data.songBpm, data.initialPlayerHeight, data.replayHeights);
    }
  }
}

export function applyReplayNoteEvents(data: MapRenderData, events: ReplayNoteEvent[]) {
  let linkedObjects: Map<string, (NoteInstance | BombInstance)[]> | undefined;
  const propagate = (source: NoteInstance | BombInstance, time: number, eventType: ReplayNoteEventType | undefined) => {
    if (source.noodle?.link === undefined) return;
    linkedObjects ??= indexLinkedObjects(data.notes, data.bombs);
    propagateLinkedCut(linkedObjects, source, time, eventType, data.songBpm, data.noodle);
  };
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
      if (bomb !== undefined) {
        bomb.replayEndTime = event.time;
        propagate(bomb, event.time, undefined);
      }
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
    propagate(note, event.time, event.eventType);
    if (identity.gameplayType !== undefined) note.lookAtPlayer = identity.gameplayType === 0;
  }
}

function propagateInitialLinkedCuts(
  notes: NoteInstance[],
  bombs: BombInstance[],
  songBpm: number,
  noodle: Difficulty['noodle'],
) {
  const cuts = [
    ...notes.flatMap((object) =>
      object.replayEndTime === undefined
        ? []
        : [
            {
              object,
              time: object.replayEndTime,
              eventType: object.replayEventType,
            },
          ],
    ),
    ...bombs.flatMap((object) =>
      object.replayEndTime === undefined ? [] : [{ object, time: object.replayEndTime, eventType: undefined }],
    ),
  ].sort((left, right) => left.time - right.time);
  let linkedObjects: Map<string, (NoteInstance | BombInstance)[]> | undefined;
  for (const cut of cuts) {
    if (cut.object.noodle?.link === undefined) continue;
    linkedObjects ??= indexLinkedObjects(notes, bombs);
    propagateLinkedCut(linkedObjects, cut.object, cut.time, cut.eventType, songBpm, noodle);
  }
}

function indexLinkedObjects(notes: NoteInstance[], bombs: BombInstance[]) {
  const linked = new Map<string, (NoteInstance | BombInstance)[]>();
  for (const objects of [notes, bombs]) {
    for (const object of objects) {
      const link = object.noodle?.link;
      if (link === undefined) continue;
      const group = linked.get(link);
      if (group === undefined) linked.set(link, [object]);
      else group.push(object);
    }
  }
  return linked;
}

function linkedObjectIsActive(
  object: NoteInstance | BombInstance,
  time: number,
  songBpm: number,
  noodle: Difficulty['noodle'],
) {
  const beat = secondsToSongBpmTime(time, songBpm);
  if (beat < object.enterBeat) return false;
  const duration = object.hjdBeats * 2;
  const pathTime = (beat - object.spawnBeat) / duration;
  const override = sampleNoodleObject(object.noodle, noodle, beat, pathTime).time;
  const movementBeat = override === undefined ? beat : object.spawnBeat + override * duration;
  return movementBeat <= object.despawnBeat;
}

function propagateLinkedCut(
  linkedObjects: ReadonlyMap<string, (NoteInstance | BombInstance)[]>,
  source: NoteInstance | BombInstance,
  time: number,
  eventType: ReplayNoteEventType | undefined,
  songBpm: number,
  noodle: Difficulty['noodle'],
) {
  const link = source.noodle?.link;
  if (link === undefined) return;
  for (const object of linkedObjects.get(link) ?? []) {
    if (
      !linkedObjectIsActive(object, time, songBpm, noodle) ||
      (object.replayEndTime !== undefined && object.replayEndTime <= time)
    ) {
      continue;
    }
    object.replayEndTime = time;
    if ('replayEventType' in object) object.replayEventType = eventType;
  }
}
