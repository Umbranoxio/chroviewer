import { Camera } from 'lucide-react';
import { useTranslations } from 'use-intl';

import type { ViewerSettings } from '../../../core/viewer-settings';

import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

interface ReplayCameraMenuProps {
  open: boolean;
  camera: ViewerSettings['replayCamera'];
  onOpenChange: (open: boolean) => void;
  onCameraChange: (camera: ViewerSettings['replayCamera']) => void;
}

export function ReplayCameraMenu({ open, camera, onOpenChange, onCameraChange }: ReplayCameraMenuProps) {
  const t = useTranslations('viewer.transport');
  const tc = useTranslations('common');

  function selectCamera(value: string) {
    switch (value) {
      case 'static':
      case 'follow':
      case 'first-person':
        onCameraChange(value);
    }
  }

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Button
          className="max-sm:hidden"
          variant="ghost"
          size="icon"
          aria-label={t('replayCamera')}
          title={t('replayCamera')}
        >
          <Camera />
        </Button>
      </PopoverTrigger>
      <PopoverContent side="top" align="center" sideOffset={12} className="w-36 p-1">
        <ToggleGroup
          className="flex w-full flex-col"
          type="single"
          orientation="vertical"
          value={camera}
          aria-label={t('replayCamera')}
          onValueChange={selectCamera}
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
      </PopoverContent>
    </Popover>
  );
}
