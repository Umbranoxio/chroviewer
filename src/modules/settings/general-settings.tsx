import { Result } from 'better-result';
import { Trash2 } from 'lucide-react';
import { useFormatter, useTranslations } from 'use-intl';

import { clearCustomHitsound, saveCustomHitsound } from '../../core/hitsound-storage';
import {
  DEFAULT_VIEWER_SETTINGS,
  MAX_AUDIO_OFFSET_MS,
  MIN_AUDIO_OFFSET_MS,
  type HitsoundPreset,
  type ViewerSettings,
} from '../../core/viewer-settings';
import { AudioOffsetCalibration } from './audio-offset-calibration';
import { SettingRow } from './components/setting-row';
import { SettingSection } from './components/setting-section';
import { SliderSetting } from './components/slider-setting';
import { MapCacheSetting } from './map-cache-setting';

import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
        <SettingSection title={t('hitsounds')}>
          <SettingRow label={t('hitsoundPreset')}>
            <Select
              value={settings.hitsoundPreset}
              onValueChange={(value: HitsoundPreset) => {
                update('hitsoundPreset', value);
              }}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder={t('hitsoundPreset')} />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="default">{t('presetDefault')}</SelectItem>
                  <SelectItem value="ChromapperTick">Chromapper</SelectItem>
                  <SelectItem value="GalxHitsound">Galx</SelectItem>
                  <SelectItem value="OsuHitsound">Osu</SelectItem>
                  <SelectItem value="RabbitViewerTick">Rabbit</SelectItem>
                  <SelectItem value="ThumpyHitsound">Thumpy</SelectItem>
                  <SelectItem value="custom">{t('presetCustom')}</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </SettingRow>
          {settings.hitsoundPreset === 'custom' && (
            <>
              <SettingRow label={t('customGoodHitsound')} detail={t('customHitsoundHelp')}>
                <div className="flex items-center gap-2">
                  <input
                    type="file"
                    accept="audio/*"
                    className="file:bg-primary/10 file:text-primary hover:file:bg-primary/20 w-48 text-sm file:mr-2 file:rounded-md file:border-0 file:px-2 file:py-1 file:text-xs file:font-medium"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        void saveCustomHitsound('good', file).then((result: Result<string, Error>) => {
                          if (result.isOk()) {
                            update('customGoodHitsound', `${file.name}?${~~(Date.now() / 1000)}`);
                          } else {
                            console.error(result.error);
                          }
                        });
                      }
                    }}
                  />
                  {settings.customGoodHitsound && (
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => {
                        void clearCustomHitsound('good').then((result: Result<void, Error>) => {
                          if (result.isOk()) {
                            update('customGoodHitsound', null);
                          } else {
                            console.error(result.error);
                          }
                        });
                      }}
                    >
                      <Trash2 className="text-destructive h-4 w-4" />
                    </Button>
                  )}
                </div>
              </SettingRow>
              <SettingRow label={t('customBadHitsound')} detail={t('customHitsoundHelp')}>
                <div className="flex items-center gap-2">
                  <input
                    type="file"
                    accept="audio/*"
                    className="file:bg-primary/10 file:text-primary hover:file:bg-primary/20 w-48 text-sm file:mr-2 file:rounded-md file:border-0 file:px-2 file:py-1 file:text-xs file:font-medium"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        void saveCustomHitsound('bad', file).then((result: Result<string, Error>) => {
                          if (result.isOk()) {
                            update('customBadHitsound', `${file.name}?${~~(Date.now() / 1000)}`);
                          } else {
                            console.error(result.error);
                          }
                        });
                      }
                    }}
                  />
                  {settings.customBadHitsound && (
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => {
                        void clearCustomHitsound('bad').then((result: Result<void, Error>) => {
                          if (result.isOk()) {
                            update('customBadHitsound', null);
                          } else {
                            console.error(result.error);
                          }
                        });
                      }}
                    >
                      <Trash2 className="text-destructive h-4 w-4" />
                    </Button>
                  )}
                </div>
              </SettingRow>
            </>
          )}
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
