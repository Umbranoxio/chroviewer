// recreated for ChroViewer's fog-light projection
export type Vec3 = readonly [number, number, number];
export type Mat16 = readonly [
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
];

export interface LightSegment {
  start: [number, number, number];
  end: [number, number, number];
  color: Vec3;
  alpha: number;
  startWidth?: number;
  endWidth?: number;
  startAlpha?: number;
  endAlpha?: number;
  widthMultiplier?: number;
  intensityMultiplier?: number;
  boostToWhite?: number;
  limitAlpha?: boolean;
  minAlpha?: number;
  maxAlpha?: number;
  blendMode?: 'add' | 'max';
}

type Vec4M = [number, number, number, number];
type Vec3M = [number, number, number];

export interface LightQuadScratch {
  startClip: Vec4M;
  endClip: Vec4M;
  startView: Vec3M;
  endView: Vec3M;
}

type NumberBuffer = number[] | Float32Array;

export function createLightQuadScratch(): LightQuadScratch {
  return {
    startClip: [0, 0, 0, 0],
    endClip: [0, 0, 0, 0],
    startView: [0, 0, 0],
    endView: [0, 0, 0],
  };
}

function mulPoint(m: Mat16, p: Vec3, result: Vec3M) {
  result[0] = m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12];
  result[1] = m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13];
  result[2] = m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14];
}

function mulPoint4(m: Mat16, v: Vec3M, result: Vec4M) {
  result[0] = m[0] * v[0] + m[4] * v[1] + m[8] * v[2] + m[12];
  result[1] = m[1] * v[0] + m[5] * v[1] + m[9] * v[2] + m[13];
  result[2] = m[2] * v[0] + m[6] * v[1] + m[10] * v[2] + m[14];
  result[3] = m[3] * v[0] + m[7] * v[1] + m[11] * v[2] + m[15];
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export function linearToGammaSpace(value: number) {
  if (value <= 0) return 0;
  if (value <= 0.0031308) return value * 12.92;
  if (value < 1) return 1.055 * value ** (1 / 2.4) - 0.055;
  return value ** (1 / 2.2);
}

interface ClipState {
  startClip: Vec4M;
  endClip: Vec4M;
  startView: Vec3M;
  endView: Vec3M;
}

function clipPoints(state: ClipState, startInside: boolean, t: number) {
  const { startClip, endClip, startView, endView } = state;
  if (startInside) {
    for (let i = 0; i < 4; i++) endClip[i] = lerp(startClip[i] ?? 0, endClip[i] ?? 0, t);
    for (let i = 0; i < 3; i++) endView[i] = lerp(startView[i] ?? 0, endView[i] ?? 0, t);
  } else {
    for (let i = 0; i < 4; i++) startClip[i] = lerp(startClip[i] ?? 0, endClip[i] ?? 0, t);
    for (let i = 0; i < 3; i++) startView[i] = lerp(startView[i] ?? 0, endView[i] ?? 0, t);
  }
}

// sign +1 keeps c[axis] >= -w, sign -1 keeps c[axis] <= w; near plane passes epsilon
function clipAgainst(state: ClipState, axis: 0 | 1 | 2, sign: 1 | -1, epsilon = 0): boolean {
  const s = state.startClip;
  const e = state.endClip;
  const startInside = sign > 0 ? s[axis] >= -s[3] - epsilon : s[axis] <= s[3];
  const endInside = sign > 0 ? e[axis] >= -e[3] - epsilon : e[axis] <= e[3];
  if (!startInside && !endInside) return false;
  if (startInside !== endInside) {
    const t =
      sign > 0
        ? (-s[3] - s[axis]) / (e[axis] - s[axis] + e[3] - s[3])
        : (s[3] - s[axis]) / (e[axis] - s[axis] - e[3] + s[3]);
    clipPoints(state, startInside, t);
  }
  return true;
}

export function writeLightQuad(
  segment: LightSegment,
  view: Mat16,
  projection: Mat16,
  lineWidth: number,
  positions: NumberBuffer,
  viewPositions: NumberBuffer,
  colors: NumberBuffer,
  uvs: NumberBuffer,
  offset: number,
  scratch: LightQuadScratch,
) {
  if (segment.alpha < 0.01) return false;

  mulPoint(view, segment.start, scratch.startView);
  mulPoint(view, segment.end, scratch.endView);
  mulPoint4(projection, scratch.startView, scratch.startClip);
  mulPoint4(projection, scratch.endView, scratch.endClip);
  const state: ClipState = scratch;

  if (!clipAgainst(state, 0, 1)) return false;
  if (!clipAgainst(state, 0, -1)) return false;
  if (!clipAgainst(state, 1, 1)) return false;
  if (!clipAgainst(state, 1, -1)) return false;
  if (!clipAgainst(state, 2, -1)) return false;
  if (!clipAgainst(state, 2, 1, 0.0001)) return false;

  const { startClip, endClip } = state;
  let startX = (startClip[0] / startClip[3]) * 0.5 + 0.5;
  let startY = (startClip[1] / startClip[3]) * 0.5 + 0.5;
  let endX = (endClip[0] / endClip[3]) * 0.5 + 0.5;
  let endY = (endClip[1] / endClip[3]) * 0.5 + 0.5;

  let dirX = endX - startX;
  let dirY = endY - startY;
  let dirLength = Math.sqrt(dirX * dirX + dirY * dirY);
  if (dirLength === 0) dirLength = 1e-6;
  dirX /= dirLength;
  dirY /= dirLength;

  const aa = 1 / 64;
  endX += dirX * aa;
  endY += dirY * aa;
  startX -= dirX * aa;
  startY -= dirY * aa;

  const effectiveLineWidth = lineWidth * (segment.widthMultiplier ?? 1);
  const perpX = -dirY * effectiveLineWidth;
  const perpY = dirX * effectiveLineWidth;

  const startWidth = segment.startWidth ?? 1;
  const endWidth = segment.endWidth ?? 1;
  const startAlpha = segment.startAlpha ?? 1;
  const endAlpha = segment.endAlpha ?? 1;

  const boost = segment.boostToWhite ?? 0;
  const r = segment.color[0] + boost;
  const g = segment.color[1] + boost;
  const b = segment.color[2] + boost;
  let intensity = segment.alpha * (segment.intensityMultiplier ?? 1);
  if (segment.limitAlpha) {
    intensity = Math.min(Math.max(intensity, segment.minAlpha ?? 0), segment.maxAlpha ?? 1);
  }
  const finalAlpha = linearToGammaSpace(intensity);

  const swx = perpX * startWidth;
  const swy = perpY * startWidth;
  const ewx = perpX * endWidth;
  const ewy = perpY * endWidth;

  const positionOffset = offset * 12;
  positions[positionOffset] = startX - swx;
  positions[positionOffset + 1] = startY - swy;
  positions[positionOffset + 2] = 0;
  positions[positionOffset + 3] = startX + swx;
  positions[positionOffset + 4] = startY + swy;
  positions[positionOffset + 5] = 0;
  positions[positionOffset + 6] = endX + ewx;
  positions[positionOffset + 7] = endY + ewy;
  positions[positionOffset + 8] = 0;
  positions[positionOffset + 9] = endX - ewx;
  positions[positionOffset + 10] = endY - ewy;
  positions[positionOffset + 11] = 0;
  const startView = state.startView;
  const endView = state.endView;
  viewPositions[positionOffset] = startView[0];
  viewPositions[positionOffset + 1] = startView[1];
  viewPositions[positionOffset + 2] = startView[2];
  viewPositions[positionOffset + 3] = startView[0];
  viewPositions[positionOffset + 4] = startView[1];
  viewPositions[positionOffset + 5] = startView[2];
  viewPositions[positionOffset + 6] = endView[0];
  viewPositions[positionOffset + 7] = endView[1];
  viewPositions[positionOffset + 8] = endView[2];
  viewPositions[positionOffset + 9] = endView[0];
  viewPositions[positionOffset + 10] = endView[1];
  viewPositions[positionOffset + 11] = endView[2];
  const startR = startAlpha * r;
  const startG = startAlpha * g;
  const startB = startAlpha * b;
  const startFinalAlpha = startAlpha * finalAlpha;
  const endR = endAlpha * r;
  const endG = endAlpha * g;
  const endB = endAlpha * b;
  const endFinalAlpha = endAlpha * finalAlpha;
  const colorOffset = offset * 16;
  for (let i = 0; i < 8; i += 4) {
    colors[colorOffset + i] = startR;
    colors[colorOffset + i + 1] = startG;
    colors[colorOffset + i + 2] = startB;
    colors[colorOffset + i + 3] = startFinalAlpha;
  }
  for (let i = 8; i < 16; i += 4) {
    colors[colorOffset + i] = endR;
    colors[colorOffset + i + 1] = endG;
    colors[colorOffset + i + 2] = endB;
    colors[colorOffset + i + 3] = endFinalAlpha;
  }
  uvs[positionOffset] = 0;
  uvs[positionOffset + 1] = 0;
  uvs[positionOffset + 2] = startWidth;
  uvs[positionOffset + 3] = startWidth;
  uvs[positionOffset + 4] = 0;
  uvs[positionOffset + 5] = startWidth;
  uvs[positionOffset + 6] = endWidth;
  uvs[positionOffset + 7] = 1;
  uvs[positionOffset + 8] = endWidth;
  uvs[positionOffset + 9] = 0;
  uvs[positionOffset + 10] = 1;
  uvs[positionOffset + 11] = endWidth;
  return true;
}
