import { useEffect, useRef, useState } from 'react';

import { Result } from 'better-result';
import { useTranslations } from 'use-intl';

import { BeatmapParser } from '../../core/beatmap/worker/client';
import { applyLegacyScoreSaberMetadata, isScoreSaberReplay } from '../../core/replay/parse-scoresaber';
import { replayMapHash, type Replay } from '../../core/replay/types';
import { extractMapArchive } from '../../sources/archive';
import { SourceError, sourceError } from '../../sources/source-error';
import type {
  BeatSaverMapSource,
  MapSourceFile,
  ScoreSaberReplayPlayer,
  SourceResult,
} from '../../sources/source-types';
import { parseMapPackage } from './parse-map-package';
import { sourceErrorMessage } from './source-error-message';
import type { DifficultyRow, MapIdentity, MapMeta } from './viewer-types';

export interface PendingSharedView {
  autoplay?: boolean;
  difficultyIndex?: number;
  beat?: number;
}

export interface LoadedSourceContext {
  identity?: MapIdentity;
  scoreId?: string;
  player?: ScoreSaberReplayPlayer;
}

interface UseViewerFileSourceOptions {
  setError: (message: string) => void;
  onClearViewer: () => void;
  onMapLoaded: () => void;
  onSourceLoaded: () => void;
}

const legacyDifficultyRanks: Record<string, number> = {
  easy: 1,
  normal: 3,
  hard: 5,
  expert: 7,
  expertplus: 9,
};

function legacyMetadataFromFilename(name: string) {
  const match = /-([^-]+)-([^-]+)-([0-9a-f]{40})\.dat$/i.exec(name);
  if (match === null) return null;
  const difficulty = legacyDifficultyRanks[match[1]?.toLowerCase() ?? ''];
  const characteristic = match[2];
  const hash = match[3];
  return difficulty === undefined || characteristic === undefined || hash === undefined
    ? null
    : { difficulty, characteristic, hash };
}

export function useViewerFileSource({
  setError,
  onClearViewer,
  onMapLoaded,
  onSourceLoaded,
}: UseViewerFileSourceOptions) {
  const t = useTranslations('viewer');
  const parserRef = useRef<BeatmapParser | null>(null);
  const coverUrlRef = useRef<string | null>(null);
  const replayRef = useRef<Replay | null>(null);
  const audioDataRef = useRef<ArrayBuffer | null>(null);
  const pendingSharedViewRef = useRef<PendingSharedView | null>(null);
  const [mapMeta, setMapMeta] = useState<MapMeta | null>(null);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [songBpm, setSongBpm] = useState(0);
  const [rows, setRows] = useState<DifficultyRow[]>([]);
  const [mapIdentity, setMapIdentity] = useState<MapIdentity | null>(null);
  const [shareScoreId, setShareScoreId] = useState<string | null>(null);
  const [replayPlayer, setReplayPlayer] = useState<ScoreSaberReplayPlayer | null>(null);

  function revokeCover() {
    if (coverUrlRef.current === null) return;
    URL.revokeObjectURL(coverUrlRef.current);
    coverUrlRef.current = null;
  }

  useEffect(() => {
    const parser = new BeatmapParser();
    parserRef.current = parser;
    return () => {
      parser.dispose();
      parserRef.current = null;
      revokeCover();
    };
  }, []);

  async function parseReplay(data: ArrayBuffer, source: SourceError['source'] = 'local') {
    parserRef.current ??= new BeatmapParser();
    const parser = parserRef.current;
    return Result.tryPromise({
      try: () => parser.parseReplay(data),
      catch: (cause) =>
        sourceError(cause, {
          message: cause instanceof Error ? cause.message : 'replay could not be parsed',
          source,
          operation: 'parse-replay',
        }),
    });
  }

  async function loadSourceFiles(
    files: MapSourceFile[],
    replay: Replay | null = null,
    context: LoadedSourceContext = {},
  ) {
    setError('');
    replayRef.current = replay;
    setShareScoreId(context.scoreId ?? null);
    setReplayPlayer(context.player ?? null);
    setMapIdentity(null);
    onClearViewer();
    revokeCover();
    setCoverUrl(null);
    const source =
      context.scoreId !== undefined ? 'scoresaber' : context.identity === undefined ? 'local' : 'beatsaver';
    if (!files.some((file) => file.name.toLowerCase() === 'info.dat')) {
      return Result.err(
        new SourceError({
          message: t('errors.missingInfo'),
          source,
          operation: 'find-map-info',
        }),
      );
    }
    parserRef.current ??= new BeatmapParser();
    const parser = parserRef.current;
    const mapPackage = await Result.tryPromise({
      try: () => parseMapPackage(files, parser, replay),
      catch: (cause) =>
        sourceError(cause, {
          message: cause instanceof Error ? cause.message : 'map files could not be parsed',
          source,
          operation: 'parse-map-package',
        }),
    });
    if (mapPackage.isErr()) {
      setMapMeta(null);
      setRows([]);
      revokeCover();
      setCoverUrl(null);
      return Result.err(mapPackage.error);
    }
    setMapMeta(mapPackage.value.mapMeta);
    setSongBpm(mapPackage.value.songBpm);
    if (mapPackage.value.cover !== null) {
      const url = URL.createObjectURL(new Blob([mapPackage.value.cover.data], { type: mapPackage.value.cover.type }));
      coverUrlRef.current = url;
      setCoverUrl(url);
    }
    audioDataRef.current = mapPackage.value.audioData;
    setRows(mapPackage.value.rows);
    onSourceLoaded();
    onMapLoaded();
    setMapIdentity(context.identity ?? null);
    return Result.ok(undefined);
  }

  async function loadFiles(
    files: File[],
    resolveReplayMap: (hash: string) => Promise<SourceResult<BeatSaverMapSource>>,
  ) {
    const result = await Result.gen(async function* () {
      pendingSharedViewRef.current = null;
      setMapIdentity(null);
      setShareScoreId(null);
      const sourceFiles: MapSourceFile[] = [];
      let replay: Replay | null = null;
      let identity: MapIdentity | undefined;
      for (const file of files) {
        if (/\.zip$/i.test(file.name)) {
          const data = yield* Result.await(
            Result.tryPromise({
              try: () => file.arrayBuffer(),
              catch: (cause) =>
                sourceError(cause, {
                  message: `${file.name} could not be read`,
                  source: 'local',
                  operation: 'read-local-file',
                }),
            }),
          );
          const archive = yield* Result.await(extractMapArchive(new Uint8Array(data)));
          sourceFiles.push(...archive);
        } else if (/\.dat$/i.test(file.name)) {
          const data = yield* Result.await(
            Result.tryPromise({
              try: () => file.arrayBuffer(),
              catch: (cause) =>
                sourceError(cause, {
                  message: `${file.name} could not be read`,
                  source: 'local',
                  operation: 'read-local-file',
                }),
            }),
          );
          if (isScoreSaberReplay(new Uint8Array(data))) {
            if (replay !== null) {
              return Result.err(
                new SourceError({
                  message: t('errors.oneReplay'),
                  source: 'local',
                  operation: 'validate-replay-files',
                }),
              );
            }
            replay = yield* Result.await(parseReplay(data));
            const legacyMetadata = legacyMetadataFromFilename(file.name);
            if (legacyMetadata !== null) applyLegacyScoreSaberMetadata(replay, legacyMetadata);
          } else sourceFiles.push(file);
        } else sourceFiles.push(file);
      }
      if (replay !== null && sourceFiles.length === 0) {
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
        const source = yield* Result.await(resolveReplayMap(hash));
        sourceFiles.push(...source.files);
        identity = { key: source.key, hash: source.hash };
      }
      if (replay !== null) pendingSharedViewRef.current = {};
      yield* Result.await(loadSourceFiles(sourceFiles, replay, { identity }));
      return Result.ok(undefined);
    });
    if (result.isErr()) {
      pendingSharedViewRef.current = null;
      setMapMeta(null);
      setRows([]);
      revokeCover();
      setCoverUrl(null);
      const fallback =
        result.error.source === 'beatsaver' || result.error.source === 'scoresaber'
          ? t('errors.failedSource')
          : t('errors.failedMap');
      setError(sourceErrorMessage(result.error, fallback, t('errors.missingInfo')));
    }
  }

  return {
    audioDataRef,
    coverUrl,
    loadFiles,
    loadSourceFiles,
    mapIdentity,
    mapMeta,
    parseReplay,
    pendingSharedViewRef,
    replayPlayer,
    replayRef,
    rows,
    shareScoreId,
    songBpm,
  };
}
