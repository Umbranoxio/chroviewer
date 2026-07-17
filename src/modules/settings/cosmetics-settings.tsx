import { useState } from 'react';

import { RotateCcw } from 'lucide-react';
import { useFormatter, useTranslations } from 'use-intl';

import {
  DEFAULT_REPLAY_SABER_SETTINGS,
  DEFAULT_VIEWER_SETTINGS,
  type ReplaySaberSettings,
  type ViewerSettings,
} from '../../core/viewer-settings';
import { ColorPicker } from './components/color-picker';
import { SettingRow } from './components/setting-row';
import { SettingSection } from './components/setting-section';
import { SliderSetting } from './components/slider-setting';

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { TabsContent } from '@/components/ui/tabs';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

interface CosmeticsSettingsProps {
  settings: ViewerSettings;
  environments: readonly { id: string; title: string }[];
  onChange: (settings: ViewerSettings) => void;
}

type NumericSaberSetting = Exclude<keyof ReplaySaberSettings, 'showSabers' | 'showSaberTrails' | 'replayTrailShape'>;

interface SaberSliderOptions {
  minimum: number;
  maximum: number;
  step: number;
  display: (value: number) => string;
}

type ColorSetting = Extract<
  keyof ViewerSettings,
  | 'leftColor'
  | 'rightColor'
  | 'obstacleColor'
  | 'environmentLeftColor'
  | 'environmentRightColor'
  | 'environmentWhiteColor'
  | 'environmentLeftBoostColor'
  | 'environmentRightBoostColor'
  | 'environmentWhiteBoostColor'
>;

type CosmeticSection = 'colors' | 'sabers';

const cosmeticSections: CosmeticSection[] = ['colors', 'sabers'];
const colorSettings: ColorSetting[] = [
  'leftColor',
  'rightColor',
  'obstacleColor',
  'environmentLeftColor',
  'environmentRightColor',
  'environmentWhiteColor',
  'environmentLeftBoostColor',
  'environmentRightBoostColor',
  'environmentWhiteBoostColor',
];
const cosmeticSectionsStorageKey = 'chroviewer.settings.cosmetic-sections';

function loadOpenSections(storage: Pick<Storage, 'getItem'> = localStorage) {
  const saved = storage.getItem(cosmeticSectionsStorageKey)?.split(',') ?? [];
  return cosmeticSections.filter((section) => saved.includes(section));
}

function saveOpenSections(sections: readonly CosmeticSection[], storage: Pick<Storage, 'setItem'> = localStorage) {
  storage.setItem(cosmeticSectionsStorageKey, sections.join(','));
}

export function CosmeticsSettings({ settings, environments, onChange }: CosmeticsSettingsProps) {
  const format = useFormatter();
  const ts = useTranslations('settings');
  const t = useTranslations('settings.saber');
  const tc = useTranslations('settings.cosmetics');
  const [openSections, setOpenSections] = useState(loadOpenSections);

  function update<K extends keyof ViewerSettings>(key: K, value: ViewerSettings[K]) {
    onChange({ ...settings, [key]: value });
  }

  function slider(key: NumericSaberSetting, options: SaberSliderOptions) {
    return (
      <SliderSetting
        key={key}
        defaultValue={DEFAULT_REPLAY_SABER_SETTINGS[key]}
        id={`viewer-${key}`}
        label={t(key)}
        value={settings[key]}
        minimum={options.minimum}
        maximum={options.maximum}
        step={options.step}
        display={options.display}
        onChange={(value) => {
          update(key, value);
        }}
      />
    );
  }

  function color(key: ColorSetting) {
    const resetLabel = ts('resetSetting', { setting: tc(key) });

    return (
      <SettingRow key={key} label={tc(key)}>
        <div className="flex items-center gap-1">
          <ColorPicker
            label={tc(key)}
            inputLabel={tc('hexColorInput', { setting: tc(key) })}
            disabled={!settings.customColors}
            value={settings[key]}
            onChange={(color) => {
              update(key, color);
            }}
          />
          <Button
            className="size-5"
            type="button"
            variant="ghost"
            size="icon-sm"
            disabled={settings[key] === DEFAULT_VIEWER_SETTINGS[key]}
            aria-label={resetLabel}
            title={resetLabel}
            onClick={() => {
              update(key, DEFAULT_VIEWER_SETTINGS[key]);
            }}
          >
            <RotateCcw data-icon="inline-start" />
          </Button>
        </div>
      </SettingRow>
    );
  }

  function resetColors() {
    onChange({
      ...settings,
      leftColor: DEFAULT_VIEWER_SETTINGS.leftColor,
      rightColor: DEFAULT_VIEWER_SETTINGS.rightColor,
      obstacleColor: DEFAULT_VIEWER_SETTINGS.obstacleColor,
      environmentLeftColor: DEFAULT_VIEWER_SETTINGS.environmentLeftColor,
      environmentRightColor: DEFAULT_VIEWER_SETTINGS.environmentRightColor,
      environmentWhiteColor: DEFAULT_VIEWER_SETTINGS.environmentWhiteColor,
      environmentLeftBoostColor: DEFAULT_VIEWER_SETTINGS.environmentLeftBoostColor,
      environmentRightBoostColor: DEFAULT_VIEWER_SETTINGS.environmentRightBoostColor,
      environmentWhiteBoostColor: DEFAULT_VIEWER_SETTINGS.environmentWhiteBoostColor,
    });
  }

  const centimeters = (value: number) => t('centimeters', { value: format.number(value * 100, 'decimal') });
  const millimeters = (value: number) => t('millimeters', { value: format.number(value * 1000, 'decimal') });
  const degrees = (value: number) => t('degrees', { value: format.number(value, 'decimal') });
  const integer = (value: number) => format.number(value, 'integer');
  const percent = (value: number) => format.number(value, 'percent', { maximumFractionDigits: 0 });
  const multiplier = (value: number) => t('multiplier', { value: format.number(value, 'decimal') });

  return (
    <TabsContent value="cosmetics" className="min-h-0 overflow-y-auto data-[state=inactive]:hidden">
      <Accordion
        type="multiple"
        value={openSections}
        className="px-5 py-4"
        onValueChange={(sections) => {
          const nextSections = cosmeticSections.filter((section) => sections.includes(section));
          setOpenSections(nextSections);
          saveOpenSections(nextSections);
        }}
      >
        <AccordionItem value="colors">
          <AccordionTrigger className="text-base font-semibold tracking-tight">{tc('overrides')}</AccordionTrigger>
          <AccordionContent className="flex flex-col gap-5">
            <SettingSection title={tc('environment')}>
              <SettingRow label={tc('enableEnvironmentOverride')}>
                <Switch
                  checked={settings.overrideEnvironment}
                  onCheckedChange={(overrideEnvironment) => {
                    update('overrideEnvironment', overrideEnvironment);
                  }}
                />
              </SettingRow>
              <SettingRow label={tc('stage')}>
                <Select
                  disabled={!settings.overrideEnvironment}
                  value={settings.environmentOverrideId}
                  onValueChange={(environmentOverrideId) => {
                    update('environmentOverrideId', environmentOverrideId);
                  }}
                >
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
              <SettingRow label={tc('preferReplayEnvironment')} detail={tc('preferReplayEnvironmentDescription')}>
                <Switch
                  checked={settings.preferReplayEnvironment}
                  onCheckedChange={(preferReplayEnvironment) => {
                    update('preferReplayEnvironment', preferReplayEnvironment);
                  }}
                />
              </SettingRow>
            </SettingSection>
            <Separator />
            <SettingSection
              title={tc('colors')}
              action={
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={colorSettings.every((key) => settings[key] === DEFAULT_VIEWER_SETTINGS[key])}
                  onClick={resetColors}
                >
                  <RotateCcw data-icon="inline-start" />
                  {ts('resetAll')}
                </Button>
              }
            >
              <SettingRow label={tc('enableColorOverrides')}>
                <Switch
                  checked={settings.customColors}
                  onCheckedChange={(customColors) => {
                    update('customColors', customColors);
                  }}
                />
              </SettingRow>
              <SettingRow label={tc('preferReplayColors')} detail={tc('preferReplayColorsDescription')}>
                <Switch
                  checked={settings.preferReplayColors}
                  onCheckedChange={(preferReplayColors) => {
                    update('preferReplayColors', preferReplayColors);
                  }}
                />
              </SettingRow>
              {colorSettings.map(color)}
            </SettingSection>
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="sabers">
          <AccordionTrigger className="text-base font-semibold tracking-tight">{tc('sabers')}</AccordionTrigger>
          <AccordionContent className="flex flex-col gap-5">
            <SettingSection title={t('blade')}>
              <SettingRow label={t('showSabers')}>
                <Switch
                  checked={settings.showSabers}
                  onCheckedChange={(showSabers) => {
                    update('showSabers', showSabers);
                  }}
                />
              </SettingRow>
              {slider('saberScale', {
                minimum: 0.25,
                maximum: 3,
                step: 0.01,
                display: percent,
              })}
              {slider('saberBladeLength', {
                minimum: 0.1,
                maximum: 2,
                step: 0.001,
                display: centimeters,
              })}
              {slider('saberBladeThickness', {
                minimum: 0.001,
                maximum: 0.03,
                step: 0.0001,
                display: millimeters,
              })}
              {slider('saberCoreThickness', {
                minimum: 0.0005,
                maximum: 0.02,
                step: 0.0001,
                display: millimeters,
              })}
              {slider('saberCoreInset', {
                minimum: 0,
                maximum: 0.2,
                step: 0.001,
                display: millimeters,
              })}
            </SettingSection>
            <Separator />
            <SettingSection title={t('trail')}>
              <SettingRow label={t('showSaberTrails')}>
                <Switch
                  checked={settings.showSaberTrails}
                  onCheckedChange={(showSaberTrails) => {
                    update('showSaberTrails', showSaberTrails);
                  }}
                />
              </SettingRow>
              <SettingRow label={t('replayTrailShape')}>
                <ToggleGroup
                  type="single"
                  value={settings.replayTrailShape}
                  aria-label={t('replayTrailShape')}
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
              {slider('replayTrailLength', {
                minimum: 0.02,
                maximum: 1.5,
                step: 0.001,
                display: centimeters,
              })}
              {slider('replayTrailThinness', {
                minimum: 0,
                maximum: 0.95,
                step: 0.01,
                display: percent,
              })}
              {slider('replayTrailSamples', {
                minimum: 2,
                maximum: 128,
                step: 1,
                display: integer,
              })}
              {slider('replayTrailFade', {
                minimum: 0.1,
                maximum: 5,
                step: 0.1,
                display: multiplier,
              })}
              {slider('replayTrailOpacity', {
                minimum: 0,
                maximum: 2,
                step: 0.01,
                display: percent,
              })}
              {slider('replayTrailMotionThreshold', {
                minimum: 0.0001,
                maximum: 0.02,
                step: 0.0001,
                display: millimeters,
              })}
            </SettingSection>
            <Separator />
            <SettingSection title={t('hilt')}>
              {slider('saberGripLength', {
                minimum: 0.02,
                maximum: 0.3,
                step: 0.001,
                display: centimeters,
              })}
              {slider('saberGripThickness', {
                minimum: 0.002,
                maximum: 0.03,
                step: 0.0001,
                display: millimeters,
              })}
              {slider('saberGuardSize', {
                minimum: 0.005,
                maximum: 0.08,
                step: 0.0005,
                display: millimeters,
              })}
              {slider('saberGuardThickness', {
                minimum: 0.0005,
                maximum: 0.01,
                step: 0.0001,
                display: millimeters,
              })}
              {slider('saberCollarSize', {
                minimum: 0.002,
                maximum: 0.04,
                step: 0.0005,
                display: millimeters,
              })}
              {slider('saberCollarThickness', {
                minimum: 0.0005,
                maximum: 0.01,
                step: 0.0001,
                display: millimeters,
              })}
              {slider('saberCollarSpacing', {
                minimum: 0,
                maximum: 0.2,
                step: 0.001,
                display: millimeters,
              })}
              {slider('saberRingCount', {
                minimum: 0,
                maximum: 5,
                step: 1,
                display: integer,
              })}
              {slider('saberRingSize', {
                minimum: 0.002,
                maximum: 0.03,
                step: 0.0001,
                display: millimeters,
              })}
              {slider('saberRingThickness', {
                minimum: 0.001,
                maximum: 0.02,
                step: 0.0001,
                display: millimeters,
              })}
              {slider('saberRingSpacing', {
                minimum: 0,
                maximum: 0.04,
                step: 0.0005,
                display: millimeters,
              })}
              {slider('saberPommelLength', {
                minimum: 0.002,
                maximum: 0.05,
                step: 0.0005,
                display: millimeters,
              })}
              {slider('saberPommelThickness', {
                minimum: 0.002,
                maximum: 0.03,
                step: 0.0001,
                display: millimeters,
              })}
            </SettingSection>
            <Separator />
            <SettingSection title={t('alignment')}>
              {slider('saberXOffset', {
                minimum: -0.25,
                maximum: 0.25,
                step: 0.001,
                display: centimeters,
              })}
              {slider('saberYOffset', {
                minimum: -0.25,
                maximum: 0.25,
                step: 0.001,
                display: centimeters,
              })}
              {slider('saberZOffset', {
                minimum: -0.25,
                maximum: 0.25,
                step: 0.001,
                display: centimeters,
              })}
              {slider('saberXRotation', {
                minimum: -45,
                maximum: 45,
                step: 0.1,
                display: degrees,
              })}
              {slider('saberYRotation', {
                minimum: -45,
                maximum: 45,
                step: 0.1,
                display: degrees,
              })}
              {slider('saberZRotation', {
                minimum: -45,
                maximum: 45,
                step: 0.1,
                display: degrees,
              })}
            </SettingSection>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </TabsContent>
  );
}
