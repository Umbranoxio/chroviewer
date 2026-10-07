import { Lightbulb } from 'lucide-react';
import { useTranslations } from 'use-intl';

import type { LightshowMode } from '../../../core/lighting/basic-light';
import { TransportMenu } from './transport-menu';

import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

interface LightshowMenuProps {
  disabled?: boolean;
  open: boolean;
  mode: LightshowMode;
  onOpenChange: (open: boolean) => void;
  onHoverChange: (hovered: boolean) => void;
  onModeChange: (mode: LightshowMode) => void;
}

export function LightshowMenu({
  disabled = false,
  open,
  mode,
  onOpenChange,
  onHoverChange,
  onModeChange,
}: LightshowMenuProps) {
  const t = useTranslations('viewer.transport.lighting');
  const tc = useTranslations('common');

  function selectMode(value: string) {
    switch (value) {
      case 'full-lightshow':
      case 'lightshow':
      case 'full':
      case 'static':
      case 'none':
        onModeChange(value);
    }
  }

  return (
    <TransportMenu
      disabled={disabled}
      open={open}
      label={t('label')}
      icon={Lightbulb}
      triggerClassName="max-sm:hidden"
      className="w-44 p-1"
      onOpenChange={onOpenChange}
      onHoverChange={onHoverChange}
    >
      <ToggleGroup
        className="flex w-full flex-col"
        disabled={disabled}
        type="single"
        orientation="vertical"
        value={mode}
        aria-label={t('label')}
        onValueChange={selectMode}
      >
        <ToggleGroupItem className="w-full" value="full-lightshow">
          {t('lightsOnly')}
        </ToggleGroupItem>
        <ToggleGroupItem className="w-full" value="lightshow">
          {t('lightshow')}
        </ToggleGroupItem>
        <ToggleGroupItem className="w-full" value="full">
          {t('full')}
        </ToggleGroupItem>
        <ToggleGroupItem className="w-full" value="static">
          {tc('static')}
        </ToggleGroupItem>
        <ToggleGroupItem className="w-full" value="none">
          {t('off')}
        </ToggleGroupItem>
      </ToggleGroup>
    </TransportMenu>
  );
}
