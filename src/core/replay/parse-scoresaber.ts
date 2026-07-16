import { LZMA } from 'lzma-web/dist/lzma.js';
import lzmaWorkerSource from 'lzma-web/dist/lzma_worker.js?raw';

import type {
  Replay,
  ReplayColor,
  ReplayComboEvent,
  ReplayControllerOffset,
  ReplayEnergyEvent,
  ReplayHeightEvent,
  LegacyScoreSaberFrame,
  ReplayMetadata,
  ReplayMultiplierEvent,
  ReplayNoteEvent,
  ReplayNoteEventType,
  ReplayNoteId,
  ReplayPauseEvent,
  ReplayPose,
  ReplayQuaternion,
  ReplayScoreEvent,
  ReplayTransform,
  ReplayVector3,
  ReplayWallEvent,
} from './types';

export const SCORESABER_REPLAY_HEADER = new TextEncoder().encode('ScoreSaber Replay 👌🤠\r\n');
export const SCORESABER_LEGACY_REPLAY_HEADER = Uint8Array.of(0x5d, 0, 0, 0x80);

const extensionMagic = 0x31585353;
const maxReplayBytes = 128 * 1024 * 1024;
const maxListItems = 2_000_000;
const decoder = new TextDecoder('utf-8', { fatal: true });

class BinaryReader {
  private readonly view: DataView;
  private limit: number;
  offset = 0;

  constructor(private readonly bytes: Uint8Array) {
    this.view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    this.limit = bytes.byteLength;
  }

  seek(offset: number, limit = this.bytes.byteLength) {
    if (
      !Number.isInteger(offset) ||
      !Number.isInteger(limit) ||
      offset < 0 ||
      offset > limit ||
      limit > this.bytes.byteLength
    ) {
      throw new Error('ScoreSaber replay pointer is out of bounds');
    }
    this.offset = offset;
    this.limit = limit;
  }

  private require(length: number) {
    if (!Number.isInteger(length) || length < 0 || this.offset + length > this.limit) {
      throw new Error('truncated ScoreSaber replay');
    }
  }

  byte() {
    this.require(1);
    return this.bytes[this.offset++] ?? 0;
  }

  skip(length: number) {
    this.require(length);
    this.offset += length;
  }

  int32() {
    this.require(4);
    const value = this.view.getInt32(this.offset, true);
    this.offset += 4;
    return value;
  }

  int64() {
    this.require(8);
    const value = this.view.getBigInt64(this.offset, true);
    this.offset += 8;
    return value;
  }

  float32() {
    this.require(4);
    const value = this.view.getFloat32(this.offset, true);
    this.offset += 4;
    if (!Number.isFinite(value)) throw new Error('ScoreSaber replay contains a non-finite number');
    return value;
  }

  bool() {
    return this.byte() !== 0;
  }

  string() {
    const length = this.int32();
    this.require(length);
    let value: string;
    try {
      value = decoder.decode(this.bytes.subarray(this.offset, this.offset + length));
    } catch {
      throw new Error('ScoreSaber replay contains invalid UTF-8');
    }
    this.offset += length;
    return value;
  }

  raw(length: number) {
    this.require(length);
    const value = this.bytes.slice(this.offset, this.offset + length);
    this.offset += length;
    return value;
  }

  count(label: string, minimumBytes: number) {
    const count = this.int32();
    if (count < 0 || count > maxListItems || count * minimumBytes > this.bytes.byteLength) {
      throw new Error(`invalid ScoreSaber replay ${label} count`);
    }
    return count;
  }
}

export function hasScoreSaberReplayHeader(data: Uint8Array) {
  return (
    data.byteLength >= SCORESABER_REPLAY_HEADER.byteLength &&
    SCORESABER_REPLAY_HEADER.every((byte, index) => data[index] === byte)
  );
}

export function hasLegacyScoreSaberReplayHeader(data: Uint8Array) {
  return (
    data.byteLength >= SCORESABER_LEGACY_REPLAY_HEADER.byteLength &&
    SCORESABER_LEGACY_REPLAY_HEADER.every((byte, index) => data[index] === byte)
  );
}

export function isScoreSaberReplay(data: Uint8Array) {
  return hasScoreSaberReplayHeader(data) || hasLegacyScoreSaberReplayHeader(data);
}

function outputSize(stream: Uint8Array) {
  if (stream.byteLength < 13) throw new Error('truncated ScoreSaber replay LZMA stream');
  const view = new DataView(stream.buffer, stream.byteOffset, stream.byteLength);
  const size = view.getBigUint64(5, true);
  if (size > BigInt(maxReplayBytes)) throw new Error('ScoreSaber replay is too large');
  return Number(size);
}

const lzmaWorkerUrl = URL.createObjectURL(
  new Blob([`var exports = {};\n${lzmaWorkerSource}`], { type: 'text/javascript' }),
);
const lzma = LZMA(lzmaWorkerUrl);

async function decompressReplay(stream: Uint8Array) {
  const expectedSize = outputSize(stream);
  let result: Uint8Array | string;
  try {
    result = await new Promise<Uint8Array | string>((resolve, reject) => {
      lzma.decompress(stream, (value, error) => {
        if (error !== undefined && error !== null) reject(error);
        else if (value === null) reject(new Error('empty ScoreSaber replay payload'));
        else resolve(value);
      });
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`invalid ScoreSaber replay LZMA stream: ${detail}`, { cause: error });
  }
  if (typeof result === 'string') throw new Error('invalid ScoreSaber replay binary payload');
  const bytes = Uint8Array.from(result, (value) => value & 0xff);
  if (bytes.byteLength !== expectedSize) throw new Error('truncated ScoreSaber replay LZMA payload');
  return bytes;
}

function vector3(reader: BinaryReader): ReplayVector3 {
  return { x: reader.float32(), y: reader.float32(), z: reader.float32() };
}

function quaternion(reader: BinaryReader): ReplayQuaternion {
  return { ...vector3(reader), w: reader.float32() };
}

function transform(reader: BinaryReader): ReplayTransform {
  return { position: vector3(reader), rotation: quaternion(reader) };
}

function color(reader: BinaryReader): ReplayColor | undefined {
  return reader.bool() ? { ...vector3(reader), a: reader.float32() } : undefined;
}

function versionParts(version: string) {
  const match = /^(\d+)\.(\d+)\.(\d+)(?:\.|$)/.exec(version);
  if (match === null) throw new Error(`invalid ScoreSaber replay version ${version}`);
  return match.slice(1).map(Number);
}

function compareVersion(left: string, right: string) {
  const a = versionParts(left);
  const b = versionParts(right);
  for (let index = 0; index < 3; index++) {
    const difference = (a[index] ?? 0) - (b[index] ?? 0);
    if (difference !== 0) return difference;
  }
  return 0;
}

function metadata(reader: BinaryReader): ReplayMetadata {
  const version = reader.string();
  const value: ReplayMetadata = {
    version,
    levelId: reader.string(),
    difficulty: reader.int32(),
    characteristic: reader.string(),
    environment: reader.string(),
    modifiers: strings(reader),
    noteSpawnOffset: reader.float32(),
    leftHanded: reader.bool(),
    initialHeight: reader.float32(),
    roomRotation: reader.float32(),
    roomCenter: vector3(reader),
    failTime: reader.float32(),
    hasPlaySettings: false,
  };
  if (compareVersion(version, '3.1.0') >= 0) {
    value.gameVersion = reader.string();
    value.pluginVersion = reader.string();
    value.platform = reader.string();
  }
  return value;
}

function pose(reader: BinaryReader): ReplayPose {
  return {
    head: transform(reader),
    leftHand: transform(reader),
    rightHand: transform(reader),
    fps: reader.int32(),
    time: reader.float32(),
  };
}

function noteId(reader: BinaryReader, version3: boolean): ReplayNoteId {
  const value: ReplayNoteId = {
    time: reader.float32(),
    lineLayer: reader.int32(),
    lineIndex: reader.int32(),
    colorType: reader.int32(),
    cutDirection: reader.int32(),
  };
  if (version3) {
    value.gameplayType = reader.int32();
    value.scoringType = reader.int32();
    value.cutDirectionAngleOffset = reader.float32();
  }
  return value;
}

function replayNoteEventType(value: number): ReplayNoteEventType {
  switch (value) {
    case 0:
    case 1:
    case 2:
    case 3:
    case 4:
      return value;
    default:
      throw new Error(`invalid ScoreSaber note event type ${String(value)}`);
  }
}

function note(reader: BinaryReader, version3: boolean): ReplayNoteEvent {
  const id = noteId(reader, version3);
  const eventType = replayNoteEventType(reader.int32());
  const value: ReplayNoteEvent = {
    noteId: id,
    eventType,
    cutPoint: vector3(reader),
    cutNormal: vector3(reader),
    saberDirection: vector3(reader),
    saberType: reader.int32(),
    directionOk: reader.bool(),
    saberSpeed: reader.float32(),
    cutAngle: reader.float32(),
    cutDistanceToCenter: reader.float32(),
    cutDirectionDeviation: reader.float32(),
    beforeCutRating: reader.float32(),
    afterCutRating: reader.float32(),
    time: reader.float32(),
    unityTimescale: reader.float32(),
    timeSyncTimescale: reader.float32(),
  };
  if (version3) {
    value.timeDeviation = reader.float32();
    value.worldRotation = quaternion(reader);
    value.inverseWorldRotation = quaternion(reader);
    value.noteRotation = quaternion(reader);
    value.notePosition = vector3(reader);
  }
  return value;
}

function score(reader: BinaryReader, version3: boolean): ReplayScoreEvent {
  const value: ReplayScoreEvent = { score: reader.int32(), time: reader.float32() };
  if (version3) value.immediateMaxPossibleScore = reader.int32();
  return value;
}

function combo(reader: BinaryReader): ReplayComboEvent {
  return { combo: reader.int32(), time: reader.float32() };
}

function multiplier(reader: BinaryReader): ReplayMultiplierEvent {
  return { multiplier: reader.int32(), nextMultiplierProgress: reader.float32(), time: reader.float32() };
}

function energy(reader: BinaryReader): ReplayEnergyEvent {
  return { energy: reader.float32(), time: reader.float32() };
}

function height(reader: BinaryReader): ReplayHeightEvent {
  return { height: reader.float32(), time: reader.float32() };
}

function pause(reader: BinaryReader): ReplayPauseEvent {
  return {
    time: reader.float32(),
    duration: reader.int64(),
    unixStartTime: reader.int64(),
    unixEndTime: reader.int64(),
  };
}

function wall(reader: BinaryReader): ReplayWallEvent {
  return {
    time: reader.float32(),
    exitTime: reader.float32(),
    energy: reader.float32(),
    obstacleTime: reader.float32(),
    obstacleDuration: reader.float32(),
    lineIndex: reader.int32(),
    lineLayer: reader.int32(),
    width: reader.int32(),
    height: reader.int32(),
  };
}

function controllerOffset(reader: BinaryReader): ReplayControllerOffset | undefined {
  return reader.bool() ? { position: vector3(reader), rotation: vector3(reader) } : undefined;
}

function strings(reader: BinaryReader) {
  return Array.from({ length: reader.count('string', 4) }, () => reader.string());
}

function list<T>(reader: BinaryReader, label: string, minimumBytes: number, read: (reader: BinaryReader) => T) {
  return Array.from({ length: reader.count(label, minimumBytes) }, () => read(reader));
}

function readPlaySettings(replay: Replay, reader: BinaryReader) {
  const metadata = replay.metadata;
  metadata.hasPlaySettings = true;
  metadata.songSpeed = reader.float32();
  metadata.jumpDistance = reader.float32();
  metadata.leftSaberColor = color(reader);
  metadata.rightSaberColor = color(reader);
  metadata.obstacleColor = color(reader);
  metadata.environmentColor0 = color(reader);
  metadata.environmentColor1 = color(reader);
  metadata.environmentColorW = color(reader);
  metadata.environmentColor0Boost = color(reader);
  metadata.environmentColor1Boost = color(reader);
  metadata.environmentColorWBoost = color(reader);
  metadata.supportsEnvironmentColorBoost = reader.bool();
  const environment = reader.string();
  if (environment !== '') metadata.environment = environment;
  metadata.environmentEffectsFilterDefaultPreset = reader.int32();
  metadata.environmentEffectsFilterExpertPlusPreset = reader.int32();
  metadata.environmentEffectsFilterPreset = reader.int32();
  metadata.noTextsAndHuds = reader.bool();
  metadata.saberTrailIntensity = reader.float32();
  metadata.hideNoteSpawnEffect = reader.bool();
  metadata.arcsHapticFeedback = reader.bool();
  metadata.arcVisibility = reader.int32();
}

function readExtensions(replay: Replay, reader: BinaryReader, offset: number, byteLength: number) {
  if (offset <= 0 || offset >= byteLength) return;
  reader.seek(offset);
  if (reader.int32() !== extensionMagic || reader.int32() !== 1) return;
  const entryCount = reader.count('extension', 12);
  for (let index = 0; index < entryCount; index++) {
    const id = reader.string();
    const version = reader.int32();
    const length = reader.int32();
    if (length < 0 || reader.offset + length > byteLength)
      throw new Error('ScoreSaber replay extension is out of bounds');
    const payloadOffset = reader.offset;
    const nextOffset = reader.offset + length;
    reader.seek(payloadOffset, nextOffset);
    if (version === 1 && id === 'scoresaber.play-settings') readPlaySettings(replay, reader);
    else if (version === 1 && id === 'scoresaber.pause-events') replay.pauses = list(reader, 'pause', 28, pause);
    else if (version === 1 && id === 'scoresaber.wall-events') replay.walls = list(reader, 'wall', 36, wall);
    else if (version === 1 && id === 'scoresaber.controller-offsets') {
      replay.metadata.controllerOffsets = {
        shared: controllerOffset(reader),
        left: controllerOffset(reader),
        right: controllerOffset(reader),
      };
    } else if (version === 1 && id === 'scoresaber.hsv-config') replay.hsvConfig = reader.raw(length);
    reader.seek(nextOffset, byteLength);
  }
}

export function applyScoreSaberReplayExtension(
  replay: Replay,
  id: string,
  version: number,
  payload: Uint8Array,
  append = false,
) {
  if (version !== 1 || payload.byteLength === 0) return;
  const reader = new BinaryReader(payload);
  switch (id) {
    case 'scoresaber.play-settings':
      readPlaySettings(replay, reader);
      break;
    case 'scoresaber.pause-events': {
      const values = list(reader, 'pause', 28, pause);
      if (append) replay.pauses.push(...values);
      else replay.pauses = values;
      break;
    }
    case 'scoresaber.wall-events': {
      const values = list(reader, 'wall', 36, wall);
      if (append) replay.walls.push(...values);
      else replay.walls = values;
      break;
    }
    case 'scoresaber.controller-offsets':
      replay.metadata.controllerOffsets = {
        shared: controllerOffset(reader),
        left: controllerOffset(reader),
        right: controllerOffset(reader),
      };
      break;
    case 'scoresaber.hsv-config':
      replay.hsvConfig = reader.raw(payload.byteLength);
  }
}

interface LegacyKeyframe extends LegacyScoreSaberFrame {
  rightHand: ReplayTransform;
  leftHand: ReplayTransform;
  head: ReplayTransform;
}

function nrbfString(reader: BinaryReader) {
  let length = 0;
  for (let shift = 0; shift <= 28; shift += 7) {
    const byte = reader.byte();
    length |= (byte & 0x7f) << shift;
    if ((byte & 0x80) === 0) {
      try {
        return decoder.decode(reader.raw(length));
      } catch {
        throw new Error('legacy ScoreSaber replay contains invalid UTF-8');
      }
    }
  }
  throw new Error('invalid legacy ScoreSaber replay string length');
}

function skipNrbfTypeInfo(reader: BinaryReader, type: number) {
  switch (type) {
    case 0:
    case 7:
      reader.skip(1);
      break;
    case 3:
      nrbfString(reader);
      break;
    case 4:
      nrbfString(reader);
      reader.skip(4);
  }
}

function legacyKeyframe(reader: BinaryReader): LegacyKeyframe {
  const rightPosition = vector3(reader);
  const leftPosition = vector3(reader);
  const headPosition = vector3(reader);
  return {
    rightHand: { position: rightPosition, rotation: quaternion(reader) },
    leftHand: { position: leftPosition, rotation: quaternion(reader) },
    head: { position: headPosition, rotation: quaternion(reader) },
    time: reader.float32(),
    combo: reader.int32(),
    score: reader.int32(),
  };
}

function parseLegacyKeyframes(bytes: Uint8Array) {
  const reader = new BinaryReader(bytes);
  const keyframes: LegacyKeyframe[] = [];
  let keyframeClassId = -1;

  while (reader.offset < bytes.byteLength) {
    const recordType = reader.byte();
    switch (recordType) {
      case 0:
        reader.skip(16);
        break;
      case 1: {
        reader.skip(4);
        const metadataId = reader.int32();
        if (metadataId === keyframeClassId) keyframes.push(legacyKeyframe(reader));
        break;
      }
      case 5: {
        const objectId = reader.int32();
        const className = nrbfString(reader);
        const memberCount = reader.int32();
        if (memberCount < 0 || memberCount > 256) throw new Error('invalid legacy ScoreSaber replay class');
        for (let index = 0; index < memberCount; index++) nrbfString(reader);
        const memberTypes = Array.from({ length: memberCount }, () => reader.byte());
        for (const memberType of memberTypes) skipNrbfTypeInfo(reader, memberType);
        reader.skip(4);
        if (className.includes('KeyframeSerializable')) {
          if (memberCount !== 24) throw new Error('unsupported legacy ScoreSaber replay keyframe');
          keyframeClassId = objectId;
          keyframes.push(legacyKeyframe(reader));
        }
        break;
      }
      case 6:
        reader.skip(4);
        nrbfString(reader);
        break;
      case 7: {
        reader.skip(4);
        const arrayType = reader.byte();
        const rank = reader.int32();
        if (rank < 1 || rank > 32) throw new Error('invalid legacy ScoreSaber replay array');
        for (let index = 0; index < rank; index++) {
          const length = reader.int32();
          if (length < 0 || length > maxListItems) throw new Error('invalid legacy ScoreSaber replay array');
        }
        if (arrayType >= 3 && arrayType <= 5) reader.skip(rank * 4);
        skipNrbfTypeInfo(reader, reader.byte());
        break;
      }
      case 9:
        reader.skip(4);
        break;
      case 10:
        break;
      case 11:
        if (keyframes.length === 0) throw new Error('legacy ScoreSaber replay has no keyframes');
        return keyframes;
      case 12:
        reader.skip(4);
        nrbfString(reader);
        break;
      case 13:
        reader.skip(1);
        break;
      case 14:
        reader.skip(4);
        break;
      case 16: {
        reader.skip(4);
        const length = reader.int32();
        if (length < 0 || length > maxListItems) throw new Error('invalid legacy ScoreSaber replay array');
        break;
      }
      default:
        throw new Error(`unsupported legacy ScoreSaber replay record ${String(recordType)}`);
    }
    if (keyframes.length > maxListItems) throw new Error('legacy ScoreSaber replay has too many keyframes');
  }
  throw new Error('truncated legacy ScoreSaber replay');
}

function legacyMultiplier(combo: number) {
  if (combo < 2) return { multiplier: 1, nextMultiplierProgress: combo / 2 };
  if (combo < 6) return { multiplier: 2, nextMultiplierProgress: (combo - 2) / 4 };
  if (combo < 14) return { multiplier: 4, nextMultiplierProgress: (combo - 6) / 8 };
  return { multiplier: 8, nextMultiplierProgress: 0 };
}

export function parseLegacyScoreSaberPayload(bytes: Uint8Array): Replay {
  const keyframes = parseLegacyKeyframes(bytes);
  const poses: ReplayPose[] = [];
  const scores: ReplayScoreEvent[] = [];
  const combos: ReplayComboEvent[] = [];
  const multipliers: ReplayMultiplierEvent[] = [];
  let previousScore: number | undefined;
  let previousCombo: number | undefined;

  for (const keyframe of keyframes) {
    if (keyframe.time !== 0 && keyframe.time !== poses.at(-1)?.time) {
      poses.push({
        time: keyframe.time,
        fps: 0,
        head: keyframe.head,
        leftHand: keyframe.leftHand,
        rightHand: keyframe.rightHand,
      });
    }
    if (keyframe.score !== previousScore) {
      scores.push({ score: keyframe.score, time: keyframe.time });
      previousScore = keyframe.score;
    }
    if (keyframe.combo !== previousCombo) {
      combos.push({ combo: keyframe.combo, time: keyframe.time });
      multipliers.push({ ...legacyMultiplier(Math.max(0, keyframe.combo)), time: keyframe.time });
      previousCombo = keyframe.combo;
    }
  }

  return {
    metadata: {
      version: 'ScoreSaberLegacy',
      levelId: '',
      difficulty: -1,
      characteristic: '',
      environment: '',
      modifiers: [],
      noteSpawnOffset: 0,
      leftHanded: false,
      initialHeight: poses[0]?.head.position.y ?? 0,
      roomRotation: 0,
      roomCenter: { x: 0, y: 0, z: 0 },
      failTime: 0,
      hasPlaySettings: false,
    },
    poses,
    heights: [],
    notes: [],
    scores,
    combos,
    multipliers,
    energies: [],
    pauses: [],
    walls: [],
    legacyScoreSaber: {
      frames: keyframes.map(({ time, score, combo }) => ({ time, score, combo })),
      converted: false,
    },
  };
}

export function applyLegacyScoreSaberMetadata(
  replay: Replay,
  metadata: { hash: string; difficulty: number; characteristic: string },
) {
  if (replay.legacyScoreSaber === undefined) return;
  replay.metadata.levelId = `custom_level_${metadata.hash}`;
  replay.metadata.difficulty = metadata.difficulty;
  replay.metadata.characteristic = metadata.characteristic;
}

export function parseScoreSaberPayload(bytes: Uint8Array): Replay {
  const reader = new BinaryReader(bytes);
  const pointers = Array.from({ length: 9 }, () => reader.int32());
  const [
    metadataPointer,
    posePointer,
    heightPointer,
    notePointer,
    scorePointer,
    comboPointer,
    multiplierPointer,
    energyPointer,
    extensionsPointer,
  ] = pointers;
  if (
    metadataPointer === undefined ||
    posePointer === undefined ||
    heightPointer === undefined ||
    notePointer === undefined ||
    scorePointer === undefined ||
    comboPointer === undefined ||
    multiplierPointer === undefined ||
    energyPointer === undefined ||
    extensionsPointer === undefined
  )
    throw new Error('ScoreSaber replay pointer table is missing');

  const requiredPointers = pointers.slice(0, 8);
  if (
    metadataPointer < 36 ||
    requiredPointers.some(
      (pointer, index) =>
        pointer < 0 || pointer >= bytes.byteLength || (index > 0 && pointer < (requiredPointers[index - 1] ?? 0)),
    ) ||
    (extensionsPointer !== 0 && (extensionsPointer < energyPointer || extensionsPointer >= bytes.byteLength))
  )
    throw new Error('ScoreSaber replay pointer is out of bounds');
  const energyEnd = extensionsPointer === 0 ? bytes.byteLength : extensionsPointer;

  reader.seek(metadataPointer, posePointer);
  const replayMetadata = metadata(reader);
  if (compareVersion(replayMetadata.version, '3.1.0') > 0) {
    throw new Error(`unsupported ScoreSaber replay version ${replayMetadata.version}`);
  }
  const version3 = replayMetadata.version !== '2.0.0';

  reader.seek(posePointer, heightPointer);
  const poses = list(reader, 'pose', 92, pose);
  reader.seek(heightPointer, notePointer);
  const heights = list(reader, 'height', 8, height);
  reader.seek(notePointer, scorePointer);
  const notes = list(reader, 'note', version3 ? 177 : 101, (source) => note(source, version3));
  reader.seek(scorePointer, comboPointer);
  const scores = list(reader, 'score', version3 ? 12 : 8, (source) => score(source, version3));
  reader.seek(comboPointer, multiplierPointer);
  const combos = list(reader, 'combo', 8, combo);
  reader.seek(multiplierPointer, energyPointer);
  const multipliers = list(reader, 'multiplier', 12, multiplier);
  reader.seek(energyPointer, energyEnd);
  const energies = list(reader, 'energy', 8, energy);

  const replay: Replay = {
    metadata: replayMetadata,
    poses,
    heights,
    notes,
    scores,
    combos,
    multipliers,
    energies,
    pauses: [],
    walls: [],
  };
  readExtensions(replay, reader, extensionsPointer, bytes.byteLength);
  return replay;
}

export async function parseScoreSaberReplay(data: Uint8Array) {
  if (hasScoreSaberReplayHeader(data)) {
    return parseScoreSaberPayload(await decompressReplay(data.subarray(SCORESABER_REPLAY_HEADER.byteLength)));
  }
  if (hasLegacyScoreSaberReplayHeader(data)) return parseLegacyScoreSaberPayload(await decompressReplay(data));
  throw new Error('unsupported ScoreSaber replay file');
}
