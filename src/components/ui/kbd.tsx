import type { ComponentProps } from 'react';

import { cn } from '@/lib/utils';

function Kbd({ className, ...props }: ComponentProps<'kbd'>) {
  return (
    <kbd
      data-slot="kbd"
      className={cn(
        'inline-flex min-h-5 min-w-5 items-center justify-center rounded border border-border bg-muted px-1.5 font-sans text-[11px] font-medium text-muted-foreground',
        className,
      )}
      {...props}
    />
  );
}

export { Kbd };
