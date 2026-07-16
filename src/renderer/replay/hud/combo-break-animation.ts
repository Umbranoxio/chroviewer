import { evaluateAnimationCurve, type AnimationCurveData } from '../../environment/animation-curve';

export const COMBO_BREAK_ANIMATION_DURATION = 1.05;

export interface ComboBreakAnimationState {
  linesVisible: boolean;
  lineAlpha: number;
  lineScaleX: number;
  topLineX: number;
  bottomLineX: number;
  comboScaleX: number;
  comboScaleY: number;
  comboRotationDegrees: number;
  comboDepth: number;
}

function curve(keys: readonly [time: number, value: number, slope?: number][]): AnimationCurveData {
  return {
    keys: keys.map(([time, value, slope = 0]) => ({ time, value, inSlope: slope, outSlope: slope })),
  };
}

const topLinePosition = curve([
  [0, 0],
  [0.6666667, 20, 30],
]);
const bottomLinePosition = curve([
  [0, 0],
  [0.6666667, -20, -30],
]);
const lineScale = curve([
  [0, 0.8],
  [0.6666667, 10, 13.799999],
]);
const lineAlpha = curve([
  [0, 1],
  [0.5833333, 1],
  [0.6666667, 0],
]);
const comboScaleX = curve([
  [0, 0.01],
  [0.1, 0.02],
  [0.43333334, 0.02],
  [0.6666667, 0.013173884, -0.022885125],
  [COMBO_BREAK_ANIMATION_DURATION, 0.01],
]);
const comboScaleY = curve([
  [0, 0.01],
  [0.1, 0.02],
  [0.43333334, 0.02],
  [0.6666667, 0.0133923385, -0.017910095],
  [COMBO_BREAK_ANIMATION_DURATION, 0.01],
]);
const comboRotation = curve([
  [0, 0],
  [0.1, 0],
  [0.18333334, 8],
  [0.25, -8],
  [0.31666666, 8],
  [0.43333334, 0],
  [COMBO_BREAK_ANIMATION_DURATION, 0],
]);
const comboDepth = curve([
  [0, 0],
  [0.1, -2],
  [0.43333334, -2],
  [0.65, -0.5336836, 4.4348807],
  [COMBO_BREAK_ANIMATION_DURATION, 0],
]);

const restingState: ComboBreakAnimationState = {
  linesVisible: true,
  lineAlpha: 1,
  lineScaleX: 1,
  topLineX: 0,
  bottomLineX: 0,
  comboScaleX: 1,
  comboScaleY: 1,
  comboRotationDegrees: 0,
  comboDepth: 0,
};

export function comboBreakAnimationAt(elapsed: number | null): ComboBreakAnimationState {
  if (elapsed === null || elapsed < 0) return restingState;
  const time = Math.min(elapsed, COMBO_BREAK_ANIMATION_DURATION);
  return {
    linesVisible: elapsed < COMBO_BREAK_ANIMATION_DURATION,
    lineAlpha: evaluateAnimationCurve(lineAlpha, time),
    lineScaleX: evaluateAnimationCurve(lineScale, time) / 0.8,
    topLineX: evaluateAnimationCurve(topLinePosition, time),
    bottomLineX: evaluateAnimationCurve(bottomLinePosition, time),
    comboScaleX: evaluateAnimationCurve(comboScaleX, time) / 0.01,
    comboScaleY: evaluateAnimationCurve(comboScaleY, time) / 0.01,
    comboRotationDegrees: evaluateAnimationCurve(comboRotation, time),
    comboDepth: evaluateAnimationCurve(comboDepth, time),
  };
}
