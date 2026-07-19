import { useState } from 'react';

import { Pause, Play, Square, Trash2 } from 'lucide-react';
import { useTranslations } from 'use-intl';

import { WatchPartyPlaybackState } from '../live/generated/proto/scoresaber/live/v1/watch_party_pb';
import type { WatchPartyExperience } from './use-watch-party-experience';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

interface WatchPartyControlsProps {
  party: WatchPartyExperience;
}

export function WatchPartyControls({ party }: WatchPartyControlsProps) {
  const t = useTranslations('watchParty');
  const [mapInput, setMapInput] = useState('');
  const state = party.serverState;
  const hasMap = state?.map !== undefined;
  const loading = party.hostMapLoading || party.status === 'loading';
  const disabled = !party.connected || loading;

  function submit() {
    const input = mapInput.trim();
    if (input === '') return;
    void party.setMap(input);
  }

  return (
    <Card className="bg-card/88 flex w-[min(21rem,calc(100vw-1.5rem))] flex-col gap-2 p-2 backdrop-blur-xl max-sm:w-full max-sm:rounded-none">
      <p className="text-muted-foreground px-0.5 text-[11px] font-medium tracking-wide uppercase">{t('controls')}</p>
      <form
        className="flex gap-1.5"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <Input
          className="bg-background/70 h-8 min-w-0 text-xs"
          value={mapInput}
          disabled={loading}
          aria-label={t('mapInput')}
          placeholder={t('mapInputPlaceholder')}
          onChange={(event) => {
            setMapInput(event.currentTarget.value);
          }}
        />
        <Button type="submit" size="sm" className="h-8" disabled={disabled || mapInput.trim() === ''}>
          {t('set')}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="size-8"
          disabled={disabled || !hasMap}
          aria-label={t('clear')}
          title={t('clear')}
          onClick={() => {
            party.clearMap();
          }}
        >
          <Trash2 />
        </Button>
      </form>
      <div className="grid grid-cols-3 gap-1.5">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={disabled || !hasMap || !party.mapReady || state.playbackState === WatchPartyPlaybackState.PLAYING}
          onClick={() => {
            void party.unlockAudio();
            party.start();
          }}
        >
          <Play data-icon="inline-start" />
          {t('start')}
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={disabled || state?.playbackState !== WatchPartyPlaybackState.PLAYING}
          onClick={() => {
            party.pause();
          }}
        >
          <Pause data-icon="inline-start" />
          {t('pause')}
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={disabled || !hasMap || state.playbackState === WatchPartyPlaybackState.STOPPED}
          onClick={() => {
            party.stop();
          }}
        >
          <Square data-icon="inline-start" />
          {t('stop')}
        </Button>
      </div>
    </Card>
  );
}
