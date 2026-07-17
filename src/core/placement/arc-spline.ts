import { MidAnchorMode, type Arc } from '../beatmap/types';
import { noodleCoordinates, noodleTailCoordinates } from '../noodle';
import { cutDirectionEuler, objectPosition } from './grid';

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface ArcPathPoint extends Vec3 {
  tangent: Vec3;
  normal: Vec3;
  pathT: number;
  zT: number;
}

export interface ArcPath {
  points: ArcPathPoint[];
  length: number;
}

type Segment = [Vec3, Vec3, Vec3, Vec3];

export const ARC_SAMPLES = 50;

const anyCutDirection = 8;
const noteRadius = 0.45 * 0.5;
const degToRad = Math.PI / 180;
const back: Vec3 = { x: 0, y: 0, z: -1 };

const add = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
const subtract = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
function scale(point: Vec3, amount: number): Vec3 {
  return { x: point.x * amount, y: point.y * amount, z: point.z * amount };
}
const dot = (a: Vec3, b: Vec3) => a.x * b.x + a.y * b.y + a.z * b.z;
function cross(a: Vec3, b: Vec3): Vec3 {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}
const magnitude = (point: Vec3) => Math.hypot(point.x, point.y, point.z);
function normalize(point: Vec3, fallback: Vec3 = { x: 1, y: 0, z: 0 }): Vec3 {
  const length = magnitude(point);
  return length > 1e-7 ? scale(point, 1 / length) : fallback;
}

function cutDirectionVector(cutDirection: number): Vec3 {
  if (cutDirection === anyCutDirection) return { x: 0, y: 0, z: 0 };
  const radians = cutDirectionEuler(cutDirection) * degToRad;
  return { x: Math.sin(radians), y: -Math.cos(radians), z: -1e-5 };
}

function cubicBezier(p0: Vec3, p1: Vec3, p2: Vec3, p3: Vec3, t: number): Vec3 {
  const u = 1 - t;
  return add(add(scale(p0, u * u * u), scale(p1, 3 * u * u * t)), add(scale(p2, 3 * u * t * t), scale(p3, t * t * t)));
}

function cubicDerivative(p0: Vec3, p1: Vec3, p2: Vec3, p3: Vec3, t: number) {
  const u = 1 - t;
  return add(
    add(scale(subtract(p1, p0), 3 * u * u), scale(subtract(p2, p1), 6 * u * t)),
    scale(subtract(p3, p2), 3 * t * t),
  );
}

function estimatedLength([p0, p1, p2, p3]: Segment) {
  return (
    magnitude(subtract(p0, p3)) +
    (magnitude(subtract(p0, p1)) + magnitude(subtract(p1, p2)) + magnitude(subtract(p2, p3))) / 2
  );
}

function segmentsFor(arc: Arc, zDistance: number, hasHeadNote: boolean, hasTailNote: boolean): Segment[] {
  const head = objectPosition(arc.posX, arc.posY, noodleCoordinates(arc.customData));
  const tail = objectPosition(arc.tailPosX, arc.tailPosY, noodleTailCoordinates(arc.customData));
  const headDirection = cutDirectionVector(arc.cutDirection);
  const tailDirection = cutDirectionVector(arc.tailCutDirection);
  const headAttachment = scale(headDirection, noteRadius * (hasHeadNote ? 1 : 0.1));
  const tailAttachment = scale(tailDirection, -noteRadius * (hasTailNote ? 1 : 0.1));
  const headAnchor = { x: head.x + headAttachment.x, y: head.y + headAttachment.y, z: noteRadius };
  const tailAnchor = { x: tail.x + tailAttachment.x, y: tail.y + tailAttachment.y, z: zDistance + noteRadius };
  const headControl = add(headAnchor, scale(headDirection, arc.headControlPointLengthMultiplier));
  const tailControl = add(tailAnchor, scale(tailDirection, -arc.tailControlPointLengthMultiplier));
  const angleDifference = Math.abs(cutDirectionEuler(arc.cutDirection) - cutDirectionEuler(arc.tailCutDirection));
  const samePlane = angleDifference < 1e-5 || Math.abs(angleDifference - 180) < 1e-5;
  const useMidAnchor = arc.midAnchorMode !== MidAnchorMode.Straight && samePlane && arc.posX === arc.tailPosX;
  if (!useMidAnchor) return [[headAnchor, headControl, tailControl, tailAnchor]];

  const rotation = arc.midAnchorMode === MidAnchorMode.Clockwise ? -Math.PI / 2 : Math.PI / 2;
  const rotated = {
    x: headDirection.x * Math.cos(rotation) - headDirection.y * Math.sin(rotation),
    y: headDirection.x * Math.sin(rotation) + headDirection.y * Math.cos(rotation),
    z: 0,
  };
  const mid = add(scale(add(headAnchor, tailAnchor), 0.5), scale(rotated, 0.5));
  const headDelta = subtract(headControl, mid);
  const tailDelta = subtract(tailControl, mid);
  let xOffset = (Math.abs(headDelta.x) + Math.abs(tailDelta.x)) * 0.25;
  let yOffset = (Math.abs(headDelta.y) + Math.abs(tailDelta.y)) * 0.25;
  const zOffset = (Math.abs(headDelta.z) + Math.abs(tailDelta.z)) * 0.15;
  if (headControl.x < tailControl.x) xOffset = -xOffset;
  if (headControl.y < tailControl.y) yOffset = -yOffset;
  if (Math.abs(headControl.x - tailControl.x) < 1e-5) xOffset = 0;
  if (Math.abs(headControl.y - tailControl.y) < 1e-5) yOffset = 0;
  const headMidControl = add(mid, { x: xOffset, y: yOffset, z: -zOffset });
  const tailMidControl = add(mid, { x: -xOffset, y: -yOffset, z: zOffset });
  return [
    [headAnchor, headControl, headMidControl, mid],
    [mid, tailMidControl, tailControl, tailAnchor],
  ];
}

function rotateAroundAxis(point: Vec3, axis: Vec3, angle: number): Vec3 {
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  return add(add(scale(point, cosine), scale(cross(axis, point), sine)), scale(axis, dot(axis, point) * (1 - cosine)));
}

export function arcPath(arc: Arc, zDistance: number, hasHeadNote = true, hasTailNote = true): ArcPath {
  const segments = segmentsFor(arc, zDistance, hasHeadNote, hasTailNote);
  const segmentLengths = segments.map(estimatedLength);
  const estimatedTotal = segmentLengths.reduce((sum, length) => sum + length, 0);
  const positions: Vec3[] = [];
  const tangents: Vec3[] = [];
  for (let i = 0; i <= ARC_SAMPLES; i++) {
    const distance = (estimatedTotal * i) / ARC_SAMPLES;
    let segmentIndex = 0;
    let segmentStart = 0;
    while (segmentIndex < segments.length - 1 && distance > segmentStart + (segmentLengths[segmentIndex] ?? 0)) {
      segmentStart += segmentLengths[segmentIndex] ?? 0;
      segmentIndex++;
    }
    const segment = segments[segmentIndex] ?? segments[0];
    if (segment === undefined) continue;
    const segmentLength = segmentLengths[segmentIndex] ?? 1;
    const t = i === ARC_SAMPLES ? 1 : Math.min(Math.max((distance - segmentStart) / segmentLength, 0), 1);
    positions.push(cubicBezier(...segment, t));
    tangents.push(normalize(cubicDerivative(...segment, t), { x: 0, y: 0, z: 1 }));
  }

  const cumulative = Array.from({ length: positions.length }, () => 0);
  const firstPosition = positions[0] ?? { x: 0, y: 0, z: 0 };
  const firstTangent = tangents[0] ?? { x: 0, y: 0, z: 1 };
  let length = 0;
  for (let i = 1; i < positions.length; i++) {
    length += magnitude(subtract(positions[i] ?? firstPosition, positions[i - 1] ?? firstPosition));
    cumulative[i] = length;
  }

  const normals: Vec3[] = [];
  let rotationAxis = back;
  normals.push(normalize(cross(rotationAxis, firstTangent), { x: 1, y: 0, z: 0 }));
  for (let i = 1; i < positions.length; i++) {
    const previousPosition = positions[i - 1] ?? firstPosition;
    const position = positions[i] ?? previousPosition;
    const previousTangent = tangents[i - 1] ?? firstTangent;
    const tangent = tangents[i] ?? previousTangent;
    const delta = subtract(previousPosition, position);
    const deltaSquared = dot(delta, delta);
    if (deltaSquared > 1e-10) {
      const reflectedAxis = subtract(rotationAxis, scale(delta, (2 * dot(delta, rotationAxis)) / deltaSquared));
      const reflectedTangent = subtract(
        previousTangent,
        scale(delta, (2 * dot(delta, previousTangent)) / deltaSquared),
      );
      const tangentDelta = subtract(tangent, reflectedTangent);
      const tangentDeltaSquared = dot(tangentDelta, tangentDelta);
      rotationAxis =
        tangentDeltaSquared > 1e-10
          ? subtract(reflectedAxis, scale(tangentDelta, (2 * dot(tangentDelta, reflectedAxis)) / tangentDeltaSquared))
          : reflectedAxis;
    }
    normals.push(normalize(cross(rotationAxis, tangent), normals[i - 1]));
  }

  const lastIndex = positions.length - 1;
  const targetNormal = normalize(cross(back, tangents[lastIndex] ?? back), normals[lastIndex]);
  const lastNormal = normals[lastIndex] ?? targetNormal;
  let correction = Math.acos(Math.min(Math.max(dot(lastNormal, targetNormal), -1), 1));
  if ((positions[0]?.x ?? 0) < (positions[lastIndex]?.x ?? 0)) correction = -correction;

  return {
    length,
    points: positions.map((position, index) => {
      const pathT = length > 0 ? (cumulative[index] ?? 0) / length : index / Math.max(lastIndex, 1);
      const tangent = tangents[index] ?? { x: 0, y: 0, z: 1 };
      return {
        ...position,
        tangent,
        normal: normalize(rotateAroundAxis(normals[index] ?? { x: 1, y: 0, z: 0 }, tangent, correction * pathT)),
        pathT,
        zT: zDistance > 0 ? position.z / zDistance : pathT,
      };
    }),
  };
}
