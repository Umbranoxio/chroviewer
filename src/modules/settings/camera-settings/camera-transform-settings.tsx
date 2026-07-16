import { useFormatter, useTranslations } from 'use-intl';

import { DEFAULT_REPLAY_CAMERA_SETTINGS, type ViewerSettings } from '../../../core/viewer-settings';
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
      replayCameraZOffset: DEFAULT_REPLAY_CAMERA_SETTINGS.replayCameraZOffset,
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
          minimum={-10}
          maximum={10}
          step={0.01}
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
          minimum={-10}
          maximum={10}
          step={0.01}
          display={formatMeters}
          onChange={(replayCameraYOffset) => {
            update('replayCameraYOffset', replayCameraYOffset);
          }}
        />
        <SliderSetting
          defaultValue={DEFAULT_REPLAY_CAMERA_SETTINGS.replayCameraZOffset}
          id="replay-camera-z-offset"
          label={t('forwardBack')}
          value={settings.replayCameraZOffset}
          minimum={-10}
          maximum={10}
          step={0.01}
          display={formatMeters}
          onChange={(replayCameraZOffset) => {
            update('replayCameraZOffset', replayCameraZOffset);
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
          minimum={-180}
          maximum={180}
          step={0.1}
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
          minimum={-180}
          maximum={180}
          step={0.1}
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
          minimum={-180}
          maximum={180}
          step={0.1}
          display={formatDegrees}
          onChange={(replayCameraZRotation) => {
            update('replayCameraZRotation', replayCameraZRotation);
          }}
        />
      </SettingSection>
    </>
  );
}
