import { Lightbulb } from 'lucide-react';
import { useTranslations } from 'use-intl';

import type { LightshowMode } from '../../../core/lighting/basic-light';

import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

interface LightshowMenuProps {
  open: boolean;
  mode: LightshowMode;
  onOpenChange: (open: boolean) => void;
  onModeChange: (mode: LightshowMode) => void;
}

export function LightshowMenu({ open, mode, onOpenChange, onModeChange }: LightshowMenuProps) {
  const t = useTranslations('viewer.transport.lighting');
  const tc = useTranslations('common');

  function selectMode(value: string) {
    switch (value) {
      case 'full-lightshow':
      case 'full':
      case 'static':
      case 'none':
        onModeChange(value);
    }
  }

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Button className="max-sm:hidden" variant="ghost" size="icon" aria-label={t('label')} title={t('label')}>
          <Lightbulb />
        </Button>
      </PopoverTrigger>
      <PopoverContent side="top" align="center" sideOffset={12} className="w-44 p-1">
        <ToggleGroup
          className="flex w-full flex-col"
          type="single"
          orientation="vertical"
          value={mode}
          aria-label={t('label')}
          onValueChange={selectMode}
        >
          <ToggleGroupItem className="w-full" value="full-lightshow">
            {t('force')}
          </ToggleGroupItem>
          <ToggleGroupItem className="w-full" value="full">
            {t('full')}
          </ToggleGroupItem>
          <ToggleGroupItem className="w-full" value="static">
            {tc('static')}
          </ToggleGroupItem>
          <ToggleGroupItem className="w-full" value="none">
            {tc('off')}
          </ToggleGroupItem>
        </ToggleGroup>
      </PopoverContent>
    </Popover>
  );
}
