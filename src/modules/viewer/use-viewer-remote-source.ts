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
import type { MapIdentity, ViewerSource, ViewerSourceLink } from './viewer-types';

type RemoteSourceCommand =
  | { type: 'lookup'; lookup: MapLookup }
  | { type: 'input'; input: string; source: ViewerSource }
  | { type: 'shared-map'; mapSource: string }
  | { type: 'shared-replay'; replayUrl: string; beat?: number; autoplay?: boolean }
  | { type: 'shared-score'; scoreId: string; beat?: number; autoplay?: boolean };

export interface SourceDownload {
  kind: ViewerSource | 'replay';
  progress: DownloadProgress;
}

function sourceDownloadUrl(value: string) {
  return new URL(value).protocol === 'https:' ? `/api/source?${new URLSearchParams({ url: value }).toString()}` : value;
}

interface UseViewerRemoteSourceOptions {
  mapIdentity: MapIdentity | null;
  loadSourceFiles: (
    files: MapSourceFile[],
    replay?: Replay | null,
    context?: LoadedSourceContext,
  ) => Promise<SourceResult<void>>;
  parseReplay: (data: ArrayBuffer, source?: SourceError['source']) => Promise<SourceResult<Replay>>;
  pendingSharedViewRef: RefObject<PendingSharedView | null>;
  setError: (message: string) => void;
  setSettings: Dispatch<SetStateAction<ViewerSettings>>;
  setSourceChoices: Dispatch<SetStateAction<MapLookup[]>>;
}

export function useViewerRemoteSource({
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

  function downloadOptions(kind: SourceDownload['kind']) {
    setSourceDownload({ kind, progress: null });
    return {
      onProgress: (progress: DownloadProgress) => {
        setSourceDownload({ kind, progress });
      },
    };
  }

  async function loadLookupSource(lookup: MapLookup) {
    return Result.gen(async function* () {
      const source = yield* Result.await(fetchBeatSaverHash(lookup.hash, downloadOptions('beatsaver')));
      pendingSharedViewRef.current = {};
      yield* Result.await(loadSourceFiles(source.files, null, { identity: { key: source.key, hash: source.hash } }));
      return Result.ok(undefined);
    });
  }

  async function loadScoreSaberScore(scoreId: string, pending: { beat?: number; autoplay?: boolean } = {}) {
    return Result.gen(async function* () {
      const metadataPromise = fetchScoreSaberReplayMetadata(scoreId, downloadOptions('scoresaber'));
      const initialReplayPromise = fetchScoreSaberReplayFile(scoreId, downloadOptions('scoresaber'));
      const source = yield* Result.await(metadataPromise);
      const replayFilePromise =
        source.scoreId === scoreId
          ? initialReplayPromise
          : fetchScoreSaberReplayFile(source.scoreId, downloadOptions('scoresaber'));
      const [replayResult, mapResult] = await Promise.all([
        replayFilePromise.then((result) =>
          result.isErr() ? Result.err(result.error) : parseReplay(result.value, 'scoresaber'),
        ),
        fetchBeatSaverHash(source.hash, downloadOptions('beatsaver')),
      ]);
      const replay = yield* replayResult;
      const map = yield* mapResult;
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
        loadSourceFiles(map.files, replay, {
          identity: { key: map.key, hash: map.hash },
          scoreId: source.scoreId,
          player: source.player,
        }),
      );
      return Result.ok(undefined);
    });
  }

  async function loadReplayData(
    data: ArrayBuffer,
    pending: { beat?: number; autoplay?: boolean } = {},
    sourceLink?: ViewerSourceLink,
  ) {
    return Result.gen(async function* () {
      const replay = yield* Result.await(parseReplay(data));
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
      const map = yield* Result.await(fetchBeatSaverHash(hash, downloadOptions('beatsaver')));
      pendingSharedViewRef.current = pending;
      yield* Result.await(
        loadSourceFiles(map.files, replay, {
          identity: { key: map.key, hash: map.hash },
          sourceLink,
        }),
      );
      return Result.ok(undefined);
    });
  }

  async function loadReplayUrl(replayUrl: string, pending: { beat?: number; autoplay?: boolean } = {}) {
    return Result.gen(async function* () {
      const data = yield* Result.await(
        requestArrayBuffer(sourceDownloadUrl(replayUrl), {
          source: 'local',
          label: 'Replay',
          operation: 'download-replay',
          ...downloadOptions('replay'),
        }),
      );
      yield* Result.await(loadReplayData(data, pending, { type: 'replay', url: replayUrl }));
      return Result.ok(undefined);
    });
  }

  async function loadMapUrl(mapUrl: string) {
    return Result.gen(async function* () {
      const data = yield* Result.await(
        requestArrayBuffer(sourceDownloadUrl(mapUrl), {
          source: 'local',
          label: 'Map',
          operation: 'download-map',
          ...downloadOptions('link'),
        }),
      );
      const files = yield* Result.await(extractMapArchive(new Uint8Array(data)));
      yield* Result.await(loadSourceFiles(files, null, { sourceLink: { type: 'map', url: mapUrl } }));
      return Result.ok(undefined);
    });
  }

  async function loadSharedMap(mapSource: string) {
    if (isRemoteSourceUrl(mapSource)) return loadMapUrl(mapSource);
    return Result.gen(async function* () {
      const source = yield* Result.await(fetchBeatSaverMap(mapSource, downloadOptions('beatsaver')));
      yield* Result.await(loadSourceFiles(source.files, null, { identity: { key: source.key, hash: source.hash } }));
      return Result.ok(undefined);
    });
  }

  async function loadLink(link: string) {
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
          ...downloadOptions(replayByName ? 'replay' : 'link'),
        }),
      );
      if (isScoreSaberReplay(new Uint8Array(data))) {
        yield* Result.await(loadReplayData(data, {}, { type: 'replay', url: linkUrl }));
        await navigate({ to: '/', search: { replayUrl: linkUrl }, replace: true });
        return Result.ok(undefined);
      }
      const files = yield* Result.await(extractMapArchive(new Uint8Array(data)));
      pendingSharedViewRef.current = {};
      yield* Result.await(loadSourceFiles(files, null, { sourceLink: { type: 'map', url: linkUrl } }));
      await navigate({ to: '/', search: { map: linkUrl }, replace: true });
      return Result.ok(undefined);
    });
  }

  async function loadSourceInput(input: string, sourceType: ViewerSource) {
    return Result.gen(async function* () {
      if (sourceType === 'link') {
        yield* Result.await(loadLink(input));
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
        yield* Result.await(loadScoreSaberScore(scoreId));
        return Result.ok(undefined);
      }
      const scoreSaber = scoreSaberReference(input);
      if (scoreSaber?.kind === 'score') {
        yield* Result.await(loadScoreSaberScore(scoreSaber.id));
        return Result.ok(undefined);
      }
      if (scoreSaber !== null) {
        const choices = yield* Result.await(lookupScoreSaber(input));
        if (choices.length !== 1 || choices[0] === undefined) {
          setSourceChoices(choices);
          return Result.ok(undefined);
        }
        yield* Result.await(loadLookupSource(choices[0]));
        return Result.ok(undefined);
      }
      const source = yield* Result.await(fetchBeatSaverMap(input, downloadOptions('beatsaver')));
      pendingSharedViewRef.current = {};
      yield* Result.await(loadSourceFiles(source.files, null, { identity: { key: source.key, hash: source.hash } }));
      await navigate({ to: '/', search: { map: source.key }, replace: true });
      return Result.ok(undefined);
    });
  }

  async function runRemoteSourceCommand(command: RemoteSourceCommand) {
    switch (command.type) {
      case 'lookup':
        return loadLookupSource(command.lookup);
      case 'input':
        return loadSourceInput(command.input, command.source);
      case 'shared-map':
        return loadSharedMap(command.mapSource);
      case 'shared-replay':
        return loadReplayUrl(command.replayUrl, { beat: command.beat, autoplay: command.autoplay });
      case 'shared-score':
        return loadScoreSaberScore(command.scoreId, { beat: command.beat, autoplay: command.autoplay });
    }
  }

  const sourceMutation = useMutation({
    mutationFn: async (command: RemoteSourceCommand) => {
      const result = await runRemoteSourceCommand(command);
      if (result.isErr()) throw result.error;
    },
    onMutate: () => {
      setError('');
    },
    onError: (error: SourceError) => {
      pendingSharedViewRef.current = null;
      setError(sourceErrorMessage(error, t('errors.failedSource'), t('errors.missingInfo')));
    },
    onSettled: () => {
      setSourceDownload(null);
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
    pendingSharedViewRef.current = null;
    sourceMutation.mutate({ type: 'lookup', lookup });
  }

  function loadSource(source: ViewerSource) {
    pendingSharedViewRef.current = null;
    sourceMutation.mutate({ type: 'input', input: sourceInput, source });
  }

  useEffect(() => {
    if (startupRef.current) return;
    startupRef.current = true;
    if (search.replayUrl !== undefined) {
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
      });
      return;
    }
    if (search.scoreId !== undefined) {
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
      });
      return;
    }
    if (search.map === undefined) return;
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
    sourceMutation.mutate({ type: 'shared-map', mapSource: search.map });
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
