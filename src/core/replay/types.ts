export interface ReplayVector3 {
  x: number;
  y: number;
  z: number;
}

export interface ReplayQuaternion extends ReplayVector3 {
  w: number;
}

export interface ReplayTransform {
  position: ReplayVector3;
  rotation: ReplayQuaternion;
}

export interface ReplayColor extends ReplayVector3 {
  a: number;
}

export interface ReplayControllerOffset {
  position: ReplayVector3;
  rotation: ReplayVector3;
}

export interface ReplayControllerOffsets {
  shared?: ReplayControllerOffset;
  left?: ReplayControllerOffset;
  right?: ReplayControllerOffset;
}

export interface ReplayMetadata {
  version: string;
  levelId: string;
  difficulty: number;
  characteristic: string;
  environment: string;
  modifiers: string[];
  noteSpawnOffset: number;
  leftHanded: boolean;
  initialHeight: number;
  roomRotation: number;
  roomCenter: ReplayVector3;
  failTime: number;
  gameVersion?: string;
  pluginVersion?: string;
  platform?: string;
  hasPlaySettings: boolean;
  songSpeed?: number;
  jumpDistance?: number;
  leftSaberColor?: ReplayColor;
  rightSaberColor?: ReplayColor;
  obstacleColor?: ReplayColor;
  environmentColor0?: ReplayColor;
  environmentColor1?: ReplayColor;
  environmentColorW?: ReplayColor;
  environmentColor0Boost?: ReplayColor;
  environmentColor1Boost?: ReplayColor;
  environmentColorWBoost?: ReplayColor;
  supportsEnvironmentColorBoost?: boolean;
  environmentEffectsFilterDefaultPreset?: number;
  environmentEffectsFilterExpertPlusPreset?: number;
  environmentEffectsFilterPreset?: number;
  noTextsAndHuds?: boolean;
  saberTrailIntensity?: number;
  hideNoteSpawnEffect?: boolean;
  arcsHapticFeedback?: boolean;
  arcVisibility?: number;
  controllerOffsets?: ReplayControllerOffsets;
}

export interface ReplayPose {
  time: number;
  fps: number;
  head: ReplayTransform;
  leftHand: ReplayTransform;
  rightHand: ReplayTransform;
}

export interface ReplayNoteId {
  time: number;
  lineLayer: number;
  lineIndex: number;
  colorType: number;
  cutDirection: number;
  gameplayType?: number;
  scoringType?: number;
  cutDirectionAngleOffset?: number;
}

export type ReplayNoteEventType = 0 | 1 | 2 | 3 | 4;

export interface ReplayNoteEvent {
  noteId: ReplayNoteId;
  eventType: ReplayNoteEventType;
  cutPoint: ReplayVector3;
  cutNormal: ReplayVector3;
  saberDirection: ReplayVector3;
  saberType: number;
  directionOk: boolean;
  saberSpeed: number;
  cutAngle: number;
  cutDistanceToCenter: number;
  cutDirectionDeviation: number;
  beforeCutRating: number;
  afterCutRating: number;
  time: number;
  unityTimescale: number;
  timeSyncTimescale: number;
  timeDeviation?: number;
  worldRotation?: ReplayQuaternion;
  inverseWorldRotation?: ReplayQuaternion;
  noteRotation?: ReplayQuaternion;
  notePosition?: ReplayVector3;
}

export interface ReplayScoreEvent {
  score: number;
  time: number;
  immediateMaxPossibleScore?: number;
}

export interface ReplayComboEvent {
  combo: number;
  time: number;
}

export interface ReplayMultiplierEvent {
  multiplier: number;
  nextMultiplierProgress: number;
  time: number;
}

export interface ReplayEnergyEvent {
  energy: number;
  time: number;
}

export interface ReplayHeightEvent {
  height: number;
  time: number;
}

export interface ReplayPauseEvent {
  time: number;
  duration: bigint;
  unixStartTime: bigint;
  unixEndTime: bigint;
}

export interface ReplayWallEvent {
  time: number;
  exitTime: number;
  energy: number;
  obstacleTime: number;
  obstacleDuration: number;
  lineIndex: number;
  lineLayer: number;
  width: number;
  height: number;
}

export interface LegacyScoreSaberFrame {
  time: number;
  score: number;
  combo: number;
}

export interface LegacyScoreSaberData {
  frames: LegacyScoreSaberFrame[];
  converted: boolean;
}

export interface Replay {
  metadata: ReplayMetadata;
  poses: ReplayPose[];
  heights: ReplayHeightEvent[];
  notes: ReplayNoteEvent[];
  scores: ReplayScoreEvent[];
  combos: ReplayComboEvent[];
  multipliers: ReplayMultiplierEvent[];
  energies: ReplayEnergyEvent[];
  pauses: ReplayPauseEvent[];
  walls: ReplayWallEvent[];
  hsvConfig?: Uint8Array;
  legacyScoreSaber?: LegacyScoreSaberData;
}

export function replayMapHash(replay: Replay) {
  return /([0-9a-f]{40})$/i.exec(replay.metadata.levelId)?.[1]?.toUpperCase() ?? null;
}
