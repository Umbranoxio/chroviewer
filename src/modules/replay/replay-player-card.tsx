import { Globe2, Users } from 'lucide-react';
import { useFormatter, useTranslations } from 'use-intl';

import type { ScoreSaberReplayPlayer } from '../../sources/source-types';
import { CountryImage } from './country-image';

import { Card, CardHeader, CardTitle } from '@/components/ui/card';

import { cn } from '@/lib/utils';

interface ReplayPlayerCardProps {
  player: ScoreSaberReplayPlayer;
  liveViewerCount?: number | null;
}

export function ReplayPlayerCard({ player, liveViewerCount }: ReplayPlayerCardProps) {
  const format = useFormatter();
  const t = useTranslations('replay');
  const rank = player.rank === undefined ? undefined : format.number(player.rank, 'integer');
  const countryRank = player.countryRank === undefined ? undefined : format.number(player.countryRank, 'integer');
  const live = liveViewerCount !== undefined;
  const viewerCount = liveViewerCount ?? null;
  const viewerCountLabel = viewerCount === null ? null : format.number(viewerCount, 'integer');

  return (
    <Card
      className={cn(
        'bg-card/88 flex overflow-hidden backdrop-blur-xl',
        live ? 'w-72 rounded-b-none max-sm:w-full max-sm:rounded-none' : 'w-60 max-sm:w-52',
      )}
    >
      <div className="bg-muted w-14 shrink-0 overflow-hidden border-r max-sm:w-9">
        {player.avatar === '' ? (
          <span className="text-muted-foreground flex size-full items-center justify-center text-sm font-semibold">
            {player.name.slice(0, 1).toUpperCase()}
          </span>
        ) : (
          <img className="size-full object-cover" src={player.avatar} alt="" />
        )}
      </div>
      <CardHeader className="flex min-w-0 flex-1 items-center p-2 max-sm:px-1.5 max-sm:py-1">
        <div className={cn('min-w-0 flex-1', live && 'flex items-center gap-2')}>
          <div className="flex min-w-0 items-center gap-1.5">
            <CountryImage country={player.country} />
            <CardTitle className="min-w-0 truncate text-sm max-sm:text-xs">
              <a
                className="hover:text-muted-foreground transition-colors"
                href={`https://scoresaber.com/u/${player.id}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                {player.name}
              </a>
            </CardTitle>
          </div>
          {(player.rank !== undefined || player.countryRank !== undefined || viewerCount !== null) && (
            <div className="text-muted-foreground flex shrink-0 items-center gap-1 text-xs max-sm:text-[10px]">
              {rank !== undefined && (
                <span className="flex items-center gap-1 tabular-nums" aria-label={t('globalRank', { rank })}>
                  <Globe2 className="size-2.5" />
                  {t('rank', { rank })}
                </span>
              )}
              {player.rank !== undefined && player.countryRank !== undefined && <span className="mx-0.5">·</span>}
              {countryRank !== undefined && (
                <span
                  className="flex items-center gap-1 tabular-nums"
                  aria-label={t('countryRank', { rank: countryRank })}
                >
                  <CountryImage country={player.country} size={12} />
                  {t('rank', { rank: countryRank })}
                </span>
              )}
              {viewerCountLabel !== null && (
                <span className="ml-auto flex items-center gap-1 tabular-nums">
                  <Users className="size-2.5" />
                  {viewerCountLabel}
                </span>
              )}
            </div>
          )}
        </div>
      </CardHeader>
    </Card>
  );
}
