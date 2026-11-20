import { Result } from 'better-result';
import * as z from 'zod/mini';

import type { InfoColorScheme } from './beatmap/info';
import type { Rgb } from './colors';
import { MAX_HSV_PROFILE_BYTES } from './replay/hit-score-visualizer-profile';
import { replayColorScheme } from './replay/play-settings';
import type { ReplayMetadata } from './replay/types';

export const SETTING_OPTIONS = {
  graphicsQuality: ['none', 'low', 'medium', 'high'],
  orthoCameraView: ['back', 'left', 'right'],
  replayCamera: ['static', 'follow', 'first-person'],
  hitsoundPreset: [
    'default',
    'ChromapperTick',
    'OsuHitsound',
    'ThumpyHitsound',
    'GalxHitsound',
    'RabbitViewerTick',
    'custom',
  ],
} as const;

type SettingOption<K extends keyof typeof SETTING_OPTIONS> = (typeof SETTING_OPTIONS)[K][number];

export interface ViewerSettings {
  graphicsQuality: SettingOption<'graphicsQuality'>;
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
  orthoCameraView: SettingOption<'orthoCameraView'>;
  replayCamera: SettingOption<'replayCamera'>;
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

export type HitsoundPreset = SettingOption<'hitsoundPreset'>;

export interface SettingRange {
  min: number;
  max: number;
  step: number;
}

type NumberSettingKey = {
  [K in keyof ViewerSettings]: ViewerSettings[K] extends number ? K : never;
}[keyof ViewerSettings];

export const SETTING_RANGES: Record<NumberSettingKey, SettingRange> = {
  renderScale: { min: 0.5, max: 1.5, step: 0.05 },
  saberScale: { min: 0.25, max: 3, step: 0.01 },
  saberBladeLength: { min: 0.1, max: 2, step: 0.01 },
  saberBladeWidth: { min: 0.25, max: 4, step: 0.05 },
  saberTipWidth: { min: 0, max: 1, step: 0.01 },
  saberHiltLength: { min: 0.04, max: 0.4, step: 0.005 },
  saberHiltWidth: { min: 0.25, max: 3, step: 0.05 },
  saberRingCount: { min: 0, max: 5, step: 1 },
  saberTrailDuration: { min: 0.05, max: 1, step: 0.01 },
  saberTrailWidth: { min: 0.05, max: 1, step: 0.01 },
  saberTrailBrightness: { min: 0, max: 2, step: 0.01 },
  saberXOffset: { min: -0.25, max: 0.25, step: 0.001 },
  saberYOffset: { min: -0.25, max: 0.25, step: 0.001 },
  saberZOffset: { min: -0.25, max: 0.25, step: 0.001 },
  saberXRotation: { min: -45, max: 45, step: 0.1 },
  saberYRotation: { min: -45, max: 45, step: 0.1 },
  saberZRotation: { min: -45, max: 45, step: 0.1 },
  masterVolume: { min: 0, max: 1, step: 0.01 },
  songVolume: { min: 0, max: 1, step: 0.01 },
  hitsoundVolume: { min: 0, max: 1, step: 0.01 },
  audioOffsetMs: { min: -1000, max: 1000, step: 10 },
  replayCameraSmoothingSpeed: { min: 1, max: 20, step: 0.1 },
  replayCameraFov: { min: 60, max: 120, step: 0.1 },
  previewCameraDistance: { min: 0, max: 10, step: 0.1 },
  fixedCameraDistance: { min: 2, max: 10, step: 0.1 },
  replayCameraXOffset: { min: -10, max: 10, step: 0.01 },
  replayCameraYOffset: { min: -10, max: 10, step: 0.01 },
  replayCameraDepthOffset: { min: -10, max: 10, step: 0.01 },
  replayCameraXRotation: { min: -180, max: 180, step: 0.1 },
  replayCameraYRotation: { min: -180, max: 180, step: 0.1 },
  replayCameraZRotation: { min: -180, max: 180, step: 0.1 },
};

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

function numberSetting(key: NumberSettingKey) {
  const { min, max, step } = SETTING_RANGES[key];
  return z.pipe(
    z.catch(z.number(), DEFAULT_VIEWER_SETTINGS[key]),
    z.transform((value) => {
      const clamped = Math.min(Math.max(value, min), max);
      return Number.isInteger(step) ? Math.round(clamped) : clamped;
    }),
  );
}

function optionSetting<K extends keyof typeof SETTING_OPTIONS>(key: K) {
  return z.catch(z.enum(SETTING_OPTIONS[key]), DEFAULT_VIEWER_SETTINGS[key]);
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
  graphicsQuality: optionSetting('graphicsQuality'),
  screenDisplacementEffects: z.catch(z.boolean(), DEFAULT_VIEWER_SETTINGS.screenDisplacementEffects),
  previewHitNotes: z.catch(z.boolean(), DEFAULT_VIEWER_SETTINGS.previewHitNotes),
  previewHitLine: z.catch(z.boolean(), DEFAULT_VIEWER_SETTINGS.previewHitLine),
  previewNotesLookAtPlayer: z.catch(z.boolean(), DEFAULT_VIEWER_SETTINGS.previewNotesLookAtPlayer),
  renderScale: numberSetting('renderScale'),
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
  saberScale: numberSetting('saberScale'),
  saberBladeLength: numberSetting('saberBladeLength'),
  saberBladeWidth: numberSetting('saberBladeWidth'),
  saberTipWidth: numberSetting('saberTipWidth'),
  saberHiltLength: numberSetting('saberHiltLength'),
  saberHiltWidth: numberSetting('saberHiltWidth'),
  saberRingCount: numberSetting('saberRingCount'),
  showSaberTrails: z.catch(z.boolean(), DEFAULT_VIEWER_SETTINGS.showSaberTrails),
  saberTrailDuration: numberSetting('saberTrailDuration'),
  saberTrailWidth: numberSetting('saberTrailWidth'),
  saberTrailBrightness: numberSetting('saberTrailBrightness'),
  saberXOffset: numberSetting('saberXOffset'),
  saberYOffset: numberSetting('saberYOffset'),
  saberZOffset: numberSetting('saberZOffset'),
  saberXRotation: numberSetting('saberXRotation'),
  saberYRotation: numberSetting('saberYRotation'),
  saberZRotation: numberSetting('saberZRotation'),
  hitsounds: z.catch(z.boolean(), DEFAULT_VIEWER_SETTINGS.hitsounds),
  hitsoundPreset: optionSetting('hitsoundPreset'),
  customGoodHitsound: z.catch(z.nullable(z.string()), DEFAULT_VIEWER_SETTINGS.customGoodHitsound),
  customBadHitsound: z.catch(z.nullable(z.string()), DEFAULT_VIEWER_SETTINGS.customBadHitsound),
  masterMuted: z.catch(z.boolean(), DEFAULT_VIEWER_SETTINGS.masterMuted),
  songMuted: z.catch(z.boolean(), DEFAULT_VIEWER_SETTINGS.songMuted),
  masterVolume: numberSetting('masterVolume'),
  songVolume: numberSetting('songVolume'),
  hitsoundVolume: numberSetting('hitsoundVolume'),
  audioOffsetMs: numberSetting('audioOffsetMs'),
  showBookmarks: z.catch(z.boolean(), DEFAULT_VIEWER_SETTINGS.showBookmarks),
  reverseTimelineScroll: z.catch(z.boolean(), DEFAULT_VIEWER_SETTINGS.reverseTimelineScroll),
  showHeadset: z.catch(z.boolean(), DEFAULT_VIEWER_SETTINGS.showHeadset),
  orthoCameraEnabled: z.catch(z.boolean(), DEFAULT_VIEWER_SETTINGS.orthoCameraEnabled),
  orthoCameraView: optionSetting('orthoCameraView'),
  replayCamera: optionSetting('replayCamera'),
  replayCameraSmoothing: z.catch(z.boolean(), DEFAULT_VIEWER_SETTINGS.replayCameraSmoothing),
  replayCameraSmoothingSpeed: numberSetting('replayCameraSmoothingSpeed'),
  replayCameraFov: numberSetting('replayCameraFov'),
  previewCameraDistance: numberSetting('previewCameraDistance'),
  fixedCameraDistance: numberSetting('fixedCameraDistance'),
  replayCameraXOffset: numberSetting('replayCameraXOffset'),
  replayCameraYOffset: numberSetting('replayCameraYOffset'),
  replayCameraDepthOffset: numberSetting('replayCameraDepthOffset'),
  replayCameraXRotation: numberSetting('replayCameraXRotation'),
  replayCameraYRotation: numberSetting('replayCameraYRotation'),
  replayCameraZRotation: numberSetting('replayCameraZRotation'),
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
