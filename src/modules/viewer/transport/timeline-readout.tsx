import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useFormatter, useLocale, useTranslations } from 'use-intl';

import { formatDuration } from '../../../i18n/formats';

import { Button } from '@/components/ui/button';

interface TimelineReadoutProps {
  time: number;
  duration: number;
  displayBeat: number;
  beatStep: number;
  beatStepNumerator: number;
  beatStepDenominator: number;
  shareUrl: string | null;
  copied: 'time' | 'beat' | null;
  onCopy: (target: 'time' | 'beat') => void;
  onSeekBeats: (beats: number) => void;
  interactive?: boolean;
}

export function TimelineReadout({
  time,
  duration,
  displayBeat,
  beatStep,
  beatStepNumerator,
  beatStepDenominator,
  shareUrl,
  copied,
  onCopy,
  onSeekBeats,
  interactive = true,
}: TimelineReadoutProps) {
  const format = useFormatter();
  const locale = useLocale();
  const t = useTranslations('viewer.transport');
  const tc = useTranslations('common');
  const beatStepLabel = t('beatStepValue', {
    numerator: beatStepNumerator,
    denominator: beatStepDenominator,
  });
  const timeLabel = formatDuration(time, locale);
  const durationLabel = formatDuration(duration, locale);
  const beatLabel = format.number(displayBeat, 'beat');

  if (!interactive) {
    return (
      <div className="flex w-24 shrink-0 flex-col items-center gap-1 text-xs leading-none tabular-nums max-sm:order-3 max-sm:w-auto">
        <span>{t('timeRange', { current: timeLabel, duration: durationLabel })}</span>
        <span className="text-muted-foreground">{beatLabel}</span>
      </div>
    );
  }

  return (
    <div className="flex w-24 shrink-0 flex-col items-center gap-0.5 text-xs leading-none tabular-nums max-sm:order-3 max-sm:w-auto">
      <Button
        type="button"
        className="text-foreground h-4 w-full min-w-0 rounded-sm px-0.5 py-0 text-xs leading-none font-normal"
        variant="ghost"
        disabled={shareUrl === null}
        aria-label={t('copyAtTime', { time: timeLabel })}
        title={
          shareUrl === null ? t('localFilesUnavailable') : copied === 'time' ? t('copiedShareLink') : t('copyShareLink')
        }
        onClick={() => {
          onCopy('time');
        }}
      >
        <span
          key={copied === 'time' ? 'copied' : 'time'}
          className={copied === 'time' ? 'animate-in fade-in-0 zoom-in-95 duration-200' : undefined}
        >
          <span className="max-sm:hidden">{copied === 'time' ? tc('copied') : timeLabel}</span>
          <span className="hidden max-sm:inline">
            {copied === 'time' ? tc('copied') : t('timeRange', { current: timeLabel, duration: durationLabel })}
          </span>
        </span>
      </Button>
      <div className="grid w-full grid-cols-[1.25rem_minmax(0,1fr)_1.25rem] items-center max-sm:hidden">
        <Button
          className="size-5"
          variant="ghost"
          size="icon-sm"
          aria-label={t('seekBack', { step: beatStepLabel })}
          title={t('seekBack', { step: beatStepLabel })}
          disabled={time <= 0}
          onClick={() => {
            onSeekBeats(-beatStep);
          }}
        >
          <ChevronLeft data-icon="inline-start" />
        </Button>
        <Button
          type="button"
          className="text-muted-foreground h-4 min-w-0 truncate rounded-sm px-0.5 py-0 text-[11px] leading-none font-normal"
          variant="ghost"
          disabled={shareUrl === null}
          aria-label={t('copyAtBeat', { beat: beatLabel })}
          title={
            shareUrl === null
              ? t('localFilesUnavailable')
              : copied === 'beat'
                ? t('copiedShareLink')
                : t('copyShareLink')
          }
          onClick={() => {
            onCopy('beat');
          }}
        >
          <span
            key={copied === 'beat' ? 'copied' : 'beat'}
            className={copied === 'beat' ? 'animate-in fade-in-0 zoom-in-95 duration-200' : undefined}
          >
            {copied === 'beat' ? tc('copied') : beatLabel}
          </span>
        </Button>
        <Button
          className="size-5"
          variant="ghost"
          size="icon-sm"
          aria-label={t('seekForward', { step: beatStepLabel })}
          title={t('seekForward', { step: beatStepLabel })}
          disabled={time >= duration}
          onClick={() => {
            onSeekBeats(beatStep);
          }}
        >
          <ChevronRight data-icon="inline-end" />
        </Button>
      </div>
    </div>
  );
}
