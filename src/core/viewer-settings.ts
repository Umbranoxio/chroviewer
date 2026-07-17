import { Result } from 'better-result';
import * as z from 'zod/mini';

import type { InfoColorScheme } from './beatmap/info';
import type { Rgb } from './colors';
import { replayColorScheme } from './replay/play-settings';
import type { ReplayMetadata } from './replay/types';

export interface ViewerSettings {
  graphicsQuality: 'none' | 'low' | 'medium' | 'high';
  screenDisplacementEffects: boolean;
  previewHitNotes: boolean;
  previewHitLine: boolean;
  previewNotesLookAtPlayer: boolean;
  renderScale: number;
  staticLights: boolean;
  preferReplayColors: boolean;
  preferReplayEnvironment: boolean;
  overrideEnvironment: boolean;
  environmentOverrideId: string;
  customColors: boolean;
  leftColor: string;
  rightColor: string;
  obstacleColor: string;
  environmentLeftColor: string;
  environmentRightColor: string;
  environmentWhiteColor: string;
  environmentLeftBoostColor: string;
  environmentRightBoostColor: string;
  environmentWhiteBoostColor: string;
  showSabers: boolean;
  saberScale: number;
  saberBladeLength: number;
  saberBladeThickness: number;
  saberCoreThickness: number;
  saberCoreInset: number;
  showSaberTrails: boolean;
  replayTrailShape: 'flag' | 'rectangle';
  replayTrailLength: number;
  replayTrailThinness: number;
  replayTrailSamples: number;
  replayTrailFade: number;
  replayTrailOpacity: number;
  replayTrailMotionThreshold: number;
  saberGripLength: number;
  saberGripThickness: number;
  saberGuardSize: number;
  saberGuardThickness: number;
  saberCollarSize: number;
  saberCollarThickness: number;
  saberCollarSpacing: number;
  saberRingCount: number;
  saberRingSize: number;
  saberRingThickness: number;
  saberRingSpacing: number;
  saberPommelLength: number;
  saberPommelThickness: number;
  saberXOffset: number;
  saberYOffset: number;
  saberZOffset: number;
  saberXRotation: number;
  saberYRotation: number;
  saberZRotation: number;
  hitsounds: boolean;
  masterMuted: boolean;
  songMuted: boolean;
  masterVolume: number;
  songVolume: number;
  hitsoundVolume: number;
  showBookmarks: boolean;
  replayCamera: 'static' | 'follow' | 'first-person';
  replayCameraSmoothing: boolean;
  replayCameraSmoothingSpeed: number;
  replayCameraFov: number;
  previewCameraDistance: number;
  fixedCameraDistance: number;
  replayCameraXOffset: number;
  replayCameraYOffset: number;
  replayCameraDepthOffset: number;
  replayCameraXRotation: number;
  replayCameraYRotation: number;
  replayCameraZRotation: number;
  replayCameraForceUpright: boolean;
  autoHide: boolean;
}

export type ReplayCameraSettings = Pick<
  ViewerSettings,
  | 'replayCamera'
  | 'replayCameraSmoothing'
  | 'replayCameraSmoothingSpeed'
  | 'replayCameraFov'
  | 'previewCameraDistance'
  | 'fixedCameraDistance'
  | 'replayCameraXOffset'
  | 'replayCameraYOffset'
  | 'replayCameraDepthOffset'
  | 'replayCameraXRotation'
  | 'replayCameraYRotation'
  | 'replayCameraZRotation'
  | 'replayCameraForceUpright'
>;

export type ReplayTrailSettings = Pick<
  ViewerSettings,
  | 'showSaberTrails'
  | 'replayTrailShape'
  | 'replayTrailLength'
  | 'replayTrailThinness'
  | 'replayTrailSamples'
  | 'replayTrailFade'
  | 'replayTrailOpacity'
  | 'replayTrailMotionThreshold'
>;

export type ReplaySaberSettings = Pick<
  ViewerSettings,
  | 'showSabers'
  | 'saberScale'
  | 'saberBladeLength'
  | 'saberBladeThickness'
  | 'saberCoreThickness'
  | 'saberCoreInset'
  | 'showSaberTrails'
  | 'replayTrailShape'
  | 'replayTrailLength'
  | 'replayTrailThinness'
  | 'replayTrailSamples'
  | 'replayTrailFade'
  | 'replayTrailOpacity'
  | 'replayTrailMotionThreshold'
  | 'saberGripLength'
  | 'saberGripThickness'
  | 'saberGuardSize'
  | 'saberGuardThickness'
  | 'saberCollarSize'
  | 'saberCollarThickness'
  | 'saberCollarSpacing'
  | 'saberRingCount'
  | 'saberRingSize'
  | 'saberRingThickness'
  | 'saberRingSpacing'
  | 'saberPommelLength'
  | 'saberPommelThickness'
  | 'saberXOffset'
  | 'saberYOffset'
  | 'saberZOffset'
  | 'saberXRotation'
  | 'saberYRotation'
  | 'saberZRotation'
>;

export const DEFAULT_REPLAY_CAMERA_SETTINGS: ReplayCameraSettings = {
  replayCamera: 'first-person',
  replayCameraSmoothing: true,
  replayCameraSmoothingSpeed: 4,
  replayCameraFov: 70,
  previewCameraDistance: 4,
  fixedCameraDistance: 4,
  replayCameraXOffset: 0,
  replayCameraYOffset: 0,
  replayCameraDepthOffset: -0.55,
  replayCameraXRotation: 0,
  replayCameraYRotation: 0,
  replayCameraZRotation: 0,
  replayCameraForceUpright: false,
};

export const DEFAULT_REPLAY_TRAIL_SETTINGS: ReplayTrailSettings = {
  showSaberTrails: true,
  replayTrailShape: 'flag',
  replayTrailLength: 0.331,
  replayTrailThinness: 0,
  replayTrailSamples: 18,
  replayTrailFade: 1.6,
  replayTrailOpacity: 1,
  replayTrailMotionThreshold: 0.002,
};

export const DEFAULT_REPLAY_SABER_SETTINGS: ReplaySaberSettings = {
  showSabers: true,
  saberScale: 1,
  saberBladeLength: 1,
  saberBladeThickness: 0.0045,
  saberCoreThickness: 0.0018,
  saberCoreInset: 0.004,
  ...DEFAULT_REPLAY_TRAIL_SETTINGS,
  saberGripLength: 0.089,
  saberGripThickness: 0.005,
  saberGuardSize: 0.02,
  saberGuardThickness: 0.001,
  saberCollarSize: 0.006,
  saberCollarThickness: 0.001,
  saberCollarSpacing: 0.088,
  saberRingCount: 5,
  saberRingSize: 0.0054,
  saberRingThickness: 0.0025,
  saberRingSpacing: 0.014,
  saberPommelLength: 0.009,
  saberPommelThickness: 0.0055,
  saberXOffset: 0,
  saberYOffset: 0,
  saberZOffset: 0,
  saberXRotation: 0,
  saberYRotation: 0,
  saberZRotation: 0,
};

export const DEFAULT_VIEWER_SETTINGS: ViewerSettings = {
  graphicsQuality: 'high',
  screenDisplacementEffects: true,
  previewHitNotes: true,
  previewHitLine: false,
  previewNotesLookAtPlayer: false,
  renderScale: 1,
  staticLights: false,
  preferReplayColors: true,
  preferReplayEnvironment: true,
  overrideEnvironment: false,
  environmentOverrideId: 'BigMirrorEnvironment',
  customColors: false,
  leftColor: '#c81414',
  rightColor: '#288ed2',
  obstacleColor: '#ff3030',
  environmentLeftColor: '#d91616',
  environmentRightColor: '#30acff',
  environmentWhiteColor: '#b9b9b9',
  environmentLeftBoostColor: '#d91616',
  environmentRightBoostColor: '#30acff',
  environmentWhiteBoostColor: '#b9b9b9',
  ...DEFAULT_REPLAY_SABER_SETTINGS,
  hitsounds: true,
  masterMuted: false,
  songMuted: false,
  masterVolume: 1,
  songVolume: 1,
  hitsoundVolume: 1,
  showBookmarks: false,
  ...DEFAULT_REPLAY_CAMERA_SETTINGS,
  autoHide: true,
};

const storageKey = 'chroviewer.settings.v6';
const previousStorageKey = 'chroviewer.settings.v5';
const olderStorageKey = 'chroviewer.settings.v4';
const legacyStorageKey = 'chroviewer.settings.v3';
const oldestStorageKey = 'chroviewer.settings.v2';
const originalStorageKey = 'chroviewer.settings.v1';
const hexPattern = /^#[0-9a-f]{6}$/i;
const mobileUserAgent = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i;

interface MobileDeviceInfo {
  userAgent: string;
  maxTouchPoints: number;
}

function numberSetting(fallback: number, minimum: number, maximum: number) {
  return z.pipe(
    z.catch(z.number(), fallback),
    z.transform((value) => Math.min(Math.max(value, minimum), maximum)),
  );
}

function integerSetting(fallback: number, minimum: number, maximum: number) {
  return z.pipe(
    numberSetting(fallback, minimum, maximum),
    z.transform((value) => Math.round(value)),
  );
}

function hexColorSchema(fallback: string) {
  return z.catch(
    z.pipe(
      z.string().check(z.regex(hexPattern)),
      z.transform((value) => value.toLowerCase()),
    ),
    fallback,
  );
}

const viewerSettingsObjectSchema = z.object({
  graphicsQuality: z.catch(z.enum(['none', 'low', 'medium', 'high']), DEFAULT_VIEWER_SETTINGS.graphicsQuality),
  screenDisplacementEffects: z.catch(z.boolean(), DEFAULT_VIEWER_SETTINGS.screenDisplacementEffects),
  previewHitNotes: z.catch(z.boolean(), DEFAULT_VIEWER_SETTINGS.previewHitNotes),
  previewHitLine: z.catch(z.boolean(), DEFAULT_VIEWER_SETTINGS.previewHitLine),
  previewNotesLookAtPlayer: z.catch(z.boolean(), DEFAULT_VIEWER_SETTINGS.previewNotesLookAtPlayer),
  renderScale: numberSetting(DEFAULT_VIEWER_SETTINGS.renderScale, 0.5, 1.5),
  staticLights: z.catch(z.boolean(), DEFAULT_VIEWER_SETTINGS.staticLights),
  preferReplayColors: z.catch(z.boolean(), DEFAULT_VIEWER_SETTINGS.preferReplayColors),
  preferReplayEnvironment: z.catch(z.boolean(), DEFAULT_VIEWER_SETTINGS.preferReplayEnvironment),
  overrideEnvironment: z.catch(z.boolean(), DEFAULT_VIEWER_SETTINGS.overrideEnvironment),
  environmentOverrideId: z.catch(z.string(), DEFAULT_VIEWER_SETTINGS.environmentOverrideId),
  customColors: z.catch(z.boolean(), DEFAULT_VIEWER_SETTINGS.customColors),
  leftColor: hexColorSchema(DEFAULT_VIEWER_SETTINGS.leftColor),
  rightColor: hexColorSchema(DEFAULT_VIEWER_SETTINGS.rightColor),
  obstacleColor: hexColorSchema(DEFAULT_VIEWER_SETTINGS.obstacleColor),
  environmentLeftColor: hexColorSchema(DEFAULT_VIEWER_SETTINGS.environmentLeftColor),
  environmentRightColor: hexColorSchema(DEFAULT_VIEWER_SETTINGS.environmentRightColor),
  environmentWhiteColor: hexColorSchema(DEFAULT_VIEWER_SETTINGS.environmentWhiteColor),
  environmentLeftBoostColor: hexColorSchema(DEFAULT_VIEWER_SETTINGS.environmentLeftBoostColor),
  environmentRightBoostColor: hexColorSchema(DEFAULT_VIEWER_SETTINGS.environmentRightBoostColor),
  environmentWhiteBoostColor: hexColorSchema(DEFAULT_VIEWER_SETTINGS.environmentWhiteBoostColor),
  showSabers: z.catch(z.boolean(), DEFAULT_VIEWER_SETTINGS.showSabers),
  saberScale: numberSetting(DEFAULT_VIEWER_SETTINGS.saberScale, 0.25, 3),
  saberBladeLength: numberSetting(DEFAULT_VIEWER_SETTINGS.saberBladeLength, 0.1, 2),
  saberBladeThickness: numberSetting(DEFAULT_VIEWER_SETTINGS.saberBladeThickness, 0.001, 0.03),
  saberCoreThickness: numberSetting(DEFAULT_VIEWER_SETTINGS.saberCoreThickness, 0.0005, 0.02),
  saberCoreInset: numberSetting(DEFAULT_VIEWER_SETTINGS.saberCoreInset, 0, 0.2),
  showSaberTrails: z.catch(z.boolean(), DEFAULT_VIEWER_SETTINGS.showSaberTrails),
  replayTrailShape: z.catch(z.enum(['flag', 'rectangle']), DEFAULT_VIEWER_SETTINGS.replayTrailShape),
  replayTrailLength: numberSetting(DEFAULT_VIEWER_SETTINGS.replayTrailLength, 0.02, 1.5),
  replayTrailThinness: numberSetting(DEFAULT_VIEWER_SETTINGS.replayTrailThinness, 0, 0.95),
  replayTrailSamples: integerSetting(DEFAULT_VIEWER_SETTINGS.replayTrailSamples, 2, 128),
  replayTrailFade: numberSetting(DEFAULT_VIEWER_SETTINGS.replayTrailFade, 0.1, 5),
  replayTrailOpacity: numberSetting(DEFAULT_VIEWER_SETTINGS.replayTrailOpacity, 0, 2),
  replayTrailMotionThreshold: numberSetting(DEFAULT_VIEWER_SETTINGS.replayTrailMotionThreshold, 0.0001, 0.02),
  saberGripLength: numberSetting(DEFAULT_VIEWER_SETTINGS.saberGripLength, 0.02, 0.3),
  saberGripThickness: numberSetting(DEFAULT_VIEWER_SETTINGS.saberGripThickness, 0.002, 0.03),
  saberGuardSize: numberSetting(DEFAULT_VIEWER_SETTINGS.saberGuardSize, 0.005, 0.08),
  saberGuardThickness: numberSetting(DEFAULT_VIEWER_SETTINGS.saberGuardThickness, 0.0005, 0.01),
  saberCollarSize: numberSetting(DEFAULT_VIEWER_SETTINGS.saberCollarSize, 0.002, 0.04),
  saberCollarThickness: numberSetting(DEFAULT_VIEWER_SETTINGS.saberCollarThickness, 0.0005, 0.01),
  saberCollarSpacing: numberSetting(DEFAULT_VIEWER_SETTINGS.saberCollarSpacing, 0, 0.2),
  saberRingCount: integerSetting(DEFAULT_VIEWER_SETTINGS.saberRingCount, 0, 5),
  saberRingSize: numberSetting(DEFAULT_VIEWER_SETTINGS.saberRingSize, 0.002, 0.03),
  saberRingThickness: numberSetting(DEFAULT_VIEWER_SETTINGS.saberRingThickness, 0.001, 0.02),
  saberRingSpacing: numberSetting(DEFAULT_VIEWER_SETTINGS.saberRingSpacing, 0, 0.04),
  saberPommelLength: numberSetting(DEFAULT_VIEWER_SETTINGS.saberPommelLength, 0.002, 0.05),
  saberPommelThickness: numberSetting(DEFAULT_VIEWER_SETTINGS.saberPommelThickness, 0.002, 0.03),
  saberXOffset: numberSetting(DEFAULT_VIEWER_SETTINGS.saberXOffset, -0.25, 0.25),
  saberYOffset: numberSetting(DEFAULT_VIEWER_SETTINGS.saberYOffset, -0.25, 0.25),
  saberZOffset: numberSetting(DEFAULT_VIEWER_SETTINGS.saberZOffset, -0.25, 0.25),
  saberXRotation: numberSetting(DEFAULT_VIEWER_SETTINGS.saberXRotation, -45, 45),
  saberYRotation: numberSetting(DEFAULT_VIEWER_SETTINGS.saberYRotation, -45, 45),
  saberZRotation: numberSetting(DEFAULT_VIEWER_SETTINGS.saberZRotation, -45, 45),
  hitsounds: z.catch(z.boolean(), DEFAULT_VIEWER_SETTINGS.hitsounds),
  masterMuted: z.catch(z.boolean(), DEFAULT_VIEWER_SETTINGS.masterMuted),
  songMuted: z.catch(z.boolean(), DEFAULT_VIEWER_SETTINGS.songMuted),
  masterVolume: numberSetting(DEFAULT_VIEWER_SETTINGS.masterVolume, 0, 1),
  songVolume: numberSetting(DEFAULT_VIEWER_SETTINGS.songVolume, 0, 1),
  hitsoundVolume: numberSetting(DEFAULT_VIEWER_SETTINGS.hitsoundVolume, 0, 1),
  showBookmarks: z.catch(z.boolean(), DEFAULT_VIEWER_SETTINGS.showBookmarks),
  replayCamera: z.catch(z.enum(['static', 'follow', 'first-person']), DEFAULT_VIEWER_SETTINGS.replayCamera),
  replayCameraSmoothing: z.catch(z.boolean(), DEFAULT_VIEWER_SETTINGS.replayCameraSmoothing),
  replayCameraSmoothingSpeed: numberSetting(DEFAULT_VIEWER_SETTINGS.replayCameraSmoothingSpeed, 1, 20),
  replayCameraFov: numberSetting(DEFAULT_VIEWER_SETTINGS.replayCameraFov, 60, 120),
  previewCameraDistance: numberSetting(DEFAULT_VIEWER_SETTINGS.previewCameraDistance, 0, 10),
  fixedCameraDistance: numberSetting(DEFAULT_VIEWER_SETTINGS.fixedCameraDistance, 2, 10),
  replayCameraXOffset: numberSetting(DEFAULT_VIEWER_SETTINGS.replayCameraXOffset, -10, 10),
  replayCameraYOffset: numberSetting(DEFAULT_VIEWER_SETTINGS.replayCameraYOffset, -10, 10),
  replayCameraDepthOffset: numberSetting(DEFAULT_VIEWER_SETTINGS.replayCameraDepthOffset, -10, 10),
  replayCameraXRotation: numberSetting(DEFAULT_VIEWER_SETTINGS.replayCameraXRotation, -180, 180),
  replayCameraYRotation: numberSetting(DEFAULT_VIEWER_SETTINGS.replayCameraYRotation, -180, 180),
  replayCameraZRotation: numberSetting(DEFAULT_VIEWER_SETTINGS.replayCameraZRotation, -180, 180),
  replayCameraForceUpright: z.catch(z.boolean(), DEFAULT_VIEWER_SETTINGS.replayCameraForceUpright),
  autoHide: z.catch(z.boolean(), DEFAULT_VIEWER_SETTINGS.autoHide),
});

const viewerSettingsSchema = z.catch(viewerSettingsObjectSchema, DEFAULT_VIEWER_SETTINGS);
export const viewerSettingsPatchSchema = z.partial(viewerSettingsObjectSchema);

export function sanitizeViewerSettings(value: unknown): ViewerSettings {
  return z.parse(viewerSettingsSchema, value);
}

export function isMobileDevice(
  device: MobileDeviceInfo | undefined = typeof navigator === 'undefined' ? undefined : navigator,
) {
  if (device === undefined) return false;
  return (
    mobileUserAgent.test(device.userAgent) || (device.maxTouchPoints > 1 && device.userAgent.includes('Macintosh'))
  );
}

export function loadViewerSettings(
  storage: Pick<Storage, 'getItem'> = localStorage,
  mobile = isMobileDevice(),
): ViewerSettings {
  const defaults: ViewerSettings = mobile
    ? { ...DEFAULT_VIEWER_SETTINGS, graphicsQuality: 'medium' }
    : DEFAULT_VIEWER_SETTINGS;
  const text = storage.getItem(storageKey);
  if (text !== null) {
    const parsed = Result.try((): unknown => JSON.parse(text));
    return parsed.isOk() ? sanitizeViewerSettings(parsed.value) : defaults;
  }

  const previousText = storage.getItem(previousStorageKey);
  if (previousText !== null) {
    const parsed = Result.try((): unknown => JSON.parse(previousText));
    if (parsed.isErr()) return defaults;
    return resetSaberSettings(migrateIncorrectDefaultColors(sanitizeViewerSettings(parsed.value)));
  }

  const olderText = storage.getItem(olderStorageKey);
  if (olderText !== null) {
    const parsed = Result.try((): unknown => JSON.parse(olderText));
    if (parsed.isErr()) return defaults;
    return resetSaberSettings(migrateLegacyColorOverrides(sanitizeViewerSettings(parsed.value)));
  }

  const legacyText = storage.getItem(legacyStorageKey);
  if (legacyText !== null) {
    const parsed = Result.try((): unknown => JSON.parse(legacyText));
    if (parsed.isErr()) return defaults;
    return resetSaberSettings(migrateLegacyColorOverrides(sanitizeViewerSettings(parsed.value)));
  }

  const oldestText = storage.getItem(oldestStorageKey);
  if (oldestText !== null) {
    const parsed = Result.try((): unknown => JSON.parse(oldestText));
    if (parsed.isErr()) return defaults;
    const settings = resetSaberSettings(migrateLegacyColorOverrides(sanitizeViewerSettings(parsed.value)));
    return settings.graphicsQuality === 'medium'
      ? { ...settings, graphicsQuality: defaults.graphicsQuality }
      : settings;
  }

  const originalText = storage.getItem(originalStorageKey);
  if (originalText === null) return defaults;
  const parsed = Result.try((): unknown => JSON.parse(originalText));
  if (parsed.isErr()) return defaults;
  const settings = resetSaberSettings(migrateLegacyColorOverrides(sanitizeViewerSettings(parsed.value)));
  return settings.graphicsQuality === 'high' ? { ...settings, graphicsQuality: defaults.graphicsQuality } : settings;
}

function resetSaberSettings(settings: ViewerSettings): ViewerSettings {
  return { ...settings, ...DEFAULT_REPLAY_SABER_SETTINGS };
}

function migrateIncorrectDefaultColors(settings: ViewerSettings): ViewerSettings {
  if (
    settings.leftColor !== '#bb0000' ||
    settings.rightColor !== '#005ebc' ||
    settings.obstacleColor !== '#ff0000' ||
    settings.environmentLeftColor !== '#ff0000' ||
    settings.environmentRightColor !== '#0048ff' ||
    settings.environmentWhiteColor !== '#b9b9b9' ||
    settings.environmentLeftBoostColor !== '#ff0000' ||
    settings.environmentRightBoostColor !== '#0048ff' ||
    settings.environmentWhiteBoostColor !== '#b9b9b9'
  )
    return settings;
  return {
    ...settings,
    leftColor: DEFAULT_VIEWER_SETTINGS.leftColor,
    rightColor: DEFAULT_VIEWER_SETTINGS.rightColor,
    obstacleColor: DEFAULT_VIEWER_SETTINGS.obstacleColor,
    environmentLeftColor: DEFAULT_VIEWER_SETTINGS.environmentLeftColor,
    environmentRightColor: DEFAULT_VIEWER_SETTINGS.environmentRightColor,
    environmentWhiteColor: DEFAULT_VIEWER_SETTINGS.environmentWhiteColor,
    environmentLeftBoostColor: DEFAULT_VIEWER_SETTINGS.environmentLeftBoostColor,
    environmentRightBoostColor: DEFAULT_VIEWER_SETTINGS.environmentRightBoostColor,
    environmentWhiteBoostColor: DEFAULT_VIEWER_SETTINGS.environmentWhiteBoostColor,
  };
}

function migrateLegacyColorOverrides(settings: ViewerSettings): ViewerSettings {
  return {
    ...settings,
    obstacleColor: settings.leftColor,
    environmentLeftColor: settings.leftColor,
    environmentRightColor: settings.rightColor,
    environmentLeftBoostColor: settings.leftColor,
    environmentRightBoostColor: settings.rightColor,
  };
}

export function saveViewerSettings(settings: ViewerSettings, storage: Pick<Storage, 'setItem'> = localStorage) {
  storage.setItem(storageKey, JSON.stringify(settings));
}

export function hexToRgb(hex: string): Rgb {
  return [
    Number.parseInt(hex.slice(1, 3), 16) / 255,
    Number.parseInt(hex.slice(3, 5), 16) / 255,
    Number.parseInt(hex.slice(5, 7), 16) / 255,
  ];
}

export function environmentForSettings(
  settings: Pick<ViewerSettings, 'preferReplayEnvironment' | 'overrideEnvironment' | 'environmentOverrideId'>,
  mapEnvironmentId: string,
  replayEnvironmentId?: string,
) {
  if (settings.preferReplayEnvironment && replayEnvironmentId !== undefined) return replayEnvironmentId;
  return settings.overrideEnvironment ? settings.environmentOverrideId : mapEnvironmentId;
}

export function colorOverride(
  settings: ViewerSettings,
  mapScheme?: InfoColorScheme,
  replayMetadata?: ReplayMetadata,
): InfoColorScheme | undefined {
  const base = manualColorOverride(settings, mapScheme);
  return settings.preferReplayColors ? replayColorScheme(replayMetadata, base) : base;
}

function manualColorOverride(settings: ViewerSettings, mapScheme?: InfoColorScheme): InfoColorScheme | undefined {
  if (!settings.customColors) return mapScheme;
  const left = hexToRgb(settings.leftColor);
  const right = hexToRgb(settings.rightColor);
  return {
    name: 'ChroViewer custom',
    overrideNotes: true,
    leftNote: left,
    rightNote: right,
    obstacle: hexToRgb(settings.obstacleColor),
    overrideLights: true,
    supportsEnvironmentColorBoost: true,
    environmentLeft: hexToRgb(settings.environmentLeftColor),
    environmentRight: hexToRgb(settings.environmentRightColor),
    environmentWhite: hexToRgb(settings.environmentWhiteColor),
    environmentLeftBoost: hexToRgb(settings.environmentLeftBoostColor),
    environmentRightBoost: hexToRgb(settings.environmentRightBoostColor),
    environmentWhiteBoost: hexToRgb(settings.environmentWhiteBoostColor),
  };
}
