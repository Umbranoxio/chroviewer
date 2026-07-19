import { useRef, useState, type Dispatch, type SetStateAction } from 'react';

import { Result } from 'better-result';

import type { Replay } from '../../core/replay/types';
import type { ViewerSettings } from '../../core/viewer-settings';
import { fetchBeatSaverHash, fetchBeatSaverMap } from '../../sources/beatsaver/provider';
import type { DownloadProgress, MapLookup } from '../../sources/source-types';
import { LiveMapCache } from '../live/live-map-cache';
import { useViewerFileSource } from './use-viewer-file-source';
import { useViewerRemoteSource } from './use-viewer-remote-source';

interface UseViewerSourcesOptions {
  setError: (message: string) => void;
  setSettings: Dispatch<SetStateAction<ViewerSettings>>;
  onClearViewer: () => void;
  onMapLoaded: () => void;
}

export function useViewerSources({ setError, setSettings, onClearViewer, onMapLoaded }: UseViewerSourcesOptions) {
  const [sourceChoices, setSourceChoices] = useState<MapLookup[]>([]);
  const [liveDownloadProgress, setLiveDownloadProgress] = useState<DownloadProgress>(null);
  const liveMapCache = useRef(new LiveMapCache());
  const files = useViewerFileSource({
    setError,
    onClearViewer,
    onMapLoaded,
    onSourceLoaded: () => {
      setSourceChoices([]);
    },
  });
  const remote = useViewerRemoteSource({
    beginSourceRequest: files.beginSourceRequest,
    isSourceRequestCurrent: files.isSourceRequestCurrent,
    mapIdentity: files.mapIdentity,
    loadSourceFiles: files.loadSourceFiles,
    parseReplay: files.parseReplay,
    pendingSharedViewRef: files.pendingSharedViewRef,
    setError,
    setSettings,
    setSourceChoices,
  });

  return {
    audioDataRef: files.audioDataRef,
    clearSource: files.clearSource,
    coverUrl: files.coverUrl,
    hasLiveMap(hash: string) {
      return liveMapCache.current.has(hash);
    },
    loadFiles(selectedFiles: File[]) {
      return files.loadFiles(selectedFiles, remote.resolveReplayMap);
    },
    loadLookup: remote.loadLookup,
    async loadLiveReplay(hash: string, replay: Replay) {
      const requestId = files.beginSourceRequest();
      files.pendingSharedViewRef.current = {};
      const cached = liveMapCache.current.get(hash);
      if (cached !== undefined) {
        setLiveDownloadProgress(null);
        const loaded = await files.loadSourceFiles(requestId, cached.files, replay, {
          identity: { key: cached.key, hash: cached.hash },
        });
        return loaded.isErr() ? Result.err(loaded.error) : Result.ok(undefined);
      }
      setLiveDownloadProgress(null);
      const source = await fetchBeatSaverHash(hash, {
        onProgress(progress) {
          if (files.isSourceRequestCurrent(requestId)) setLiveDownloadProgress(progress);
        },
      });
      if (!files.isSourceRequestCurrent(requestId)) return Result.ok(undefined);
      if (source.isErr()) return Result.err(source.error);
      const loaded = await files.loadSourceFiles(requestId, source.value.files, replay, {
        identity: { key: source.value.key, hash: source.value.hash },
      });
      if (loaded.isErr()) return Result.err(loaded.error);
      if (files.isSourceRequestCurrent(requestId)) liveMapCache.current.set(source.value);
      return Result.ok(undefined);
    },
    async loadWatchPartyMapByHash(hash: string, signal?: AbortSignal) {
      const requestId = files.beginSourceRequest();
      files.pendingSharedViewRef.current = null;
      setLiveDownloadProgress(null);
      const source = await fetchBeatSaverHash(hash, {
        onProgress(progress) {
          if (files.isSourceRequestCurrent(requestId)) setLiveDownloadProgress(progress);
        },
        signal,
      });
      if (!files.isSourceRequestCurrent(requestId)) return Result.ok(null);
      if (source.isErr()) return Result.err(source.error);
      const loaded = await files.loadSourceFiles(requestId, source.value.files, null, {
        identity: { key: source.value.key, hash: source.value.hash },
      });
      if (loaded.isErr()) return Result.err(loaded.error);
      if (!files.isSourceRequestCurrent(requestId)) return Result.ok(null);
      liveMapCache.current.set(source.value);
      return Result.ok({ identity: { key: source.value.key, hash: source.value.hash }, rows: loaded.value });
    },
    async loadWatchPartyMapById(input: string, signal?: AbortSignal) {
      const requestId = files.beginSourceRequest();
      files.pendingSharedViewRef.current = null;
      setLiveDownloadProgress(null);
      const source = await fetchBeatSaverMap(input, {
        onProgress(progress) {
          if (files.isSourceRequestCurrent(requestId)) setLiveDownloadProgress(progress);
        },
        signal,
      });
      if (!files.isSourceRequestCurrent(requestId)) return Result.ok(null);
      if (source.isErr()) return Result.err(source.error);
      const loaded = await files.loadSourceFiles(requestId, source.value.files, null, {
        identity: { key: source.value.key, hash: source.value.hash },
      });
      if (loaded.isErr()) return Result.err(loaded.error);
      if (!files.isSourceRequestCurrent(requestId)) return Result.ok(null);
      liveMapCache.current.set(source.value);
      return Result.ok({ identity: { key: source.value.key, hash: source.value.hash }, rows: loaded.value });
    },
    loadSource: remote.loadSource,
    liveDownloadProgress,
    mapIdentity: files.mapIdentity,
    mapMeta: files.mapMeta,
    pendingSharedViewRef: files.pendingSharedViewRef,
    replayPlayer: files.replayPlayer,
    replayRef: files.replayRef,
    rows: files.rows,
    scoreSaberLeaderboards: remote.scoreSaberLeaderboards,
    shareScoreId: files.shareScoreId,
    songBpm: files.songBpm,
    sourceLink: files.sourceLink,
    sourceChoices,
    sourceInput: remote.sourceInput,
    sourceDownload: remote.sourceDownload,
    sourceLoading: remote.sourceLoading,
    setSourceInput: remote.setSourceInput,
  };
}
