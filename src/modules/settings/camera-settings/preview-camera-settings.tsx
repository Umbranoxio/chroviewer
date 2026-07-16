import { useFormatter, useTranslations } from 'use-intl';

import { DEFAULT_REPLAY_CAMERA_SETTINGS, type ViewerSettings } from '../../../core/viewer-settings';
import { SettingSection } from '../components/setting-section';
import { SliderSetting } from '../components/slider-setting';
import { CameraResetButton, type CameraSettingsUpdate } from './camera-setting-controls';

import { Separator } from '@/components/ui/separator';

interface PreviewCameraSettingsProps {
  hasReplay: boolean;
  settings: ViewerSettings;
  update: CameraSettingsUpdate;
}

export function PreviewCameraSettings({ hasReplay, settings, update }: PreviewCameraSettingsProps) {
  const format = useFormatter();
  const t = useTranslations('settings.camera');
  const distanceKey = hasReplay ? 'fixedCameraDistance' : 'previewCameraDistance';
  const defaultDistance = DEFAULT_REPLAY_CAMERA_SETTINGS[distanceKey];
  const showFixedCamera = !hasReplay || settings.replayCamera === 'static';

  return (
    <>
      <SettingSection
        title={t('view')}
        action={
          <CameraResetButton
            onClick={() => {
              update('replayCameraFov', DEFAULT_REPLAY_CAMERA_SETTINGS.replayCameraFov);
            }}
          />
        }
      >
        <SliderSetting
          defaultValue={DEFAULT_REPLAY_CAMERA_SETTINGS.replayCameraFov}
          id="replay-camera-fov"
          label={t('fieldOfView')}
          value={settings.replayCameraFov}
          minimum={60}
          maximum={120}
          step={0.1}
          display={(value) =>
            format.number(value, {
              style: 'unit',
              unit: 'degree',
              unitDisplay: 'short',
              minimumFractionDigits: 1,
              maximumFractionDigits: 1,
            })
          }
          onChange={(replayCameraFov) => {
            update('replayCameraFov', replayCameraFov);
          }}
        />
      </SettingSection>
      {showFixedCamera && (
        <>
          <Separator />
          <SettingSection
            title={t('fixedCamera')}
            action={
              <CameraResetButton
                onClick={() => {
                  update(distanceKey, defaultDistance);
                }}
              />
            }
          >
            <SliderSetting
              defaultValue={defaultDistance}
              id="fixed-camera-distance"
              label={t('distanceFromHitPlane')}
              value={settings[distanceKey]}
              minimum={hasReplay ? 2 : 0}
              maximum={10}
              step={0.1}
              display={(value) =>
                format.number(value, {
                  style: 'unit',
                  unit: 'meter',
                  unitDisplay: 'short',
                  minimumFractionDigits: 1,
                  maximumFractionDigits: 1,
                })
              }
              onChange={(distance) => {
                update(distanceKey, distance);
              }}
            />
          </SettingSection>
        </>
      )}
    </>
  );
}
