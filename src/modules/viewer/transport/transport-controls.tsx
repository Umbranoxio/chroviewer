import { Pause, Play, RotateCcw } from 'lucide-react';
import { useTranslations } from 'use-intl';

import type { LightshowMode } from '../../../core/lighting/basic-light';
import type { ViewerSettings } from '../../../core/viewer-settings';
import type { TimelineMarker } from '../timeline-markers';
import { quantizedBeatAt } from '../viewer-timeline';
import { BeatStepControl } from './beat-step-control';
import { LightshowMenu } from './lightshow-menu';
import { PlaybackSpeedMenu } from './playback-speed-menu';
import { ReplayCameraMenu } from './replay-camera-menu';
import { TimelineReadout } from './timeline-readout';
import { TimelineSlider } from './timeline-slider';
import { VolumeMenu } from './volume-menu';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

import { cn } from '@/lib/utils';

type TransportPanel = 'speed' | 'lights' | 'camera' | 'volume';

interface TransportControlsProps {
  mode: 'live' | 'playback';
  visible: boolean;
  playing: boolean;
  ended: boolean;
  time: number;
  duration: number;
  songBpm: number;
  beatStepNumerator: number;
  beatStepDenominator: number;
  timelineShareUrl: string | null;
  timelineCopied: 'time' | 'beat' | null;
  panel: TransportPanel | null;
  playbackRate: number;
  lightshowMode: LightshowMode;
  replayCamera: ViewerSettings['replayCamera'];
  hasReplay: boolean;
  songMuted: boolean;
  masterMuted: boolean;
  masterVolume: number;
  songVolume: number;
  hitsounds: boolean;
  hitsoundVolume: number;
  markers: TimelineMarker[];
  onTogglePlay: () => void;
  onSeek: (time: number) => void;
  onSeekBeats: (beats: number) => void;
  onNumeratorChange: (value: number) => void;
  onDenominatorChange: (value: number) => void;
  onCopyTimeline: (target: 'time' | 'beat') => void;
  onPanelChange: (panel: TransportPanel | null) => void;
  onPlaybackRateChange: (rate: number) => void;
  onLightshowModeChange: (mode: LightshowMode) => void;
  onReplayCameraChange: (camera: ViewerSettings['replayCamera']) => void;
  onMasterVolumeChange: (volume: number) => void;
  onSongVolumeChange: (volume: number) => void;
  onHitsoundVolumeChange: (volume: number) => void;
  onToggleMasterMuted: () => void;
  onToggleSongMuted: () => void;
  onToggleHitsounds: () => void;
}

export function TransportControls({
  mode,
  visible,
  playing,
  ended,
  time,
  duration,
  songBpm,
  beatStepNumerator,
  beatStepDenominator,
  timelineShareUrl,
  timelineCopied,
  panel,
  playbackRate,
  lightshowMode,
  replayCamera,
  hasReplay,
  songMuted,
  masterMuted,
  masterVolume,
  songVolume,
  hitsounds,
  hitsoundVolume,
  markers,
  onTogglePlay,
  onSeek,
  onSeekBeats,
  onNumeratorChange,
  onDenominatorChange,
  onCopyTimeline,
  onPanelChange,
  onPlaybackRateChange,
  onLightshowModeChange,
  onReplayCameraChange,
  onMasterVolumeChange,
  onSongVolumeChange,
  onHitsoundVolumeChange,
  onToggleMasterMuted,
  onToggleSongMuted,
  onToggleHitsounds,
}: TransportControlsProps) {
  const t = useTranslations('common');
  const live = mode === 'live';
  const beatStep = beatStepNumerator / beatStepDenominator;
  const displayBeat = quantizedBeatAt(time, songBpm, beatStep);

  return (
    <Card
      data-transport-controls
      className={cn(
        'fixed bottom-3 left-1/2 z-30 flex w-[min(52rem,calc(100vw-1.5rem))] -translate-x-1/2 items-center gap-2 bg-card/88 px-1.5 py-0 backdrop-blur-xl transition duration-200 max-sm:bottom-2 max-sm:grid max-sm:w-[calc(100vw-1rem)] max-sm:grid-cols-[auto_minmax(0,1fr)_auto] max-sm:gap-1.5 max-sm:p-2',
        live && '!right-3 !left-[calc(var(--live-sidebar-width)+1.5rem)] !w-auto !translate-x-0 max-sm:!hidden',
        !visible && 'pointer-events-none translate-y-2 opacity-0',
      )}
    >
      {live ? (
        <span
          className="relative flex size-9 shrink-0 items-center justify-center max-sm:order-2 max-sm:size-8"
          aria-label={t('live')}
          title={t('live')}
        >
          {playing && <span className="bg-timeline-playhead absolute size-2.5 animate-ping rounded-full opacity-40" />}
          <span className="bg-timeline-playhead relative size-2.5 rounded-full" />
        </span>
      ) : (
        <Button
          className="max-sm:order-2 max-sm:size-8"
          variant="ghost"
          size="icon"
          aria-label={ended ? t('replay') : playing ? t('pause') : t('play')}
          onClick={onTogglePlay}
        >
          {ended ? <RotateCcw /> : playing ? <Pause /> : <Play />}
        </Button>
      )}
      <TimelineSlider
        className="max-sm:order-1 max-sm:col-span-3"
        time={time}
        duration={duration}
        songBpm={songBpm}
        beatStep={beatStep}
        interactive={!live}
        markers={markers}
        onSeek={onSeek}
      />
      <Separator orientation="vertical" className="h-8 max-sm:hidden" />
      <TimelineReadout
        time={time}
        duration={duration}
        displayBeat={displayBeat}
        beatStep={beatStep}
        beatStepNumerator={beatStepNumerator}
        beatStepDenominator={beatStepDenominator}
        shareUrl={timelineShareUrl}
        copied={timelineCopied}
        onCopy={onCopyTimeline}
        onSeekBeats={onSeekBeats}
        interactive={!live}
      />
      {!live && (
        <>
          <BeatStepControl
            className="max-sm:hidden"
            numerator={beatStepNumerator}
            denominator={beatStepDenominator}
            onNumeratorChange={onNumeratorChange}
            onDenominatorChange={onDenominatorChange}
          />
          <PlaybackSpeedMenu
            open={panel === 'speed'}
            playbackRate={playbackRate}
            onOpenChange={(open) => {
              onPanelChange(open ? 'speed' : null);
            }}
            onPlaybackRateChange={onPlaybackRateChange}
          />
        </>
      )}
      <LightshowMenu
        open={panel === 'lights'}
        mode={lightshowMode}
        onOpenChange={(open) => {
          onPanelChange(open ? 'lights' : null);
        }}
        onModeChange={onLightshowModeChange}
      />
      {hasReplay && (
        <ReplayCameraMenu
          open={panel === 'camera'}
          camera={replayCamera}
          onOpenChange={(open) => {
            onPanelChange(open ? 'camera' : null);
          }}
          onCameraChange={onReplayCameraChange}
        />
      )}
      <VolumeMenu
        open={panel === 'volume'}
        songMuted={songMuted}
        masterMuted={masterMuted}
        masterVolume={masterVolume}
        songVolume={songVolume}
        hitsounds={hitsounds}
        hitsoundVolume={hitsoundVolume}
        onOpenChange={(open) => {
          onPanelChange(open ? 'volume' : null);
        }}
        onMasterVolumeChange={onMasterVolumeChange}
        onSongVolumeChange={onSongVolumeChange}
        onHitsoundVolumeChange={onHitsoundVolumeChange}
        onToggleMasterMuted={onToggleMasterMuted}
        onToggleSongMuted={onToggleSongMuted}
        onToggleHitsounds={onToggleHitsounds}
      />
    </Card>
  );
}
