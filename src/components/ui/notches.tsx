import { useEffect, useState } from 'react';

import { cn } from '@/lib/utils';

interface NotchesProps {
  orientation?: 'horizontal' | 'vertical';
  min?: number;
  max?: number;
  step?: number;
  divisor?: number;
  value?: number[];
}

function Notches({ orientation, min = 0, max = 100, step = 1, divisor = 1, value }: NotchesProps) {
  const [localValues, setLocalValues] = useState(value);
  useEffect(() => {
    if (value) setLocalValues(value);
  }, [value]);

  return (
    <>
      {Array.from({ length: Math.round((max - min) / step) + 1 }).map((_, index, notches) => {
        if (index % divisor !== 0) return null;
        const isBigBoyNotch = [0, notches.length - 1, Math.floor((notches.length - 1) / 2)].includes(index);
        const percentage = (index / (notches.length - 1)) * 100;
        const isActive = localValues !== undefined ? localValues.some((v) => Math.abs(v - (min + index * step)) < step * 0.5) : false;

        return (
          <div
            key={index}
            data-orientation={orientation}
            style={orientation === 'vertical' ? { bottom: `${percentage}%` } : { left: `${percentage}%` }}
            className={cn(
              'absolute rounded-full shrink-0 transition-all duration-100',
              isBigBoyNotch && isActive ? 'bg-white' : 'bg-muted-foreground/20 z-10',
              'data-[orientation=horizontal]:top-1/2 data-[orientation=horizontal]:-translate-y-1/2 data-[orientation=horizontal]:-translate-x-1/2 data-[orientation=horizontal]:w-0.5',
              isActive ? 'data-[orientation=horizontal]:h-6' : isBigBoyNotch ? 'data-[orientation=horizontal]:h-4 bg-muted-foreground/20 z-10' : 'data-[orientation=horizontal]:h-2',
              'data-[orientation=vertical]:left-1/2 data-[orientation=vertical]:-translate-x-1/2 data-[orientation=vertical]:translate-y-1/2 data-[orientation=vertical]:h-0.5',
              isActive ? 'data-[orientation=vertical]:w-6' : isBigBoyNotch ? 'data-[orientation=vertical]:w-4 bg-muted-foreground/20 z-10' : 'data-[orientation=vertical]:w-2',
            )}
          />
        );
      })}
    </>
  );
}

export { Notches };
