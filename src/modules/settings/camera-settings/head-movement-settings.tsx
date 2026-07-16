import { useFormatter, useTranslations } from 'use-intl';

import { DEFAULT_REPLAY_CAMERA_SETTINGS, type ViewerSettings } from '../../../core/viewer-settings';
import { SettingRow } from '../components/setting-row';
import { SettingSection } from '../components/setting-section';
import { SliderSetting } from '../components/slider-setting';
import type { CameraSettingsUpdate } from './camera-setting-controls';

import { Switch } from '@/components/ui/switch';

interface HeadMovementSettingsProps {
  settings: ViewerSettings;
  update: CameraSettingsUpdate;
}

export function HeadMovementSettings({ settings, update }: HeadMovementSettingsProps) {
  const format = useFormatter();
  const t = useTranslations('settings.camera');

  return (
    <SettingSection title={t('headMovement')}>
      <SettingRow label={t('smoothing')}>
        <Switch
          checked={settings.replayCameraSmoothing}
          onCheckedChange={(replayCameraSmoothing) => {
            update('replayCameraSmoothing', replayCameraSmoothing);
          }}
        />
      </SettingRow>
      {settings.replayCameraSmoothing && (
        <SliderSetting
          defaultValue={DEFAULT_REPLAY_CAMERA_SETTINGS.replayCameraSmoothingSpeed}
          id="replay-camera-smoothing-speed"
          label={t('responseSpeed')}
          value={settings.replayCameraSmoothingSpeed}
          minimum={1}
          maximum={20}
          step={0.1}
          display={(value) =>
            t('perSecond', {
              value: format.number(value, { minimumFractionDigits: 1, maximumFractionDigits: 1 }),
            })
          }
          onChange={(replayCameraSmoothingSpeed) => {
            update('replayCameraSmoothingSpeed', replayCameraSmoothingSpeed);
          }}
        />
      )}
    </SettingSection>
  );
}
