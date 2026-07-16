import { useEffect, type Dispatch, type RefObject, type SetStateAction } from 'react';

import { Result } from 'better-result';

import type { LiveChatMessage } from './generated/proto/scoresaber/live/v1/chat_pb';
import { LudusPlayState } from './generated/proto/scoresaber/live/v1/common_pb';
import type { ReplayStreamPacket } from './generated/proto/scoresaber/live/v1/replay_stream_pb';
import type { LiveMatchRoomState, LiveRoomStreamSnapshot } from './generated/proto/scoresaber/live/v1/room_state_pb';
import { fetchLiveBrowserSession } from './live-browser-session';
import { retainedChatMessages, uniqueChatMessages, upsertChatMessage } from './live-chat-state';
import { tickLivePlayback } from './live-playback';
import { createLiveReplay, liveMapHash } from './live-replay';
import { applyLiveReplayChunk, applyLiveReplayEnd, applyLiveReplayStates } from './live-replay-stream';
import {
  acceptLiveReplayPacket,
  applyLivePlaybackBuffer,
  createLiveRuntime,
  maxBufferedPackets,
  reconnectDelays,
  replayPacketTargetsPlayer,
  resetLiveStream,
  type LiveRuntime,
} from './live-runtime';
import { initialLiveState } from './live-state';
import type { LiveExperienceOptions, LiveExperienceState, LiveStatus, LiveTarget } from './live-types';
import {
  decodeLudusEnvelope,
  encodeConnectEnvelope,
  encodeFollowRoomEnvelope,
  encodeHeartbeatEnvelope,
  ludusWebSocketUrl,
} from './ludus-protocol';

export function useLiveConnection(
  target: LiveTarget | null,
  optionsRef: RefObject<LiveExperienceOptions>,
  runtimeRef: RefObject<LiveRuntime | null>,
  setState: Dispatch<SetStateAction<LiveExperienceState>>,
) {
  useEffect(() => {
    if (target === null) {
      runtimeRef.current = null;
      setState(initialLiveState);
      return;
    }
    const activeTarget = target;

    let disposed = false;
    const runtime = createLiveRuntime(activeTarget);
    runtimeRef.current = runtime;
    setState(initialLiveState);

    function updateConnectionState(status: LiveStatus) {
      const canChat =
        runtime.socket?.readyState === WebSocket.OPEN &&
        runtime.connectionId !== '' &&
        runtime.sessionPlayerId !== '' &&
        runtime.targetMatchId !== '';
      setState((current) =>
        current.status === status && current.canChat === canChat ? current : { ...current, canChat, status },
      );
    }

    function clearHeartbeat() {
      window.clearTimeout(runtime.heartbeatId);
      runtime.heartbeatId = 0;
    }

    function send(bytes: Uint8Array) {
      const socket = runtime.socket;
      if (socket?.readyState !== WebSocket.OPEN) return false;
      const result = Result.try(() => {
        socket.send(new Uint8Array(bytes));
      });
      return result.isOk();
    }

    function scheduleHeartbeat() {
      clearHeartbeat();
      runtime.heartbeatId = window.setTimeout(
        () => {
          if (runtime.connectionId !== '') {
            const sent = send(
              encodeHeartbeatEnvelope(runtime.lastReceivedSequence, runtime.outgoingSequence++, runtime.connectionId),
            );
            if (!sent) {
              scheduleReconnect();
              return;
            }
          }
          scheduleHeartbeat();
        },
        Math.max(1000, runtime.heartbeatIntervalMs),
      );
    }

    function sendFollowRequest() {
      if (
        runtime.followRequested ||
        runtime.targetMatchId === '' ||
        runtime.connectionId === '' ||
        runtime.socket?.readyState !== WebSocket.OPEN
      )
        return;
      const sent = send(
        encodeFollowRoomEnvelope(
          runtime.targetMatchId,
          activeTarget.playerId,
          runtime.outgoingSequence++,
          runtime.connectionId,
        ),
      );
      if (!sent) {
        scheduleReconnect();
        return;
      }
      runtime.followRequested = true;
      updateConnectionState('waiting');
    }

    function learnTargetMatch(room: LiveMatchRoomState) {
      if (activeTarget.roomId === undefined || room.roomId !== activeTarget.roomId || room.matchId === '') return;
      if (runtime.targetMatchId === room.matchId) return;
      runtime.targetMatchId = room.matchId;
      runtime.followRequested = false;
      runtime.pendingChatMessageIds = [];
      setState((current) => ({ ...current, chatError: false, messages: [], pendingChatMessageIds: [] }));
      sendFollowRequest();
    }

    function isTargetRoom(room: LiveMatchRoomState | undefined) {
      if (room === undefined) return false;
      if (activeTarget.roomId !== undefined && room.roomId === activeTarget.roomId) return true;
      return runtime.targetMatchId !== '' && room.matchId === runtime.targetMatchId;
    }

    function applyRoomState(room: LiveMatchRoomState) {
      learnTargetMatch(room);
      const player = room.playerStates.find((candidate) => candidate.playerId === activeTarget.playerId);
      const playState = player?.playState ?? LudusPlayState.UNSPECIFIED;
      const viewerCount = room.viewers.length || room.viewerCount;
      setState((current) =>
        current.playState === playState && current.viewerCount === viewerCount
          ? current
          : { ...current, playState, viewerCount },
      );
      const present = player !== undefined || room.playerIds.includes(activeTarget.playerId);
      if (!present) {
        runtime.streamEnding = true;
        pausePlayback();
        updateConnectionState('waiting');
      } else if (runtime.replay === null && player?.playState === LudusPlayState.PAUSED)
        updateConnectionState('paused');
      else if (runtime.replay === null) updateConnectionState('waiting');
    }

    function beginReplayStream(packet: ReplayStreamPacket) {
      const start = packet.body.case === 'start' ? packet.body.value : undefined;
      if (start === undefined || !replayPacketTargetsPlayer(packet, activeTarget.playerId)) return;
      if (runtime.replay !== null && runtime.currentStreamId === packet.streamId) return;
      const buffered = runtime.bufferedPackets;
      resetLiveStream(runtime);
      runtime.currentStreamId = packet.streamId;
      const replay = createLiveReplay(start);
      runtime.replay = replay;
      runtime.playbackRate = replay.metadata.songSpeed && replay.metadata.songSpeed > 0 ? replay.metadata.songSpeed : 1;
      const hash = liveMapHash(start);
      if (!/^[0-9A-F]{40}$/.test(hash)) {
        updateConnectionState('error');
        return;
      }
      updateConnectionState(optionsRef.current.hasLiveMap(hash) ? 'buffering' : 'loading');
      void loadReplayMap();

      async function loadReplayMap() {
        const result = await optionsRef.current.loadLiveReplay(hash, replay);
        if (disposed || runtime.replay !== replay) return;
        if (result.isErr()) {
          updateConnectionState('error');
          return;
        }
        runtime.mapLoaded = true;
        runtime.playbackAttemptPending = true;
        updateConnectionState('buffering');
        tickPlayback();
      }
      for (const queued of buffered) {
        if (queued.streamId === packet.streamId && queued.body.case === 'chunk') applyReplayPacket(queued, true);
      }
      runtime.bufferedPackets = [];
    }

    function handleReplayEnd(packet: ReplayStreamPacket, deferPlaybackAttempt: boolean) {
      if (applyLiveReplayEnd(runtime, packet) === 'waiting') {
        pausePlayback();
        updateConnectionState('waiting');
      }
      if (!deferPlaybackAttempt) tickPlayback();
    }

    function applyReplayPacket(packet: ReplayStreamPacket, deferPlaybackAttempt = false) {
      if (!replayPacketTargetsPlayer(packet, activeTarget.playerId)) return;
      if (packet.body.case === 'start') {
        beginReplayStream(packet);
        return;
      }
      if (packet.body.case === 'chunk') {
        if (runtime.replay === null) {
          runtime.bufferedPackets.push(packet);
          if (runtime.bufferedPackets.length > maxBufferedPackets) {
            runtime.bufferedPackets.splice(0, runtime.bufferedPackets.length - maxBufferedPackets);
          }
          return;
        }
        if (acceptLiveReplayPacket(runtime, packet)) {
          applyLiveReplayChunk(runtime, packet.body.value, optionsRef.current.appendReplayNoteEvents);
          if (!deferPlaybackAttempt) tickPlayback();
        }
        return;
      }
      if (packet.body.case === 'end') handleReplayEnd(packet, deferPlaybackAttempt);
    }

    function applyStreamRoom(room: LiveRoomStreamSnapshot) {
      if (room.room !== undefined) applyRoomState(room.room);
      applyLivePlaybackBuffer(runtime, room.playbackBuffer);
      for (const packet of room.replayPackets) applyReplayPacket(packet, true);
      applyLiveReplayStates(runtime, room.replayStates, activeTarget.playerId, () => {
        optionsRef.current.appendReplayNoteEvents([]);
      });
      tickPlayback();
    }

    function addChatMessage(message: LiveChatMessage) {
      if (message.matchId !== runtime.targetMatchId) return;
      const acceptedPending = runtime.pendingChatMessageIds.includes(message.messageId);
      runtime.pendingChatMessageIds = runtime.pendingChatMessageIds.filter(
        (messageId) => messageId !== message.messageId,
      );
      setState((current) => ({
        ...current,
        chatError: acceptedPending ? false : current.chatError,
        messages: upsertChatMessage(
          current.messages,
          message,
          retainedChatMessages + runtime.pendingChatMessageIds.length,
        ),
        pendingChatMessageIds: [...runtime.pendingChatMessageIds],
      }));
    }

    function targetUnavailable() {
      setState((current) => ({ ...current, playState: LudusPlayState.UNSPECIFIED, viewerCount: null }));
      updateConnectionState('waiting');
    }

    function handleEnvelope(bytes: ArrayBuffer) {
      const decoded = decodeLudusEnvelope(bytes);
      if (decoded.isErr()) return;
      const envelope = decoded.value;
      if (envelope.sequence > runtime.lastReceivedSequence) runtime.lastReceivedSequence = envelope.sequence;
      const body = envelope.body;
      switch (body.case) {
        case 'connectAccepted':
          runtime.connectionId = body.value.connectionId || envelope.connectionId;
          runtime.heartbeatIntervalMs = body.value.heartbeatIntervalMs || 5000;
          runtime.followRequested = false;
          runtime.reconnectAttempt = 0;
          scheduleHeartbeat();
          sendFollowRequest();
          break;
        case 'roomSnapshot': {
          const room = body.value.rooms.find(isTargetRoom);
          if (room === undefined) targetUnavailable();
          else applyRoomState(room);
          break;
        }
        case 'streamSnapshot': {
          const room = body.value.rooms.find((candidate) => isTargetRoom(candidate.room));
          if (room === undefined) targetUnavailable();
          else applyStreamRoom(room);
          break;
        }
        case 'replayPacket':
          applyReplayPacket(body.value);
          break;
        case 'chatMessage':
          addChatMessage(body.value);
          break;
        case 'chatSnapshot':
          if (body.value.matchId !== runtime.targetMatchId) break;
          setState((current) => ({
            ...current,
            messages: uniqueChatMessages(
              [
                ...body.value.messages,
                ...current.messages.filter((message) => runtime.pendingChatMessageIds.includes(message.messageId)),
              ],
              retainedChatMessages + runtime.pendingChatMessageIds.length,
            ),
          }));
          break;
        case 'roomContextUpdated':
          updateConnectionState('waiting');
          break;
        case 'reconnectRequested':
          runtime.websocketUrl = ludusWebSocketUrl(body.value.websocketUrl);
          scheduleReconnect(body.value.retryAfterMs);
          break;
        case 'error': {
          const failedChatMessageId = runtime.pendingChatMessageIds.shift();
          setState((current) => ({
            ...current,
            chatError: current.chatError || failedChatMessageId !== undefined,
            messages:
              failedChatMessageId === undefined
                ? current.messages
                : current.messages.filter((message) => message.messageId !== failedChatMessageId),
            pendingChatMessageIds: [...runtime.pendingChatMessageIds],
            status: body.value.retryable ? current.status : 'error',
          }));
          break;
        }
      }
    }

    function closeSocket() {
      clearHeartbeat();
      const socket = runtime.socket;
      runtime.socket = null;
      runtime.connectionId = '';
      runtime.followRequested = false;
      if (socket !== null) {
        socket.onopen = null;
        socket.onmessage = null;
        socket.onerror = null;
        socket.onclose = null;
        socket.close();
      }
    }

    function failPendingChatMessages() {
      if (runtime.pendingChatMessageIds.length === 0) return;
      const pending = new Set(runtime.pendingChatMessageIds);
      runtime.pendingChatMessageIds = [];
      setState((current) => ({
        ...current,
        chatError: true,
        messages: current.messages.filter((message) => !pending.has(message.messageId)),
        pendingChatMessageIds: [],
      }));
    }

    function scheduleReconnect(delayOverride?: number) {
      if (disposed || runtime.reconnectId !== 0) return;
      failPendingChatMessages();
      closeSocket();
      const delay =
        delayOverride ?? reconnectDelays[Math.min(runtime.reconnectAttempt++, reconnectDelays.length - 1)] ?? 10_000;
      updateConnectionState('reconnecting');
      runtime.reconnectId = window.setTimeout(
        () => {
          runtime.reconnectId = 0;
          void connect();
        },
        Math.max(50, delay),
      );
    }

    async function connect() {
      if (runtimeRef.current !== runtime) return;
      updateConnectionState(runtime.reconnectAttempt === 0 ? 'connecting' : 'reconnecting');
      const browserSession = await fetchLiveBrowserSession(activeTarget);
      if (disposed) return;
      const socketResult = Result.try(() => new WebSocket(runtime.websocketUrl));
      if (socketResult.isErr()) {
        scheduleReconnect();
        return;
      }
      const socket = socketResult.value;
      socket.binaryType = 'arraybuffer';
      runtime.socket = socket;
      const playerId = activeTarget.watcherPlayerId ?? browserSession?.playerId;
      const authToken = activeTarget.authToken ?? browserSession?.authToken;
      runtime.sessionPlayerId = playerId ?? '';
      socket.onopen = () => {
        if (disposed || runtime.socket !== socket) return;
        runtime.reconnectAttempt = 0;
        send(
          encodeConnectEnvelope(
            { authToken, playerId, tournamentId: activeTarget.tournamentId },
            runtime.outgoingSequence++,
          ),
        );
        updateConnectionState('connecting');
      };
      socket.onmessage = (event: MessageEvent<ArrayBuffer>) => {
        if (!disposed && runtime.socket === socket) handleEnvelope(event.data);
      };
      socket.onerror = () => {
        if (!disposed && runtime.socket === socket) updateConnectionState('reconnecting');
      };
      socket.onclose = () => {
        if (disposed || runtime.socket !== socket) return;
        runtime.socket = null;
        scheduleReconnect();
      };
    }

    function pausePlayback() {
      const transport = optionsRef.current.transport;
      if (transport.clockRef.current?.isPlaying()) transport.togglePlay();
    }

    function resumePlayback() {
      const transport = optionsRef.current.transport;
      const clock = transport.clockRef.current;
      if (clock === null) return false;
      if (clock.audioBlocked()) {
        setState((current) => ({ ...current, audioBlocked: true }));
      }
      if (!clock.isPlaying()) transport.togglePlay();
      return clock.isPlaying();
    }

    function seekPlayback(time: number) {
      optionsRef.current.transport.seek(Math.max(0, time));
    }

    const playbackActions = {
      pause: pausePlayback,
      resume: resumePlayback,
      seek: seekPlayback,
      updateStatus: updateConnectionState,
    };

    function tickPlayback() {
      const transport = optionsRef.current.transport;
      tickLivePlayback(runtime, transport.clockRef.current, optionsRef.current.selectedKey, playbackActions);
    }

    void connect();
    const playbackId = window.setInterval(tickPlayback, 100);
    return () => {
      disposed = true;
      window.clearInterval(playbackId);
      window.clearTimeout(runtime.reconnectId);
      closeSocket();
      pausePlayback();
      if (runtimeRef.current === runtime) runtimeRef.current = null;
    };
  }, [
    target?.authToken,
    target?.matchId,
    target?.playerId,
    target?.roomId,
    target?.tournamentId,
    target?.watcherPlayerId,
  ]);
}
