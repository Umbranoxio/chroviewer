import type { InfoColorScheme } from '../beatmap/info';
import { DEFAULT_COLORS, type Rgb } from '../colors';
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
  if (metadata?.hasPlaySettings !== true) return mapScheme;

  const base = mapColors(mapScheme);
  const overrideNotes =
    mapScheme?.overrideNotes === true ||
    (metadata.leftSaberColor !== undefined && metadata.rightSaberColor !== undefined);
  const overrideLights =
    mapScheme?.overrideLights === true ||
    (metadata.environmentColor0 !== undefined &&
      metadata.environmentColor1 !== undefined &&
      metadata.environmentColor0Boost !== undefined &&
      metadata.environmentColor1Boost !== undefined);
  const hasRecordedColors =
    metadata.leftSaberColor !== undefined ||
    metadata.rightSaberColor !== undefined ||
    metadata.obstacleColor !== undefined ||
    metadata.environmentColor0 !== undefined ||
    metadata.environmentColor1 !== undefined ||
    metadata.environmentColorW !== undefined ||
    metadata.environmentColor0Boost !== undefined ||
    metadata.environmentColor1Boost !== undefined ||
    metadata.environmentColorWBoost !== undefined;
  if (!hasRecordedColors) return mapScheme;

  return {
    name: 'ScoreSaber replay',
    overrideNotes,
    leftNote: rgb(metadata.leftSaberColor, base.leftNote),
    rightNote: rgb(metadata.rightSaberColor, base.rightNote),
    obstacle: rgb(metadata.obstacleColor, base.obstacle),
    overrideLights,
    supportsEnvironmentColorBoost: overrideLights
      ? (metadata.supportsEnvironmentColorBoost ?? mapScheme?.supportsEnvironmentColorBoost ?? true)
      : (mapScheme?.supportsEnvironmentColorBoost ?? true),
    environmentLeft: rgb(metadata.environmentColor0, base.environmentLeft),
    environmentRight: rgb(metadata.environmentColor1, base.environmentRight),
    environmentWhite: rgb(metadata.environmentColorW, base.environmentWhite),
    environmentLeftBoost: rgb(metadata.environmentColor0Boost, base.environmentLeftBoost),
    environmentRightBoost: rgb(metadata.environmentColor1Boost, base.environmentRightBoost),
    environmentWhiteBoost: rgb(metadata.environmentColorWBoost, base.environmentWhiteBoost),
  } satisfies InfoColorScheme;
}
