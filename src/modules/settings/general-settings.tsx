import { useFormatter, useTranslations } from 'use-intl';

import { DEFAULT_VIEWER_SETTINGS, type ViewerSettings } from '../../core/viewer-settings';
import { SettingRow } from './components/setting-row';
import { SettingSection } from './components/setting-section';
import { SliderSetting } from './components/slider-setting';

import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { TabsContent } from '@/components/ui/tabs';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

interface GeneralSettingsProps {
  settings: ViewerSettings;
  environmentId: string;
  environments: readonly { id: string; title: string }[];
  onChange: (settings: ViewerSettings) => void;
  onEnvironmentChange: (id: string) => void;
}

export function GeneralSettings({
  settings,
  environmentId,
  environments,
  onChange,
  onEnvironmentChange,
}: GeneralSettingsProps) {
  const format = useFormatter();
  const t = useTranslations('settings.general');

  function update<K extends keyof ViewerSettings>(key: K, value: ViewerSettings[K]) {
    onChange({ ...settings, [key]: value });
  }

  return (
    <TabsContent value="general" className="min-h-0 overflow-y-auto data-[state=inactive]:hidden">
      <div className="flex flex-col gap-5 px-5 py-4">
        <SettingSection title={t('environment')}>
          <SettingRow label={t('stage')}>
            <Select value={environmentId} onValueChange={onEnvironmentChange}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {environments.map((environment) => (
                    <SelectItem key={environment.id} value={environment.id}>
                      {environment.title}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </SettingRow>
        </SettingSection>
        <Separator />
        <SettingSection title={t('colors')}>
          <SettingRow label={t('trailShape')}>
            <ToggleGroup
              type="single"
              value={settings.replayTrailShape}
              aria-label={t('trailShape')}
              onValueChange={(replayTrailShape) => {
                if (replayTrailShape === 'flag' || replayTrailShape === 'rectangle') {
                  update('replayTrailShape', replayTrailShape);
                }
              }}
            >
              <ToggleGroupItem value="flag">{t('trailFlag')}</ToggleGroupItem>
              <ToggleGroupItem value="rectangle">{t('trailRectangle')}</ToggleGroupItem>
            </ToggleGroup>
          </SettingRow>
          <SliderSetting
            defaultValue={DEFAULT_VIEWER_SETTINGS.replayTrailLength}
            id="viewer-replay-trail-length"
            label={t('trailLength')}
            value={settings.replayTrailLength}
            minimum={0.05}
            maximum={0.98}
            step={0.001}
            display={(value) => t('centimeters', { value: format.number(value * 100, 'decimal') })}
            onChange={(replayTrailLength) => {
              update('replayTrailLength', replayTrailLength);
            }}
          />
          <SliderSetting
            defaultValue={DEFAULT_VIEWER_SETTINGS.replayTrailSamples}
            id="viewer-replay-trail-samples"
            label={t('trailSamples')}
            value={settings.replayTrailSamples}
            minimum={2}
            maximum={64}
            step={1}
            display={(value) => format.number(value, 'integer')}
            onChange={(replayTrailSamples) => {
              update('replayTrailSamples', replayTrailSamples);
            }}
          />
        </SettingSection>
        <Separator />
        <SettingSection title={t('interface')}>
          <SettingRow label={t('timelineBookmarks')}>
            <Switch
              checked={settings.showBookmarks}
              onCheckedChange={(checked) => {
                update('showBookmarks', checked);
              }}
            />
          </SettingRow>
          <SettingRow label={t('autoHideControls')}>
            <Switch
              checked={settings.autoHide}
              onCheckedChange={(checked) => {
                update('autoHide', checked);
              }}
            />
          </SettingRow>
        </SettingSection>
      </div>
    </TabsContent>
  );
}
