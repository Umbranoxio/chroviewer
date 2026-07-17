import { useState } from 'react';

import { useTranslations } from 'use-intl';

import type { ViewerSettings } from '../../core/viewer-settings';
import { CameraSettings } from './camera-settings';
import { CosmeticsSettings } from './cosmetics-settings';
import { GeneralSettings } from './general-settings';
import { GraphicsSettings } from './graphics-settings';

import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface SettingsDrawerProps {
  open: boolean;
  settings: ViewerSettings;
  environments: readonly { id: string; title: string }[];
  hasReplay: boolean;
  isMapPreview: boolean;
  onChange: (settings: ViewerSettings) => void;
  onClose: () => void;
}

export function SettingsDrawer({
  open,
  settings,
  environments,
  hasReplay,
  isMapPreview,
  onChange,
  onClose,
}: SettingsDrawerProps) {
  const t = useTranslations('settings');
  const tc = useTranslations('common');
  const [tab, setTab] = useState('general');

  return (
    <Sheet
      modal={false}
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onClose();
      }}
    >
      <SheetContent
        showOverlay={false}
        className="w-[92vw] max-w-none gap-0 overflow-hidden p-0 sm:max-w-lg"
        onInteractOutside={(event) => {
          event.preventDefault();
        }}
      >
        <SheetHeader className="shrink-0 border-b-0 px-5 pt-5 pb-0">
          <SheetTitle className="text-lg tracking-tight">{t('title')}</SheetTitle>
        </SheetHeader>
        <Tabs value={tab} className="min-h-0 flex-1 gap-0" onValueChange={setTab}>
          <div className="shrink-0 px-5 pt-4">
            <TabsList>
              <TabsTrigger value="general">{tc('general')}</TabsTrigger>
              <TabsTrigger value="graphics">{tc('graphics')}</TabsTrigger>
              <TabsTrigger value="camera">{tc('camera')}</TabsTrigger>
              <TabsTrigger value="cosmetics">{tc('cosmetics')}</TabsTrigger>
            </TabsList>
          </div>
          <GeneralSettings
            active={open && tab === 'general'}
            settings={settings}
            isMapPreview={isMapPreview}
            onChange={onChange}
          />
          <GraphicsSettings settings={settings} onChange={onChange} />
          <CameraSettings settings={settings} hasReplay={hasReplay} onChange={onChange} />
          <CosmeticsSettings settings={settings} environments={environments} onChange={onChange} />
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
