import { useEffect, useRef, useState, type Dispatch, type RefObject, type SetStateAction } from 'react';

import { useTranslations } from 'use-intl';

import { songBpmTimeToSeconds } from '../../core/beatmap/bpm';
import { difficultyRank, effectiveNoteJumpSpeed } from '../../core/beatmap/info';
import { buildHitsoundEvents } from '../../core/clock/hitsounds';
import { isForcedLightshowMode, type LightshowMode } from '../../core/lighting/basic-light';
import { applyReplayHeightEvents, buildMapRenderData } from '../../core/placement/map-render-data';
import { replayLightshowMode } from '../../core/replay/play-settings';
import type { ReplayHeightEvent, ReplayNoteEvent } from '../../core/replay/types';
import { colorOverride, saveViewerSettings, type ViewerSettings } from '../../core/viewer-settings';
import { EnvironmentLoadAborted, type EnvironmentLoadFailure } from '../../renderer/environment/environment-error';
import type { useSongTransport } from './use-song-transport';
import { useViewerRenderer } from './use-viewer-renderer';
import type { useViewerSources } from './use-viewer-sources';
import type { ActiveSelection, DifficultyRow, ViewerPanel } from './viewer-types';

type SongTransport = ReturnType<typeof useSongTransport>;
type ViewerSources = ReturnType<typeof useViewerSources>;

interface ViewerSessionOptions {
  lightshowMode: LightshowMode;
  lightshowModeRef: RefObject<LightshowMode>;
  setActivePanel: Dispatch<SetStateAction<ViewerPanel>>;
  setError: (message: string) => void;
  setLightshowMode: Dispatch<SetStateAction<LightshowMode>>;
  setSettings: Dispatch<SetStateAction<ViewerSettings>>;
  settings: ViewerSettings;
  settingsRef: RefObject<ViewerSettings>;
  sources: Pick<
    ViewerSources,
    'audioDataRef' | 'pendingSharedViewRef' | 'replayRef' | 'rows' | 'scoreSaberLeaderboards' | 'songBpm'
  >;
  transport: Pick<SongTransport, 'clockRef' | 'load' | 'play' | 'seek' | 'setHitsoundEvents'>;
}

export function useViewerSession({
  lightshowMode,
  lightshowModeRef,
  setActivePanel,
  setError,
  setLightshowMode,
  setSettings,
  settings,
  settingsRef,
  sources,
  transport,
}: ViewerSessionOptions) {
  const t = useTranslations('viewer');
  const activeSelectionRef = useRef<ActiveSelection | null>(null);
  const [environmentId, setEnvironmentId] = useState('BigMirrorEnvironment');
  const [selectedKey, setSelectedKey] = useState('');
  const { canvasRef, environmentLoading, viewerReady, viewerRef } = useViewerRenderer({
    activeSelectionRef,
    clockRef: transport.clockRef,
    lightshowModeRef,
    replayRef: sources.replayRef,
    settings,
    settingsRef,
    setError,
  });

  useEffect(() => {
    saveViewerSettings(settings);
    viewerRef.current?.lifecycle.setRenderScale(settings.renderScale);
  }, [settings]);

  useEffect(() => {
    viewerRef.current?.view.setScreenDisplacementEffects(settings.screenDisplacementEffects);
  }, [settings.screenDisplacementEffects]);

  useEffect(() => {
    viewerRef.current?.view.setPreviewNotesLookAtPlayer(settings.previewNotesLookAtPlayer);
  }, [settings.previewNotesLookAtPlayer]);

  useEffect(() => {
    const mode: LightshowMode = settings.staticLights ? 'static' : 'full';
    if (isForcedLightshowMode(lightshowModeRef.current) && mode === 'full') return;
    lightshowModeRef.current = mode;
    setLightshowMode(mode);
    viewerRef.current?.view.setLightshowMode(mode);
  }, [settings.staticLights]);

  useEffect(() => {
    viewerRef.current?.view.setReplayCameraSettings(settings);
  }, [
    settings.replayCamera,
    settings.replayCameraSmoothing,
    settings.replayCameraSmoothingSpeed,
    settings.replayCameraFov,
    settings.previewCameraDistance,
    settings.fixedCameraDistance,
    settings.replayCameraXOffset,
    settings.replayCameraYOffset,
    settings.replayCameraDepthOffset,
    settings.replayCameraXRotation,
    settings.replayCameraYRotation,
    settings.replayCameraZRotation,
    settings.replayCameraForceUpright,
  ]);

  useEffect(() => {
    viewerRef.current?.view.setReplaySaberSettings(settings);
  }, [
    settings.showSabers,
    settings.saberScale,
    settings.saberBladeLength,
    settings.saberBladeThickness,
    settings.saberCoreThickness,
    settings.saberCoreInset,
    settings.showSaberTrails,
    settings.replayTrailShape,
    settings.replayTrailLength,
    settings.replayTrailThinness,
    settings.replayTrailSamples,
    settings.replayTrailFade,
    settings.replayTrailOpacity,
    settings.replayTrailMotionThreshold,
    settings.saberGripLength,
    settings.saberGripThickness,
    settings.saberGuardSize,
    settings.saberGuardThickness,
    settings.saberCollarSize,
    settings.saberCollarThickness,
    settings.saberCollarSpacing,
    settings.saberRingCount,
    settings.saberRingSize,
    settings.saberRingThickness,
    settings.saberRingSpacing,
    settings.saberPommelLength,
    settings.saberPommelThickness,
    settings.saberXOffset,
    settings.saberYOffset,
    settings.saberZOffset,
    settings.saberXRotation,
    settings.saberYRotation,
    settings.saberZRotation,
  ]);

  useEffect(() => {
    const active = activeSelectionRef.current;
    const view = viewerRef.current?.view;
    if (active === null || view === undefined) return;
    view.setMap(active.data, colorOverride(settings, active.mapColorScheme));
    view.setReplay(sources.replayRef.current);
  }, [settings.customColors, settings.leftColor, settings.rightColor]);

  function reportEnvironmentError(error: EnvironmentLoadFailure) {
    if (EnvironmentLoadAborted.is(error)) return;
    setError(`${t('errors.failedEnvironment')}: ${error.message}`);
  }

  async function selectDifficulty(row: DifficultyRow, initialBeat = 0) {
    const viewer = viewerRef.current;
    if (
      viewer === null ||
      row.difficulty === undefined ||
      row.infoDifficulty === undefined ||
      row.environmentId === undefined
    )
      return;
    const environmentId = row.environmentId;
    setError('');
    if (sources.replayRef.current !== null && row.replayMatch !== true) {
      setError(t('errors.selectReplayDifficulty'));
      return;
    }

    const data = buildMapRenderData(row.difficulty, {
      noteJumpSpeed: effectiveNoteJumpSpeed(row.infoDifficulty),
      noteStartBeatOffset: row.infoDifficulty.noteStartBeatOffset,
      songBpm: sources.songBpm,
      recordedJumpDistance:
        sources.replayRef.current?.metadata.hasPlaySettings === true
          ? sources.replayRef.current.metadata.jumpDistance
          : undefined,
      leftHanded: sources.replayRef.current?.metadata.leftHanded,
      replayNotes: sources.replayRef.current?.notes,
      initialPlayerHeight: sources.replayRef.current?.metadata.initialHeight,
      replayHeights: sources.replayRef.current?.heights,
      environmentRemoval: row.infoDifficulty.environmentRemoval,
    });
    const environmentResult = await viewer.view.setEnvironment(environmentId);
    if (environmentResult.isErr()) {
      reportEnvironmentError(environmentResult.error);
      return;
    }
    setEnvironmentId(environmentId);
    const recordedLightshowMode = row.replayMatch
      ? replayLightshowMode(sources.replayRef.current?.metadata)
      : undefined;
    if (recordedLightshowMode !== undefined && !isForcedLightshowMode(lightshowModeRef.current)) {
      lightshowModeRef.current = recordedLightshowMode;
      setLightshowMode(recordedLightshowMode);
    }
    viewer.view.setLightshowMode(lightshowModeRef.current);

    activeSelectionRef.current = {
      data,
      environmentId,
      mapColorScheme: row.colorScheme,
    };

    const hitsoundEvents = buildHitsoundEvents([...data.notes, ...data.chainLinks], sources.songBpm);
    const currentReplayHeights = sources.replayRef.current?.heights ?? [];
    applyReplayHeightEvents(data, currentReplayHeights.slice(data.replayHeights.length));
    viewer.view.setBeatSource(() => initialBeat);
    viewer.view.setMap(data, colorOverride(settings, row.colorScheme));
    viewer.view.setReplay(sources.replayRef.current);
    viewer.view.setReplayCameraSettings(settings);
    setActivePanel(null);

    let clock = transport.clockRef.current;
    if (clock === null) {
      const replayEnd = sources.replayRef.current?.poses.at(-1)?.time ?? 0;
      const fallbackDuration = Math.max(songBpmTimeToSeconds(data.endBeat, sources.songBpm) + 1, replayEnd);
      clock = await transport.load({
        audioData: sources.audioDataRef.current,
        fallbackDuration,
        hitsoundEvents,
        onAudioDecodeError() {
          setError(t('errors.audioDecode'));
        },
        songBpm: sources.songBpm,
        volume: settings.masterMuted || settings.songMuted ? 0 : settings.masterVolume * settings.songVolume,
      });
    } else {
      transport.setHitsoundEvents(hitsoundEvents);
    }

    viewer.view.setSongDuration(clock.duration);
    viewer.view.setBeatSource(() => clock.currentBeat());
    setSelectedKey(row.key);
  }

  async function selectEnvironment(nextEnvironmentId: string) {
    const viewer = viewerRef.current;
    if (viewer === null) return;
    setError('');
    const result = await viewer.view.setEnvironment(nextEnvironmentId);
    if (result.isErr()) {
      reportEnvironmentError(result.error);
      return;
    }
    const active = activeSelectionRef.current;
    if (active !== null) {
      active.environmentId = nextEnvironmentId;
      viewer.view.refreshMapColors(colorOverride(settingsRef.current, active.mapColorScheme));
    }
    setEnvironmentId(nextEnvironmentId);
  }

  async function applyPendingView(row: DifficultyRow, beat: number | undefined) {
    await selectDifficulty(row, beat);
    const clock = transport.clockRef.current;
    if (clock === null) return;
    transport.seek(songBpmTimeToSeconds(beat ?? 0, sources.songBpm));
  }

  useEffect(() => {
    const pending = sources.pendingSharedViewRef.current;
    if (!viewerReady || pending === null || sources.rows.length === 0 || sources.songBpm <= 0) return;
    const indexedRow = pending.difficultyIndex === undefined ? undefined : sources.rows[pending.difficultyIndex];
    const row =
      (indexedRow?.difficulty === undefined ? undefined : indexedRow) ??
      sources.rows.find((candidate) => sources.replayRef.current !== null && candidate.replayMatch === true) ??
      sources.rows.find((candidate) => candidate.difficulty !== undefined);
    if (row === undefined) return;
    sources.pendingSharedViewRef.current = null;
    void applyPendingView(row, pending.beat).then(() => {
      if (pending.autoplay === true) transport.play({ autoplay: true });
    });
  }, [sources.rows, sources.songBpm, viewerReady]);

  function clearViewer() {
    activeSelectionRef.current = null;
    viewerRef.current?.view.clear();
  }

  function clearMapSelection() {
    setSelectedKey('');
  }

  function cycleLights() {
    const modes: LightshowMode[] = ['full-lightshow', 'full', 'static', 'none'];
    const next = modes[(modes.indexOf(lightshowMode) + 1) % modes.length] ?? 'full';
    applyLightshowMode(next);
  }

  function applyLightshowMode(mode: LightshowMode) {
    lightshowModeRef.current = mode;
    setLightshowMode(mode);
    viewerRef.current?.view.setLightshowMode(mode);
    if (mode !== 'none') {
      setSettings((current) => ({ ...current, staticLights: mode === 'static' }));
    }
  }

  function changeLightshowMode(mode: LightshowMode) {
    applyLightshowMode(mode);
    setActivePanel(null);
  }

  function cycleCamera() {
    if (sources.replayRef.current === null) return;
    const modes: ViewerSettings['replayCamera'][] = ['static', 'follow', 'first-person'];
    const next = modes[(modes.indexOf(settings.replayCamera) + 1) % modes.length] ?? 'static';
    setSettings((current) => ({ ...current, replayCamera: next }));
  }

  function appendLiveReplayNoteEvents(events: ReplayNoteEvent[]) {
    viewerRef.current?.view.appendReplayNoteEvents(events);
  }

  function appendLiveReplayHeightEvents(events: ReplayHeightEvent[]) {
    viewerRef.current?.view.appendReplayHeightEvents(events);
  }

  const difficultyOptions = sources.rows.map((row) => ({
    key: row.key,
    label: row.label,
    disabled: row.difficulty === undefined || (sources.replayRef.current !== null && row.replayMatch !== true),
    difficulty: row.infoDifficulty?.difficulty ?? '',
  }));
  const selectedDifficultyIndex = sources.rows.findIndex((row) => row.key === selectedKey);
  const selectedRow = sources.rows[selectedDifficultyIndex];
  const selectedCharacteristic = selectedRow?.infoDifficulty?.characteristic;
  const selectedGameMode =
    selectedCharacteristic === undefined
      ? null
      : selectedCharacteristic.startsWith('Solo')
        ? selectedCharacteristic
        : `Solo${selectedCharacteristic}`;
  const scoreSaberLeaderboard =
    selectedRow?.infoDifficulty === undefined || selectedGameMode === null
      ? undefined
      : sources.scoreSaberLeaderboards.find(
          (leaderboard) =>
            leaderboard.difficulty === difficultyRank(selectedRow.infoDifficulty?.difficulty ?? '') &&
            leaderboard.gameMode.toLowerCase() === selectedGameMode.toLowerCase(),
        );
  const scoreSaberUrl =
    scoreSaberLeaderboard === undefined
      ? null
      : `https://scoresaber.com/leaderboard/${String(scoreSaberLeaderboard.id)}`;

  return {
    canvasRef,
    appendLiveReplayHeightEvents,
    appendLiveReplayNoteEvents,
    changeLightshowMode,
    clearMapSelection,
    clearViewer,
    cycleCamera,
    cycleLights,
    difficultyOptions,
    environmentLoading,
    environmentId,
    scoreSaberUrl,
    selectDifficulty,
    selectedDifficultyIndex,
    selectedKey,
    selectEnvironment,
  };
}
