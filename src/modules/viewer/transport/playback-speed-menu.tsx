import { Gauge } from 'lucide-react';
import { useFormatter, useTranslations } from 'use-intl';

import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

interface PlaybackSpeedMenuProps {
  open: boolean;
  playbackRate: number;
  onOpenChange: (open: boolean) => void;
  onPlaybackRateChange: (rate: number) => void;
}

const playbackRates = [0.5, 0.75, 1, 1.25, 1.5, 2];

export function PlaybackSpeedMenu({ open, playbackRate, onOpenChange, onPlaybackRateChange }: PlaybackSpeedMenuProps) {
  const format = useFormatter();
  const t = useTranslations('viewer.transport');

  function selectPlaybackRate(value: string) {
    switch (value) {
      case '0.5':
      case '0.75':
      case '1':
      case '1.25':
      case '1.5':
      case '2':
        onPlaybackRateChange(Number(value));
    }
  }

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Button
          className="max-sm:hidden"
          variant="ghost"
          size="icon"
          aria-label={t('playbackSpeed')}
          title={t('playbackSpeed')}
        >
          <Gauge />
        </Button>
      </PopoverTrigger>
      <PopoverContent side="top" align="center" sideOffset={12} className="w-28 p-1">
        <ToggleGroup
          className="flex w-full flex-col"
          type="single"
          orientation="vertical"
          value={String(playbackRate)}
          aria-label={t('playbackSpeed')}
          onValueChange={selectPlaybackRate}
        >
          {playbackRates.map((rate) => (
            <ToggleGroupItem className="w-full" key={rate} value={String(rate)}>
              {t('speedValue', { speed: format.number(rate) })}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </PopoverContent>
    </Popover>
  );
}
