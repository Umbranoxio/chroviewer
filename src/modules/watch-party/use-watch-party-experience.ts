import { useCallback, useEffect, useRef, useState } from 'react';

import { create } from '@bufbuild/protobuf';
import { Result } from 'better-result';
import { useTranslations } from 'use-intl';

import type { SourceResult } from '../../sources/source-types';
import {
  LiveChatMessageKind,
  LiveChatMessageSchema,
  type LiveChatMessage,
} from '../live/generated/proto/scoresaber/live/v1/chat_pb';
import type { LudusEnvelope } from '../live/generated/proto/scoresaber/live/v1/ludus_pb';
import {
  WatchPartyMapSchema,
  WatchPartyPlaybackState,
  WatchPartyViewerSettingsSchema,
  type WatchPartyParticipant,
  type WatchPartySelfCapabilities,
  type WatchPartyState,
} from '../live/generated/proto/scoresaber/live/v1/watch_party_pb';
import { retainedChatMessages, uniqueChatMessages, upsertChatMessage } from '../live/live-chat-state';
import {
  decodeLudusEnvelope,
  encodeChatEnvelope,
  encodeClearWatchPartyMapEnvelope,
  encodeHeartbeatEnvelope,
  encodeMuteWatchPartyParticipantEnvelope,
  encodeSetWatchPartyMapEnvelope,
  encodeSetWatchPartyPlaybackStateEnvelope,
  encodeSetWatchPartyViewerSettingsEnvelope,
  encodeUnmuteWatchPartyParticipantEnvelope,
  encodeWatchPartyConnectEnvelope,
  ludusWebSocketUrl,
} from '../live/ludus-protocol';
import type { useSongTransport } from '../viewer/use-song-transport';
import type { DifficultyRow, MapIdentity } from '../viewer/viewer-types';
import { addEnvelopeClockSample, addHeartbeatClockSample, estimatedServerUnixMs } from './watch-party-clock';
import {
  isWatchPartyBeatSaverId,
  selectAuthoritativeWatchPartyRow,
  selectWatchPartySetRow,
  watchPartyMapKey,
} from './watch-party-map';
import { createWatchPartyRuntime, watchPartyReconnectDelays, type WatchPartyRuntime } from './watch-party-runtime';
import { fetchWatchPartySession, type WatchPartySession } from './watch-party-session';
import { acceptWatchPartyRevision, sameWatchPartyMap, watchPartyTargetTime } from './watch-party-state';

interface LoadedWatchPartyMap {
  identity: MapIdentity;
  rows: DifficultyRow[];
}

interface WatchPartySources {
  clearSource(): void;
  loadWatchPartyMapByHash(hash: string, signal?: AbortSignal): Promise<SourceResult<LoadedWatchPartyMap | null>>;
  loadWatchPartyMapById(input: string, signal?: AbortSignal): Promise<SourceResult<LoadedWatchPartyMap | null>>;
  mapIdentity: MapIdentity | null;
  rows: DifficultyRow[];
  songBpm: number;
}

type SongTransport = ReturnType<typeof useSongTransport>;

interface WatchPartySessionSelection {
  selectDifficulty(row: DifficultyRow, initialBeat?: number): Promise<boolean | undefined>;
  selectedKey: string;
  viewerReady: boolean;
}

interface UseWatchPartyExperienceOptions {
  partyPlayerId: string | null;
  session: WatchPartySessionSelection;
  setError: (message: string) => void;
  sources: WatchPartySources;
  transport: Pick<
    SongTransport,
    'audioBlocked' | 'clockRef' | 'pause' | 'play' | 'seek' | 'setPlaybackRate' | 'stop' | 'unlockAudio'
  >;
}

export type WatchPartyStatus = 'idle' | 'connecting' | 'connected' | 'loading' | 'reconnecting' | 'error';

interface WatchPartyViewState {
  chatError: boolean;
  messages: LiveChatMessage[];
  participants: WatchPartyParticipant[];
  pendingChatMessageIds: string[];
  selfCapabilities: WatchPartySelfCapabilities | undefined;
  serverState: WatchPartyState | undefined;
  session: WatchPartySession | null;
  status: WatchPartyStatus;
}

const initialViewState: WatchPartyViewState = {
  chatError: false,
  messages: [],
  participants: [],
  pendingChatMessageIds: [],
  selfCapabilities: undefined,
  serverState: undefined,
  session: null,
  status: 'idle',
};

const tokenRefreshLeewayMs = 10_000;
const hardSeekThresholdSeconds = 0.25;
const softDriftThresholdSeconds = 0.03;

export function useWatchPartyExperience(options: UseWatchPartyExperienceOptions) {
  const t = useTranslations('watchParty');
  const optionsRef = useRef(options);
  optionsRef.current = options;
  const runtimeRef = useRef<WatchPartyRuntime | null>(null);
  const mapAbortRef = useRef<AbortController | null>(null);
  const hostSetAbortRef = useRef<AbortController | null>(null);
  const pendingHostMapKeyRef = useRef('');
  const [view, setView] = useState<WatchPartyViewState>(initialViewState);
  const [hostMapLoading, setHostMapLoading] = useState(false);
  const [mapLoadFailed, setMapLoadFailed] = useState(false);
  const [mapReady, setMapReady] = useState(false);

  const applyPlayback = useCallback(() => {
    const runtime = runtimeRef.current;
    const state = runtime?.state;
    const transport = optionsRef.current.transport;
    const clock = transport.clockRef.current;
    if (runtime === null || state === undefined || clock === null || runtime.mapReadyKey === '') return;
    const rate = state.playbackRate > 0 ? state.playbackRate : 1;
    const target = watchPartyTargetTime(state, estimatedServerUnixMs(runtime.clock, Date.now()), clock.duration);

    if (state.playbackState === WatchPartyPlaybackState.STOPPED) {
      transport.setPlaybackRate(rate);
      transport.stop();
      return;
    }
    if (state.playbackState === WatchPartyPlaybackState.PAUSED) {
      transport.setPlaybackRate(rate);
      transport.pause();
      if (Math.abs(clock.currentTime() - target) > softDriftThresholdSeconds) transport.seek(target);
      return;
    }
    if (state.playbackState !== WatchPartyPlaybackState.PLAYING) {
      transport.pause();
      return;
    }
    if (clock.duration <= 0 || target >= clock.duration) {
      transport.setPlaybackRate(rate);
      transport.pause();
      transport.seek(clock.duration);
      return;
    }

    const drift = target - clock.currentTime();
    if (!clock.isPlaying()) {
      transport.setPlaybackRate(rate);
      transport.seek(target);
      transport.play({ autoplay: true });
      return;
    }
    if (Math.abs(drift) > hardSeekThresholdSeconds) {
      transport.setPlaybackRate(rate);
      transport.seek(target);
      return;
    }
    const correction = Math.abs(drift) > softDriftThresholdSeconds ? Math.min(0.02, Math.max(-0.02, drift * 0.1)) : 0;
    transport.setPlaybackRate(rate * (1 + correction));
  }, []);

  const ensureAuthoritativeMap = useCallback(async () => {
    const runtime = runtimeRef.current;
    const state = runtime?.state;
    if (runtime === null || state === undefined) return;
    const map = state.map;
    if (map === undefined) {
      mapAbortRef.current?.abort();
      mapAbortRef.current = null;
      runtime.mapLoadGeneration++;
      runtime.mapLoadingKey = '';
      runtime.mapReadyKey = '';
      optionsRef.current.transport.stop();
      if (
        optionsRef.current.sources.mapIdentity !== null ||
        optionsRef.current.sources.rows.length > 0 ||
        optionsRef.current.sources.songBpm > 0
      ) {
        optionsRef.current.sources.clearSource();
      }
      setMapLoadFailed(false);
      setMapReady(false);
      setView((current) => ({ ...current, status: current.status === 'error' ? 'error' : 'connected' }));
      return;
    }

    const mapKey = watchPartyMapKey(map);
    if (runtime.mapReadyKey === mapKey) {
      applyPlayback();
      return;
    }
    if (!optionsRef.current.session.viewerReady || runtime.mapLoadingKey === mapKey) return;

    const rows = optionsRef.current.sources.rows;
    const loadedIdentity = optionsRef.current.sources.mapIdentity;
    const sourceMatches = loadedIdentity?.hash.toLowerCase() === map.hash.toLowerCase() && rows.length > 0;
    if (sourceMatches && optionsRef.current.sources.songBpm <= 0) return;

    const generation = ++runtime.mapLoadGeneration;
    runtime.mapLoadingKey = mapKey;
    runtime.mapReadyKey = '';
    setMapLoadFailed(false);
    setMapReady(false);
    setView((current) => ({ ...current, status: 'loading' }));
    mapAbortRef.current?.abort();
    const abort = new AbortController();
    mapAbortRef.current = abort;

    if (!sourceMatches) {
      optionsRef.current.sources.clearSource();
      const loaded = await optionsRef.current.sources.loadWatchPartyMapByHash(map.hash, abort.signal);
      if (loaded.isErr()) {
        if (!abort.signal.aborted && generation === runtime.mapLoadGeneration) {
          runtime.mapLoadingKey = '';
          setMapLoadFailed(true);
          setView((current) => ({ ...current, status: 'error' }));
          optionsRef.current.setError(t('errors.mapLoad'));
        }
        return;
      }
      if (loaded.value === null) return;
      if (
        abort.signal.aborted ||
        generation !== runtime.mapLoadGeneration ||
        runtime.state?.map === undefined ||
        watchPartyMapKey(runtime.state.map) !== mapKey
      )
        return;
      runtime.mapLoadingKey = '';
      setView((current) => ({ ...current }));
      return;
    }

    if (
      abort.signal.aborted ||
      generation !== runtime.mapLoadGeneration ||
      runtime.state?.map === undefined ||
      watchPartyMapKey(runtime.state.map) !== mapKey
    )
      return;
    const row = selectAuthoritativeWatchPartyRow(rows, map);
    if (row === undefined) {
      runtime.mapLoadingKey = '';
      setMapLoadFailed(true);
      setView((current) => ({ ...current, status: 'error' }));
      optionsRef.current.setError(t('errors.difficultyMissing'));
      return;
    }
    const selected = await optionsRef.current.session.selectDifficulty(row);
    const currentMap = runtimeRef.current?.state?.map;
    if (
      runtimeRef.current !== runtime ||
      generation !== runtime.mapLoadGeneration ||
      currentMap === undefined ||
      watchPartyMapKey(currentMap) !== mapKey
    )
      return;
    if (selected !== true) {
      runtime.mapLoadingKey = '';
      setMapLoadFailed(true);
      setView((current) => ({ ...current, status: 'error' }));
      optionsRef.current.setError(t('errors.mapLoad'));
      return;
    }
    runtime.mapLoadingKey = '';
    runtime.mapReadyKey = mapKey;
    setMapLoadFailed(false);
    setMapReady(true);
    setView((current) => ({ ...current, status: 'connected' }));
    applyPlayback();
  }, [applyPlayback, t]);

  useEffect(() => {
    if (!options.session.viewerReady) return;
    void ensureAuthoritativeMap();
  }, [
    ensureAuthoritativeMap,
    options.session.viewerReady,
    options.sources.mapIdentity?.hash,
    options.sources.rows.length,
    options.sources.songBpm,
  ]);

  useEffect(() => {
    const partyPlayerId = options.partyPlayerId;
    if (partyPlayerId === null) {
      runtimeRef.current = null;
      setView(initialViewState);
      setMapLoadFailed(false);
      setMapReady(false);
      setHostMapLoading(false);
      return;
    }
    const activePartyPlayerId = partyPlayerId;

    let disposed = false;
    const sessionAbort = new AbortController();
    const runtime = createWatchPartyRuntime();
    runtimeRef.current = runtime;
    setView({ ...initialViewState, status: 'connecting' });
    setMapLoadFailed(false);
    setMapReady(false);
    setHostMapLoading(false);

    function updateStatus(status: WatchPartyStatus) {
      setView((current) => (current.status === status ? current : { ...current, status }));
    }

    function clearHeartbeat() {
      window.clearTimeout(runtime.heartbeatId);
      runtime.heartbeatId = 0;
    }

    function send(bytes: Uint8Array) {
      const socket = runtime.socket;
      if (socket?.readyState !== WebSocket.OPEN) return false;
      return Result.try(() => {
        socket.send(bytes);
      }).isOk();
    }

    function scheduleHeartbeat() {
      clearHeartbeat();
      runtime.heartbeatId = window.setTimeout(
        () => {
          if (runtime.connectionId !== '') {
            const sequence = runtime.outgoingSequence++;
            runtime.pendingHeartbeats.set(sequence, Date.now());
            if (!send(encodeHeartbeatEnvelope(runtime.lastReceivedSequence, sequence, runtime.connectionId))) {
              scheduleReconnect();
              return;
            }
          }
          scheduleHeartbeat();
        },
        Math.max(1000, runtime.heartbeatIntervalMs),
      );
    }

    function closeSocket() {
      clearHeartbeat();
      const socket = runtime.socket;
      runtime.socket = null;
      runtime.connectionId = '';
      runtime.matchId = '';
      runtime.pendingHeartbeats.clear();
      runtime.roster = [];
      runtime.selfCapabilities = undefined;
      setView((current) => ({ ...current, participants: [], selfCapabilities: undefined }));
      if (socket === null) return;
      socket.onopen = null;
      socket.onmessage = null;
      socket.onerror = null;
      socket.onclose = null;
      socket.close();
    }

    function failPendingChatMessages() {
      if (runtime.pendingChatMessageIds.length === 0) return;
      const pending = new Set(runtime.pendingChatMessageIds);
      runtime.pendingChatMessageIds = [];
      setView((current) => ({
        ...current,
        chatError: true,
        messages: current.messages.filter((message) => !pending.has(message.messageId)),
        pendingChatMessageIds: [],
      }));
    }

    function scheduleReconnect(delayOverride?: number) {
      if (disposed || runtime.reconnectId !== 0) return;
      failPendingChatMessages();
      pendingHostMapKeyRef.current = '';
      setHostMapLoading(false);
      closeSocket();
      const delay =
        delayOverride ??
        watchPartyReconnectDelays[Math.min(runtime.reconnectAttempt++, watchPartyReconnectDelays.length - 1)] ??
        10_000;
      updateStatus('reconnecting');
      runtime.reconnectId = window.setTimeout(
        () => {
          runtime.reconnectId = 0;
          void connect();
        },
        Math.max(50, delay),
      );
    }

    function addServerClockSample(envelope: LudusEnvelope, receivedUnixMs: number) {
      if (envelope.serverTimeUnixMs <= 0n) return;
      const serverUnixMs = Number(envelope.serverTimeUnixMs);
      if (envelope.body.case === 'heartbeatAck') {
        const sentUnixMs = runtime.pendingHeartbeats.get(envelope.body.value.highestSeenSequence);
        if (sentUnixMs !== undefined) {
          runtime.pendingHeartbeats.delete(envelope.body.value.highestSeenSequence);
          runtime.clock = addHeartbeatClockSample(runtime.clock, sentUnixMs, receivedUnixMs, serverUnixMs);
          return;
        }
      }
      if (
        envelope.body.case === 'connectAccepted' ||
        envelope.body.case === 'watchPartyStateSnapshot' ||
        envelope.body.case === 'watchPartyRosterSnapshot'
      ) {
        runtime.clock = addEnvelopeClockSample(runtime.clock, serverUnixMs, receivedUnixMs);
      }
    }

    function acceptState(state: WatchPartyState | undefined) {
      if (state === undefined) return;
      const accepted = acceptWatchPartyRevision(runtime.revision, state.revision);
      if (!accepted.accepted) return;
      const previousMap = runtime.state?.map;
      runtime.revision = accepted.next;
      runtime.state = state;
      setView((current) => ({ ...current, serverState: state }));
      const requestedMapKey = pendingHostMapKeyRef.current;
      if (requestedMapKey !== '' && state.map !== undefined && watchPartyMapKey(state.map) === requestedMapKey) {
        pendingHostMapKeyRef.current = '';
        setHostMapLoading(false);
      }
      if (!sameWatchPartyMap(previousMap, state.map)) {
        mapAbortRef.current?.abort();
        runtime.mapLoadingKey = '';
        runtime.mapReadyKey = '';
        setMapReady(false);
        void ensureAuthoritativeMap();
      } else if (runtime.mapReadyKey !== '') applyPlayback();
      else void ensureAuthoritativeMap();
    }

    function handleEnvelope(bytes: ArrayBuffer) {
      const decoded = decodeLudusEnvelope(bytes);
      if (decoded.isErr()) return;
      const envelope = decoded.value;
      const receivedUnixMs = Date.now();
      if (envelope.sequence > runtime.lastReceivedSequence) runtime.lastReceivedSequence = envelope.sequence;
      addServerClockSample(envelope, receivedUnixMs);
      const body = envelope.body;
      switch (body.case) {
        case 'connectAccepted':
          runtime.connectionId = body.value.connectionId || envelope.connectionId;
          runtime.matchId = body.value.currentMatchId;
          runtime.heartbeatIntervalMs = body.value.heartbeatIntervalMs || 5000;
          runtime.reconnectAttempt = 0;
          scheduleHeartbeat();
          updateStatus('connected');
          break;
        case 'watchPartyStateSnapshot':
          acceptState(body.value.state);
          break;
        case 'watchPartyRosterSnapshot':
          runtime.roster = body.value.participants;
          runtime.selfCapabilities = body.value.selfCapabilities;
          setView((current) => ({
            ...current,
            participants: body.value.participants,
            selfCapabilities: body.value.selfCapabilities,
          }));
          break;
        case 'chatSnapshot':
          if (runtime.matchId !== '' && body.value.matchId !== runtime.matchId) break;
          runtime.messages = uniqueChatMessages(
            [
              ...body.value.messages,
              ...runtime.messages.filter((message) => runtime.pendingChatMessageIds.includes(message.messageId)),
            ],
            retainedChatMessages + runtime.pendingChatMessageIds.length,
          );
          setView((current) => ({ ...current, messages: runtime.messages }));
          break;
        case 'chatMessage': {
          if (runtime.matchId !== '' && body.value.matchId !== runtime.matchId) break;
          const acceptedPending = runtime.pendingChatMessageIds.includes(body.value.messageId);
          runtime.pendingChatMessageIds = runtime.pendingChatMessageIds.filter(
            (messageId) => messageId !== body.value.messageId,
          );
          runtime.messages = upsertChatMessage(
            runtime.messages,
            body.value,
            retainedChatMessages + runtime.pendingChatMessageIds.length,
          );
          setView((current) => ({
            ...current,
            chatError: acceptedPending ? false : current.chatError,
            messages: runtime.messages,
            pendingChatMessageIds: [...runtime.pendingChatMessageIds],
          }));
          break;
        }
        case 'heartbeatAck':
          break;
        case 'reconnectRequested':
          runtime.websocketUrl = ludusWebSocketUrl(body.value.websocketUrl);
          scheduleReconnect(body.value.retryAfterMs);
          break;
        case 'error': {
          const authFailed = body.value.code === 'auth_failed';
          if (authFailed) runtime.session = null;
          else optionsRef.current.setError(t('errors.action'));
          pendingHostMapKeyRef.current = '';
          setHostMapLoading(false);
          setView((current) => ({
            ...current,
            session: authFailed ? null : current.session,
            status: body.value.retryable ? current.status : 'error',
          }));
          if (authFailed) optionsRef.current.setError(t('errors.session'));
          void ensureAuthoritativeMap();
          break;
        }
      }
    }

    async function validSession() {
      if (runtime.session !== null && runtime.session.expiresAtUnixMs > Date.now() + tokenRefreshLeewayMs) {
        return runtime.session;
      }
      const result = await fetchWatchPartySession(activePartyPlayerId, sessionAbort.signal);
      if (result.isErr()) return null;
      runtime.session = result.value;
      setView((current) => ({ ...current, session: result.value }));
      return result.value;
    }

    async function connect() {
      if (disposed || runtimeRef.current !== runtime) return;
      updateStatus(runtime.reconnectAttempt === 0 ? 'connecting' : 'reconnecting');
      const session = await validSession();
      if (runtimeRef.current !== runtime) return;
      if (session === null) {
        updateStatus('error');
        optionsRef.current.setError(t('errors.session'));
        scheduleReconnect();
        return;
      }
      const socketResult = Result.try(() => new WebSocket(runtime.websocketUrl));
      if (socketResult.isErr()) {
        scheduleReconnect();
        return;
      }
      const socket = socketResult.value;
      socket.binaryType = 'arraybuffer';
      runtime.socket = socket;
      runtime.revision = { baselineAccepted: false, revision: runtime.revision.revision };
      socket.onopen = () => {
        if (disposed || runtime.socket !== socket) return;
        if (
          !send(
            encodeWatchPartyConnectEnvelope(session.authToken, session.viewer?.playerId, runtime.outgoingSequence++),
          )
        ) {
          scheduleReconnect();
        }
      };
      socket.onmessage = (event: MessageEvent<ArrayBuffer>) => {
        if (!disposed && runtime.socket === socket) handleEnvelope(event.data);
      };
      socket.onerror = () => {
        if (!disposed && runtime.socket === socket) updateStatus('reconnecting');
      };
      socket.onclose = () => {
        if (disposed || runtime.socket !== socket) return;
        runtime.socket = null;
        scheduleReconnect();
      };
    }

    void connect();
    const driftId = window.setInterval(applyPlayback, 1000);
    return () => {
      disposed = true;
      sessionAbort.abort();
      mapAbortRef.current?.abort();
      hostSetAbortRef.current?.abort();
      window.clearInterval(driftId);
      window.clearTimeout(runtime.reconnectId);
      closeSocket();
      runtime.mapLoadGeneration++;
      optionsRef.current.transport.setPlaybackRate(1);
      optionsRef.current.transport.pause();
      optionsRef.current.sources.clearSource();
      pendingHostMapKeyRef.current = '';
      if (runtimeRef.current === runtime) runtimeRef.current = null;
    };
  }, [applyPlayback, ensureAuthoritativeMap, options.partyPlayerId, t]);

  const sendChatMessage = useCallback((text: string) => {
    const runtime = runtimeRef.current;
    const socket = runtime?.socket;
    const message = text.trim();
    if (
      runtime === null ||
      socket?.readyState !== WebSocket.OPEN ||
      runtime.connectionId === '' ||
      runtime.matchId === '' ||
      runtime.selfCapabilities?.canChat !== true ||
      message === ''
    )
      return false;
    const messageId = crypto.randomUUID();
    const sent = Result.try(() => {
      socket.send(
        encodeChatEnvelope(runtime.matchId, message, runtime.outgoingSequence++, runtime.connectionId, messageId),
      );
    });
    if (sent.isErr()) return false;
    runtime.pendingChatMessageIds.push(messageId);
    const lastSequence = runtime.messages.at(-1)?.roomSequence ?? 0n;
    const optimistic = create(LiveChatMessageSchema, {
      messageId,
      matchId: runtime.matchId,
      senderConnectionId: runtime.connectionId,
      senderPlayerId: runtime.session?.viewer?.playerId ?? '',
      senderDisplayName: runtime.session?.viewer?.displayName ?? '',
      kind: LiveChatMessageKind.CHAT,
      text: message,
      createdAtUnixMs: BigInt(Date.now()),
      roomSequence: lastSequence + 1n,
    });
    runtime.messages = upsertChatMessage(
      runtime.messages,
      optimistic,
      retainedChatMessages + runtime.pendingChatMessageIds.length,
    );
    setView((current) => ({
      ...current,
      chatError: false,
      messages: runtime.messages,
      pendingChatMessageIds: [...runtime.pendingChatMessageIds],
    }));
    return true;
  }, []);

  const setMap = useCallback(
    async (input: string) => {
      const runtime = runtimeRef.current;
      if (runtime?.selfCapabilities?.host !== true || hostMapLoading) return false;
      const beatSaverId = input.trim();
      if (!isWatchPartyBeatSaverId(beatSaverId)) {
        optionsRef.current.setError(t('errors.invalidMapId'));
        return false;
      }
      const abort = new AbortController();
      hostSetAbortRef.current?.abort();
      hostSetAbortRef.current = abort;
      runtime.mapLoadGeneration++;
      runtime.mapLoadingKey = '';
      runtime.mapReadyKey = '';
      setMapReady(false);
      setHostMapLoading(true);
      setView((current) => ({ ...current, status: 'loading' }));
      const loaded = await optionsRef.current.sources.loadWatchPartyMapById(beatSaverId, abort.signal);
      if (abort.signal.aborted) return false;
      if (loaded.isErr()) {
        setHostMapLoading(false);
        optionsRef.current.setError(t('errors.mapLoad'));
        void ensureAuthoritativeMap();
        return false;
      }
      if (loaded.value === null) return false;
      const row = selectWatchPartySetRow(loaded.value.rows);
      if (row?.infoDifficulty === undefined) {
        setHostMapLoading(false);
        optionsRef.current.setError(t('errors.noPlayableDifficulty'));
        void ensureAuthoritativeMap();
        return false;
      }
      const map = create(WatchPartyMapSchema, {
        beatSaverId: loaded.value.identity.key,
        hash: loaded.value.identity.hash,
        characteristic: row.infoDifficulty.characteristic,
        difficulty: row.infoDifficulty.difficulty,
      });
      const mapKey = watchPartyMapKey(map);
      if (runtime.state?.map !== undefined && watchPartyMapKey(runtime.state.map) === mapKey) {
        setHostMapLoading(false);
        void ensureAuthoritativeMap();
      } else pendingHostMapKeyRef.current = mapKey;
      const sent = sendRuntimeEnvelope(runtime, (sequence, connectionId) =>
        encodeSetWatchPartyMapEnvelope(map, sequence, connectionId),
      );
      if (!sent) {
        pendingHostMapKeyRef.current = '';
        setHostMapLoading(false);
        optionsRef.current.setError(t('errors.action'));
        void ensureAuthoritativeMap();
      }
      return sent;
    },
    [ensureAuthoritativeMap, hostMapLoading, t],
  );

  const clearMap = useCallback(() => {
    const runtime = runtimeRef.current;
    if (runtime?.selfCapabilities?.host !== true) return false;
    const sent = sendRuntimeEnvelope(runtime, encodeClearWatchPartyMapEnvelope);
    if (!sent) optionsRef.current.setError(t('errors.action'));
    return sent;
  }, [t]);

  const setPlaybackState = useCallback(
    (playbackState: WatchPartyPlaybackState) => {
      const runtime = runtimeRef.current;
      if (runtime?.selfCapabilities?.host !== true) return false;
      const sent = sendRuntimeEnvelope(runtime, (sequence, connectionId) =>
        encodeSetWatchPartyPlaybackStateEnvelope(playbackState, sequence, connectionId),
      );
      if (!sent) optionsRef.current.setError(t('errors.action'));
      return sent;
    },
    [t],
  );

  const setViewerSettings = useCallback(
    (json: string) => {
      const runtime = runtimeRef.current;
      if (runtime?.selfCapabilities?.host !== true) return false;
      const viewerSettings = create(WatchPartyViewerSettingsSchema, { schemaVersion: 1, json });
      const sent = sendRuntimeEnvelope(runtime, (sequence, connectionId) =>
        encodeSetWatchPartyViewerSettingsEnvelope(viewerSettings, sequence, connectionId),
      );
      if (!sent) optionsRef.current.setError(t('errors.action'));
      return sent;
    },
    [t],
  );

  const muteParticipant = useCallback(
    (connectionId: string) => {
      const runtime = runtimeRef.current;
      if (runtime?.selfCapabilities?.canModerate !== true) return false;
      const sent = sendRuntimeEnvelope(runtime, (sequence, ownConnectionId) =>
        encodeMuteWatchPartyParticipantEnvelope(connectionId, sequence, ownConnectionId),
      );
      if (!sent) optionsRef.current.setError(t('errors.action'));
      return sent;
    },
    [t],
  );

  const unmuteParticipant = useCallback(
    (connectionId: string) => {
      const runtime = runtimeRef.current;
      if (runtime?.selfCapabilities?.canModerate !== true) return false;
      const sent = sendRuntimeEnvelope(runtime, (sequence, ownConnectionId) =>
        encodeUnmuteWatchPartyParticipantEnvelope(connectionId, sequence, ownConnectionId),
      );
      if (!sent) optionsRef.current.setError(t('errors.action'));
      return sent;
    },
    [t],
  );

  const retryMap = useCallback(() => {
    const runtime = runtimeRef.current;
    if (runtime === null) return;
    runtime.mapLoadingKey = '';
    void ensureAuthoritativeMap();
  }, [ensureAuthoritativeMap]);

  const unlockAudio = useCallback(async () => {
    const unlocked = await optionsRef.current.transport.unlockAudio();
    if (unlocked) applyPlayback();
    return unlocked;
  }, [applyPlayback]);

  const connected = runtimeRef.current?.socket?.readyState === WebSocket.OPEN && runtimeRef.current.connectionId !== '';
  const canChat = connected && view.selfCapabilities?.canChat === true;
  const canRetryMap = mapLoadFailed && view.serverState?.map !== undefined && runtimeRef.current?.mapLoadingKey === '';

  return {
    ...view,
    audioBlocked: options.transport.audioBlocked,
    canChat,
    canRetryMap,
    connected,
    hostMapLoading,
    mapReady,
    clearMap,
    muteParticipant,
    pause: () => setPlaybackState(WatchPartyPlaybackState.PAUSED),
    retryMap,
    sendChatMessage,
    setMap,
    setViewerSettings,
    start: () => setPlaybackState(WatchPartyPlaybackState.PLAYING),
    stop: () => setPlaybackState(WatchPartyPlaybackState.STOPPED),
    unlockAudio,
    unmuteParticipant,
  };
}

export type WatchPartyExperience = ReturnType<typeof useWatchPartyExperience>;

function sendRuntimeEnvelope(
  runtime: WatchPartyRuntime,
  encode: (sequence: bigint, connectionId: string) => Uint8Array,
) {
  const socket = runtime.socket;
  if (socket?.readyState !== WebSocket.OPEN || runtime.connectionId === '') return false;
  return Result.try(() => {
    socket.send(encode(runtime.outgoingSequence++, runtime.connectionId));
  }).isOk();
}
