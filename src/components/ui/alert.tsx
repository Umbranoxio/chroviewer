import type { ComponentProps } from 'react';

import { cn } from '@/lib/utils';

function Alert({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      data-slot="alert"
      role="alert"
      className={cn(
        'grid grid-cols-[1fr_auto] items-center gap-3 rounded-lg border border-destructive/40 bg-destructive/15 p-3 text-sm text-foreground shadow-xl',
        className,
      )}
      {...props}
    />
  );
}

export { Alert };
