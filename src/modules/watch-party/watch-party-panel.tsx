import type { RefObject } from 'react';

import { LogOut, MessageCircle, MoreHorizontal } from 'lucide-react';
import { useTranslations } from 'use-intl';

import { LiveChat } from '../live/live-chat';
import { ReplayPlayerCard } from '../replay/replay-player-card';
import type { WatchPartyExperience } from './use-watch-party-experience';

import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

import { cn } from '@/lib/utils';

interface WatchPartyPanelProps {
  chatInputRef: RefObject<HTMLTextAreaElement | null>;
  chatOpen: boolean;
  onChatOpenChange: (open: boolean) => void;
  onLeave: () => void;
  party: WatchPartyExperience;
}

export function WatchPartyPanel({ chatInputRef, chatOpen, onChatOpenChange, onLeave, party }: WatchPartyPanelProps) {
  const t = useTranslations('watchParty');
  const liveT = useTranslations('live');
  const owner = party.session?.owner;
  const viewerPlayerId = party.session?.viewer?.playerId;
  const viewerMuted = party.participants.some(
    (participant) => participant.authenticated && participant.playerId === viewerPlayerId && participant.muted,
  );

  function toggleChat() {
    const open = !chatOpen;
    onChatOpenChange(open);
    if (open) window.requestAnimationFrame(() => chatInputRef.current?.focus());
  }

  const disabledPlaceholder = party.canChat
    ? undefined
    : party.session?.viewer === null
      ? undefined
      : viewerMuted
        ? t('chat.muted')
        : t('chat.unavailable');

  return (
    <>
      <div
        className={cn(
          'flex min-h-0 w-(--live-sidebar-width) flex-1 flex-col max-sm:fixed max-sm:inset-x-0 max-sm:bottom-[var(--live-keyboard-inset)] max-sm:z-40 max-sm:w-full max-sm:flex-none max-sm:pr-[env(safe-area-inset-right)] max-sm:pb-[var(--live-safe-area-bottom)] max-sm:pl-[env(safe-area-inset-left)]',
          chatOpen &&
            'max-sm:animate-in max-sm:slide-in-from-bottom-4 max-sm:fade-in max-sm:h-[calc(var(--live-mobile-chat-height)+env(safe-area-inset-bottom))] max-sm:duration-300',
        )}
      >
        {owner !== undefined && (
          <ReplayPlayerCard
            action={
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={t('leave')}
                title={t('leave')}
                onClick={onLeave}
              >
                <LogOut />
              </Button>
            }
            liveViewerCount={party.participants.length}
            player={{
              id: owner.playerId,
              name: owner.displayName || owner.playerId,
              avatar: '',
              country: '',
            }}
            playerLabel={t('hostedBy')}
            resolvePlayer
            showRanks={false}
          />
        )}
        <LiveChat
          disabledPlaceholder={disabledPlaceholder}
          inputRef={chatInputRef}
          live={party}
          open={chatOpen}
          onToggle={toggleChat}
          renderMessageActions={(message) => {
            const participant = party.participants.find(
              (candidate) => candidate.authenticated && candidate.playerId === message.senderPlayerId,
            );
            const canModerate =
              party.connected &&
              party.selfCapabilities?.canModerate === true &&
              participant !== undefined &&
              participant.playerId !== viewerPlayerId;
            if (!canModerate) return null;
            const displayName = participant.displayName || participant.playerId;
            return (
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="size-6 shrink-0"
                    aria-label={t('actionsFor', { name: displayName })}
                  >
                    <MoreHorizontal />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-36 p-1" sideOffset={4}>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start"
                    aria-label={t(participant.muted ? 'unmuteParticipant' : 'muteParticipant', {
                      name: displayName,
                    })}
                    onClick={() => {
                      if (participant.muted) party.unmuteParticipant(participant.connectionId);
                      else party.muteParticipant(participant.connectionId);
                    }}
                  >
                    {t(participant.muted ? 'unmute' : 'mute')}
                  </Button>
                </PopoverContent>
              </Popover>
            );
          }}
        />
      </div>

      <Button
        type="button"
        variant="secondary"
        size="icon"
        className="fixed top-[var(--live-viewport-center-y)] right-[max(0.5rem,env(safe-area-inset-right))] z-50 hidden -translate-y-1/2 rounded-full shadow-lg max-sm:inline-flex"
        aria-expanded={chatOpen}
        aria-label={liveT(chatOpen ? 'chat.close' : 'chat.open')}
        title={liveT(chatOpen ? 'chat.close' : 'chat.open')}
        onClick={toggleChat}
      >
        <MessageCircle className={cn(chatOpen && 'fill-current')} />
      </Button>
    </>
  );
}
