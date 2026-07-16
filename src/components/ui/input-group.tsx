import type { ComponentProps } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import { cn } from '@/lib/utils';

function InputGroup({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      data-slot="input-group"
      role="group"
      className={cn(
        'flex h-9 w-full items-center rounded-md border border-input bg-background/65 has-[[data-slot=input-group-control]:focus-visible]:border-ring has-[[data-slot=input-group-control]:focus-visible]:ring-3 has-[[data-slot=input-group-control]:focus-visible]:ring-ring/40',
        className,
      )}
      {...props}
    />
  );
}

function InputGroupInput({ className, ...props }: ComponentProps<'input'>) {
  return (
    <Input
      data-slot="input-group-control"
      className={cn('flex-1 border-0 bg-transparent shadow-none focus-visible:ring-0', className)}
      {...props}
    />
  );
}

function InputGroupTextarea({ className, ...props }: ComponentProps<'textarea'>) {
  return (
    <textarea
      data-slot="input-group-control"
      className={cn(
        'min-h-9 flex-1 resize-none bg-transparent px-3 py-2 text-sm outline-none [field-sizing:content] placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  );
}

function InputGroupButton({ className, ...props }: ComponentProps<typeof Button>) {
  return <Button type="button" variant="ghost" size="icon-sm" className={cn('mr-0.5', className)} {...props} />;
}

export { InputGroup, InputGroupInput, InputGroupTextarea, InputGroupButton };
