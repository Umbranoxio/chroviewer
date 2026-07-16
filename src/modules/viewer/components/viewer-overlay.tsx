import type { LucideIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';

import { cn } from '@/lib/utils';

interface ViewerOverlayProps {
  actionLabel?: string;
  className?: string;
  icon: LucideIcon;
  iconClassName?: string;
  label: string;
  onAction?: () => void;
  progress?: number | null;
}

const progressRadius = 52;
const progressCircumference = 2 * Math.PI * progressRadius;

export function ViewerOverlay({
  actionLabel,
  className,
  icon: Icon,
  iconClassName,
  label,
  onAction,
  progress,
}: ViewerOverlayProps) {
  const actionable = onAction !== undefined;
  return (
    <div
      className={cn(
        'animate-in fade-in fixed inset-x-0 top-0 bottom-0 z-40 flex items-center justify-center bg-black/35 backdrop-blur-sm transition-[bottom] duration-300 ease-out',
        !actionable && 'pointer-events-none',
        className,
      )}
      role={actionable ? undefined : 'status'}
      aria-live={actionable ? undefined : 'polite'}
    >
      <div className="flex flex-col items-center gap-4 text-white drop-shadow-2xl">
        {actionable ? (
          <Button
            className="size-24 rounded-full backdrop-blur-xl [&_svg]:size-11"
            variant="outline"
            size="icon"
            aria-label={actionLabel ?? label}
            onClick={onAction}
          >
            <Icon className={iconClassName} strokeWidth={1.75} />
          </Button>
        ) : (
          <div className="relative flex size-24 items-center justify-center">
            {progress !== undefined && (
              <svg
                className={cn(
                  'pointer-events-none absolute -inset-2 size-28 -rotate-90',
                  progress === null && 'animate-spin',
                )}
                viewBox="0 0 112 112"
                aria-hidden="true"
              >
                <circle
                  cx="56"
                  cy="56"
                  r={progressRadius}
                  fill="none"
                  stroke="currentColor"
                  strokeOpacity="0.2"
                  strokeWidth="4"
                />
                <circle
                  className="text-primary transition-[stroke-dashoffset] duration-200"
                  cx="56"
                  cy="56"
                  r={progressRadius}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeDasharray={progress === null ? `82 ${progressCircumference - 82}` : progressCircumference}
                  strokeDashoffset={
                    progress === null ? 0 : progressCircumference * (1 - Math.min(Math.max(progress, 0), 1))
                  }
                />
              </svg>
            )}
            <div className="flex size-24 items-center justify-center rounded-full border border-white/20 bg-black/45 shadow-2xl">
              <Icon className={cn('size-11', iconClassName)} strokeWidth={1.75} />
            </div>
          </div>
        )}
        <span className="text-lg font-semibold tracking-wide">{label}</span>
      </div>
    </div>
  );
}
