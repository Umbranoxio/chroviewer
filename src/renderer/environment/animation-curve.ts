export interface AnimationCurveKey {
  time: number;
  value: number;
  inSlope: number;
  outSlope: number;
}

export interface AnimationCurveData {
  keys: AnimationCurveKey[];
}

export function evaluateAnimationCurve(curve: AnimationCurveData, time: number) {
  const first = curve.keys[0];
  const last = curve.keys.at(-1);
  if (first === undefined || last === undefined) return 1;
  if (time <= first.time) return first.value;
  if (time >= last.time) return last.value;

  for (let index = 0; index < curve.keys.length - 1; index++) {
    const from = curve.keys[index];
    const to = curve.keys[index + 1];
    if (from === undefined || to === undefined || time > to.time) continue;
    if (!Number.isFinite(from.outSlope) || !Number.isFinite(to.inSlope)) return from.value;
    const duration = to.time - from.time;
    if (duration <= 0) return to.value;
    const t = (time - from.time) / duration;
    const t2 = t * t;
    const t3 = t2 * t;
    return (
      (2 * t3 - 3 * t2 + 1) * from.value +
      (t3 - 2 * t2 + t) * from.outSlope * duration +
      (-2 * t3 + 3 * t2) * to.value +
      (t3 - t2) * to.inSlope * duration
    );
  }
  return last.value;
}
