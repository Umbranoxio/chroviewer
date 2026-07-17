import type { InfoColorScheme } from '../beatmap/info';
import { DEFAULT_COLORS, type Rgb } from '../colors';
import type { LightshowMode } from '../lighting/basic-light';
import type { ReplayColor, ReplayMetadata } from './types';

function rgb(color: ReplayColor | undefined, fallback: Rgb): Rgb {
  return color === undefined ? fallback : [color.x, color.y, color.z];
}

function mapColors(mapScheme?: InfoColorScheme) {
  const custom = mapScheme?.customColors;
  return {
    leftNote: custom?.leftNote ?? mapScheme?.leftNote ?? DEFAULT_COLORS.leftNote,
    rightNote: custom?.rightNote ?? mapScheme?.rightNote ?? DEFAULT_COLORS.rightNote,
    obstacle: custom?.obstacle ?? mapScheme?.obstacle ?? DEFAULT_COLORS.obstacle,
    environmentLeft:
      custom?.environmentLeft ?? custom?.leftNote ?? mapScheme?.environmentLeft ?? DEFAULT_COLORS.environmentLeft,
    environmentRight:
      custom?.environmentRight ?? custom?.rightNote ?? mapScheme?.environmentRight ?? DEFAULT_COLORS.environmentRight,
    environmentWhite: custom?.environmentWhite ?? mapScheme?.environmentWhite ?? DEFAULT_COLORS.environmentWhite,
    environmentLeftBoost:
      custom?.environmentLeftBoost ??
      custom?.environmentLeft ??
      custom?.leftNote ??
      mapScheme?.environmentLeftBoost ??
      DEFAULT_COLORS.environmentLeftBoost,
    environmentRightBoost:
      custom?.environmentRightBoost ??
      custom?.environmentRight ??
      custom?.rightNote ??
      mapScheme?.environmentRightBoost ??
      DEFAULT_COLORS.environmentRightBoost,
    environmentWhiteBoost:
      custom?.environmentWhiteBoost ?? mapScheme?.environmentWhiteBoost ?? DEFAULT_COLORS.environmentWhiteBoost,
  };
}

export function replayColorScheme(metadata: ReplayMetadata | undefined, mapScheme?: InfoColorScheme) {
  if (
    metadata?.hasPlaySettings !== true ||
    metadata.leftSaberColor === undefined ||
    metadata.rightSaberColor === undefined
  )
    return mapScheme;

  const base = mapColors(mapScheme);
  const overrideLights =
    metadata.obstacleColor !== undefined &&
    metadata.environmentColor0 !== undefined &&
    metadata.environmentColor1 !== undefined &&
    metadata.environmentColor0Boost !== undefined &&
    metadata.environmentColor1Boost !== undefined;

  return {
    name: 'ScoreSaber replay',
    overrideNotes: true,
    leftNote: rgb(metadata.leftSaberColor, base.leftNote),
    rightNote: rgb(metadata.rightSaberColor, base.rightNote),
    obstacle: overrideLights ? rgb(metadata.obstacleColor, base.obstacle) : base.obstacle,
    overrideLights,
    supportsEnvironmentColorBoost: overrideLights
      ? (metadata.supportsEnvironmentColorBoost ?? mapScheme?.supportsEnvironmentColorBoost ?? true)
      : (mapScheme?.supportsEnvironmentColorBoost ?? true),
    environmentLeft: overrideLights ? rgb(metadata.environmentColor0, base.environmentLeft) : base.environmentLeft,
    environmentRight: overrideLights ? rgb(metadata.environmentColor1, base.environmentRight) : base.environmentRight,
    environmentWhite:
      overrideLights && metadata.environmentColorW !== undefined
        ? rgb(metadata.environmentColorW, base.environmentWhite)
        : undefined,
    environmentLeftBoost: overrideLights
      ? rgb(metadata.environmentColor0Boost, base.environmentLeftBoost)
      : base.environmentLeftBoost,
    environmentRightBoost: overrideLights
      ? rgb(metadata.environmentColor1Boost, base.environmentRightBoost)
      : base.environmentRightBoost,
    environmentWhiteBoost:
      overrideLights && metadata.environmentColorWBoost !== undefined
        ? rgb(metadata.environmentColorWBoost, base.environmentWhiteBoost)
        : undefined,
  } satisfies InfoColorScheme;
}

function environmentEffectsPreset(metadata: ReplayMetadata) {
  const current = metadata.environmentEffectsFilterPreset;
  if (current === 0 || current === 1 || current === 10) return current;
  return metadata.difficulty === 9
    ? metadata.environmentEffectsFilterExpertPlusPreset
    : metadata.environmentEffectsFilterDefaultPreset;
}

export function replayLightshowMode(metadata: ReplayMetadata | undefined): LightshowMode | undefined {
  if (metadata?.hasPlaySettings !== true) return undefined;
  const preset = environmentEffectsPreset(metadata);
  if (preset === 10) return 'static';
  if (preset === 0 || preset === 1) return 'full';
  return undefined;
}
