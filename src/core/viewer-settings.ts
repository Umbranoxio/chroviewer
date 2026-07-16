import { Result } from 'better-result';
import * as z from 'zod/mini';

import type { InfoColorScheme } from './beatmap/info';
import type { Rgb } from './colors';

export interface ViewerSettings {
  graphicsQuality: 'none' | 'low' | 'medium' | 'high';
  screenDisplacementEffects: boolean;
  renderScale: number;
  staticLights: boolean;
  customColors: boolean;
  leftColor: string;
  rightColor: string;
  replayTrailShape: 'flag' | 'rectangle';
  replayTrailLength: number;
  replayTrailSamples: number;
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
  replayCameraZOffset: number;
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
  | 'replayCameraZOffset'
  | 'replayCameraXRotation'
  | 'replayCameraYRotation'
  | 'replayCameraZRotation'
  | 'replayCameraForceUpright'
>;

export type ReplayTrailSettings = Pick<ViewerSettings, 'replayTrailShape' | 'replayTrailLength' | 'replayTrailSamples'>;

export const DEFAULT_REPLAY_CAMERA_SETTINGS: ReplayCameraSettings = {
  replayCamera: 'first-person',
  replayCameraSmoothing: true,
  replayCameraSmoothingSpeed: 4,
  replayCameraFov: 70,
  previewCameraDistance: 4,
  fixedCameraDistance: 4,
  replayCameraXOffset: 0,
  replayCameraYOffset: 0,
  replayCameraZOffset: -0.45,
  replayCameraXRotation: 0,
  replayCameraYRotation: 0,
  replayCameraZRotation: 0,
  replayCameraForceUpright: false,
};

export const DEFAULT_REPLAY_TRAIL_SETTINGS: ReplayTrailSettings = {
  replayTrailShape: 'flag',
  replayTrailLength: 0.331,
  replayTrailSamples: 18,
};

export const DEFAULT_VIEWER_SETTINGS: ViewerSettings = {
  graphicsQuality: 'high',
  screenDisplacementEffects: true,
  renderScale: 1,
  staticLights: false,
  customColors: false,
  leftColor: '#bb0000',
  rightColor: '#005ebc',
  ...DEFAULT_REPLAY_TRAIL_SETTINGS,
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

const storageKey = 'chroviewer.settings.v3';
const previousStorageKey = 'chroviewer.settings.v2';
const legacyStorageKey = 'chroviewer.settings.v1';
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
  renderScale: numberSetting(DEFAULT_VIEWER_SETTINGS.renderScale, 0.5, 1.5),
  staticLights: z.catch(z.boolean(), DEFAULT_VIEWER_SETTINGS.staticLights),
  customColors: z.catch(z.boolean(), DEFAULT_VIEWER_SETTINGS.customColors),
  leftColor: hexColorSchema(DEFAULT_VIEWER_SETTINGS.leftColor),
  rightColor: hexColorSchema(DEFAULT_VIEWER_SETTINGS.rightColor),
  replayTrailShape: z.catch(z.enum(['flag', 'rectangle']), DEFAULT_VIEWER_SETTINGS.replayTrailShape),
  replayTrailLength: numberSetting(DEFAULT_VIEWER_SETTINGS.replayTrailLength, 0.05, 0.98),
  replayTrailSamples: integerSetting(DEFAULT_VIEWER_SETTINGS.replayTrailSamples, 2, 64),
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
  replayCameraZOffset: numberSetting(DEFAULT_VIEWER_SETTINGS.replayCameraZOffset, -10, 10),
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
    const settings = sanitizeViewerSettings(parsed.value);
    return settings.graphicsQuality === 'medium'
      ? { ...settings, graphicsQuality: defaults.graphicsQuality }
      : settings;
  }

  const legacyText = storage.getItem(legacyStorageKey);
  if (legacyText === null) return defaults;
  const parsed = Result.try((): unknown => JSON.parse(legacyText));
  if (parsed.isErr()) return defaults;
  const settings = sanitizeViewerSettings(parsed.value);
  return settings.graphicsQuality === 'high' ? { ...settings, graphicsQuality: defaults.graphicsQuality } : settings;
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

export function colorOverride(settings: ViewerSettings, mapScheme?: InfoColorScheme): InfoColorScheme | undefined {
  if (!settings.customColors) return mapScheme;
  const left = hexToRgb(settings.leftColor);
  const right = hexToRgb(settings.rightColor);
  return {
    name: 'ChroViewer custom',
    overrideNotes: true,
    leftNote: left,
    rightNote: right,
    obstacle: left,
    overrideLights: true,
    supportsEnvironmentColorBoost: true,
    environmentLeft: left,
    environmentRight: right,
    environmentLeftBoost: left,
    environmentRightBoost: right,
  };
}
