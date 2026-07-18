import type { ComponentProps } from 'react';

import { Slider as SliderPrimitive } from 'radix-ui';

import { cn } from '@/lib/utils';

interface SliderProps extends ComponentProps<typeof SliderPrimitive.Root> {
  variant?: 'default' | 'transport' | 'range-transport';
}

function Slider({ className, value, defaultValue, min = 0, max = 100, variant = 'default', ...props }: SliderProps) {
  const values = value ?? defaultValue ?? [min];
  return (
    <SliderPrimitive.Root
      data-slot="slider"
      value={value}
      defaultValue={defaultValue}
      min={min}
      max={max}
      className={cn(
        'relative flex touch-none select-none items-center data-[disabled]:opacity-45 data-[orientation=horizontal]:w-full data-[orientation=vertical]:h-full data-[orientation=vertical]:flex-col',
        variant === 'transport' && 'h-12 cursor-pointer',
        variant === 'range-transport' &&
          'data-[orientation=horizontal]:h-full pointer-events-none data-[disabled]:opacity-70',
        className,
      )}
      {...props}
    >
      <SliderPrimitive.Track
        data-slot="slider-track"
        className={cn(
          'relative grow overflow-hidden rounded-full bg-muted data-[orientation=horizontal]:h-1.5 data-[orientation=horizontal]:w-full data-[orientation=vertical]:h-full data-[orientation=vertical]:w-1.5',
          variant === 'transport' &&
            'rounded-none border-x border-border/70 bg-muted/45 data-[orientation=horizontal]:h-full',
          variant === 'range-transport' &&
            'rounded-none bg-transparent data-[orientation=horizontal]:h-full opacity-10 pointer-events-none',
        )}
      >
        <SliderPrimitive.Range
          data-slot="slider-range"
          className={cn(
            'bg-primary absolute data-[orientation=horizontal]:h-full data-[orientation=vertical]:w-full',
            variant === 'transport' && 'bg-transparent',
            variant === 'range-transport' && 'bg-foreground pointer-events-none',
          )}
        />
      </SliderPrimitive.Track>
      {values.map((_, index) => (
        <SliderPrimitive.Thumb
          data-slot="slider-thumb"
          key={index}
          className={cn(
            'block size-4 rounded-full border border-primary bg-background shadow outline-none focus-visible:ring-3 focus-visible:ring-ring/40',
            variant === 'transport' &&
              'relative z-10 h-full w-5 rounded-none border-0 bg-transparent shadow-none ring-0 focus-visible:ring-0',
            variant === 'range-transport' &&
              'z-40 cursor-pointer relative top-[-25px] size-5 bg-foreground border-none rounded-xs w-1.5 pointer-events-auto',
            variant === 'range-transport' && index == 0 && 'right-0.75',
            variant === 'range-transport' && index == 1 && 'left-0.75',
          )}
        />
      ))}
    </SliderPrimitive.Root>
  );
}

export { Slider };
