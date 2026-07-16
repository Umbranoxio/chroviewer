import { ChevronDown, ChevronUp } from 'lucide-react';
import { useTranslations } from 'use-intl';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import { cn } from '@/lib/utils';

interface BeatStepControlProps {
  className?: string;
  numerator: number;
  denominator: number;
  onNumeratorChange: (value: number) => void;
  onDenominatorChange: (value: number) => void;
}

export function BeatStepControl({
  className,
  numerator,
  denominator,
  onNumeratorChange,
  onDenominatorChange,
}: BeatStepControlProps) {
  const t = useTranslations('viewer.transport');

  function update(change: (value: number) => void, value: string) {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed)) change(Math.min(Math.max(parsed, 1), 64));
  }

  return (
    <div
      className={cn(
        'flex w-12 shrink-0 items-center justify-center gap-0.5 text-[10px] leading-none text-muted-foreground',
        className,
      )}
      aria-label={t('beatStep', { numerator, denominator })}
    >
      <div className="flex flex-col items-center">
        <Button
          variant="ghost"
          size="icon-2xs"
          aria-label={t('increaseNumeratorLabel')}
          title={t('increaseNumerator')}
          disabled={numerator >= 64}
          onClick={() => {
            onNumeratorChange(numerator + 1);
          }}
        >
          <ChevronUp data-icon="inline-start" />
        </Button>
        <Input
          variant="fraction"
          type="number"
          min={1}
          max={64}
          step={1}
          value={numerator}
          aria-label={t('beatStepNumerator')}
          title={t('beatStepNumerator')}
          onFocus={(event) => {
            event.currentTarget.select();
          }}
          onChange={(event) => {
            update(onNumeratorChange, event.currentTarget.value);
          }}
        />
        <Button
          variant="ghost"
          size="icon-2xs"
          aria-label={t('decreaseNumeratorLabel')}
          title={t('decreaseNumerator')}
          disabled={numerator <= 1}
          onClick={() => {
            onNumeratorChange(numerator - 1);
          }}
        >
          <ChevronDown data-icon="inline-end" />
        </Button>
      </div>
      <span aria-hidden>/</span>
      <div className="flex flex-col items-center">
        <Button
          variant="ghost"
          size="icon-2xs"
          aria-label={t('increaseDenominatorLabel')}
          title={t('increaseDenominator')}
          disabled={denominator >= 64}
          onClick={() => {
            onDenominatorChange(denominator + 1);
          }}
        >
          <ChevronUp data-icon="inline-start" />
        </Button>
        <Input
          variant="fraction"
          type="number"
          min={1}
          max={64}
          step={1}
          value={denominator}
          aria-label={t('beatStepDenominator')}
          title={t('beatStepDenominator')}
          onFocus={(event) => {
            event.currentTarget.select();
          }}
          onChange={(event) => {
            update(onDenominatorChange, event.currentTarget.value);
          }}
        />
        <Button
          variant="ghost"
          size="icon-2xs"
          aria-label={t('decreaseDenominatorLabel')}
          title={t('decreaseDenominator')}
          disabled={denominator <= 1}
          onClick={() => {
            onDenominatorChange(denominator - 1);
          }}
        >
          <ChevronDown data-icon="inline-end" />
        </Button>
      </div>
    </div>
  );
}
