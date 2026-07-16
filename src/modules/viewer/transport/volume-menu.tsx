import { AudioWaveform, Music2, Slash, Volume2, type LucideIcon } from 'lucide-react';
import { useFormatter, useTranslations } from 'use-intl';

import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Slider } from '@/components/ui/slider';

interface VolumeMenuProps {
  open: boolean;
  songMuted: boolean;
  masterMuted: boolean;
  masterVolume: number;
  songVolume: number;
  hitsounds: boolean;
  hitsoundVolume: number;
  onOpenChange: (open: boolean) => void;
  onMasterVolumeChange: (volume: number) => void;
  onSongVolumeChange: (volume: number) => void;
  onHitsoundVolumeChange: (volume: number) => void;
  onToggleMasterMuted: () => void;
  onToggleSongMuted: () => void;
  onToggleHitsounds: () => void;
}

export function VolumeMenu({
  open,
  songMuted,
  masterMuted,
  masterVolume,
  songVolume,
  hitsounds,
  hitsoundVolume,
  onOpenChange,
  onMasterVolumeChange,
  onSongVolumeChange,
  onHitsoundVolumeChange,
  onToggleMasterMuted,
  onToggleSongMuted,
  onToggleHitsounds,
}: VolumeMenuProps) {
  const t = useTranslations('viewer.transport');

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Button
          className="max-sm:order-4 max-sm:size-8"
          variant="ghost"
          size="icon"
          aria-label={t('audioVolumes')}
          title={t('audioVolumes')}
        >
          <Volume2 />
        </Button>
      </PopoverTrigger>
      <PopoverContent side="top" align="center" sideOffset={12} className="w-40 rounded-lg p-2.5">
        <div className="flex h-28 justify-center gap-2">
          <VolumeColumn
            volume={songVolume}
            muted={songMuted}
            sliderLabel={t('songVolume')}
            toggleLabel={t(songMuted ? 'unmuteSong' : 'muteSong')}
            icon={Music2}
            onVolumeChange={onSongVolumeChange}
            onToggleMuted={onToggleSongMuted}
          />
          <VolumeColumn
            volume={masterVolume}
            muted={masterMuted}
            sliderLabel={t('masterVolume')}
            toggleLabel={t(masterMuted ? 'unmuteMaster' : 'muteMaster')}
            icon={Volume2}
            onVolumeChange={onMasterVolumeChange}
            onToggleMuted={onToggleMasterMuted}
          />
          <VolumeColumn
            volume={hitsoundVolume}
            muted={!hitsounds}
            sliderLabel={t('hitsoundVolume')}
            toggleLabel={t(hitsounds ? 'muteHitsounds' : 'unmuteHitsounds')}
            icon={AudioWaveform}
            onVolumeChange={onHitsoundVolumeChange}
            onToggleMuted={onToggleHitsounds}
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}

interface VolumeColumnProps {
  volume: number;
  muted: boolean;
  sliderLabel: string;
  toggleLabel: string;
  icon: LucideIcon;
  onVolumeChange: (volume: number) => void;
  onToggleMuted: () => void;
}

function VolumeColumn({
  volume,
  muted,
  sliderLabel,
  toggleLabel,
  icon: Icon,
  onVolumeChange,
  onToggleMuted,
}: VolumeColumnProps) {
  const format = useFormatter();

  return (
    <div className="flex w-10 flex-col items-center gap-1.5">
      <span className="text-muted-foreground w-full text-center text-[10px] tabular-nums">
        {format.number(volume, 'percent', { maximumFractionDigits: 0 })}
      </span>
      <Slider
        className="min-h-0 flex-1 [&_[data-slot=slider-thumb]]:size-3.5 [&_[data-slot=slider-thumb]]:shadow-none [&_[data-slot=slider-track]]:w-1"
        orientation="vertical"
        aria-label={sliderLabel}
        min={0}
        max={1}
        step={0.01}
        value={[volume]}
        onValueChange={([value]) => {
          if (value !== undefined) onVolumeChange(value);
        }}
      />
      <Button
        className="relative size-6 rounded-sm"
        variant="ghost"
        size="icon-sm"
        aria-label={toggleLabel}
        aria-pressed={muted}
        title={toggleLabel}
        onClick={onToggleMuted}
      >
        <Icon aria-hidden />
        {muted && <Slash className="absolute" aria-hidden />}
      </Button>
    </div>
  );
}
