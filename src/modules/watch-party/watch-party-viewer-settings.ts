import { Result } from 'better-result';
import * as z from 'zod/mini';

import type { LightshowMode } from '../../core/lighting/basic-light';
import { sanitizeViewerSettings, type ViewerSettings } from '../../core/viewer-settings';

const colorSchema = z.string().check(z.regex(/^#[0-9a-f]{6}$/i));

const watchPartyViewerSettingsSchema = z.object({
  graphicsQuality: z.enum(['none', 'low', 'medium', 'high']),
  screenDisplacementEffects: z.boolean(),
  previewHitNotes: z.boolean(),
  previewHitLine: z.boolean(),
  previewNotesLookAtPlayer: z.boolean(),
  lightshowMode: z.enum(['full', 'full-lightshow', 'static', 'none']),
  preferReplayColors: z.boolean(),
  preferReplayEnvironment: z.boolean(),
  overrideEnvironment: z.boolean(),
  environmentOverrideId: z.string().check(z.maxLength(128)),
  customColors: z.boolean(),
  leftColor: colorSchema,
  rightColor: colorSchema,
  obstacleColor: colorSchema,
  environmentLeftColor: colorSchema,
  environmentRightColor: colorSchema,
  environmentWhiteColor: colorSchema,
  environmentLeftBoostColor: colorSchema,
  environmentRightBoostColor: colorSchema,
  environmentWhiteBoostColor: colorSchema,
  replayCameraFov: z.number(),
  previewCameraDistance: z.number(),
});

export type WatchPartyViewerSettingsValue = z.infer<typeof watchPartyViewerSettingsSchema>;

export function encodeWatchPartyViewerSettings(settings: ViewerSettings, lightshowMode: LightshowMode) {
  return JSON.stringify({
    graphicsQuality: settings.graphicsQuality,
    screenDisplacementEffects: settings.screenDisplacementEffects,
    previewHitNotes: settings.previewHitNotes,
    previewHitLine: settings.previewHitLine,
    previewNotesLookAtPlayer: settings.previewNotesLookAtPlayer,
    lightshowMode,
    preferReplayColors: settings.preferReplayColors,
    preferReplayEnvironment: settings.preferReplayEnvironment,
    overrideEnvironment: settings.overrideEnvironment,
    environmentOverrideId: settings.environmentOverrideId,
    customColors: settings.customColors,
    leftColor: settings.leftColor,
    rightColor: settings.rightColor,
    obstacleColor: settings.obstacleColor,
    environmentLeftColor: settings.environmentLeftColor,
    environmentRightColor: settings.environmentRightColor,
    environmentWhiteColor: settings.environmentWhiteColor,
    environmentLeftBoostColor: settings.environmentLeftBoostColor,
    environmentRightBoostColor: settings.environmentRightBoostColor,
    environmentWhiteBoostColor: settings.environmentWhiteBoostColor,
    replayCameraFov: settings.replayCameraFov,
    previewCameraDistance: settings.previewCameraDistance,
  } satisfies WatchPartyViewerSettingsValue);
}

export function parseWatchPartyViewerSettings(json: string) {
  const parsedJson = Result.try((): unknown => JSON.parse(json));
  if (parsedJson.isErr()) return null;
  const parsed = watchPartyViewerSettingsSchema.safeParse(parsedJson.value);
  return parsed.success ? parsed.data : null;
}

export function preserveLocalWatchPartyViewerSettings(local: ViewerSettings, next: ViewerSettings) {
  return {
    ...next,
    graphicsQuality: local.graphicsQuality,
    screenDisplacementEffects: local.screenDisplacementEffects,
    previewHitNotes: local.previewHitNotes,
    previewHitLine: local.previewHitLine,
    previewNotesLookAtPlayer: local.previewNotesLookAtPlayer,
    staticLights: local.staticLights,
    preferReplayColors: local.preferReplayColors,
    preferReplayEnvironment: local.preferReplayEnvironment,
    overrideEnvironment: local.overrideEnvironment,
    environmentOverrideId: local.environmentOverrideId,
    customColors: local.customColors,
    leftColor: local.leftColor,
    rightColor: local.rightColor,
    obstacleColor: local.obstacleColor,
    environmentLeftColor: local.environmentLeftColor,
    environmentRightColor: local.environmentRightColor,
    environmentWhiteColor: local.environmentWhiteColor,
    environmentLeftBoostColor: local.environmentLeftBoostColor,
    environmentRightBoostColor: local.environmentRightBoostColor,
    environmentWhiteBoostColor: local.environmentWhiteBoostColor,
    replayCameraFov: local.replayCameraFov,
    previewCameraDistance: local.previewCameraDistance,
  };
}

export function applyWatchPartyViewerSettings(settings: ViewerSettings, partySettings: WatchPartyViewerSettingsValue) {
  return sanitizeViewerSettings({
    ...settings,
    ...partySettings,
    staticLights: partySettings.lightshowMode === 'static',
  });
}
