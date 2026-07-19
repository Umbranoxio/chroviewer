import { useEffect, useRef, useState, type Dispatch, type RefObject, type SetStateAction } from 'react';

import { skipToken, useMutation, useQuery } from '@tanstack/react-query';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { Result } from 'better-result';
import { useTranslations } from 'use-intl';

import { applyLegacyScoreSaberMetadata, isScoreSaberReplay } from '../../core/replay/parse-scoresaber';
import type { Replay } from '../../core/replay/types';
import { replayMapHash } from '../../core/replay/types';
import { applySharedViewerSettings } from '../../core/share-link';
import type { ViewerSettings } from '../../core/viewer-settings';
import { extractMapArchive } from '../../sources/archive';
import { fetchBeatSaverHash, fetchBeatSaverMap } from '../../sources/beatsaver/provider';
import { requestArrayBuffer } from '../../sources/http';
import {
  fetchScoreSaberLeaderboards,
  fetchScoreSaberReplayFile,
  fetchScoreSaberReplayMetadata,
  lookupScoreSaber,
  scoreSaberReference,
} from '../../sources/scoresaber/provider';
import { SourceError } from '../../sources/source-error';
import type {
  DownloadProgress,
  MapLookup,
  MapSourceFile,
  ScoreSaberLeaderboard,
  SourceResult,
} from '../../sources/source-types';
import { sourceErrorMessage } from './source-error-message';
import type { LoadedSourceContext, PendingSharedView } from './use-viewer-file-source';
import { isRemoteSourceUrl } from './viewer-search';
import type { DifficultyRow, MapIdentity, ViewerSource, ViewerSourceLink } from './viewer-types';

type RemoteSourceCommand = { requestId: number } & (
  | { type: 'lookup'; lookup: MapLookup }
  | { type: 'input'; input: string; source: ViewerSource }
  | { type: 'shared-map'; mapSource: string }
  | { type: 'shared-replay'; replayUrl: string; beat?: number; autoplay?: boolean }
  | { type: 'shared-score'; scoreId: string; beat?: number; autoplay?: boolean }
);

export interface SourceDownload {
  kind: ViewerSource | 'replay';
  progress: DownloadProgress;
}

function sourceDownloadUrl(value: string) {
  return new URL(value).protocol === 'https:' ? `/api/source?${new URLSearchParams({ url: value }).toString()}` : value;
}

interface UseViewerRemoteSourceOptions {
  beginSourceRequest: () => number;
  isSourceRequestCurrent: (requestId: number) => boolean;
  mapIdentity: MapIdentity | null;
  loadSourceFiles: (
    requestId: number,
    files: MapSourceFile[],
    replay?: Replay | null,
    context?: LoadedSourceContext,
  ) => Promise<SourceResult<DifficultyRow[]>>;
  parseReplay: (data: ArrayBuffer, source?: SourceError['source']) => Promise<SourceResult<Replay>>;
  pendingSharedViewRef: RefObject<PendingSharedView | null>;
  setError: (message: string) => void;
  setSettings: Dispatch<SetStateAction<ViewerSettings>>;
  setSourceChoices: Dispatch<SetStateAction<MapLookup[]>>;
}

export function useViewerRemoteSource({
  beginSourceRequest,
  isSourceRequestCurrent,
  mapIdentity,
  loadSourceFiles,
  parseReplay,
  pendingSharedViewRef,
  setError,
  setSettings,
  setSourceChoices,
}: UseViewerRemoteSourceOptions) {
  const t = useTranslations('viewer');
  const sourceT = useTranslations('source');
  const navigate = useNavigate({ from: '/' });
  const search = useSearch({ from: '/' });
  const startupRef = useRef(false);
  const [sourceInput, setSourceInput] = useState('');
  const [sourceDownload, setSourceDownload] = useState<SourceDownload | null>(null);

  function downloadOptions(kind: SourceDownload['kind'], requestId: number) {
    if (isSourceRequestCurrent(requestId)) setSourceDownload({ kind, progress: null });
    return {
      onProgress: (progress: DownloadProgress) => {
        if (isSourceRequestCurrent(requestId)) setSourceDownload({ kind, progress });
      },
    };
  }

  async function loadLookupSource(requestId: number, lookup: MapLookup) {
    return Result.gen(async function* () {
      const source = yield* Result.await(fetchBeatSaverHash(lookup.hash, downloadOptions('beatsaver', requestId)));
      if (!isSourceRequestCurrent(requestId)) return Result.ok(undefined);
      pendingSharedViewRef.current = {};
      yield* Result.await(
        loadSourceFiles(requestId, source.files, null, { identity: { key: source.key, hash: source.hash } }),
      );
      return Result.ok(undefined);
    });
  }

  async function loadScoreSaberScore(
    requestId: number,
    scoreId: string,
    pending: { beat?: number; autoplay?: boolean } = {},
  ) {
    return Result.gen(async function* () {
      const metadataPromise = fetchScoreSaberReplayMetadata(scoreId, downloadOptions('scoresaber', requestId));
      const initialReplayPromise = fetchScoreSaberReplayFile(scoreId, downloadOptions('scoresaber', requestId));
      const source = yield* Result.await(metadataPromise);
      if (!isSourceRequestCurrent(requestId)) return Result.ok(undefined);
      const replayFilePromise =
        source.scoreId === scoreId
          ? initialReplayPromise
          : fetchScoreSaberReplayFile(source.scoreId, downloadOptions('scoresaber', requestId));
      const [replayResult, mapResult] = await Promise.all([
        replayFilePromise.then((result) =>
          result.isErr() ? Result.err(result.error) : parseReplay(result.value, 'scoresaber'),
        ),
        fetchBeatSaverHash(source.hash, downloadOptions('beatsaver', requestId)),
      ]);
      if (!isSourceRequestCurrent(requestId)) return Result.ok(undefined);
      const replay = yield* replayResult;
      const map = yield* mapResult;
      if (!isSourceRequestCurrent(requestId)) return Result.ok(undefined);
      applyLegacyScoreSaberMetadata(replay, source);
      const replayHash = replayMapHash(replay);
      if (replayHash?.toLowerCase() !== source.hash.toLowerCase()) {
        return Result.err(
          new SourceError({
            message: t('errors.replayMapMismatch'),
            source: 'scoresaber',
            operation: 'validate-replay-map',
          }),
        );
      }
      if (
        replay.metadata.difficulty !== source.difficulty ||
        replay.metadata.characteristic.toLowerCase() !== source.characteristic.toLowerCase()
      ) {
        return Result.err(
          new SourceError({
            message: t('errors.replayDifficultyMismatch'),
            source: 'scoresaber',
            operation: 'validate-replay-difficulty',
          }),
        );
      }
      pendingSharedViewRef.current = pending;
      yield* Result.await(
        loadSourceFiles(requestId, map.files, replay, {
          identity: { key: map.key, hash: map.hash },
          scoreId: source.scoreId,
          player: source.player,
        }),
      );
      return Result.ok(undefined);
    });
  }

  async function loadReplayData(
    requestId: number,
    data: ArrayBuffer,
    pending: { beat?: number; autoplay?: boolean } = {},
    sourceLink?: ViewerSourceLink,
  ) {
    return Result.gen(async function* () {
      const replay = yield* Result.await(parseReplay(data));
      if (!isSourceRequestCurrent(requestId)) return Result.ok(undefined);
      const hash = replayMapHash(replay);
      if (hash === null) {
        return Result.err(
          new SourceError({
            message: t('errors.replayMissingHash'),
            source: 'local',
            operation: 'validate-replay-map',
          }),
        );
      }
      const map = yield* Result.await(fetchBeatSaverHash(hash, downloadOptions('beatsaver', requestId)));
      if (!isSourceRequestCurrent(requestId)) return Result.ok(undefined);
      pendingSharedViewRef.current = pending;
      yield* Result.await(
        loadSourceFiles(requestId, map.files, replay, {
          identity: { key: map.key, hash: map.hash },
          sourceLink,
        }),
      );
      return Result.ok(undefined);
    });
  }

  async function loadReplayUrl(
    requestId: number,
    replayUrl: string,
    pending: { beat?: number; autoplay?: boolean } = {},
  ) {
    return Result.gen(async function* () {
      const data = yield* Result.await(
        requestArrayBuffer(sourceDownloadUrl(replayUrl), {
          source: 'local',
          label: 'Replay',
          operation: 'download-replay',
          ...downloadOptions('replay', requestId),
        }),
      );
      if (!isSourceRequestCurrent(requestId)) return Result.ok(undefined);
      yield* Result.await(loadReplayData(requestId, data, pending, { type: 'replay', url: replayUrl }));
      return Result.ok(undefined);
    });
  }

  async function loadMapUrl(requestId: number, mapUrl: string) {
    return Result.gen(async function* () {
      const data = yield* Result.await(
        requestArrayBuffer(sourceDownloadUrl(mapUrl), {
          source: 'local',
          label: 'Map',
          operation: 'download-map',
          ...downloadOptions('link', requestId),
        }),
      );
      if (!isSourceRequestCurrent(requestId)) return Result.ok(undefined);
      const files = yield* Result.await(extractMapArchive(new Uint8Array(data)));
      if (!isSourceRequestCurrent(requestId)) return Result.ok(undefined);
      yield* Result.await(loadSourceFiles(requestId, files, null, { sourceLink: { type: 'map', url: mapUrl } }));
      return Result.ok(undefined);
    });
  }

  async function loadSharedMap(requestId: number, mapSource: string) {
    if (isRemoteSourceUrl(mapSource)) return loadMapUrl(requestId, mapSource);
    return Result.gen(async function* () {
      const source = yield* Result.await(fetchBeatSaverMap(mapSource, downloadOptions('beatsaver', requestId)));
      if (!isSourceRequestCurrent(requestId)) return Result.ok(undefined);
      yield* Result.await(
        loadSourceFiles(requestId, source.files, null, { identity: { key: source.key, hash: source.hash } }),
      );
      return Result.ok(undefined);
    });
  }

  async function loadLink(requestId: number, link: string) {
    const linkUrl = link.trim();
    if (!isRemoteSourceUrl(linkUrl)) {
      return Result.err(
        new SourceError({
          message: sourceT('invalidLink'),
          source: 'local',
          operation: 'parse-link',
        }),
      );
    }
    return Result.gen(async function* () {
      const replayByName = new URL(linkUrl).pathname.toLowerCase().endsWith('.dat');
      const data = yield* Result.await(
        requestArrayBuffer(sourceDownloadUrl(linkUrl), {
          source: 'local',
          label: 'Link',
          operation: 'download-link',
          ...downloadOptions(replayByName ? 'replay' : 'link', requestId),
        }),
      );
      if (!isSourceRequestCurrent(requestId)) return Result.ok(undefined);
      if (isScoreSaberReplay(new Uint8Array(data))) {
        yield* Result.await(loadReplayData(requestId, data, {}, { type: 'replay', url: linkUrl }));
        if (isSourceRequestCurrent(requestId)) {
          await navigate({ to: '/', search: { replayUrl: linkUrl }, replace: true });
        }
        return Result.ok(undefined);
      }
      const files = yield* Result.await(extractMapArchive(new Uint8Array(data)));
      if (!isSourceRequestCurrent(requestId)) return Result.ok(undefined);
      pendingSharedViewRef.current = {};
      yield* Result.await(loadSourceFiles(requestId, files, null, { sourceLink: { type: 'map', url: linkUrl } }));
      if (isSourceRequestCurrent(requestId)) await navigate({ to: '/', search: { map: linkUrl }, replace: true });
      return Result.ok(undefined);
    });
  }

  async function loadSourceInput(requestId: number, input: string, sourceType: ViewerSource) {
    return Result.gen(async function* () {
      if (sourceType === 'link') {
        yield* Result.await(loadLink(requestId, input));
        return Result.ok(undefined);
      }
      if (sourceType === 'scoresaber') {
        const scoreId = input.trim();
        if (!/^\d+$/.test(scoreId)) {
          return Result.err(
            new SourceError({
              message: sourceT('invalidScoreId'),
              source: 'scoresaber',
              operation: 'parse-score-id',
            }),
          );
        }
        yield* Result.await(loadScoreSaberScore(requestId, scoreId));
        return Result.ok(undefined);
      }
      const scoreSaber = scoreSaberReference(input);
      if (scoreSaber?.kind === 'score') {
        yield* Result.await(loadScoreSaberScore(requestId, scoreSaber.id));
        return Result.ok(undefined);
      }
      if (scoreSaber !== null) {
        const choices = yield* Result.await(lookupScoreSaber(input));
        if (!isSourceRequestCurrent(requestId)) return Result.ok(undefined);
        if (choices.length !== 1 || choices[0] === undefined) {
          setSourceChoices(choices);
          return Result.ok(undefined);
        }
        yield* Result.await(loadLookupSource(requestId, choices[0]));
        return Result.ok(undefined);
      }
      const source = yield* Result.await(fetchBeatSaverMap(input, downloadOptions('beatsaver', requestId)));
      if (!isSourceRequestCurrent(requestId)) return Result.ok(undefined);
      pendingSharedViewRef.current = {};
      yield* Result.await(
        loadSourceFiles(requestId, source.files, null, { identity: { key: source.key, hash: source.hash } }),
      );
      if (isSourceRequestCurrent(requestId)) await navigate({ to: '/', search: { map: source.key }, replace: true });
      return Result.ok(undefined);
    });
  }

  async function runRemoteSourceCommand(command: RemoteSourceCommand) {
    switch (command.type) {
      case 'lookup':
        return loadLookupSource(command.requestId, command.lookup);
      case 'input':
        return loadSourceInput(command.requestId, command.input, command.source);
      case 'shared-map':
        return loadSharedMap(command.requestId, command.mapSource);
      case 'shared-replay':
        return loadReplayUrl(command.requestId, command.replayUrl, {
          beat: command.beat,
          autoplay: command.autoplay,
        });
      case 'shared-score':
        return loadScoreSaberScore(command.requestId, command.scoreId, {
          beat: command.beat,
          autoplay: command.autoplay,
        });
    }
  }

  const sourceMutation = useMutation({
    mutationFn: async (command: RemoteSourceCommand) => {
      const result = await runRemoteSourceCommand(command);
      if (result.isErr()) throw result.error;
    },
    onMutate: (command) => {
      if (isSourceRequestCurrent(command.requestId)) setError('');
    },
    onError: (error: SourceError, command) => {
      if (!isSourceRequestCurrent(command.requestId)) return;
      pendingSharedViewRef.current = null;
      setError(sourceErrorMessage(error, t('errors.failedSource'), t('errors.missingInfo')));
    },
    onSettled: (_data, _error, command) => {
      if (isSourceRequestCurrent(command.requestId)) setSourceDownload(null);
    },
  });

  const mapHash = mapIdentity?.hash;
  const { data: scoreSaberLeaderboards = [] } = useQuery({
    queryKey: ['scoresaber', 'leaderboards', mapHash],
    queryFn:
      mapHash === undefined
        ? skipToken
        : async ({ signal }): Promise<ScoreSaberLeaderboard[]> => {
            const result = await fetchScoreSaberLeaderboards(mapHash, { signal });
            if (result.isErr()) throw result.error;
            return result.value;
          },
  });

  function loadLookup(lookup: MapLookup) {
    const requestId = beginSourceRequest();
    pendingSharedViewRef.current = null;
    sourceMutation.mutate({ type: 'lookup', lookup, requestId });
  }

  function loadSource(source: ViewerSource) {
    const requestId = beginSourceRequest();
    pendingSharedViewRef.current = null;
    sourceMutation.mutate({ type: 'input', input: sourceInput, source, requestId });
  }

  useEffect(() => {
    if (startupRef.current) return;
    startupRef.current = true;
    if (search.replayUrl !== undefined) {
      const requestId = beginSourceRequest();
      const sharedSettings = search.settings;
      if (sharedSettings !== undefined) {
        setSettings((current) => applySharedViewerSettings(current, sharedSettings));
      }
      setSourceInput(search.replayUrl);
      sourceMutation.mutate({
        type: 'shared-replay',
        replayUrl: search.replayUrl,
        beat: search.beat,
        autoplay: search.autoplay,
        requestId,
      });
      return;
    }
    if (search.scoreId !== undefined) {
      const requestId = beginSourceRequest();
      const sharedSettings = search.settings;
      if (sharedSettings !== undefined) {
        setSettings((current) => applySharedViewerSettings(current, sharedSettings));
      }
      setSourceInput(`scoresaber:${search.scoreId}`);
      sourceMutation.mutate({
        type: 'shared-score',
        scoreId: search.scoreId,
        beat: search.beat,
        autoplay: search.autoplay,
        requestId,
      });
      return;
    }
    if (search.map === undefined) return;
    const requestId = beginSourceRequest();
    const sharedSettings = search.settings;
    if (sharedSettings !== undefined) {
      setSettings((current) => applySharedViewerSettings(current, sharedSettings));
    }
    pendingSharedViewRef.current = {
      autoplay: search.autoplay,
      difficultyIndex: search.difficulty,
      beat: search.beat,
    };
    setSourceInput(search.map);
    sourceMutation.mutate({ type: 'shared-map', mapSource: search.map, requestId });
  }, []);

  return {
    loadLookup,
    loadSource,
    resolveReplayMap: fetchBeatSaverHash,
    scoreSaberLeaderboards,
    sourceInput,
    sourceDownload,
    sourceLoading: sourceMutation.isPending && mapIdentity === null,
    setSourceInput,
  };
}
