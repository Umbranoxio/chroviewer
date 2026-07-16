import { Result } from 'better-result';
import * as z from 'zod/mini';

import type { InfoColorScheme } from './beatmap/info';
import type { Rgb } from './colors';

export interface ViewerSettings {
  graphicsQuality: 'none' | 'low' | 'high';
  screenDisplacementEffects: boolean;
  renderScale: number;
  staticLights: boolean;
  customColors: boolean;
  leftColor: string;
  rightColor: string;
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
  replayCameraForceUpright: true,
};

export const DEFAULT_VIEWER_SETTINGS: ViewerSettings = {
  graphicsQuality: 'high',
  screenDisplacementEffects: true,
  renderScale: 1,
  staticLights: false,
  customColors: false,
  leftColor: '#bb0000',
  rightColor: '#005ebc',
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

const storageKey = 'chroviewer.settings.v1';
const hexPattern = /^#[0-9a-f]{6}$/i;

function numberSetting(fallback: number, minimum: number, maximum: number) {
  return z.pipe(
    z.catch(z.number(), fallback),
    z.transform((value) => Math.min(Math.max(value, minimum), maximum)),
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
  graphicsQuality: z.catch(z.enum(['none', 'low', 'high']), DEFAULT_VIEWER_SETTINGS.graphicsQuality),
  screenDisplacementEffects: z.catch(z.boolean(), DEFAULT_VIEWER_SETTINGS.screenDisplacementEffects),
  renderScale: numberSetting(DEFAULT_VIEWER_SETTINGS.renderScale, 0.5, 1.5),
  staticLights: z.catch(z.boolean(), DEFAULT_VIEWER_SETTINGS.staticLights),
  customColors: z.catch(z.boolean(), DEFAULT_VIEWER_SETTINGS.customColors),
  leftColor: hexColorSchema(DEFAULT_VIEWER_SETTINGS.leftColor),
  rightColor: hexColorSchema(DEFAULT_VIEWER_SETTINGS.rightColor),
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

export function loadViewerSettings(storage: Pick<Storage, 'getItem'> = localStorage) {
  const text = storage.getItem(storageKey);
  if (text === null) return DEFAULT_VIEWER_SETTINGS;
  const parsed = Result.try((): unknown => JSON.parse(text));
  return parsed.isOk() ? sanitizeViewerSettings(parsed.value) : DEFAULT_VIEWER_SETTINGS;
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
