import { useRef, type ComponentProps } from 'react';

import { Slider as SliderPrimitive } from 'radix-ui';

import { Notches } from '@/components/ui/notches';

import { cn } from '@/lib/utils';

interface SliderProps extends ComponentProps<typeof SliderPrimitive.Root> {
  variant?: 'default' | 'transport' | 'notched';
  notchDivisor?: number;
  explicitMin?: number;
  snapDistance?: number;
  value: number[];
  onValueChange: (value: number[]) => void;
}

function Slider({
  className,
  value,
  min = 0,
  explicitMin = min,
  max = 100,
  step = 1,
  variant = 'default',
  orientation = 'horizontal',
  notchDivisor = 1,
  onValueChange,
  snapDistance = 0,
  ...props
}: SliderProps) {
  const mappedValue = value.map((v) => (v === explicitMin ? min : v));
  const isKeyboard = useRef<boolean>(false);
  const bigboys = [explicitMin, (min + max) / 2, max];

  const handleValueChange = (newValues: number[]) => {
    onValueChange(
      newValues.map((v, i) => {
        if (isKeyboard.current) {
          const visual = mappedValue[i];
          const actuall = value[i];

          if (visual === undefined || actuall === undefined) return v;

          const diff = v - visual;
          if (diff === 0) return visual;
          return actuall + diff;
        }

        if (variant !== 'notched') return v === min ? explicitMin : v;

        return (
          bigboys.find((m) => {
            const targetMin = m === explicitMin ? min : m;
            return Math.abs(v - targetMin) <= step * snapDistance;
          }) ?? v
        );
      }),
    );
  };

  return (
    <SliderPrimitive.Root
      data-slot="slider"
      value={mappedValue}
      min={min}
      max={max}
      step={step}
      orientation={orientation}
      onKeyDownCapture={() => {
        isKeyboard.current = true;
      }}
      onKeyUpCapture={() => {
        isKeyboard.current = false;
      }}
      onValueChange={handleValueChange}
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
        {variant === 'notched' && (
          <div
            className={cn(
              'pointer-events-none absolute flex items-center justify-between',
              orientation === 'vertical'
                ? 'inset-x-auto inset-y-2 left-1/2 -translate-x-1/2 flex-col'
                : 'inset-x-2 top-1/2 -translate-y-1/2',
            )}
          >
            <Notches
              orientation={orientation}
              min={min}
              max={max}
              step={step}
              divisor={notchDivisor}
              value={mappedValue}
            />
          </div>
        )}

        <SliderPrimitive.Range
          data-slot="slider-range"
          className={cn(
            'bg-primary absolute data-[orientation=horizontal]:h-full data-[orientation=vertical]:w-full rounded-full',
            variant === 'transport' && 'bg-transparent',
          )}
        />
      </SliderPrimitive.Track>
      {mappedValue.map((_, index) => (
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
