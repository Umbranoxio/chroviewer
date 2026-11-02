type Vector3Tuple = readonly [number, number, number];

export interface HudLayout {
  energy: Vector3Tuple;
  combo: Vector3Tuple;
  score: Vector3Tuple;
  multiplier: Vector3Tuple;
  progress: Vector3Tuple;
  pitch?: number;
}

export const defaultHudLayout: HudLayout = {
  energy: [0, -0.64, 7.75],
  combo: [-3.2, 1.83, 7],
  score: [-3.2, 0.9, 7],
  multiplier: [3.2, 1.7, 7],
  progress: [3.2, 0.8, 6.99],
};

// Extracted from the 1.43.0 environment dumps in https://github.com/UGEcko/Chroodle/tree/main/EnvironmentData
const hudLayouts: Partial<Record<string, HudLayout>> = {
  BTSEnvironment: {
    energy: [0, -0.2, 3.65],
    combo: [-2, 1.703, 9],
    score: [-2, 0.8, 9],
    multiplier: [2, 1.7, 9],
    progress: [2, 0.8, 8.99],
  },
  BillieEnvironment: {
    energy: [0, 0, 6.5],
    combo: [-3.2, 1.83, 7],
    score: [-3.2, 0.9, 7],
    multiplier: [3.2, 1.7, 7],
    progress: [3.2, 0.8, 6.99],
  },
  ColliderEnvironment: {
    energy: [0, -0.14, 7.75],
    combo: [-3.2, 1.83, 7],
    score: [-3.2, 0.9, 7],
    multiplier: [3.2, 1.7, 7],
    progress: [3.2, 0.8, 6.99],
  },
  EDMEnvironment: {
    energy: [0, 0.1, 4.8],
    combo: [-2, 1.042, 4.8],
    score: [-2, 0.32, 4.8],
    multiplier: [2, 1.04, 4.8],
    progress: [2, 0.32, 4.792],
  },
  FitBeatEnvironment: {
    energy: [0, 0, 6.5],
    combo: [-2, 1.703, 7],
    score: [-2, 0.8, 7],
    multiplier: [2, 1.7, 7],
    progress: [2, 0.8, 6.99],
  },
  GagaEnvironment: {
    energy: [0, 0.1, 6.5],
    combo: [-3.2, 1.93, 7],
    score: [-3.2, 1, 7],
    multiplier: [3.2, 1.8, 7],
    progress: [3.2, 0.9, 6.99],
  },
  GlassDesertEnvironment: {
    energy: [0, 3.266, 12.197],
    combo: [-1.6, 4, 12],
    score: [-0.01, 4.039, 11.99],
    multiplier: [1.6, 4, 12],
    progress: [0.05, 4.692, 11.846],
    pitch: -15,
  },
  GreenDayEnvironment: {
    energy: [0, 0, 6.5],
    combo: [-2, 1.703, 7],
    score: [-2, 0.8, 7],
    multiplier: [2, 1.7, 7],
    progress: [2, 0.8, 6.99],
  },
  GreenDayGrenadeEnvironment: {
    energy: [0, 0, 6.5],
    combo: [-2, 1.703, 7],
    score: [-2, 0.8, 7],
    multiplier: [2, 1.7, 7],
    progress: [2, 0.8, 6.99],
  },
  HalloweenEnvironment: {
    energy: [0, 0.1, 6.5],
    combo: [-2, 1.803, 7],
    score: [-2, 0.9, 7],
    multiplier: [2, 1.8, 7],
    progress: [2, 0.9, 6.99],
  },
  HipHopEnvironment: {
    energy: [0, 0.1, 5.5],
    combo: [-3.25, 1.63, 5.5],
    score: [-3.25, 0.7, 5.5],
    multiplier: [3.25, 1.5, 5.5],
    progress: [3.25, 0.6, 5.49],
  },
  InterscopeEnvironment: {
    energy: [0, 0.1, 6],
    combo: [-2, 1.703, 7],
    score: [-2, 0.8, 7],
    multiplier: [2, 1.7, 7],
    progress: [2, 0.8, 6.99],
  },
  KaleidoscopeEnvironment: {
    energy: [0, -0.3, 3.65],
    combo: [-2, 1.703, 7],
    score: [-2, 0.8, 7],
    multiplier: [2, 1.7, 7],
    progress: [2, 0.8, 6.99],
  },
  LatticeEnvironment: {
    energy: [0, -0.64, 6],
    combo: [-3.2, 1.703, 7],
    score: [-3.2, 0.8, 7],
    multiplier: [3.2, 1.7, 7],
    progress: [3.2, 0.8, 6.99],
  },
  LinkinParkEnvironment: {
    energy: [0, 0, 6.5],
    combo: [-2, 1.703, 7],
    score: [-2, 0.8, 7],
    multiplier: [2, 1.7, 7],
    progress: [2, 0.8, 6.99],
  },
  LizzoEnvironment: {
    energy: [0, 0.15, 7.75],
    combo: [-3.2, 1.83, 7],
    score: [-3.2, 0.9, 7],
    multiplier: [3.2, 1.7, 7],
    progress: [3.2, 0.8, 6.99],
  },
  OriginsEnvironment: {
    energy: [0, 0, 6.5],
    combo: [-2, 1.703, 7],
    score: [-2, 0.8, 7],
    multiplier: [2, 1.7, 7],
    progress: [2, 0.8, 6.99],
  },
  RocketEnvironment: {
    energy: [0, 0, 6.5],
    combo: [-2, 1.703, 7],
    score: [-2, 0.8, 7],
    multiplier: [2, 1.7, 7],
    progress: [2, 0.8, 6.99],
  },
  TheWeekndEnvironment: {
    energy: [0, 0.156, 7.75],
    combo: [-3.3, 1.83, 7.5],
    score: [-3.3, 0.9, 7.5],
    multiplier: [3.25, 1.7, 7.5],
    progress: [3.25, 0.8, 7.49],
  },
  WeaveEnvironment: {
    energy: [0, -0.5, 4.8],
    combo: [-2, 1.742, 4.8],
    score: [-2, 1.02, 4.8],
    multiplier: [2, 1.74, 4.8],
    progress: [2, 1.02, 4.792],
  },
};

export function hudLayoutFor(environmentId: string | null): HudLayout {
  return (environmentId === null ? undefined : hudLayouts[environmentId]) ?? defaultHudLayout;
}
