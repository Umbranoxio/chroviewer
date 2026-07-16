import { Fragment, type ReactNode } from 'react';

import { useQuery } from '@tanstack/react-query';
import { Clock3 } from 'lucide-react';
import { useFormatter, useTranslations } from 'use-intl';

import { scoreSaberPlayerQueryOptions } from '../../sources/scoresaber/queries';
import type { ScoreSaberReplayPlayer } from '../../sources/source-types';
import { LiveChatMessageKind, type LiveChatMessage } from './generated/proto/scoresaber/live/v1/chat_pb';

import { cn } from '@/lib/utils';

const linkPattern = /https?:\/\/[^\s<>"']+/gi;

interface LiveChatMessageRowProps {
  grouped: boolean;
  message: LiveChatMessage;
  pending: boolean;
}

export function LiveChatMessageRow({ message, grouped, pending }: LiveChatMessageRowProps) {
  const format = useFormatter();
  const t = useTranslations('live');
  const isChat = message.kind === LiveChatMessageKind.CHAT;
  const profilePlayerId = isChat && /^\d+$/.test(message.senderPlayerId) ? message.senderPlayerId : undefined;
  const profile = useQuery(scoreSaberPlayerQueryOptions(profilePlayerId)).data;
  const cleanedSender = cleanName(profile?.name ?? message.senderDisplayName);
  const sender = pending ? t('chat.you') : cleanedSender === '' ? t('chat.unknown') : cleanedSender;
  const createdAt = new Date(Number(message.createdAtUnixMs));
  const time = format.dateTime(createdAt, { hour: 'numeric', minute: '2-digit' });

  if (!isChat) {
    return (
      <div className="text-muted-foreground my-1 flex items-start gap-2 px-1 text-[11px] leading-relaxed">
        <span className="shrink-0 tabular-nums opacity-60">{time}</span>
        <span className="min-w-0 break-words italic">{message.text}</span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'group flex gap-2 rounded-md px-1.5 py-1 hover:bg-accent/45',
        grouped && 'pt-0.5',
        pending && 'opacity-65',
      )}
    >
      <div className="w-7 shrink-0">{!grouped && <ChatAvatar profile={profile} name={sender} />}</div>
      <div className="min-w-0 flex-1">
        {!grouped && (
          <div className="flex min-w-0 items-baseline gap-1.5 text-xs leading-none">
            {profilePlayerId === undefined ? (
              <span className="truncate font-semibold">{sender}</span>
            ) : (
              <a
                className="hover:text-muted-foreground truncate font-semibold"
                href={`https://scoresaber.com/u/${message.senderPlayerId}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                {sender}
              </a>
            )}
            {profile?.rank !== undefined && (
              <span className="text-muted-foreground">#{format.number(profile.rank, 'integer')}</span>
            )}
            {pending ? (
              <Clock3 className="text-muted-foreground ml-auto size-3" aria-label={t('chat.sending')} />
            ) : (
              <time
                className="text-muted-foreground ml-auto shrink-0 text-[10px] opacity-0 transition-opacity group-hover:opacity-100 max-sm:opacity-60"
                dateTime={createdAt.toISOString()}
              >
                {time}
              </time>
            )}
          </div>
        )}
        <p className="mt-1 text-[13px] leading-relaxed break-words whitespace-pre-wrap">{linkify(message.text)}</p>
      </div>
    </div>
  );
}

function ChatAvatar({ profile, name }: { profile: ScoreSaberReplayPlayer | null | undefined; name: string }) {
  return (
    <span className="bg-secondary flex size-7 items-center justify-center overflow-hidden rounded-full text-[10px] font-semibold">
      {profile?.avatar ? (
        <img className="size-full object-cover" src={profile.avatar} alt="" loading="lazy" />
      ) : (
        initials(name)
      )}
    </span>
  );
}

function cleanName(value: string) {
  return value
    .replace(/<[^>\r\n]{1,128}>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function initials(value: string) {
  return value
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => Array.from(part)[0] ?? '')
    .join('')
    .toUpperCase();
}

function linkify(text: string): ReactNode {
  const nodes: ReactNode[] = [];
  let index = 0;
  for (const match of text.matchAll(linkPattern)) {
    const start = match.index;
    if (start > index) nodes.push(<Fragment key={`text:${index}`}>{text.slice(index, start)}</Fragment>);
    const raw = match[0];
    const url = raw.replace(/[.,;:)\]}]+$/, '');
    nodes.push(
      <a
        key={`${start}:${url}`}
        className="text-primary decoration-primary/40 hover:decoration-primary underline underline-offset-2"
        href={url}
        target="_blank"
        rel="noopener noreferrer"
      >
        {url}
      </a>,
    );
    if (url.length < raw.length) {
      nodes.push(<Fragment key={`punctuation:${start}`}>{raw.slice(url.length)}</Fragment>);
    }
    index = start + raw.length;
  }
  if (index < text.length) nodes.push(<Fragment key={`text:${index}`}>{text.slice(index)}</Fragment>);
  return nodes;
}
