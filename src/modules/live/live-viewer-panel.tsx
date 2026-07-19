import type { RefObject } from 'react';

import { MessageCircle, Radio } from 'lucide-react';
import { useTranslations } from 'use-intl';

import { ReplayPlayerCard } from '../replay/replay-player-card';
import { LiveChat } from './live-chat';
import type { LiveExperience } from './live-types';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

import { cn } from '@/lib/utils';

interface LiveViewerPanelProps {
  chatInputRef: RefObject<HTMLTextAreaElement | null>;
  chatOpen: boolean;
  live: LiveExperience;
  onChatOpenChange: (open: boolean) => void;
}

export function LiveViewerPanel({ chatInputRef, chatOpen, live, onChatOpenChange }: LiveViewerPanelProps) {
  const t = useTranslations('live');

  function toggleChat() {
    const open = !chatOpen;
    onChatOpenChange(open);
    if (open) window.requestAnimationFrame(() => chatInputRef.current?.focus());
  }

  return (
    <>
      <div
        className={cn(
          'flex min-h-0 w-(--live-sidebar-width) flex-1 flex-col max-sm:fixed max-sm:inset-x-0 max-sm:bottom-[var(--live-keyboard-inset)] max-sm:z-40 max-sm:w-full max-sm:flex-none max-sm:pr-[env(safe-area-inset-right)] max-sm:pb-[var(--live-safe-area-bottom)] max-sm:pl-[env(safe-area-inset-left)]',
          chatOpen &&
            'max-sm:animate-in max-sm:slide-in-from-bottom-4 max-sm:fade-in max-sm:h-[calc(var(--live-mobile-chat-height)+env(safe-area-inset-bottom))] max-sm:duration-300',
        )}
      >
        <div className="shrink-0">
          <LivePlayerCard live={live} />
        </div>
        <LiveChat inputRef={chatInputRef} live={live} open={chatOpen} onToggle={toggleChat} />
      </div>

      <Button
        type="button"
        variant="secondary"
        size="icon"
        className="fixed top-[var(--live-viewport-center-y)] right-[max(0.5rem,env(safe-area-inset-right))] z-50 hidden -translate-y-1/2 rounded-full shadow-lg max-sm:inline-flex"
        aria-expanded={chatOpen}
        aria-label={t(chatOpen ? 'chat.close' : 'chat.open')}
        title={t(chatOpen ? 'chat.close' : 'chat.open')}
        onClick={toggleChat}
      >
        <MessageCircle className={cn(chatOpen && 'fill-current')} />
      </Button>
    </>
  );
}

function LivePlayerCard({ live }: { live: LiveExperience }) {
  const t = useTranslations('live');
  return live.player === null ? (
    <Card className="bg-card/88 text-muted-foreground flex h-14 w-(--live-sidebar-width) items-center gap-2 rounded-b-none px-3 text-xs backdrop-blur-xl max-sm:h-10 max-sm:w-full max-sm:rounded-none max-sm:px-2">
      <Radio className="size-4 animate-pulse" />
      {t('playerLoading')}
    </Card>
  ) : (
    <ReplayPlayerCard player={live.player} liveViewerCount={live.viewerCount} />
  );
}
