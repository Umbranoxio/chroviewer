import type { MouseEventHandler } from 'react';

import { CircleHelp, Settings, Share2, Video } from 'lucide-react';
import { useTranslations } from 'use-intl';

import type { ShareSettingsCategory } from '../../../core/share-link';
import { SharePanel } from '../../sharing/share-panel';
import { ShortcutsPanel } from './shortcuts-panel';

import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

import { cn } from '@/lib/utils';
import { RecordVideoPanel } from '@/modules/record-video/record-video-panel';

interface ViewerActionsProps {
  chromeVisible: boolean;
  hasMap: boolean;
  settingsOpen: boolean;
  shareCategories: ShareSettingsCategory[];
  shareIncludeTimecode: boolean;
  shareOpen: boolean;
  shareUrl: string | null;
  videoUrl: string | null;
  recording: boolean;
  shortcutsOpen: boolean;
  recordVideoOpen: boolean;
  onStartRecord: () => void;
  onStopRecord: () => void;
  onCopyShare: (url: string) => Promise<boolean>;
  onSettingsClick: MouseEventHandler<HTMLButtonElement>;
  onShareCategoriesChange: (categories: ShareSettingsCategory[]) => void;
  onShareIncludeTimecodeChange: (include: boolean) => void;
  onShareOpenChange: (open: boolean) => void;
  onShortcutsOpenChange: (open: boolean) => void;
  onRecordVideoOpenChange: (open: boolean) => void;
}

export function ViewerActions({
  chromeVisible,
  hasMap,
  settingsOpen,
  shareCategories,
  shareIncludeTimecode,
  shareOpen,
  shareUrl,
  videoUrl,
  shortcutsOpen,
  recordVideoOpen,
  recording,
  onStartRecord,
  onStopRecord,
  onCopyShare,
  onSettingsClick,
  onShareCategoriesChange,
  onShareIncludeTimecodeChange,
  onShareOpenChange,
  onShortcutsOpenChange,
  onRecordVideoOpenChange,
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
      {hasMap && (
        <Popover open={recordVideoOpen} onOpenChange={onRecordVideoOpenChange}>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label={tc('exportVideo')} title={tc('exportVideo')}>
              <Video />
            </Button>
          </PopoverTrigger>
          <PopoverContent>
            <RecordVideoPanel
              videoUrl={videoUrl}
              recording={recording}
              onStartRecord={onStartRecord}
              onStopRecord={onStopRecord}
            />
          </PopoverContent>
        </Popover>
      )}
      {hasMap && (
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
              onCategoriesChange={onShareCategoriesChange}
              onCopy={onCopyShare}
              onIncludeTimecodeChange={onShareIncludeTimecodeChange}
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
      <Popover open={shortcutsOpen} onOpenChange={onShortcutsOpenChange}>
        <PopoverTrigger asChild>
          <Button
            className="max-sm:hidden"
            variant="ghost"
            size="icon-sm"
            aria-label={tc('keyboardShortcuts')}
            title={tc('keyboardShortcuts')}
          >
            <CircleHelp />
          </Button>
        </PopoverTrigger>
        <PopoverContent>
          <ShortcutsPanel />
        </PopoverContent>
      </Popover>
    </nav>
  );
}
