import type { ComponentProps } from 'react';

import { X } from 'lucide-react';
import { Dialog as SheetPrimitive } from 'radix-ui';
import { useTranslations } from 'use-intl';

import { cn } from '@/lib/utils';

function Sheet(props: ComponentProps<typeof SheetPrimitive.Root>) {
  return <SheetPrimitive.Root data-slot="sheet" {...props} />;
}

function SheetContent({
  className,
  children,
  showOverlay = true,
  ...props
}: ComponentProps<typeof SheetPrimitive.Content> & { showOverlay?: boolean }) {
  const t = useTranslations('common');

  return (
    <SheetPrimitive.Portal>
      {showOverlay && (
        <SheetPrimitive.Overlay className="data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/45" />
      )}
      <SheetPrimitive.Content
        data-slot="sheet-content"
        className={cn(
          'fixed inset-y-0 right-0 z-50 flex w-full max-w-sm flex-col border-l border-border bg-background shadow-2xl outline-none duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right',
          className,
        )}
        {...props}
      >
        {children}
        <SheetPrimitive.Close className="text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:ring-ring/40 absolute top-3 right-3 flex size-8 items-center justify-center rounded-md outline-none focus-visible:ring-3">
          <X />
          <span className="sr-only">{t('close')}</span>
        </SheetPrimitive.Close>
      </SheetPrimitive.Content>
    </SheetPrimitive.Portal>
  );
}

function SheetHeader({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('grid gap-1.5 border-b border-border p-4 pr-12', className)} {...props} />;
}

function SheetTitle({ className, ...props }: ComponentProps<typeof SheetPrimitive.Title>) {
  return <SheetPrimitive.Title className={cn('font-semibold', className)} {...props} />;
}

function SheetDescription({ className, ...props }: ComponentProps<typeof SheetPrimitive.Description>) {
  return <SheetPrimitive.Description className={cn('text-sm text-muted-foreground', className)} {...props} />;
}

export { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription };
