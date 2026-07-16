import { useCallback, useEffect, useRef, useState } from 'react';

import { create } from '@bufbuild/protobuf';
import { useQuery } from '@tanstack/react-query';
import { Result } from 'better-result';

import { scoreSaberPlayerQueryOptions } from '../../sources/scoresaber/queries';
import { LiveChatMessageKind, LiveChatMessageSchema } from './generated/proto/scoresaber/live/v1/chat_pb';
import { retainedChatMessages, upsertChatMessage } from './live-chat-state';
import type { LiveRuntime } from './live-runtime';
import { initialLiveState } from './live-state';
import type { LiveExperienceOptions, LiveExperienceState } from './live-types';
import { encodeChatEnvelope } from './ludus-protocol';
import { useLiveConnection } from './use-live-connection';

export function useLiveExperience(options: LiveExperienceOptions) {
  const optionsRef = useRef(options);
  optionsRef.current = options;
  const runtimeRef = useRef<LiveRuntime | null>(null);
  const [state, setState] = useState<LiveExperienceState>(initialLiveState);
  const playerId = options.target?.playerId;
  const playerQuery = useQuery(scoreSaberPlayerQueryOptions(playerId));

  const unlockAudio = useCallback(async () => {
    const runtime = runtimeRef.current;
    const transport = optionsRef.current.transport;
    const clock = transport.clockRef.current;
    if (runtime === null || clock === null) return false;
    const unlocked = await clock.unlockAudio();
    if (!unlocked) return false;
    if (runtime.streamPaused) {
      setState((current) => ({ ...current, audioBlocked: false, status: 'paused' }));
      return true;
    }
    if (!clock.isPlaying()) transport.togglePlay();
    setState((current) => ({ ...current, audioBlocked: false, status: 'watching' }));
    return true;
  }, []);

  const sendChatMessage = useCallback((text: string) => {
    const runtime = runtimeRef.current;
    const socket = runtime?.socket;
    const message = text.trim();
    if (
      runtime === null ||
      socket?.readyState !== WebSocket.OPEN ||
      runtime.connectionId === '' ||
      runtime.targetMatchId === '' ||
      message === ''
    )
      return false;
    const messageId = crypto.randomUUID();
    const bytes = encodeChatEnvelope(
      runtime.targetMatchId,
      message,
      runtime.outgoingSequence++,
      runtime.connectionId,
      messageId,
    );
    const result = Result.try(() => {
      socket.send(bytes);
    });
    if (result.isErr()) return false;
    runtime.pendingChatMessageIds.push(messageId);
    setState((current) => {
      const lastSequence = current.messages.at(-1)?.roomSequence ?? 0n;
      const optimistic = create(LiveChatMessageSchema, {
        messageId,
        matchId: runtime.targetMatchId,
        senderConnectionId: runtime.connectionId,
        senderPlayerId: runtime.sessionPlayerId,
        kind: LiveChatMessageKind.CHAT,
        text: message,
        createdAtUnixMs: BigInt(Date.now()),
        roomSequence: lastSequence + 1n,
      });
      return {
        ...current,
        chatError: false,
        messages: upsertChatMessage(
          current.messages,
          optimistic,
          retainedChatMessages + runtime.pendingChatMessageIds.length,
        ),
        pendingChatMessageIds: [...runtime.pendingChatMessageIds],
      };
    });
    return true;
  }, []);

  useEffect(() => {
    if (!state.audioBlocked) return;
    const unlock = () => {
      void unlockAudio();
    };
    window.addEventListener('pointerdown', unlock, true);
    window.addEventListener('keydown', unlock, true);
    return () => {
      window.removeEventListener('pointerdown', unlock, true);
      window.removeEventListener('keydown', unlock, true);
    };
  }, [state.audioBlocked, unlockAudio]);

  useLiveConnection(options.target, optionsRef, runtimeRef, setState);

  let player = playerQuery.data ?? null;
  if (player === null && playerId !== undefined && playerQuery.isError) {
    player = { id: playerId, name: playerId, avatar: '', country: '' };
  }
  return { ...state, player, sendChatMessage, unlockAudio };
}
