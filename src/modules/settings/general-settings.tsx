import { useFormatter, useTranslations } from 'use-intl';

import {
  DEFAULT_VIEWER_SETTINGS,
  MAX_AUDIO_OFFSET_MS,
  MIN_AUDIO_OFFSET_MS,
  type ViewerSettings,
} from '../../core/viewer-settings';
import { AudioOffsetCalibration } from './audio-offset-calibration';
import { SettingRow } from './components/setting-row';
import { SettingSection } from './components/setting-section';
import { SliderSetting } from './components/slider-setting';
import { MapCacheSetting } from './map-cache-setting';

import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { TabsContent } from '@/components/ui/tabs';

interface GeneralSettingsProps {
  active: boolean;
  settings: ViewerSettings;
  isMapPreview: boolean;
  onChange: (settings: ViewerSettings) => void;
}

export function GeneralSettings({ active, settings, isMapPreview, onChange }: GeneralSettingsProps) {
  const format = useFormatter();
  const t = useTranslations('settings.general');

  function update<K extends keyof ViewerSettings>(key: K, value: ViewerSettings[K]) {
    onChange({ ...settings, [key]: value });
  }

  return (
    <TabsContent value="general" className="min-h-0 overflow-y-auto data-[state=inactive]:hidden">
      <div className="flex flex-col gap-5 px-5 py-4">
        {isMapPreview && (
          <>
            <SettingSection title={t('mapPreview')}>
              <SettingRow label={t('hitNotes')} detail={t('hitNotesDescription')}>
                <Switch
                  aria-label={t('hitNotes')}
                  checked={settings.previewHitNotes}
                  onCheckedChange={(previewHitNotes) => {
                    update('previewHitNotes', previewHitNotes);
                  }}
                />
              </SettingRow>
              <SettingRow label={t('hitLine')} detail={t('hitLineDescription')}>
                <Switch
                  aria-label={t('hitLine')}
                  checked={settings.previewHitLine}
                  onCheckedChange={(previewHitLine) => {
                    update('previewHitLine', previewHitLine);
                  }}
                />
              </SettingRow>
              <SettingRow label={t('playerFacingNotes')} detail={t('playerFacingNotesDescription')}>
                <Switch
                  aria-label={t('playerFacingNotes')}
                  checked={settings.previewNotesLookAtPlayer}
                  onCheckedChange={(previewNotesLookAtPlayer) => {
                    update('previewNotesLookAtPlayer', previewNotesLookAtPlayer);
                  }}
                />
              </SettingRow>
            </SettingSection>
            <Separator />
          </>
        )}
        <SettingSection title={t('interface')}>
          <SettingRow label={t('timelineBookmarks')}>
            <Switch
              checked={settings.showBookmarks}
              onCheckedChange={(checked) => {
                update('showBookmarks', checked);
              }}
            />
          </SettingRow>
          <SettingRow label={t('reverseTimelineScroll')}>
            <Switch
              checked={settings.reverseTimelineScroll}
              onCheckedChange={(checked) => {
                update('reverseTimelineScroll', checked);
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
          <SettingRow label={t('keepMapInfoVisible')}>
            <Switch
              checked={settings.keepMapInfoVisible}
              onCheckedChange={(checked) => {
                update('keepMapInfoVisible', checked);
              }}
            />
          </SettingRow>
        </SettingSection>
        <Separator />
        <SettingSection title={t('advanced')}>
          <SliderSetting
            defaultValue={DEFAULT_VIEWER_SETTINGS.audioOffsetMs}
            id="viewer-audio-offset"
            label={t('audioOffset')}
            detail={t('audioOffsetDescription')}
            value={settings.audioOffsetMs}
            minimum={MIN_AUDIO_OFFSET_MS}
            maximum={MAX_AUDIO_OFFSET_MS}
            step={10}
            display={(value) =>
              t('milliseconds', {
                value: format.number(value, { maximumFractionDigits: 0, signDisplay: 'exceptZero' }),
              })
            }
            onChange={(audioOffsetMs) => {
              update('audioOffsetMs', audioOffsetMs);
            }}
          />
          <AudioOffsetCalibration active={active} audioOffsetMs={settings.audioOffsetMs} />
          <MapCacheSetting active={active} />
        </SettingSection>
      </div>
    </TabsContent>
  );
}
