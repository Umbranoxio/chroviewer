import type { ReactNode } from 'react';

interface SettingSectionProps {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
}

export function SettingSection({ title, description, action, children }: SettingSectionProps) {
  return (
    <section className="flex min-w-0 flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h3 className="text-base font-semibold tracking-tight">{title}</h3>
          {description !== undefined && <p className="text-muted-foreground text-xs">{description}</p>}
        </div>
        {action !== undefined && <div className="shrink-0">{action}</div>}
      </div>
      <div className="flex flex-col gap-1">{children}</div>
    </section>
  );
}
