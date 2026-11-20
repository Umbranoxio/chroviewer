import type { MouseEventHandler } from 'react';

import { Settings, Share2 } from 'lucide-react';
import { useTranslations } from 'use-intl';

import type { ShareSettingsCategory } from '../../../core/share-link';
import { SharePanel } from '../../sharing/share-panel';
import { AboutDialog } from './about-dialog';

import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

import { cn } from '@/lib/utils';

interface ViewerActionsProps {
  aboutOpen: boolean;
  aboutTriggerVisible: boolean;
  chromeVisible: boolean;
  hasMap: boolean;
  shareEnabled?: boolean;
  settingsOpen: boolean;
  shareCategories: ShareSettingsCategory[];
  shareIncludeTimecode: boolean;
  shareResetOthers: boolean;
  shareOpen: boolean;
  shareUrl: string | null;
  onAboutOpenChange: (open: boolean) => void;
  onCopyShare: (url: string) => Promise<boolean>;
  onSettingsClick: MouseEventHandler<HTMLButtonElement>;
  onShareCategoriesChange: (categories: ShareSettingsCategory[]) => void;
  onShareIncludeTimecodeChange: (include: boolean) => void;
  onShareResetOthersChange: (reset: boolean) => void;
  onShareOpenChange: (open: boolean) => void;
}

export function ViewerActions({
  aboutOpen,
  aboutTriggerVisible,
  chromeVisible,
  hasMap,
  shareEnabled = true,
  settingsOpen,
  shareCategories,
  shareIncludeTimecode,
  shareResetOthers,
  shareOpen,
  shareUrl,
  onAboutOpenChange,
  onCopyShare,
  onSettingsClick,
  onShareCategoriesChange,
  onShareIncludeTimecodeChange,
  onShareResetOthersChange,
  onShareOpenChange,
}: ViewerActionsProps) {
  const t = useTranslations('viewer');
  const tc = useTranslations('common');

  return (
    <nav
      className={cn(
        'fixed right-3 top-3 z-30 flex gap-1 rounded-lg border border-border bg-card/88 p-1 shadow-lg backdrop-blur-xl transition duration-200 max-sm:right-0 max-sm:top-0 max-sm:rounded-none',
        hasMap && 'max-sm:hidden',
        !chromeVisible && 'pointer-events-none -translate-y-2 opacity-0',
      )}
      aria-label={t('actions')}
    >
      {hasMap && shareEnabled && (
        <Popover open={shareOpen} onOpenChange={onShareOpenChange}>
          <PopoverTrigger asChild>
            <Button
              className="max-sm:hidden"
              variant="ghost"
              size="icon-sm"
              aria-label={tc('shareLink')}
              title={tc('shareLink')}
            >
              <Share2 />
            </Button>
          </PopoverTrigger>
          <PopoverContent>
            <SharePanel
              url={shareUrl}
              categories={shareCategories}
              includeTimecode={shareIncludeTimecode}
              resetOthers={shareResetOthers}
              onCategoriesChange={onShareCategoriesChange}
              onCopy={onCopyShare}
              onIncludeTimecodeChange={onShareIncludeTimecodeChange}
              onResetOthersChange={onShareResetOthersChange}
            />
          </PopoverContent>
        </Popover>
      )}
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={tc('settings')}
        title={tc('settings')}
        aria-expanded={settingsOpen}
        onClick={onSettingsClick}
      >
        <Settings />
      </Button>
      <AboutDialog open={aboutOpen} showTrigger={aboutTriggerVisible} onOpenChange={onAboutOpenChange} />
    </nav>
  );
}
