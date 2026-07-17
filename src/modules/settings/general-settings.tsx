import { useTranslations } from 'use-intl';

import type { ViewerSettings } from '../../core/viewer-settings';
import { SettingRow } from './components/setting-row';
import { SettingSection } from './components/setting-section';

import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { TabsContent } from '@/components/ui/tabs';

interface GeneralSettingsProps {
  settings: ViewerSettings;
  isMapPreview: boolean;
  onChange: (settings: ViewerSettings) => void;
}

export function GeneralSettings({ settings, isMapPreview, onChange }: GeneralSettingsProps) {
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
