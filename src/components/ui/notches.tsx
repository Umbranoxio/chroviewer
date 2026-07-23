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
  return (
    <>
      {Array.from({ length: Math.round((max - min) / step) + 1 }).map((_, index, notches) => {
        if (index % divisor !== 0) return null;
        const isBigBoyNotch = [0, notches.length - 1, Math.floor((notches.length - 1) / 2)].includes(index);
        const percentage = (index / (notches.length - 1)) * 100;

        const currentNotch = min + index * step;
        const isActive = value !== undefined ? value.some((v) => v == currentNotch) : false;

        return (
          <div
            key={index}
            style={orientation === 'horizontal' ? { left: `${percentage}%` } : { bottom: `${percentage}%` }}
            className={cn(
              'absolute rounded-full shrink-0 transition-all duration-100',
              orientation === 'horizontal' ? 'top-1/2 -translate-y-1/2 -translate-x-1/2 w-0.5' : 'left-1/2 -translate-x-1/2 translate-y-1/2 h-0.5',
              isBigBoyNotch && isActive ? 'bg-white' : 'bg-muted-foreground/20 z-10',
              orientation === 'horizontal' ? (isActive ? 'h-6' : isBigBoyNotch ? 'h-4 bg-muted-foreground/20 z-10' : 'h-2') : isActive ? 'w-6' : isBigBoyNotch ? 'w-4 bg-muted-foreground/20 z-10' : 'w-2',
            )}
          />
        );
      })}
    </>
  );
}

export { Notches };
