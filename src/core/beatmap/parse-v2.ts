import { z } from 'zod';

import {
  createDifficulty,
  ExecutionTime,
  sortByJsonTime,
  type BasicEvent,
  type BpmEvent,
  type Difficulty,
  type Note,
  type Obstacle,
  type RotationEvent,
} from './types';
import {
  beatSaberJsonObjectSchema as customDataSchema,
  beatSaberNumberSchema as numberSchema,
  beatSaberStringSchema,
} from './value-schema';

const requiredNumberSchema = z.preprocess((value) => {
  if (value === undefined) return undefined;
  return numberSchema.parse(value);
}, z.number());
const requiredIntegerSchema = requiredNumberSchema.transform(Math.trunc);
const noteSchema = z.object({
  _time: requiredNumberSchema,
  _lineIndex: requiredIntegerSchema,
  _lineLayer: requiredIntegerSchema,
  _type: requiredIntegerSchema,
  _cutDirection: requiredIntegerSchema,
  _customData: customDataSchema.optional().catch(undefined),
});
const obstacleSchema = z.object({
  _time: requiredNumberSchema,
  _lineIndex: requiredIntegerSchema,
  _type: requiredIntegerSchema,
  _duration: requiredNumberSchema,
  _width: requiredIntegerSchema,
  _customData: customDataSchema.optional().catch(undefined),
});
const eventSchema = z.object({
  _time: requiredNumberSchema,
  _type: requiredIntegerSchema,
  _value: requiredIntegerSchema,
  _floatValue: numberSchema.optional(),
  _customData: customDataSchema.optional().catch(undefined),
});
const bookmarkSchema = z.object({
  _time: numberSchema,
  _name: beatSaberStringSchema,
  _color: z.array(numberSchema).min(3).max(4).optional().catch(undefined),
});
const difficultyCustomDataSchema = z.object({
  _bookmarks: z.array(bookmarkSchema).catch([]),
});
const v2DifficultySchema = z
  .object({
    _version: beatSaberStringSchema,
    _events: z.array(eventSchema).catch([]),
    _notes: z.array(noteSchema).catch([]),
    _obstacles: z.array(obstacleSchema).catch([]),
    _customData: difficultyCustomDataSchema.optional().catch(undefined),
  })
  .catch({ _version: '', _events: [], _notes: [], _obstacles: [] });

type V2Event = z.infer<typeof eventSchema>;
type V2Note = z.infer<typeof noteSchema>;
type V2Obstacle = z.infer<typeof obstacleSchema>;

const lightValueToRotationDegrees = [-60, -45, -30, -15, 15, 30, 45, 60];

function rotationFromValue(value: number): number {
  if (value >= 1000 && value <= 1720) return value - 1360;
  const index = Math.min(Math.max(value, 0), lightValueToRotationDegrees.length - 1);
  return lightValueToRotationDegrees[index] ?? 0;
}

function parseNote(node: V2Note): Note {
  return {
    jsonTime: node._time,
    songBpmTime: 0,
    posX: node._lineIndex,
    posY: node._lineLayer,
    type: node._type,
    cutDirection: node._cutDirection,
    angleOffset: 0,
    rotation: 0,
    customFake: false,
    customData: node._customData,
  };
}

function parseObstacle(node: V2Obstacle): Obstacle {
  const type = node._type;
  return {
    jsonTime: node._time,
    songBpmTime: 0,
    rotation: 0,
    posX: node._lineIndex,
    posY: type === 1 ? 2 : 0,
    type,
    duration: node._duration,
    durationSongBpmTime: 0,
    width: node._width,
    height: type === 1 ? 3 : 5,
    customFake: false,
    customData: node._customData,
  };
}

function parseEvent(node: V2Event): BasicEvent {
  return {
    jsonTime: node._time,
    songBpmTime: 0,
    type: node._type,
    value: node._value,
    floatValue: node._floatValue ?? 1,
    customData: node._customData,
  };
}

function parseBpmEvent(node: V2Event): BpmEvent {
  return {
    jsonTime: node._time,
    songBpmTime: 0,
    bpm: requiredNumberSchema.parse(node._floatValue),
  };
}

function parseRotationEvent(node: V2Event): RotationEvent {
  const type = node._type;
  return {
    jsonTime: node._time,
    songBpmTime: 0,
    executionTime: type === 15 ? ExecutionTime.Late : ExecutionTime.Early,
    rotation: rotationFromValue(node._value),
    customData: node._customData,
  };
}

export function parseV2Difficulty(input: unknown): Difficulty {
  const root = v2DifficultySchema.parse(input);
  const version = root._version;
  const difficulty = createDifficulty(version === '' ? '2.0.0' : version);

  for (const bookmark of root._customData?._bookmarks ?? []) {
    difficulty.bookmarks.push({
      jsonTime: bookmark._time,
      songBpmTime: 0,
      name: bookmark._name,
      color: [
        bookmark._color?.[0] ?? 1,
        bookmark._color?.[1] ?? 1,
        bookmark._color?.[2] ?? 1,
        bookmark._color?.[3] ?? 1,
      ],
    });
  }

  for (const node of root._events) {
    const type = node._type;
    if (type === 100) difficulty.bpmEvents.push(parseBpmEvent(node));
    else if (type === 14 || type === 15) difficulty.rotationEvents.push(parseRotationEvent(node));
    else difficulty.events.push(parseEvent(node));
  }
  for (const note of root._notes) difficulty.notes.push(parseNote(note));
  for (const obstacle of root._obstacles) difficulty.obstacles.push(parseObstacle(obstacle));

  sortByJsonTime(difficulty.bpmEvents);
  sortByJsonTime(difficulty.rotationEvents);
  sortByJsonTime(difficulty.events);
  sortByJsonTime(difficulty.notes);
  sortByJsonTime(difficulty.obstacles);

  return difficulty;
}
