import { useFormatter, useTranslations } from 'use-intl';

import { DEFAULT_VIEWER_SETTINGS, type ViewerSettings } from '../../core/viewer-settings';
import { SettingRow } from './components/setting-row';
import { SettingSection } from './components/setting-section';
import { SliderSetting } from './components/slider-setting';

import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { TabsContent } from '@/components/ui/tabs';

interface GraphicsSettingsProps {
  settings: ViewerSettings;
  onChange: (settings: ViewerSettings) => void;
}

export function GraphicsSettings({ settings, onChange }: GraphicsSettingsProps) {
  const format = useFormatter();
  const t = useTranslations('settings.graphics');
  const tc = useTranslations('common');

  function update<K extends keyof ViewerSettings>(key: K, value: ViewerSettings[K]) {
    onChange({ ...settings, [key]: value });
  }

  function selectGraphicsQuality(value: string) {
    switch (value) {
      case 'high':
      case 'medium':
      case 'low':
      case 'none':
        update('graphicsQuality', value);
    }
  }

  return (
    <TabsContent value="graphics" className="min-h-0 overflow-y-auto data-[state=inactive]:hidden">
      <div className="flex flex-col gap-5 px-5 py-4">
        <SettingSection title={t('quality')}>
          <SettingRow label={t('mirrors')} detail={t('mirrorsDescription')}>
            <Select value={settings.graphicsQuality} onValueChange={selectGraphicsQuality}>
              <SelectTrigger className="w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="high">{t('high')}</SelectItem>
                  <SelectItem value="medium">{t('medium')}</SelectItem>
                  <SelectItem value="low">{t('low')}</SelectItem>
                  <SelectItem value="none">{tc('off')}</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </SettingRow>
          <SettingRow label={t('screenDisplacement')} detail={t('screenDisplacementDescription')}>
            <Switch
              checked={settings.screenDisplacementEffects}
              onCheckedChange={(screenDisplacementEffects) => {
                update('screenDisplacementEffects', screenDisplacementEffects);
              }}
            />
          </SettingRow>
          <SliderSetting
            defaultValue={DEFAULT_VIEWER_SETTINGS.renderScale}
            id="viewer-render-scale"
            label={t('renderScale')}
            value={settings.renderScale}
            minimum={0.5}
            maximum={1.5}
            step={0.05}
            display={(value) => format.number(value, 'percent', { maximumFractionDigits: 0 })}
            onChange={(renderScale) => {
              update('renderScale', renderScale);
            }}
          />
        </SettingSection>
        <Separator />
        <SettingSection title={t('lighting')}>
          <SettingRow label={t('staticLights')} detail={t('staticLightsDescription')}>
            <Switch
              checked={settings.staticLights}
              onCheckedChange={(staticLights) => {
                update('staticLights', staticLights);
              }}
            />
          </SettingRow>
        </SettingSection>
      </div>
    </TabsContent>
  );
}
