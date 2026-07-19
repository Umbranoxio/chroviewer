import { useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode, type RefObject } from 'react';

import { ArrowDown, ChevronDown, ChevronUp, Send, Volume2 } from 'lucide-react';
import { useTranslations } from 'use-intl';

import { LiveChatMessageKind, type LiveChatMessage } from './generated/proto/scoresaber/live/v1/chat_pb';
import { LiveChatMessageRow } from './live-chat-message';
import { chatMessageKey } from './live-chat-state';
import type { ChatExperience } from './live-types';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { InputGroup, InputGroupButton, InputGroupTextarea } from '@/components/ui/input-group';

import { cn } from '@/lib/utils';

const messageLimit = 500;
const bottomThreshold = 48;
const groupWindowMs = 5 * 60 * 1000;

interface LiveChatProps {
  disabledPlaceholder?: string;
  inputRef: RefObject<HTMLTextAreaElement | null>;
  live: ChatExperience;
  open: boolean;
  onToggle: () => void;
  renderMessageActions?: (message: LiveChatMessage) => ReactNode;
}

export function LiveChat({ disabledPlaceholder, inputRef, live, open, onToggle, renderMessageActions }: LiveChatProps) {
  const t = useTranslations('live');
  const [draft, setDraft] = useState('');
  const [newMessageCount, setNewMessageCount] = useState(0);
  const viewportRef = useRef<HTMLDivElement>(null);
  const pinnedToBottomRef = useRef(true);
  const previousMessageCountRef = useRef(0);
  const previousLatestMessageRef = useRef('');
  const initializedRef = useRef(false);
  const characters = Array.from(draft).length;

  const rows = useMemo(
    () =>
      live.messages.map((message, index) => {
        const previous = live.messages[index - 1];
        const grouped =
          previous?.kind === LiveChatMessageKind.CHAT &&
          message.kind === LiveChatMessageKind.CHAT &&
          previous.senderPlayerId === message.senderPlayerId &&
          previous.senderDisplayName === message.senderDisplayName &&
          message.createdAtUnixMs - previous.createdAtUnixMs <= BigInt(groupWindowMs);
        return { message, grouped };
      }),
    [live.messages],
  );

  function scrollToLatest(behavior: ScrollBehavior = 'smooth') {
    const viewport = viewportRef.current;
    if (viewport === null) return;
    viewport.scrollTo({ top: viewport.scrollHeight, behavior });
    pinnedToBottomRef.current = true;
    setNewMessageCount(0);
  }

  useLayoutEffect(() => {
    const nextCount = live.messages.length;
    const latest = live.messages.at(-1);
    const latestKey = latest === undefined ? '' : chatMessageKey(latest);
    const changed = latestKey !== previousLatestMessageRef.current;
    const added =
      changed && nextCount >= previousMessageCountRef.current
        ? Math.max(1, nextCount - previousMessageCountRef.current)
        : 0;
    previousMessageCountRef.current = nextCount;
    previousLatestMessageRef.current = latestKey;
    if (!initializedRef.current) {
      initializedRef.current = true;
      scrollToLatest('auto');
      return;
    }
    if (added === 0) return;
    if (pinnedToBottomRef.current) scrollToLatest('smooth');
    else setNewMessageCount((current) => current + added);
  }, [live.messages]);

  function sendDraft() {
    if (characters === 0 || characters > messageLimit || !live.sendChatMessage(draft)) return;
    setDraft('');
    requestAnimationFrame(() => {
      scrollToLatest('smooth');
      inputRef.current?.focus();
    });
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) return;
    event.preventDefault();
    sendDraft();
  }

  const inputPlaceholder = live.canChat ? t('chat.placeholder') : (disabledPlaceholder ?? t('chat.signIn'));

  return (
    <Card
      className={cn(
        'bg-card/92 flex w-(--live-sidebar-width) flex-col overflow-hidden rounded-none border-t-0 backdrop-blur-xl max-sm:w-full',
        open ? 'min-h-48 flex-1 max-sm:min-h-0' : 'shrink-0',
      )}
    >
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="bg-card/92 h-5 w-full shrink-0 rounded-none border-0 max-sm:hidden"
        aria-expanded={open}
        aria-label={t(open ? 'chat.close' : 'chat.open')}
        title={t(open ? 'chat.close' : 'chat.open')}
        onClick={onToggle}
      >
        {open ? <ChevronUp data-icon="inline-start" /> : <ChevronDown data-icon="inline-start" />}
      </Button>
      {open && (
        <CardContent className="relative flex min-h-0 flex-1 flex-col p-0">
          {live.audioBlocked && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="absolute top-2 left-1/2 z-20 -translate-x-1/2 rounded-full shadow-lg"
              onClick={() => {
                void live.unlockAudio();
              }}
            >
              <Volume2 data-icon="inline-start" />
              {t('startAudio')}
            </Button>
          )}
          <div
            ref={viewportRef}
            className="min-h-0 flex-1 [scrollbar-gutter:stable] overflow-y-auto overscroll-contain px-3 py-2"
            onScroll={(event) => {
              const viewport = event.currentTarget;
              const atBottom = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight <= bottomThreshold;
              pinnedToBottomRef.current = atBottom;
              if (atBottom) setNewMessageCount(0);
            }}
            aria-label={t('chat.transcript')}
            role="log"
            aria-live="polite"
          >
            {rows.length === 0 ? (
              <div className="text-muted-foreground flex min-h-32 items-center justify-center px-4 text-center text-xs max-sm:min-h-0">
                {t('chat.empty')}
              </div>
            ) : (
              <div className="flex flex-col gap-0.5">
                {rows.map(({ message, grouped }) => (
                  <LiveChatMessageRow
                    key={chatMessageKey(message)}
                    actions={renderMessageActions?.(message)}
                    message={message}
                    grouped={grouped}
                    pending={live.pendingChatMessageIds.includes(message.messageId)}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="relative border-t p-2">
            {newMessageCount > 0 && (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="absolute bottom-full left-1/2 z-10 mb-2 -translate-x-1/2 rounded-full shadow-lg"
                onClick={() => {
                  scrollToLatest();
                }}
              >
                <ArrowDown data-icon="inline-start" />
                {t('chat.newMessages', { count: newMessageCount })}
              </Button>
            )}
            <InputGroup className="bg-background/75 h-auto min-h-10 items-end">
              <InputGroupTextarea
                ref={inputRef}
                data-live-chat-input
                rows={1}
                value={draft}
                disabled={!live.canChat}
                placeholder={inputPlaceholder}
                aria-label={t('chat.message')}
                className="max-h-28 min-h-10 py-2.5"
                onChange={(event) => {
                  setDraft(Array.from(event.currentTarget.value).slice(0, messageLimit).join(''));
                }}
                onKeyDown={handleKeyDown}
              />
              {characters >= 450 && (
                <span
                  className={cn(
                    'pb-2.5 text-[10px] tabular-nums',
                    characters >= messageLimit ? 'text-destructive' : 'text-muted-foreground',
                  )}
                >
                  {characters}/{messageLimit}
                </span>
              )}
              <InputGroupButton
                aria-label={t('chat.send')}
                disabled={!live.canChat || characters === 0 || characters > messageLimit}
                onClick={sendDraft}
              >
                <Send />
              </InputGroupButton>
            </InputGroup>
            <p
              className={cn(
                'mt-1 px-1 text-[10px]',
                live.chatError ? 'text-destructive' : 'text-muted-foreground max-sm:hidden',
              )}
              role={live.chatError ? 'alert' : undefined}
            >
              {live.chatError ? t('chat.sendFailed') : t('chat.hint')}
            </p>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
