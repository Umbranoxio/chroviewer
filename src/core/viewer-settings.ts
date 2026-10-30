import { Result } from 'better-result';
import * as z from 'zod/mini';

import type { InfoColorScheme } from './beatmap/info';
import type { Rgb } from './colors';
import { MAX_HSV_PROFILE_BYTES } from './replay/hit-score-visualizer-profile';
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
  overrideHsvProfile: boolean;
  preferReplayHsvProfile: boolean;
  hsvProfile: string;
  showSabers: boolean;
  saberScale: number;
  saberBladeLength: number;
  saberBladeWidth: number;
  saberTipWidth: number;
  saberHiltLength: number;
  saberHiltWidth: number;
  saberRingCount: number;
  showSaberTrails: boolean;
  saberTrailDuration: number;
  saberTrailWidth: number;
  saberTrailBrightness: number;
  saberXOffset: number;
  saberYOffset: number;
  saberZOffset: number;
  saberXRotation: number;
  saberYRotation: number;
  saberZRotation: number;
  hitsounds: boolean;
  hitsoundPreset: HitsoundPreset;
  customGoodHitsound: string | null;
  customBadHitsound: string | null;
  masterMuted: boolean;
  songMuted: boolean;
  masterVolume: number;
  songVolume: number;
  hitsoundVolume: number;
  audioOffsetMs: number;
  showBookmarks: boolean;
  reverseTimelineScroll: boolean;
  showHeadset: boolean;
  orthoCameraEnabled: boolean;
  orthoCameraView: 'back' | 'left' | 'right';
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
  liveChatCollapsed: boolean;
  keepMapInfoVisible: boolean;
}

export type HitsoundPreset = z.infer<typeof hitsoundPresetSchema>;

export const MIN_AUDIO_OFFSET_MS = -1000;
export const MAX_AUDIO_OFFSET_MS = 1000;

export type ReplayCameraSettings = Pick<
  ViewerSettings,
  | 'showHeadset'
  | 'orthoCameraEnabled'
  | 'orthoCameraView'
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
  'showSaberTrails' | 'saberTrailDuration' | 'saberTrailWidth' | 'saberTrailBrightness'
>;

export type ReplaySaberSettings = Pick<
  ViewerSettings,
  | 'showSabers'
  | 'saberScale'
  | 'saberBladeLength'
  | 'saberBladeWidth'
  | 'saberTipWidth'
  | 'saberHiltLength'
  | 'saberHiltWidth'
  | 'saberRingCount'
  | 'saberXOffset'
  | 'saberYOffset'
  | 'saberZOffset'
  | 'saberXRotation'
  | 'saberYRotation'
  | 'saberZRotation'
> &
  ReplayTrailSettings;

export const DEFAULT_REPLAY_CAMERA_SETTINGS: ReplayCameraSettings = {
  showHeadset: true,
  orthoCameraEnabled: false,
  orthoCameraView: 'back',
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
  saberTrailDuration: 0.29,
  saberTrailWidth: 0.25,
  saberTrailBrightness: 1,
};

export const DEFAULT_REPLAY_SABER_SETTINGS: ReplaySaberSettings = {
  showSabers: true,
  saberScale: 1,
  saberBladeLength: 1,
  saberBladeWidth: 1,
  saberTipWidth: 0.2,
  saberHiltLength: 0.16,
  saberHiltWidth: 1,
  saberRingCount: 5,
  ...DEFAULT_REPLAY_TRAIL_SETTINGS,
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
  overrideHsvProfile: false,
  preferReplayHsvProfile: true,
  hsvProfile: '',
  ...DEFAULT_REPLAY_SABER_SETTINGS,
  hitsounds: true,
  hitsoundPreset: 'default',
  customGoodHitsound: null,
  customBadHitsound: null,
  masterMuted: false,
  songMuted: false,
  masterVolume: 1,
  songVolume: 1,
  hitsoundVolume: 1,
  audioOffsetMs: 0,
  showBookmarks: false,
  reverseTimelineScroll: false,
  ...DEFAULT_REPLAY_CAMERA_SETTINGS,
  autoHide: true,
  liveChatCollapsed: false,
  keepMapInfoVisible: false,
};

const storageKey = 'chroviewer.settings.v10';
const v9StorageKey = 'chroviewer.settings.v9';
const previousStorageKey = 'chroviewer.settings.v8';
const v7StorageKey = 'chroviewer.settings.v7';
const v6StorageKey = 'chroviewer.settings.v6';
const incorrectColorStorageKey = 'chroviewer.settings.v5';
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

const hitsoundPresetSchema = z.enum([
  'default',
  'ChromapperTick',
  'OsuHitsound',
  'ThumpyHitsound',
  'GalxHitsound',
  'RabbitViewerTick',
  'custom',
]);

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
  overrideHsvProfile: z.catch(z.boolean(), DEFAULT_VIEWER_SETTINGS.overrideHsvProfile),
  preferReplayHsvProfile: z.catch(z.boolean(), DEFAULT_VIEWER_SETTINGS.preferReplayHsvProfile),
  hsvProfile: z.catch(z.string().check(z.maxLength(MAX_HSV_PROFILE_BYTES)), DEFAULT_VIEWER_SETTINGS.hsvProfile),
  showSabers: z.catch(z.boolean(), DEFAULT_VIEWER_SETTINGS.showSabers),
  saberScale: numberSetting(DEFAULT_VIEWER_SETTINGS.saberScale, 0.25, 3),
  saberBladeLength: numberSetting(DEFAULT_VIEWER_SETTINGS.saberBladeLength, 0.1, 2),
  saberBladeWidth: numberSetting(DEFAULT_VIEWER_SETTINGS.saberBladeWidth, 0.25, 4),
  saberTipWidth: numberSetting(DEFAULT_VIEWER_SETTINGS.saberTipWidth, 0, 1),
  saberHiltLength: numberSetting(DEFAULT_VIEWER_SETTINGS.saberHiltLength, 0.04, 0.4),
  saberHiltWidth: numberSetting(DEFAULT_VIEWER_SETTINGS.saberHiltWidth, 0.25, 3),
  saberRingCount: integerSetting(DEFAULT_VIEWER_SETTINGS.saberRingCount, 0, 5),
  showSaberTrails: z.catch(z.boolean(), DEFAULT_VIEWER_SETTINGS.showSaberTrails),
  saberTrailDuration: numberSetting(DEFAULT_VIEWER_SETTINGS.saberTrailDuration, 0.05, 1),
  saberTrailWidth: numberSetting(DEFAULT_VIEWER_SETTINGS.saberTrailWidth, 0.05, 1),
  saberTrailBrightness: numberSetting(DEFAULT_VIEWER_SETTINGS.saberTrailBrightness, 0, 2),
  saberXOffset: numberSetting(DEFAULT_VIEWER_SETTINGS.saberXOffset, -0.25, 0.25),
  saberYOffset: numberSetting(DEFAULT_VIEWER_SETTINGS.saberYOffset, -0.25, 0.25),
  saberZOffset: numberSetting(DEFAULT_VIEWER_SETTINGS.saberZOffset, -0.25, 0.25),
  saberXRotation: numberSetting(DEFAULT_VIEWER_SETTINGS.saberXRotation, -45, 45),
  saberYRotation: numberSetting(DEFAULT_VIEWER_SETTINGS.saberYRotation, -45, 45),
  saberZRotation: numberSetting(DEFAULT_VIEWER_SETTINGS.saberZRotation, -45, 45),
  hitsounds: z.catch(z.boolean(), DEFAULT_VIEWER_SETTINGS.hitsounds),
  hitsoundPreset: z.catch(hitsoundPresetSchema, DEFAULT_VIEWER_SETTINGS.hitsoundPreset),
  customGoodHitsound: z.catch(z.nullable(z.string()), DEFAULT_VIEWER_SETTINGS.customGoodHitsound),
  customBadHitsound: z.catch(z.nullable(z.string()), DEFAULT_VIEWER_SETTINGS.customBadHitsound),
  masterMuted: z.catch(z.boolean(), DEFAULT_VIEWER_SETTINGS.masterMuted),
  songMuted: z.catch(z.boolean(), DEFAULT_VIEWER_SETTINGS.songMuted),
  masterVolume: numberSetting(DEFAULT_VIEWER_SETTINGS.masterVolume, 0, 1),
  songVolume: numberSetting(DEFAULT_VIEWER_SETTINGS.songVolume, 0, 1),
  hitsoundVolume: numberSetting(DEFAULT_VIEWER_SETTINGS.hitsoundVolume, 0, 1),
  audioOffsetMs: integerSetting(DEFAULT_VIEWER_SETTINGS.audioOffsetMs, MIN_AUDIO_OFFSET_MS, MAX_AUDIO_OFFSET_MS),
  showBookmarks: z.catch(z.boolean(), DEFAULT_VIEWER_SETTINGS.showBookmarks),
  reverseTimelineScroll: z.catch(z.boolean(), DEFAULT_VIEWER_SETTINGS.reverseTimelineScroll),
  showHeadset: z.catch(z.boolean(), DEFAULT_VIEWER_SETTINGS.showHeadset),
  orthoCameraEnabled: z.catch(z.boolean(), DEFAULT_VIEWER_SETTINGS.orthoCameraEnabled),
  orthoCameraView: z.catch(z.enum(['back', 'left', 'right']), DEFAULT_VIEWER_SETTINGS.orthoCameraView),
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
  liveChatCollapsed: z.catch(z.boolean(), DEFAULT_VIEWER_SETTINGS.liveChatCollapsed),
  keepMapInfoVisible: z.catch(z.boolean(), DEFAULT_VIEWER_SETTINGS.keepMapInfoVisible),
});

const viewerSettingsSchema = z.catch(viewerSettingsObjectSchema, DEFAULT_VIEWER_SETTINGS);
export const viewerSettingsPatchSchema = z.partial(viewerSettingsObjectSchema);

type ViewerSettingsInput = Parameters<typeof viewerSettingsSchema.parse>[0];

export function sanitizeViewerSettings(value: ViewerSettingsInput): ViewerSettings {
  return z.parse(viewerSettingsSchema, value);
}

const browserMobileDevice = z.safeParse(
  z.object({ userAgent: z.string(), maxTouchPoints: z.number() }),
  globalThis.navigator,
);

export function isMobileDevice(
  device: MobileDeviceInfo | undefined = browserMobileDevice.success ? browserMobileDevice.data : undefined,
) {
  if (device === undefined) return false;
  return (
    mobileUserAgent.test(device.userAgent) || (device.maxTouchPoints > 1 && device.userAgent.includes('Macintosh'))
  );
}

function parseStoredViewerSettings(text: string) {
  return Result.try(() => sanitizeViewerSettings(JSON.parse(text)));
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
    const parsed = parseStoredViewerSettings(text);
    return parsed.isOk() ? parsed.value : defaults;
  }

  for (const key of [v9StorageKey, previousStorageKey, v7StorageKey, v6StorageKey]) {
    const text = storage.getItem(key);
    if (text === null) continue;
    const parsed = parseStoredViewerSettings(text);
    return parsed.isOk() ? resetSaberSettings(parsed.value) : defaults;
  }

  const incorrectColorText = storage.getItem(incorrectColorStorageKey);
  if (incorrectColorText !== null) {
    const parsed = parseStoredViewerSettings(incorrectColorText);
    if (parsed.isErr()) return defaults;
    return resetSaberSettings(migrateIncorrectDefaultColors(parsed.value));
  }

  const olderText = storage.getItem(olderStorageKey);
  if (olderText !== null) {
    const parsed = parseStoredViewerSettings(olderText);
    if (parsed.isErr()) return defaults;
    return resetSaberSettings(migrateLegacyColorOverrides(parsed.value));
  }

  const legacyText = storage.getItem(legacyStorageKey);
  if (legacyText !== null) {
    const parsed = parseStoredViewerSettings(legacyText);
    if (parsed.isErr()) return defaults;
    return resetSaberSettings(migrateLegacyColorOverrides(parsed.value));
  }

  const oldestText = storage.getItem(oldestStorageKey);
  if (oldestText !== null) {
    const parsed = parseStoredViewerSettings(oldestText);
    if (parsed.isErr()) return defaults;
    const settings = resetSaberSettings(migrateLegacyColorOverrides(parsed.value));
    return settings.graphicsQuality === 'medium'
      ? { ...settings, graphicsQuality: defaults.graphicsQuality }
      : settings;
  }

  const originalText = storage.getItem(originalStorageKey);
  if (originalText === null) return defaults;
  const parsed = parseStoredViewerSettings(originalText);
  if (parsed.isErr()) return defaults;
  const settings = resetSaberSettings(migrateLegacyColorOverrides(parsed.value));
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
  replayEnvironmentId: string | undefined,
  usesChromaOrNoodle: boolean,
) {
  if (!usesChromaOrNoodle && settings.preferReplayEnvironment && replayEnvironmentId !== undefined)
    return replayEnvironmentId;
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
