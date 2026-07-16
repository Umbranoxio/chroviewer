import type { ReactNode } from 'react';

interface SettingRowProps {
  label: string;
  detail?: string;
  children: ReactNode;
}

export function SettingRow({ label, detail, children }: SettingRowProps) {
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <div className="min-w-0">
        <p className="text-sm">{label}</p>
        {detail !== undefined && <p className="text-muted-foreground text-xs">{detail}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}
