export type EasingFunction = (k: number) => number;

const linear: EasingFunction = (k) => k;
const step: EasingFunction = (k) => Math.floor(k);

const quadIn: EasingFunction = (k) => k * k;
const quadOut: EasingFunction = (k) => k * (2 - k);
const quadInOut: EasingFunction = (k) => ((k *= 2) < 1 ? 0.5 * k * k : -0.5 * ((k -= 1) * (k - 2) - 1));

const sineIn: EasingFunction = (k) => 1 - Math.cos((k * Math.PI) / 2);
const sineOut: EasingFunction = (k) => Math.sin((k * Math.PI) / 2);
const sineInOut: EasingFunction = (k) => 0.5 * (1 - Math.cos(Math.PI * k));

const cubicIn: EasingFunction = (k) => k * k * k;
const cubicOut: EasingFunction = (k) => 1 + (k -= 1) * k * k;
const cubicInOut: EasingFunction = (k) => ((k *= 2) < 1 ? 0.5 * k * k * k : 0.5 * ((k -= 2) * k * k + 2));

const quartIn: EasingFunction = (k) => k * k * k * k;
const quartOut: EasingFunction = (k) => 1 - (k -= 1) * k * k * k;
const quartInOut: EasingFunction = (k) => ((k *= 2) < 1 ? 0.5 * k * k * k * k : -0.5 * ((k -= 2) * k * k * k - 2));

const quintIn: EasingFunction = (k) => k * k * k * k * k;
const quintOut: EasingFunction = (k) => 1 + (k -= 1) * k * k * k * k;
function quintInOut(k: number) {
  return (k *= 2) < 1 ? 0.5 * k * k * k * k * k : 0.5 * ((k -= 2) * k * k * k * k + 2);
}

const expoIn: EasingFunction = (k) => (k === 0 ? 0 : 1024 ** (k - 1));
const expoOut: EasingFunction = (k) => (k === 1 ? 1 : 1 - 2 ** (-10 * k));
function expoInOut(k: number) {
  if (k === 0) return 0;
  if (k === 1) return 1;
  if ((k *= 2) < 1) return 0.5 * 1024 ** (k - 1);
  return 0.5 * (-(2 ** (-10 * (k - 1))) + 2);
}

const circIn: EasingFunction = (k) => 1 - Math.sqrt(1 - k * k);
const circOut: EasingFunction = (k) => Math.sqrt(1 - (k -= 1) * k);
function circInOut(k: number) {
  return (k *= 2) < 1 ? -0.5 * (Math.sqrt(1 - k * k) - 1) : 0.5 * (Math.sqrt(1 - (k -= 2) * k) + 1);
}

const backS = 1.70158;
const backS2 = 2.5949095;
const backIn: EasingFunction = (k) => k * k * ((backS + 1) * k - backS);
const backOut: EasingFunction = (k) => (k -= 1) * k * ((backS + 1) * k + backS) + 1;
function backInOut(k: number) {
  return (k *= 2) < 1
    ? 0.5 * (k * k * ((backS2 + 1) * k - backS2))
    : 0.5 * ((k -= 2) * k * ((backS2 + 1) * k + backS2) + 2);
}
function backBeatSaberInOut(t: number) {
  if (t < 0.517) return 5.014 * t * t * t;
  return 1 + 2.70158 * (1.665 * (t - 0.4) - 1) ** 3 + 1.70158 * (1.665 * (t - 0.4) - 1) ** 2;
}

function elasticIn(k: number) {
  if (k === 0) return 0;
  if (k === 1) return 1;
  return -(2 ** (10 * (k -= 1))) * Math.sin(((k - 0.1) * (2 * Math.PI)) / 0.4);
}
function elasticOut(k: number) {
  if (k === 0) return 0;
  if (k === 1) return 1;
  return 2 ** (-10 * k) * Math.sin(((k - 0.1) * (2 * Math.PI)) / 0.4) + 1;
}
function elasticInOut(k: number) {
  return (k *= 2) < 1
    ? -0.5 * 2 ** (10 * (k -= 1)) * Math.sin(((k - 0.1) * (2 * Math.PI)) / 0.4)
    : 2 ** (-10 * (k -= 1)) * Math.sin(((k - 0.1) * (2 * Math.PI)) / 0.4) * 0.5 + 1;
}
function elasticBeatSaberInOut(t: number) {
  return t < 0.3 ? 37.037 * t * t * t : 2 ** (-10 * (t - 0.2)) * Math.sin(t * 10 * ((Math.PI * 2) / 3)) + 1;
}

function bounceOut(k: number) {
  if (k < 1 / 2.75) return 7.5625 * k * k;
  if (k < 2 / 2.75) return 7.5625 * (k -= 1.5 / 2.75) * k + 0.75;
  if (k < 2.5 / 2.75) return 7.5625 * (k -= 2.25 / 2.75) * k + 0.9375;
  return 7.5625 * (k -= 2.625 / 2.75) * k + 0.984375;
}
const bounceIn: EasingFunction = (k) => 1 - bounceOut(1 - k);
const bounceInOut: EasingFunction = (k) => (k < 0.5 ? bounceIn(k * 2) * 0.5 : bounceOut(k * 2 - 1) * 0.5 + 0.5);
function bounceBeatSaberInOut(t: number) {
  if (t < 0.36363637) return 20.796 * t * t * t;
  if (t < 0.72727275) return 7.5625 * (t -= 0.54545456) * t + 0.75;
  if (t < 0.90909094) return 7.5625 * (t -= 0.8181818) * t + 0.9375;
  return 7.5625 * (t -= 21 / 22) * t + 63 / 64;
}

const byId = new Map<number, EasingFunction>([
  [-1, step],
  [0, linear],
  [1, quadIn],
  [2, quadOut],
  [3, quadInOut],
  [4, sineIn],
  [5, sineOut],
  [6, sineInOut],
  [7, cubicIn],
  [8, cubicOut],
  [9, cubicInOut],
  [10, quartIn],
  [11, quartOut],
  [12, quartInOut],
  [13, quintIn],
  [14, quintOut],
  [15, quintInOut],
  [16, expoIn],
  [17, expoOut],
  [18, expoInOut],
  [19, circIn],
  [20, circOut],
  [21, circInOut],
  [22, backIn],
  [23, backOut],
  [24, backInOut],
  [25, elasticIn],
  [26, elasticOut],
  [27, elasticInOut],
  [28, bounceIn],
  [29, bounceOut],
  [30, bounceInOut],
  [100, backBeatSaberInOut],
  [101, elasticBeatSaberInOut],
  [102, bounceBeatSaberInOut],
]);

export function easingFromId(id: number): EasingFunction {
  return byId.get(id) ?? linear;
}

const namedIds: Record<string, number> = {
  easeStep: -1,
  easeLinear: 0,
  easeInQuad: 1,
  easeOutQuad: 2,
  easeInOutQuad: 3,
  easeInSine: 4,
  easeOutSine: 5,
  easeInOutSine: 6,
  easeInCubic: 7,
  easeOutCubic: 8,
  easeInOutCubic: 9,
  easeInQuart: 10,
  easeOutQuart: 11,
  easeInOutQuart: 12,
  easeInQuint: 13,
  easeOutQuint: 14,
  easeInOutQuint: 15,
  easeInExpo: 16,
  easeOutExpo: 17,
  easeInOutExpo: 18,
  easeInCirc: 19,
  easeOutCirc: 20,
  easeInOutCirc: 21,
  easeInBack: 22,
  easeOutBack: 23,
  easeInOutBack: 24,
  easeInElastic: 25,
  easeOutElastic: 26,
  easeInOutElastic: 27,
  easeInBounce: 28,
  easeOutBounce: 29,
  easeInOutBounce: 30,
};

export function easingFromName(name: string | undefined): EasingFunction {
  return easingFromId(name === undefined ? 0 : (namedIds[name] ?? 0));
}
