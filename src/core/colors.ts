export type Rgb = readonly [number, number, number];

export interface ColorScheme {
  leftNote: Rgb;
  rightNote: Rgb;
  obstacle: Rgb;
  environmentLeft: Rgb;
  environmentRight: Rgb;
  environmentWhite: Rgb;
  environmentLeftBoost: Rgb;
  environmentRightBoost: Rgb;
  environmentWhiteBoost: Rgb;
}

export interface ColorSchemeOverride {
  overrideNotes: boolean;
  leftNote: Rgb;
  rightNote: Rgb;
  obstacle: Rgb;
  overrideLights: boolean;
  supportsEnvironmentColorBoost: boolean;
  environmentLeft: Rgb;
  environmentRight: Rgb;
  environmentWhite?: Rgb;
  environmentLeftBoost: Rgb;
  environmentRightBoost: Rgb;
  environmentWhiteBoost?: Rgb;
  customColors?: LegacyColorOverrides;
}

export interface LegacyColorOverrides {
  leftNote?: Rgb;
  rightNote?: Rgb;
  obstacle?: Rgb;
  environmentLeft?: Rgb;
  environmentRight?: Rgb;
  environmentWhite?: Rgb;
  environmentLeftBoost?: Rgb;
  environmentRightBoost?: Rgb;
  environmentWhiteBoost?: Rgb;
}

export interface EnvironmentColorScheme {
  colorLeft: Rgb;
  colorRight: Rgb;
  obstacleColor: Rgb;
  envColorLeft: Rgb;
  envColorRight: Rgb;
  envColorWhite: Rgb;
  envColorLeftBoost: Rgb;
  envColorRightBoost: Rgb;
  envColorWhiteBoost: Rgb;
  supportsEnvironmentColorBoost: boolean;
}

export const DEFAULT_COLORS: ColorScheme = {
  leftNote: [0.7352942, 0, 0],
  rightNote: [0, 0.3701827, 0.7352942],
  obstacle: [1, 0, 0],
  environmentLeft: [1, 0, 0],
  environmentRight: [0, 0.282353, 1],
  environmentWhite: [0.7264151, 0.7264151, 0.7264151],
  environmentLeftBoost: [1, 0, 0],
  environmentRightBoost: [0, 0.282353, 1],
  environmentWhiteBoost: [0.7264151, 0.7264151, 0.7264151],
};

export function resolveColorScheme(environment: EnvironmentColorScheme, override?: ColorSchemeOverride): ColorScheme {
  const environmentLeftBoost = environment.supportsEnvironmentColorBoost
    ? environment.envColorLeftBoost
    : environment.envColorLeft;
  const environmentRightBoost = environment.supportsEnvironmentColorBoost
    ? environment.envColorRightBoost
    : environment.envColorRight;
  const environmentWhiteBoost = environment.supportsEnvironmentColorBoost
    ? environment.envColorWhiteBoost
    : environment.envColorWhite;
  const base: ColorScheme = {
    leftNote: environment.colorLeft,
    rightNote: environment.colorRight,
    obstacle: environment.obstacleColor,
    environmentLeft: environment.envColorLeft,
    environmentRight: environment.envColorRight,
    environmentWhite: environment.envColorWhite,
    environmentLeftBoost,
    environmentRightBoost,
    environmentWhiteBoost,
  };
  if (override === undefined) return base;
  const selected: ColorScheme = {
    leftNote: override.overrideNotes ? override.leftNote : base.leftNote,
    rightNote: override.overrideNotes ? override.rightNote : base.rightNote,
    obstacle: override.overrideNotes ? override.obstacle : base.obstacle,
    environmentLeft: override.overrideLights ? override.environmentLeft : base.environmentLeft,
    environmentRight: override.overrideLights ? override.environmentRight : base.environmentRight,
    environmentWhite:
      override.overrideLights && override.environmentWhite !== undefined
        ? override.environmentWhite
        : base.environmentWhite,
    environmentLeftBoost: override.overrideLights
      ? override.supportsEnvironmentColorBoost
        ? override.environmentLeftBoost
        : override.environmentLeft
      : base.environmentLeftBoost,
    environmentRightBoost: override.overrideLights
      ? override.supportsEnvironmentColorBoost
        ? override.environmentRightBoost
        : override.environmentRight
      : base.environmentRightBoost,
    environmentWhiteBoost: override.overrideLights
      ? override.supportsEnvironmentColorBoost
        ? (override.environmentWhiteBoost ?? base.environmentWhiteBoost)
        : (override.environmentWhite ?? base.environmentWhite)
      : base.environmentWhiteBoost,
  };
  const custom = override.customColors;
  if (custom === undefined) return selected;
  return {
    leftNote: custom.leftNote ?? selected.leftNote,
    rightNote: custom.rightNote ?? selected.rightNote,
    obstacle: custom.obstacle ?? selected.obstacle,
    environmentLeft: custom.environmentLeft ?? custom.leftNote ?? selected.environmentLeft,
    environmentRight: custom.environmentRight ?? custom.rightNote ?? selected.environmentRight,
    environmentWhite: custom.environmentWhite ?? selected.environmentWhite,
    environmentLeftBoost:
      custom.environmentLeftBoost ?? custom.environmentLeft ?? custom.leftNote ?? selected.environmentLeftBoost,
    environmentRightBoost:
      custom.environmentRightBoost ?? custom.environmentRight ?? custom.rightNote ?? selected.environmentRightBoost,
    environmentWhiteBoost: custom.environmentWhiteBoost ?? selected.environmentWhiteBoost,
  };
}
