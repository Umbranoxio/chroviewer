import { sanitizeViewerSettings, type ViewerSettings } from './viewer-settings';

export type ShareSettingsCategory = 'general' | 'graphics' | 'sabers' | 'camera';
export type SharedViewerSettings = Partial<ViewerSettings>;

export function settingsForShareCategories(
  settings: ViewerSettings,
  categories: readonly ShareSettingsCategory[],
): SharedViewerSettings | undefined {
  const shared: SharedViewerSettings = {};
  if (categories.includes('general')) {
    Object.assign(shared, {
      hitsounds: settings.hitsounds,
      masterMuted: settings.masterMuted,
      songMuted: settings.songMuted,
      masterVolume: settings.masterVolume,
      songVolume: settings.songVolume,
      hitsoundVolume: settings.hitsoundVolume,
      showBookmarks: settings.showBookmarks,
      autoHide: settings.autoHide,
    });
  }
  if (categories.includes('graphics')) {
    Object.assign(shared, {
      graphicsQuality: settings.graphicsQuality,
      screenDisplacementEffects: settings.screenDisplacementEffects,
      renderScale: settings.renderScale,
      staticLights: settings.staticLights,
      customColors: settings.customColors,
      leftColor: settings.leftColor,
      rightColor: settings.rightColor,
    });
  }
  if (categories.includes('sabers')) {
    Object.assign(shared, {
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
      replayCameraZOffset: settings.replayCameraZOffset,
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
