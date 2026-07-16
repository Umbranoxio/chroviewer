import { useTranslations } from 'use-intl';

import type { ViewerSettings } from '../../../core/viewer-settings';
import { SettingSection } from '../components/setting-section';
import type { CameraSettingsUpdate } from './camera-setting-controls';

import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

interface ReplayCameraSettingsProps {
  settings: ViewerSettings;
  update: CameraSettingsUpdate;
}

export function ReplayCameraSettings({ settings, update }: ReplayCameraSettingsProps) {
  const t = useTranslations('settings');
  const tc = useTranslations('common');

  function selectReplayCamera(value: string) {
    switch (value) {
      case 'static':
      case 'follow':
      case 'first-person':
        update('replayCamera', value);
    }
  }

  return (
    <SettingSection title={t('camera.replayCamera')}>
      <div className="flex flex-col gap-2 py-2">
        <p className="text-sm">{t('camera.mode')}</p>
        <ToggleGroup
          className="grid w-full grid-cols-3"
          type="single"
          value={settings.replayCamera}
          aria-label={t('camera.modeLabel')}
          onValueChange={selectReplayCamera}
        >
          <ToggleGroupItem className="w-full" value="static">
            {tc('static')}
          </ToggleGroupItem>
          <ToggleGroupItem className="w-full" value="follow">
            {tc('follow')}
          </ToggleGroupItem>
          <ToggleGroupItem className="w-full" value="first-person">
            {tc('firstPerson')}
          </ToggleGroupItem>
        </ToggleGroup>
      </div>
    </SettingSection>
  );
}
