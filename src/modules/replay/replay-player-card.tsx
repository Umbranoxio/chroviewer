import { useQuery } from '@tanstack/react-query';
import { Globe2, Users } from 'lucide-react';
import { useFormatter, useTranslations } from 'use-intl';

import { scoreSaberPlayerQueryOptions } from '../../sources/scoresaber/queries';
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
  const live = liveViewerCount !== undefined;
  const profile = useQuery(scoreSaberPlayerQueryOptions(live ? undefined : player.id)).data ?? player;
  const rank = profile.rank === undefined ? undefined : format.number(profile.rank, 'integer');
  const countryRank = profile.countryRank === undefined ? undefined : format.number(profile.countryRank, 'integer');
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
        {profile.avatar === '' ? (
          <span className="text-muted-foreground flex size-full items-center justify-center text-sm font-semibold">
            {profile.name.slice(0, 1).toUpperCase()}
          </span>
        ) : (
          <img className="size-full object-cover" src={profile.avatar} alt="" />
        )}
      </div>
      <CardHeader className="flex min-w-0 flex-1 items-center p-2 max-sm:px-1.5 max-sm:py-1">
        <div className={cn('min-w-0 flex-1', live && 'flex items-center gap-2')}>
          <div className="flex min-w-0 items-center gap-1.5">
            <CountryImage country={profile.country} />
            <CardTitle className="min-w-0 truncate text-sm max-sm:text-xs">
              <a
                className="hover:text-muted-foreground transition-colors"
                href={`https://scoresaber.com/u/${profile.id}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                {profile.name}
              </a>
            </CardTitle>
          </div>
          {(profile.rank !== undefined || profile.countryRank !== undefined || viewerCount !== null) && (
            <div className="text-muted-foreground flex shrink-0 items-center gap-1 text-xs max-sm:text-[10px]">
              {rank !== undefined && (
                <span className="flex items-center gap-1 tabular-nums" aria-label={t('globalRank', { rank })}>
                  <Globe2 className="size-2.5" />
                  {t('rank', { rank })}
                </span>
              )}
              {profile.rank !== undefined && profile.countryRank !== undefined && <span className="mx-0.5">·</span>}
              {countryRank !== undefined && (
                <span
                  className="flex items-center gap-1 tabular-nums"
                  aria-label={t('countryRank', { rank: countryRank })}
                >
                  <CountryImage country={profile.country} size={12} />
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
