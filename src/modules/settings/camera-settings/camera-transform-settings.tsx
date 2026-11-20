import { useFormatter, useTranslations } from 'use-intl';

import { DEFAULT_REPLAY_CAMERA_SETTINGS, SETTING_RANGES, type ViewerSettings } from '../../../core/viewer-settings';
import { SettingRow } from '../components/setting-row';
import { SettingSection } from '../components/setting-section';
import { SliderSetting } from '../components/slider-setting';
import { CameraResetButton, type CameraSettingsUpdate } from './camera-setting-controls';

import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';

interface CameraTransformSettingsProps {
  onChange: (settings: ViewerSettings) => void;
  settings: ViewerSettings;
  update: CameraSettingsUpdate;
}

export function CameraTransformSettings({ onChange, settings, update }: CameraTransformSettingsProps) {
  const format = useFormatter();
  const t = useTranslations('settings.camera');

  function resetPosition() {
    onChange({
      ...settings,
      replayCameraXOffset: DEFAULT_REPLAY_CAMERA_SETTINGS.replayCameraXOffset,
      replayCameraYOffset: DEFAULT_REPLAY_CAMERA_SETTINGS.replayCameraYOffset,
      replayCameraDepthOffset: DEFAULT_REPLAY_CAMERA_SETTINGS.replayCameraDepthOffset,
    });
  }

  function resetRotation() {
    onChange({
      ...settings,
      replayCameraXRotation: DEFAULT_REPLAY_CAMERA_SETTINGS.replayCameraXRotation,
      replayCameraYRotation: DEFAULT_REPLAY_CAMERA_SETTINGS.replayCameraYRotation,
      replayCameraZRotation: DEFAULT_REPLAY_CAMERA_SETTINGS.replayCameraZRotation,
      replayCameraForceUpright: DEFAULT_REPLAY_CAMERA_SETTINGS.replayCameraForceUpright,
    });
  }

  function formatMeters(value: number) {
    return format.number(value, {
      style: 'unit',
      unit: 'meter',
      unitDisplay: 'short',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  function formatDegrees(value: number) {
    return format.number(value, {
      style: 'unit',
      unit: 'degree',
      unitDisplay: 'short',
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    });
  }

  return (
    <>
      <SettingSection title={t('positionOffset')} action={<CameraResetButton onClick={resetPosition} />}>
        <SliderSetting
          defaultValue={DEFAULT_REPLAY_CAMERA_SETTINGS.replayCameraXOffset}
          id="replay-camera-x-offset"
          label={t('leftRight')}
          value={settings.replayCameraXOffset}
          range={SETTING_RANGES.replayCameraXOffset}
          display={formatMeters}
          onChange={(replayCameraXOffset) => {
            update('replayCameraXOffset', replayCameraXOffset);
          }}
        />
        <SliderSetting
          defaultValue={DEFAULT_REPLAY_CAMERA_SETTINGS.replayCameraYOffset}
          id="replay-camera-y-offset"
          label={t('upDown')}
          value={settings.replayCameraYOffset}
          range={SETTING_RANGES.replayCameraYOffset}
          display={formatMeters}
          onChange={(replayCameraYOffset) => {
            update('replayCameraYOffset', replayCameraYOffset);
          }}
        />
        <SliderSetting
          defaultValue={DEFAULT_REPLAY_CAMERA_SETTINGS.replayCameraDepthOffset}
          id="replay-camera-z-offset"
          label={t('forwardBack')}
          value={settings.replayCameraDepthOffset}
          range={SETTING_RANGES.replayCameraDepthOffset}
          display={formatMeters}
          onChange={(replayCameraDepthOffset) => {
            update('replayCameraDepthOffset', replayCameraDepthOffset);
          }}
        />
      </SettingSection>
      <Separator />
      <SettingSection title={t('rotationOffset')} action={<CameraResetButton onClick={resetRotation} />}>
        <SettingRow label={t('forceUpright')}>
          <Switch
            checked={settings.replayCameraForceUpright}
            onCheckedChange={(replayCameraForceUpright) => {
              update('replayCameraForceUpright', replayCameraForceUpright);
            }}
          />
        </SettingRow>
        <SliderSetting
          defaultValue={DEFAULT_REPLAY_CAMERA_SETTINGS.replayCameraXRotation}
          id="replay-camera-x-rotation"
          label={t('upDown')}
          value={settings.replayCameraXRotation}
          range={SETTING_RANGES.replayCameraXRotation}
          display={formatDegrees}
          onChange={(replayCameraXRotation) => {
            update('replayCameraXRotation', replayCameraXRotation);
          }}
        />
        <SliderSetting
          defaultValue={DEFAULT_REPLAY_CAMERA_SETTINGS.replayCameraYRotation}
          id="replay-camera-y-rotation"
          label={t('leftRight')}
          value={settings.replayCameraYRotation}
          range={SETTING_RANGES.replayCameraYRotation}
          display={formatDegrees}
          onChange={(replayCameraYRotation) => {
            update('replayCameraYRotation', replayCameraYRotation);
          }}
        />
        <SliderSetting
          defaultValue={DEFAULT_REPLAY_CAMERA_SETTINGS.replayCameraZRotation}
          id="replay-camera-z-rotation"
          label={t('tiltLeftRight')}
          value={settings.replayCameraZRotation}
          range={SETTING_RANGES.replayCameraZRotation}
          display={formatDegrees}
          onChange={(replayCameraZRotation) => {
            update('replayCameraZRotation', replayCameraZRotation);
          }}
        />
      </SettingSection>
    </>
  );
}
