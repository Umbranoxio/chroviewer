export type BeatmapCustomDataValue = string | number | boolean | null | BeatmapCustomDataValue[] | BeatmapCustomData;

export interface BeatmapCustomData {
  [key: string]: BeatmapCustomDataValue;
}

export const NoteType = {
  Red: 0,
  Blue: 1,
  Bomb: 3,
};

export const ExecutionTime = {
  Early: 0,
  Late: 1,
};

export const MidAnchorMode = {
  Straight: 0,
  Clockwise: 1,
  CounterClockwise: 2,
};

export interface BpmEvent {
  jsonTime: number;
  songBpmTime: number;
  bpm: number;
}

export interface BasicEvent {
  jsonTime: number;
  songBpmTime: number;
  type: number;
  value: number;
  floatValue: number;
  customData?: BeatmapCustomData;
}

export interface RotationEvent {
  jsonTime: number;
  songBpmTime: number;
  executionTime: number;
  rotation: number;
  customData?: BeatmapCustomData;
}

export interface NjsEvent {
  jsonTime: number;
  songBpmTime: number;
  usePrevious: number;
  easing: number;
  relativeNjs: number;
}

export interface Bookmark {
  jsonTime: number;
  songBpmTime: number;
  name: string;
  color: [number, number, number, number];
}

export interface IndexFilter {
  type: number;
  param0: number;
  param1: number;
  reverse: number;
  chunks: number;
  random: number;
  seed: number;
  limit: number;
  limitAffectsType: number;
}

export interface LightColorEvent {
  relativeJsonTime: number;
  color: number;
  brightness: number;
  easing: number;
  usePrevious: number;
  frequency: number;
  strobeBrightness: number;
  strobeFade: number;
  customData?: BeatmapCustomData;
}

export interface LightRotationEvent {
  relativeJsonTime: number;
  rotation: number;
  direction: number;
  easing: number;
  loop: number;
  usePrevious: number;
  customData?: BeatmapCustomData;
}

export interface LightTranslationEvent {
  relativeJsonTime: number;
  translation: number;
  easing: number;
  usePrevious: number;
  customData?: BeatmapCustomData;
}

export interface FloatFxEvent {
  relativeJsonTime: number;
  value: number;
  easing: number;
  usePrevious: number;
}

export interface EventBox<T> {
  indexFilter: IndexFilter;
  beatDistribution: number;
  beatDistributionType: number;
  distribution: number;
  distributionType: number;
  affectFirst: number;
  easing: number;
  events: T[];
}

export type LightColorEventBox = EventBox<LightColorEvent>;

export interface LightTransformEventBox<T> extends EventBox<T> {
  axis: number;
  flip: number;
}

export interface EventBoxGroup<T> {
  jsonTime: number;
  songBpmTime: number;
  id: number;
  boxes: T[];
  customData?: BeatmapCustomData;
}

export interface FxEventBoxGroup extends EventBoxGroup<EventBox<FloatFxEvent>> {
  type: number;
}

export interface Note {
  jsonTime: number;
  songBpmTime: number;
  posX: number;
  posY: number;
  type: number;
  cutDirection: number;
  angleOffset: number;
  rotation: number;
  customFake: boolean;
  customData?: BeatmapCustomData;
}

export interface Obstacle {
  jsonTime: number;
  songBpmTime: number;
  rotation: number;
  posX: number;
  posY: number;
  type: number;
  duration: number;
  durationSongBpmTime: number;
  width: number;
  height: number;
  customFake: boolean;
  customData?: BeatmapCustomData;
}

export interface Arc {
  jsonTime: number;
  songBpmTime: number;
  color: number;
  posX: number;
  posY: number;
  cutDirection: number;
  angleOffset: number;
  rotation: number;
  headControlPointLengthMultiplier: number;
  tailJsonTime: number;
  tailSongBpmTime: number;
  tailPosX: number;
  tailPosY: number;
  tailCutDirection: number;
  tailControlPointLengthMultiplier: number;
  tailRotation: number;
  midAnchorMode: number;
  customData?: BeatmapCustomData;
}

export interface Chain {
  jsonTime: number;
  songBpmTime: number;
  color: number;
  posX: number;
  posY: number;
  cutDirection: number;
  angleOffset: number;
  rotation: number;
  tailJsonTime: number;
  tailSongBpmTime: number;
  tailPosX: number;
  tailPosY: number;
  tailRotation: number;
  sliceCount: number;
  squish: number;
  customFake: boolean;
  customData?: BeatmapCustomData;
}

export interface Difficulty {
  version: string;
  bookmarks: Bookmark[];
  bpmEvents: BpmEvent[];
  notes: Note[];
  obstacles: Obstacle[];
  arcs: Arc[];
  chains: Chain[];
  events: BasicEvent[];
  rotationEvents: RotationEvent[];
  njsEvents: NjsEvent[];
  lightColorEventBoxGroups: EventBoxGroup<LightColorEventBox>[];
  lightRotationEventBoxGroups: EventBoxGroup<LightTransformEventBox<LightRotationEvent>>[];
  lightTranslationEventBoxGroups: EventBoxGroup<LightTransformEventBox<LightTranslationEvent>>[];
  fxEventBoxGroups: FxEventBoxGroup[];
}

export function sortByJsonTime<T extends { jsonTime: number }>(items: T[]): T[] {
  return items.sort((a, b) => a.jsonTime - b.jsonTime);
}

export function createDifficulty(version: string): Difficulty {
  return {
    version,
    bookmarks: [],
    bpmEvents: [],
    notes: [],
    obstacles: [],
    arcs: [],
    chains: [],
    events: [],
    rotationEvents: [],
    njsEvents: [],
    lightColorEventBoxGroups: [],
    lightRotationEventBoxGroups: [],
    lightTranslationEventBoxGroups: [],
    fxEventBoxGroups: [],
  };
}
