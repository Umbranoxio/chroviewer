import { easing } from './easing';

export type Vector3Tuple = readonly [number, number, number];
export type Vector4Tuple = readonly [number, number, number, number];
export type QuaternionTuple = readonly [number, number, number, number];

export interface PointSampleContext {
  baseProvider(name: string, songBpmTime: number): readonly number[] | undefined;
}

interface StaticValues {
  type: 'static';
  values: number[];
}

interface BaseValues {
  type: 'base';
  name: string;
}

type PointValues = StaticValues | BaseValues;
type PointOperation = 'opNone' | 'opAdd' | 'opSub' | 'opMul' | 'opDiv';

interface PointExpression {
  values: PointValues[];
  modifiers: ModifierExpression[];
}

interface ModifierExpression extends PointExpression {
  operation: PointOperation;
}

interface DynamicPoint {
  expression?: PointExpression;
}

export interface NumberPoint extends DynamicPoint {
  value: number;
  time: number;
  easing?: string;
}

export interface VectorPoint extends DynamicPoint {
  value: Vector3Tuple;
  time: number;
  easing?: string;
  spline: boolean;
}

export interface Vector4Point extends DynamicPoint {
  value: Vector4Tuple;
  time: number;
  easing?: string;
  hsvLerp?: boolean;
}

export interface RotationPoint extends DynamicPoint {
  value: QuaternionTuple;
  time: number;
  easing?: string;
}

function number(value: unknown) {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return Number.parseFloat(value) || 0;
  if (typeof value === 'boolean') return Number(value);
  return 0;
}

function rows(value: unknown, definitions: Readonly<Record<string, unknown[]>>) {
  const resolved = typeof value === 'string' ? definitions[value] : value;
  if (!Array.isArray(resolved)) return [];
  return Array.isArray(resolved[0])
    ? resolved.filter(Array.isArray).map((row) => Array.from<unknown>(row))
    : [Array.from<unknown>(resolved).concat(0)];
}

function groups(values: readonly unknown[]) {
  const result: PointValues[] = [];
  let statics: number[] = [];
  const close = () => {
    if (statics.length === 0) return;
    result.push({ type: 'static', values: statics });
    statics = [];
  };
  for (const value of values) {
    if (typeof value === 'string' && value.startsWith('base')) {
      close();
      result.push({ type: 'base', name: value });
    } else {
      statics.push(number(value));
    }
  }
  close();
  return result;
}

function expression(row: readonly unknown[]) {
  const flags = row.filter((value): value is string => typeof value === 'string' && !value.startsWith('base'));
  const values = groups(
    row.filter((value) => !Array.isArray(value) && !(typeof value === 'string' && !value.startsWith('base'))),
  );
  const modifiers = row.filter(Array.isArray).map(modifier);
  return { flags, point: { values, modifiers } satisfies PointExpression };
}

function modifier(row: unknown[]): ModifierExpression {
  const parsed = expression(row);
  const operation = parsed.flags.find((flag): flag is PointOperation => flag.startsWith('op')) ?? 'opNone';
  return { ...parsed.point, operation };
}

function rawValues(values: readonly PointValues[], context: PointSampleContext | undefined, songBpmTime: number) {
  return values.flatMap((value) =>
    value.type === 'static' ? value.values : [...(context?.baseProvider(value.name, songBpmTime) ?? [])],
  );
}

function applyOperation(current: number[], modifierValues: readonly number[], operation: PointOperation) {
  return current.map((value, index) => {
    const modifierValue = modifierValues[index] ?? 0;
    if (operation === 'opAdd') return value + modifierValue;
    if (operation === 'opSub') return value - modifierValue;
    if (operation === 'opMul') return value * modifierValue;
    if (operation === 'opDiv') return value / modifierValue;
    return value;
  });
}

function evaluate(expression: PointExpression, size: number, context?: PointSampleContext, songBpmTime = 0) {
  let result = rawValues(expression.values, context, songBpmTime).slice(0, size);
  while (result.length < size) result.push(0);
  for (const modifier of expression.modifiers) {
    result = applyOperation(result, evaluate(modifier, size, context, songBpmTime), modifier.operation);
  }
  return result;
}

function parsedPoint(row: readonly unknown[], size: number) {
  const parsed = expression(row);
  const dynamic = parsed.point.modifiers.length > 0 || parsed.point.values.some((value) => value.type === 'base');
  const values = evaluate(parsed.point, size);
  const timeValues = rawValues(parsed.point.values, undefined, 0);
  return {
    flags: parsed.flags,
    values,
    time: timeValues.at(-1) ?? 0,
    expression: dynamic ? parsed.point : undefined,
  };
}

export function numberPoints(value: unknown, definitions: Readonly<Record<string, unknown[]>> = {}) {
  return rows(value, definitions)
    .map((row): NumberPoint => {
      const point = parsedPoint(row, 1);
      return {
        value: point.values[0] ?? 0,
        time: point.time,
        easing: point.flags.find((flag) => flag.startsWith('ease')),
        expression: point.expression,
      };
    })
    .sort((left, right) => left.time - right.time);
}

export function vectorPoints(value: unknown, definitions: Readonly<Record<string, unknown[]>> = {}) {
  return rows(value, definitions)
    .map((row): VectorPoint => {
      const point = parsedPoint(row, 3);
      return {
        value: [point.values[0] ?? 0, point.values[1] ?? 0, point.values[2] ?? 0],
        time: point.time,
        easing: point.flags.find((flag) => flag.startsWith('ease')),
        spline: point.flags.includes('splineCatmullRom'),
        expression: point.expression,
      };
    })
    .sort((left, right) => left.time - right.time);
}

export function vector4Points(value: unknown, definitions: Readonly<Record<string, unknown[]>> = {}) {
  return rows(value, definitions)
    .map((row): Vector4Point => {
      const point = parsedPoint(row, 4);
      return {
        value: [point.values[0] ?? 0, point.values[1] ?? 0, point.values[2] ?? 0, point.values[3] ?? 0],
        time: point.time,
        easing: point.flags.find((flag) => flag.startsWith('ease')),
        hsvLerp: point.flags.includes('lerpHSV'),
        expression: point.expression,
      };
    })
    .sort((left, right) => left.time - right.time);
}

export function quaternionFromEuler([x, y, z]: Vector3Tuple): QuaternionTuple {
  const xRad = (x * Math.PI) / 360;
  const yRad = (y * Math.PI) / 360;
  const zRad = (z * Math.PI) / 360;
  const cx = Math.cos(xRad);
  const sx = Math.sin(xRad);
  const cy = Math.cos(yRad);
  const sy = Math.sin(yRad);
  const cz = Math.cos(zRad);
  const sz = Math.sin(zRad);
  return [
    sx * cy * cz + cx * sy * sz,
    cx * sy * cz - sx * cy * sz,
    cx * cy * sz - sx * sy * cz,
    cx * cy * cz + sx * sy * sz,
  ];
}

export function multiplyQuaternions(left: QuaternionTuple | undefined, right: QuaternionTuple | undefined) {
  if (left === undefined) return right;
  if (right === undefined) return left;
  return [
    left[3] * right[0] + left[0] * right[3] + left[1] * right[2] - left[2] * right[1],
    left[3] * right[1] - left[0] * right[2] + left[1] * right[3] + left[2] * right[0],
    left[3] * right[2] + left[0] * right[1] - left[1] * right[0] + left[2] * right[3],
    left[3] * right[3] - left[0] * right[0] - left[1] * right[1] - left[2] * right[2],
  ] as const;
}

export function eulerFromQuaternion([x, y, z, w]: QuaternionTuple): Vector3Tuple {
  const m11 = 1 - 2 * (y * y + z * z);
  const m13 = 2 * (x * z + y * w);
  const m21 = 2 * (x * y + z * w);
  const m22 = 1 - 2 * (x * x + z * z);
  const m23 = 2 * (y * z - x * w);
  const m31 = 2 * (x * z - y * w);
  const m33 = 1 - 2 * (x * x + y * y);
  const xAngle = Math.asin(-Math.min(Math.max(m23, -1), 1));
  const yAngle = Math.abs(m23) < 0.9999999 ? Math.atan2(m13, m33) : Math.atan2(-m31, m11);
  const zAngle = Math.abs(m23) < 0.9999999 ? Math.atan2(m21, m22) : 0;
  const degrees = (angle: number) => ((((angle * 180) / Math.PI) % 360) + 360) % 360;
  return [degrees(xAngle), degrees(yAngle), degrees(zAngle)];
}

export function rotationPoints(value: unknown, definitions: Readonly<Record<string, unknown[]>> = {}) {
  return vectorPoints(value, definitions).map(
    (point): RotationPoint => ({
      value: quaternionFromEuler(point.value),
      time: point.time,
      easing: point.easing,
      expression: point.expression,
    }),
  );
}

function segment(points: readonly (DynamicPoint & { time: number; easing?: string })[], time: number) {
  const first = points[0];
  const last = points.at(-1);
  if (first === undefined || last === undefined) return undefined;
  const firstTime = first.time;
  const lastTime = last.time;
  if (time <= firstTime) return { left: 0, right: 0, amount: 0 };
  if (time >= lastTime) return { left: points.length - 1, right: points.length - 1, amount: 0 };
  let low = 1;
  let high = points.length;
  while (low < high) {
    const middle = (low + high) >>> 1;
    if ((points[middle]?.time ?? Number.POSITIVE_INFINITY) < time) low = middle + 1;
    else high = middle;
  }
  const right = low;
  const left = right - 1;
  const leftPoint = points[left];
  const rightPoint = points[right];
  if (leftPoint === undefined || rightPoint === undefined) return undefined;
  const duration = rightPoint.time - leftPoint.time;
  const amount = easing(duration === 0 ? 0 : (time - leftPoint.time) / duration, rightPoint.easing);
  return { left, right, amount };
}

function numberValue(point: NumberPoint, context?: PointSampleContext, songBpmTime = 0) {
  return point.expression === undefined ? point.value : (evaluate(point.expression, 1, context, songBpmTime)[0] ?? 0);
}

function vectorValue(point: VectorPoint, context?: PointSampleContext, songBpmTime = 0): Vector3Tuple {
  if (point.expression === undefined) return point.value;
  const value = evaluate(point.expression, 3, context, songBpmTime);
  return [value[0] ?? 0, value[1] ?? 0, value[2] ?? 0];
}

function vector4Value(point: Vector4Point, context?: PointSampleContext, songBpmTime = 0): Vector4Tuple {
  if (point.expression === undefined) return point.value;
  const value = evaluate(point.expression, 4, context, songBpmTime);
  return [value[0] ?? 0, value[1] ?? 0, value[2] ?? 0, value[3] ?? 0];
}

function rotationValue(point: RotationPoint, context?: PointSampleContext, songBpmTime = 0) {
  if (point.expression === undefined) return point.value;
  const value = evaluate(point.expression, 3, context, songBpmTime);
  return quaternionFromEuler([value[0] ?? 0, value[1] ?? 0, value[2] ?? 0]);
}

export function sampleNumber(
  points: readonly NumberPoint[],
  time: number,
  context?: PointSampleContext,
  songBpmTime = 0,
) {
  const part = segment(points, time);
  if (part === undefined) return undefined;
  const left = points[part.left];
  const right = points[part.right];
  if (left === undefined || right === undefined) return undefined;
  const leftValue = numberValue(left, context, songBpmTime);
  const rightValue = numberValue(right, context, songBpmTime);
  return leftValue + (rightValue - leftValue) * part.amount;
}

function catmull(
  points: readonly VectorPoint[],
  leftIndex: number,
  rightIndex: number,
  amount: number,
  context?: PointSampleContext,
  songBpmTime = 0,
): Vector3Tuple {
  const leftPoint = points[leftIndex];
  const rightPoint = points[rightIndex];
  if (leftPoint === undefined || rightPoint === undefined) return [0, 0, 0];
  const left = vectorValue(leftPoint, context, songBpmTime);
  const right = vectorValue(rightPoint, context, songBpmTime);
  const beforePoint = points[leftIndex - 1];
  const afterPoint = points[rightIndex + 1];
  const before = beforePoint === undefined ? left : vectorValue(beforePoint, context, songBpmTime);
  const after = afterPoint === undefined ? right : vectorValue(afterPoint, context, songBpmTime);
  const square = amount * amount;
  const cube = square * amount;
  const value = (axis: 0 | 1 | 2) =>
    0.5 *
    (before[axis] * (-cube + 2 * square - amount) +
      left[axis] * (3 * cube - 5 * square + 2) +
      right[axis] * (-3 * cube + 4 * square + amount) +
      after[axis] * (cube - square));
  return [value(0), value(1), value(2)];
}

export function sampleVector(
  points: readonly VectorPoint[],
  time: number,
  context?: PointSampleContext,
  songBpmTime = 0,
): Vector3Tuple | undefined {
  const part = segment(points, time);
  if (part === undefined) return undefined;
  const left = points[part.left];
  const right = points[part.right];
  if (left === undefined || right === undefined) return undefined;
  if (right.spline && part.left !== part.right) {
    return catmull(points, part.left, part.right, part.amount, context, songBpmTime);
  }
  const leftValue = vectorValue(left, context, songBpmTime);
  const rightValue = vectorValue(right, context, songBpmTime);
  return [
    leftValue[0] + (rightValue[0] - leftValue[0]) * part.amount,
    leftValue[1] + (rightValue[1] - leftValue[1]) * part.amount,
    leftValue[2] + (rightValue[2] - leftValue[2]) * part.amount,
  ];
}

function rgbToHsv([red, green, blue]: Vector4Tuple): Vector3Tuple {
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const delta = max - min;
  let hue = 0;
  if (delta !== 0) {
    if (max === red) hue = ((green - blue) / delta) % 6;
    else if (max === green) hue = (blue - red) / delta + 2;
    else hue = (red - green) / delta + 4;
    hue /= 6;
    if (hue < 0) hue += 1;
  }
  return [hue, max === 0 ? 0 : delta / max, max];
}

function hsvToRgb([hue, saturation, value]: Vector3Tuple): Vector3Tuple {
  const sector = Math.floor(hue * 6);
  const fraction = hue * 6 - sector;
  const p = value * (1 - saturation);
  const q = value * (1 - fraction * saturation);
  const t = value * (1 - (1 - fraction) * saturation);
  if (sector % 6 === 0) return [value, t, p];
  if (sector === 1) return [q, value, p];
  if (sector === 2) return [p, value, t];
  if (sector === 3) return [p, q, value];
  if (sector === 4) return [t, p, value];
  return [value, p, q];
}

export function sampleVector4(
  points: readonly Vector4Point[],
  time: number,
  context?: PointSampleContext,
  songBpmTime = 0,
): Vector4Tuple | undefined {
  const part = segment(points, time);
  if (part === undefined) return undefined;
  const leftPoint = points[part.left];
  const rightPoint = points[part.right];
  if (leftPoint === undefined || rightPoint === undefined) return undefined;
  const left = vector4Value(leftPoint, context, songBpmTime);
  const right = vector4Value(rightPoint, context, songBpmTime);
  if (rightPoint.hsvLerp) {
    const leftHsv = rgbToHsv(left);
    const rightHsv = rgbToHsv(right);
    const rgb = hsvToRgb([
      leftHsv[0] + (rightHsv[0] - leftHsv[0]) * part.amount,
      leftHsv[1] + (rightHsv[1] - leftHsv[1]) * part.amount,
      leftHsv[2] + (rightHsv[2] - leftHsv[2]) * part.amount,
    ]);
    return [rgb[0], rgb[1], rgb[2], left[3] + (right[3] - left[3]) * part.amount];
  }
  return [
    left[0] + (right[0] - left[0]) * part.amount,
    left[1] + (right[1] - left[1]) * part.amount,
    left[2] + (right[2] - left[2]) * part.amount,
    left[3] + (right[3] - left[3]) * part.amount,
  ];
}

export function sampleRotation(
  points: readonly RotationPoint[],
  time: number,
  context?: PointSampleContext,
  songBpmTime = 0,
): QuaternionTuple | undefined {
  const part = segment(points, time);
  if (part === undefined) return undefined;
  const leftPoint = points[part.left];
  const rightPoint = points[part.right];
  if (leftPoint === undefined || rightPoint === undefined) return undefined;
  const left = rotationValue(leftPoint, context, songBpmTime);
  const right = rotationValue(rightPoint, context, songBpmTime);
  let cosine = left[0] * right[0] + left[1] * right[1] + left[2] * right[2] + left[3] * right[3];
  const target: QuaternionTuple = cosine < 0 ? [-right[0], -right[1], -right[2], -right[3]] : right;
  cosine = Math.abs(cosine);
  if (cosine > 0.9995) {
    const x = left[0] + (target[0] - left[0]) * part.amount;
    const y = left[1] + (target[1] - left[1]) * part.amount;
    const z = left[2] + (target[2] - left[2]) * part.amount;
    const w = left[3] + (target[3] - left[3]) * part.amount;
    const length = Math.hypot(x, y, z, w);
    return [x / length, y / length, z / length, w / length];
  }
  const angle = Math.acos(Math.min(cosine, 1));
  const sine = Math.sin(angle);
  const leftScale = Math.sin((1 - part.amount) * angle) / sine;
  const rightScale = Math.sin(part.amount * angle) / sine;
  return [
    left[0] * leftScale + target[0] * rightScale,
    left[1] * leftScale + target[1] * rightScale,
    left[2] * leftScale + target[2] * rightScale,
    left[3] * leftScale + target[3] * rightScale,
  ];
}
