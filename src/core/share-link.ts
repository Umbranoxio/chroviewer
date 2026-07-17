import { sanitizeViewerSettings, type ViewerSettings } from './viewer-settings';

export type ShareSettingsCategory = 'general' | 'graphics' | 'cosmetics' | 'camera';
export type SharedViewerSettings = Partial<ViewerSettings>;

export function settingsForShareCategories(
  settings: ViewerSettings,
  categories: readonly ShareSettingsCategory[],
): SharedViewerSettings | undefined {
  const shared: SharedViewerSettings = {};
  if (categories.includes('general')) {
    Object.assign(shared, {
      hitsounds: settings.hitsounds,
      previewHitNotes: settings.previewHitNotes,
      previewHitLine: settings.previewHitLine,
      previewNotesLookAtPlayer: settings.previewNotesLookAtPlayer,
    });
  }
  if (categories.includes('graphics')) {
    Object.assign(shared, {
      graphicsQuality: settings.graphicsQuality,
      screenDisplacementEffects: settings.screenDisplacementEffects,
      renderScale: settings.renderScale,
      staticLights: settings.staticLights,
    });
  }
  if (categories.includes('cosmetics')) {
    Object.assign(shared, {
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
      showSabers: settings.showSabers,
      saberScale: settings.saberScale,
      saberBladeLength: settings.saberBladeLength,
      saberBladeThickness: settings.saberBladeThickness,
      saberCoreThickness: settings.saberCoreThickness,
      saberCoreInset: settings.saberCoreInset,
      showSaberTrails: settings.showSaberTrails,
      replayTrailShape: settings.replayTrailShape,
      replayTrailLength: settings.replayTrailLength,
      replayTrailThinness: settings.replayTrailThinness,
      replayTrailSamples: settings.replayTrailSamples,
      replayTrailFade: settings.replayTrailFade,
      replayTrailOpacity: settings.replayTrailOpacity,
      replayTrailMotionThreshold: settings.replayTrailMotionThreshold,
      saberGripLength: settings.saberGripLength,
      saberGripThickness: settings.saberGripThickness,
      saberGuardSize: settings.saberGuardSize,
      saberGuardThickness: settings.saberGuardThickness,
      saberCollarSize: settings.saberCollarSize,
      saberCollarThickness: settings.saberCollarThickness,
      saberCollarSpacing: settings.saberCollarSpacing,
      saberRingCount: settings.saberRingCount,
      saberRingSize: settings.saberRingSize,
      saberRingThickness: settings.saberRingThickness,
      saberRingSpacing: settings.saberRingSpacing,
      saberPommelLength: settings.saberPommelLength,
      saberPommelThickness: settings.saberPommelThickness,
      saberXOffset: settings.saberXOffset,
      saberYOffset: settings.saberYOffset,
      saberZOffset: settings.saberZOffset,
      saberXRotation: settings.saberXRotation,
      saberYRotation: settings.saberYRotation,
      saberZRotation: settings.saberZRotation,
    });
  }
  if (categories.includes('camera')) {
    Object.assign(shared, {
      replayCamera: settings.replayCamera,
      replayCameraSmoothing: settings.replayCameraSmoothing,
      replayCameraSmoothingSpeed: settings.replayCameraSmoothingSpeed,
      replayCameraFov: settings.replayCameraFov,
      previewCameraDistance: settings.previewCameraDistance,
      fixedCameraDistance: settings.fixedCameraDistance,
      replayCameraXOffset: settings.replayCameraXOffset,
      replayCameraYOffset: settings.replayCameraYOffset,
      replayCameraDepthOffset: settings.replayCameraDepthOffset,
      replayCameraXRotation: settings.replayCameraXRotation,
      replayCameraYRotation: settings.replayCameraYRotation,
      replayCameraZRotation: settings.replayCameraZRotation,
      replayCameraForceUpright: settings.replayCameraForceUpright,
    });
  }
  return Object.keys(shared).length === 0 ? undefined : shared;
}

export function applySharedViewerSettings(settings: ViewerSettings, shared: SharedViewerSettings) {
  return sanitizeViewerSettings({ ...settings, ...shared });
}
