import { Gauge } from 'lucide-react';
import { useTranslations } from 'use-intl';

import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Slider } from '@/components/ui/slider';

interface PlaybackSpeedMenuProps {
  open: boolean;
  playbackRate: number;
  onOpenChange: (open: boolean) => void;
  onPlaybackRateChange: (rate: number) => void;
}

export function PlaybackSpeedMenu({ open, playbackRate, onOpenChange, onPlaybackRateChange }: PlaybackSpeedMenuProps) {
  const t = useTranslations('viewer.transport');

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Button className="max-sm:hidden" variant="ghost" size="icon" aria-label={t('playbackSpeed')} title={t('playbackSpeed')}>
          <Gauge />
        </Button>
      </PopoverTrigger>
      <PopoverContent side="top" align="center" sideOffset={12} className="w-56 p-3">
        <div className="flex flex-col gap-2">
          <span className="text-muted-foreground text-center text-xs font-medium tabular-nums">{t('speedValue', { speed: playbackRate.toFixed(2) })}</span>
          <Slider
            variant="notched"
            orientation="horizontal"
            notchDivisor={5}
            explicitMin={0.05}
            min={0}
            max={2}
            step={0.05}
            value={[playbackRate]}
            onValueChange={([rate]) => {
              onPlaybackRateChange(rate ?? 1);
            }}
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}
