import { RotateCcw } from 'lucide-react';
import { useTranslations } from 'use-intl';

import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';

interface SliderSettingProps {
  defaultValue: number;
  id: string;
  label: string;
  detail?: string;
  value: number;
  minimum: number;
  maximum: number;
  step: number;
  display: (value: number) => string;
  onChange: (value: number) => void;
}

export function SliderSetting({
  defaultValue,
  id,
  label,
  detail,
  value,
  minimum,
  maximum,
  step,
  display,
  onChange,
}: SliderSettingProps) {
  const t = useTranslations('settings');
  const resetLabel = t('resetSetting', { setting: label });

  return (
    <div className="flex flex-col gap-3 py-2">
      <div className="flex items-center justify-between gap-4 text-sm">
        <div className="min-w-0">
          <label htmlFor={id}>{label}</label>
          {detail !== undefined && <p className="text-muted-foreground text-xs">{detail}</p>}
        </div>
        <div className="flex items-center gap-1">
          <output htmlFor={id} className="text-muted-foreground whitespace-nowrap tabular-nums">
            {display(value)}
          </output>
          <Button
            className="size-5"
            type="button"
            variant="ghost"
            size="icon-sm"
            disabled={value === defaultValue}
            aria-label={resetLabel}
            title={resetLabel}
            onClick={() => {
              onChange(defaultValue);
            }}
          >
            <RotateCcw data-icon="inline-start" />
          </Button>
        </div>
      </div>
      <Slider
        id={id}
        min={minimum}
        max={maximum}
        step={step}
        value={[value]}
        onValueChange={([next]) => {
          if (next !== undefined) onChange(next);
        }}
      />
    </div>
  );
}
