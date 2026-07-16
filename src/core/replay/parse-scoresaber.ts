import { LZMA } from 'lzma-web/dist/lzma.js';
import lzmaWorkerSource from 'lzma-web/dist/lzma_worker.js?raw';

import type {
  Replay,
  ReplayColor,
  ReplayComboEvent,
  ReplayControllerOffset,
  ReplayEnergyEvent,
  ReplayHeightEvent,
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
    this.require(1);
    return this.bytes[this.offset++] !== 0;
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
  if (!hasScoreSaberReplayHeader(data)) throw new Error('unsupported ScoreSaber replay file');
  return parseScoreSaberPayload(await decompressReplay(data.subarray(SCORESABER_REPLAY_HEADER.byteLength)));
}
