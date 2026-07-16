import type { ComponentProps } from 'react';

import { cn } from '@/lib/utils';

interface InputProps extends ComponentProps<'input'> {
  variant?: 'default' | 'fraction';
}

function Input({ className, type, variant = 'default', ...props }: InputProps) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        'h-9 w-full min-w-0 rounded-md border border-input bg-background/65 px-3 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40 disabled:pointer-events-none disabled:opacity-45',
        variant === 'fraction' &&
          'h-3.5 w-5 rounded-sm border-0 bg-transparent px-0 text-center text-[10px] leading-none tabular-nums [appearance:textfield] focus-visible:ring-1 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none',
        className,
      )}
      {...props}
    />
  );
}

export { Input };
