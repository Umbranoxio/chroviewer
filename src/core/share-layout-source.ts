import { DEFAULT_VIEWER_SETTINGS, SETTING_OPTIONS, SETTING_RANGES, type ViewerSettings } from './viewer-settings';

type SettingValue = ViewerSettings[keyof ViewerSettings];

export type ShareSettingsCategory = 'general' | 'graphics' | 'cosmetics' | 'camera';
export const SHARE_CATEGORIES: readonly ShareSettingsCategory[] = ['general', 'graphics', 'cosmetics', 'camera'];

const SHARED_SETTINGS: Record<ShareSettingsCategory, readonly (keyof ViewerSettings)[]> = {
  general: ['hitsounds', 'hitsoundPreset', 'previewHitNotes', 'previewHitLine', 'previewNotesLookAtPlayer'],
  graphics: ['graphicsQuality', 'screenDisplacementEffects', 'renderScale', 'staticLights'],
  cosmetics: [
    'preferReplayColors',
    'preferReplayEnvironment',
    'overrideEnvironment',
    'environmentOverrideId',
    'customColors',
    'leftColor',
    'rightColor',
    'obstacleColor',
    'environmentLeftColor',
    'environmentRightColor',
    'environmentWhiteColor',
    'environmentLeftBoostColor',
    'environmentRightBoostColor',
    'environmentWhiteBoostColor',
    'showSabers',
    'saberScale',
    'saberBladeLength',
    'saberBladeWidth',
    'saberTipWidth',
    'saberHiltLength',
    'saberHiltWidth',
    'saberRingCount',
    'showSaberTrails',
    'saberTrailDuration',
    'saberTrailWidth',
    'saberTrailBrightness',
    'saberXOffset',
    'saberYOffset',
    'saberZOffset',
    'saberXRotation',
    'saberYRotation',
    'saberZRotation',
  ],
  camera: [
    'showHeadset',
    'orthoCameraEnabled',
    'orthoCameraView',
    'replayCamera',
    'replayCameraSmoothing',
    'replayCameraSmoothingSpeed',
    'replayCameraFov',
    'previewCameraDistance',
    'fixedCameraDistance',
    'replayCameraXOffset',
    'replayCameraYOffset',
    'replayCameraDepthOffset',
    'replayCameraXRotation',
    'replayCameraYRotation',
    'replayCameraZRotation',
    'replayCameraForceUpright',
  ],
};

const ENVIRONMENT_IDS: readonly string[] = [
  'DefaultEnvironment',
  'OriginsEnvironment',
  'TriangleEnvironment',
  'NiceEnvironment',
  'BigMirrorEnvironment',
  'DragonsEnvironment',
  'KDAEnvironment',
  'MonstercatEnvironment',
  'CrabRaveEnvironment',
  'PanicEnvironment',
  'RocketEnvironment',
  'GreenDayGrenadeEnvironment',
  'GreenDayEnvironment',
  'TimbalandEnvironment',
  'FitBeatEnvironment',
  'LinkinParkEnvironment',
  'GlassDesertEnvironment',
  'BTSEnvironment',
  'KaleidoscopeEnvironment',
  'InterscopeEnvironment',
  'GagaEnvironment',
  'SkrillexEnvironment',
  'HalloweenEnvironment',
  'WeaveEnvironment',
  'EDMEnvironment',
  'TheSecondEnvironment',
  'LizzoEnvironment',
  'TheWeekndEnvironment',
  'Dragons2Environment',
  'LatticeEnvironment',
  'DaftPunkEnvironment',
  'HipHopEnvironment',
  'ColliderEnvironment',
  'GridEnvironment',
  'BillieEnvironment',
];

export type ShareField = { key: keyof ViewerSettings; category: string; default: SettingValue } & (
  | { kind: 'bool' }
  | { kind: 'enum'; values: readonly string[] }
  | { kind: 'num'; min: number; max: number; step: number }
  | { kind: 'color' }
);

export interface ShareLayout {
  version: number;
  categories: readonly string[];
  fields: readonly ShareField[];
}

const UNSHAREABLE_OPTIONS: readonly string[] = ['custom'];

function isRangeKey(key: keyof ViewerSettings): key is keyof typeof SETTING_RANGES {
  return key in SETTING_RANGES;
}

function isOptionKey(key: keyof ViewerSettings): key is keyof typeof SETTING_OPTIONS {
  return key in SETTING_OPTIONS;
}

function authoredField(key: keyof ViewerSettings, category: ShareSettingsCategory): ShareField {
  const base = { key, category, default: DEFAULT_VIEWER_SETTINGS[key] };
  if (key === 'environmentOverrideId') return { ...base, kind: 'enum', values: ENVIRONMENT_IDS };
  if (isRangeKey(key)) return { ...base, kind: 'num', ...SETTING_RANGES[key] };
  if (isOptionKey(key)) {
    const values = SETTING_OPTIONS[key].filter((value) => !UNSHAREABLE_OPTIONS.includes(value));
    return { ...base, kind: 'enum', values };
  }
  if (typeof base.default === 'boolean') return { ...base, kind: 'bool' };
  if (typeof base.default === 'string' && /^#[0-9a-f]{6}$/.test(base.default)) return { ...base, kind: 'color' };
  throw new Error(`Setting ${key} cannot be shared`);
}

export function authoredShareLayout(): Omit<ShareLayout, 'version'> {
  return {
    categories: SHARE_CATEGORIES,
    fields: SHARE_CATEGORIES.flatMap((category) =>
      SHARED_SETTINGS[category].map((key) => authoredField(key, category)),
    ),
  };
}
