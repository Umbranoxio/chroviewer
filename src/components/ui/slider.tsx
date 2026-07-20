import type { ComponentProps } from 'react';

import { Slider as SliderPrimitive } from 'radix-ui';

import { cn } from '@/lib/utils';

interface SliderProps extends ComponentProps<typeof SliderPrimitive.Root> {
  variant?: 'default' | 'transport' | 'notched';
  notchDivisor?: number;
  explicitMin?: number;
  onValueChange: (value: number[]) => void;
}

function Slider({ className, value, defaultValue, min = 0, explicitMin = min, max = 100, step = 1, variant = 'default', orientation = 'horizontal', notchDivisor = 1, onValueChange, ...props }: SliderProps) {
  const mappedValue = value?.map((v) => (v === explicitMin ? min : v));
  const mappedDefaultValue = defaultValue?.map((v) => (v === explicitMin ? min : v));

  const handleValueChange = (newValues: number[]) => {
    onValueChange(
      newValues.map((v) => {
        if (variant !== 'notched') return v === min ? explicitMin : v;

        const bigboys = [explicitMin, 1.0, max];
        return (
          bigboys.find((m) => {
            const targetMin = m === explicitMin ? min : m;
            return Math.abs(v - targetMin) <= step * 2;
          }) ?? v
        );
      }),
    );
  };

  return (
    <SliderPrimitive.Root
      data-slot="slider"
      value={mappedValue}
      defaultValue={mappedDefaultValue}
      min={min}
      max={max}
      step={step}
      orientation={orientation}
      onValueChange={(newValues) => {
        handleValueChange(newValues);
      }}
      className={cn(
        'relative flex touch-none select-none items-center data-disabled:opacity-45 data-[orientation=horizontal]:w-full data-[orientation=vertical]:h-full data-[orientation=vertical]:flex-col',
        variant === 'transport' && 'h-12 cursor-pointer',
        className,
      )}
      {...props}
    >
      <SliderPrimitive.Track
        data-slot="slider-track"
        className={cn(
          'relative grow overflow-visible rounded-full bg-muted data-[orientation=horizontal]:h-1.5 data-[orientation=horizontal]:w-full data-[orientation=vertical]:h-full data-[orientation=vertical]:w-1.5',
          variant === 'transport' &&
            'rounded-none border-x border-border/70 bg-muted/45 data-[orientation=horizontal]:h-full',
        )}
      >
        {variant === 'notched' ? (
          <div className="pointer-events-none absolute inset-x-2 top-1/2 flex -translate-y-1/2 items-center justify-between data-[orientation=vertical]:inset-x-auto data-[orientation=vertical]:inset-y-2 data-[orientation=vertical]:left-1/2 data-[orientation=vertical]:-translate-x-1/2 data-[orientation=vertical]:flex-col">
            {Array.from({ length: Math.round((max - min) / step) + 1 }).map((_, index, array) => {
              if (index % notchDivisor !== 0) return null;
              const notchCount = array.length;
              const isBigBoyNotch = [0, notchCount - 1, Math.floor((notchCount - 1) / 2)].includes(index);
              const percentage = (index / (notchCount - 1)) * 100;

              return (
                <div
                  key={index}
                  data-orientation={orientation}
                  style={orientation === 'vertical' ? { bottom: `${percentage}%` } : { left: `${percentage}%` }}
                  className={cn(
                    'absolute bg-muted-foreground/50 rounded-full z-10 shrink-0',
                    'data-[orientation=horizontal]:top-1/2 data-[orientation=horizontal]:-translate-y-1/2 data-[orientation=horizontal]:-translate-x-1/2 data-[orientation=horizontal]:w-0.5 data-[orientation=horizontal]:h-4',
                    isBigBoyNotch ? 'data-[orientation=horizontal]:h-4 bg-white' : 'data-[orientation=horizontal]:h-2',
                    'data-[orientation=vertical]:left-1/2 data-[orientation=vertical]:-translate-x-1/2 data-[orientation=vertical]:translate-y-1/2 data-[orientation=vertical]:h-0.5 data-[orientation=vertical]:w-4',
                    isBigBoyNotch ? 'data-[orientation=vertical]:w-4 bg-white' : 'data-[orientation=vertical]:w-2',
                  )}
                />
              );
            })}
          </div>
        ) : null}

        <SliderPrimitive.Range
          data-slot="slider-range"
          className={cn(
            'bg-primary absolute data-[orientation=horizontal]:h-full data-[orientation=vertical]:w-full rounded-full',
            variant === 'transport' && 'bg-transparent',
          )}
        />
      </SliderPrimitive.Track>
      {(mappedValue ?? mappedDefaultValue ?? [min]).map((_, index) => (
        <SliderPrimitive.Thumb
          data-slot="slider-thumb"
          key={index}
          className={cn(
            'block size-4 rounded-full border border-primary bg-background shadow outline-none focus-visible:ring-3 focus-visible:ring-ring/40',
            variant === 'transport' &&
              'relative z-10 h-full w-5 rounded-none border-0 bg-transparent shadow-none ring-0 focus-visible:ring-0',
          )}
        />
      ))}
    </SliderPrimitive.Root>
  );
}

export { Slider };
