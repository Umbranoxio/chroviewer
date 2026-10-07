import { useEffect, useRef, useState, type Dispatch, type RefObject, type SetStateAction } from 'react';

import { useTranslations } from 'use-intl';

import { songBpmTimeToSeconds } from '../../core/beatmap/bpm';
import { difficultyRank, effectiveNoteJumpSpeed } from '../../core/beatmap/info';
import { buildHitsoundEvents } from '../../core/clock/hitsounds';
import { isForcedLightshowMode, type LightshowMode } from '../../core/lighting/basic-light';
import { applyReplayHeightEvents, buildMapRenderData } from '../../core/placement/map-render-data';
import { hitScoreVisualizerForSettings } from '../../core/replay/replay-display';
import type { ReplayHeightEvent, ReplayNoteEvent } from '../../core/replay/types';
import {
  colorOverride,
  environmentForSettings,
  saveViewerSettings,
  type ViewerSettings,
} from '../../core/viewer-settings';
import { resolveEnvironmentId } from '../../renderer/environment/environment-catalog';
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
  requestedMapRow?: DifficultyRow;
  skipInitialMenuEnvironment: boolean;
  setActivePanel: Dispatch<SetStateAction<ViewerPanel>>;
  setError: (message: string) => void;
  setLightshowMode: Dispatch<SetStateAction<LightshowMode>>;
  setSettings: Dispatch<SetStateAction<ViewerSettings>>;
  persistedSettings: ViewerSettings;
  settings: ViewerSettings;
  settingsRef: RefObject<ViewerSettings>;
  sources: Pick<
    ViewerSources,
    | 'audioDataRef'
    | 'pendingSharedViewRef'
    | 'replayRef'
    | 'rows'
    | 'scoreSaberLeaderboards'
    | 'beatLeaderLeaderboards'
    | 'songBpm'
    | 'shareScoreIdBL'
  >;
  transport: Pick<SongTransport, 'clear' | 'clockRef' | 'load' | 'play' | 'seek' | 'setHitsoundEvents'>;
}

export function useViewerSession({
  lightshowMode,
  lightshowModeRef,
  requestedMapRow,
  skipInitialMenuEnvironment,
  setActivePanel,
  setError,
  setLightshowMode,
  setSettings,
  persistedSettings,
  settings,
  settingsRef,
  sources,
  transport,
}: ViewerSessionOptions) {
  const t = useTranslations('viewer');
  const activeSelectionRef = useRef<ActiveSelection | null>(null);
  const selectionRequestRef = useRef(0);
  const selectionGenerationRef = useRef(0);
  const [difficultyLoading, setDifficultyLoading] = useState(false);
  const [selectedKey, setSelectedKey] = useState('');
  const { canvasRef, environmentLoading, orthoOverlayRef, viewerReady, viewerRef } = useViewerRenderer({
    activeSelectionRef,
    clockRef: transport.clockRef,
    lightshowModeRef,
    replayRef: sources.replayRef,
    settings,
    settingsRef,
    skipInitialMenuEnvironment,
    setError,
  });

  useEffect(() => {
    saveViewerSettings(persistedSettings);
  }, [persistedSettings]);

  useEffect(() => {
    viewerRef.current?.lifecycle.setRenderScale(settings.renderScale);
  }, [settings.renderScale]);

  useEffect(() => {
    viewerRef.current?.view.setScreenDisplacementEffects(settings.screenDisplacementEffects);
  }, [settings.screenDisplacementEffects]);

  useEffect(() => {
    viewerRef.current?.view.setPreviewNotesLookAtPlayer(settings.previewNotesLookAtPlayer);
  }, [settings.previewNotesLookAtPlayer]);

  useEffect(() => {
    viewerRef.current?.view.setPreviewHitNotes(settings.previewHitNotes);
  }, [settings.previewHitNotes]);

  useEffect(() => {
    viewerRef.current?.view.setPreviewHitLine(settings.previewHitLine);
  }, [settings.previewHitLine]);

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
    settings.showHeadset,
    settings.orthoCameraEnabled,
    settings.orthoCameraView,
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
    settings.replayTrailStyle,
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
    viewerRef.current?.view.setHitScoreVisualizer(hitScoreVisualizerForSettings(settings, sources.replayRef.current));
  }, [settings.overrideHsvProfile, settings.preferReplayHsvProfile, settings.hsvProfile]);

  useEffect(() => {
    const active = activeSelectionRef.current;
    const view = viewerRef.current?.view;
    if (active === null || view === undefined) return;
    view.refreshMapColors(colorOverride(settings, active.mapColorScheme, sources.replayRef.current?.metadata));
  }, [
    settings.preferReplayColors,
    settings.customColors,
    settings.leftColor,
    settings.rightColor,
    settings.obstacleColor,
    settings.environmentLeftColor,
    settings.environmentRightColor,
    settings.environmentWhiteColor,
    settings.environmentLeftBoostColor,
    settings.environmentRightBoostColor,
    settings.environmentWhiteBoostColor,
  ]);

  useEffect(() => {
    const active = activeSelectionRef.current;
    if (skipInitialMenuEnvironment && active === null) return;
    const nextEnvironmentId = resolveEnvironmentId(
      active === null
        ? settings.overrideEnvironment
          ? settings.environmentOverrideId
          : 'BigMirrorEnvironment'
        : environmentForSettings(
            settings,
            active.mapEnvironmentId,
            active.replayEnvironmentId,
            active.usesChromaOrNoodle,
          ),
    );
    if (active?.environmentId === nextEnvironmentId) return;
    void selectEnvironment(nextEnvironmentId);
  }, [
    settings.preferReplayEnvironment,
    settings.overrideEnvironment,
    settings.environmentOverrideId,
    skipInitialMenuEnvironment,
  ]);

  function reportEnvironmentError(error: EnvironmentLoadFailure) {
    if (EnvironmentLoadAborted.is(error)) return;
    setError(`${t('errors.failedEnvironment')}: ${error.message}`);
  }

  async function selectDifficulty(row: DifficultyRow, initialBeat = 0) {
    const requestId = ++selectionRequestRef.current;
    setDifficultyLoading(false);
    const viewer = viewerRef.current;
    if (
      viewer === null ||
      row.difficulty === undefined ||
      row.infoDifficulty === undefined ||
      row.environmentId === undefined
    )
      return;
    const mapEnvironmentId = row.environmentId;
    const environmentId = resolveEnvironmentId(
      environmentForSettings(
        settings,
        mapEnvironmentId,
        row.replayEnvironmentId,
        row.infoDifficulty.usesChromaOrNoodle,
      ),
    );
    setError('');
    if (sources.replayRef.current !== null && row.replayMatch !== true) {
      setError(t('errors.selectReplayDifficulty'));
      return;
    }

    setDifficultyLoading(true);
    await new Promise<void>((resolve) => {
      window.setTimeout(resolve, 0);
    });
    if (requestId !== selectionRequestRef.current) return;

    const data = buildMapRenderData(row.difficulty, {
      noteJumpSpeed: effectiveNoteJumpSpeed(row.infoDifficulty),
      noteStartBeatOffset: row.infoDifficulty.noteStartBeatOffset,
      songBpm: sources.songBpm,
      legacyNoodleV2Semantics: row.legacyNoodleV2Semantics,
      recordedJumpDistance:
        sources.replayRef.current?.metadata.hasPlaySettings === true
          ? sources.replayRef.current.metadata.jumpDistance
          : undefined,
      leftHanded: sources.replayRef.current?.metadata.leftHanded,
      replayNotes: sources.replayRef.current?.notes,
      initialPlayerHeight: sources.replayRef.current?.metadata.initialHeight,
      replayHeights: sources.replayRef.current?.heights,
      environmentRemoval: row.infoDifficulty.environmentRemoval,
      modifiers: sources.replayRef.current?.metadata.modifiers,
    });
    const hitsoundEvents = buildHitsoundEvents([...data.notes, ...data.chainLinks], sources.songBpm);
    const replayEnd = sources.replayRef.current?.poses.at(-1)?.time ?? 0;
    const fallbackDuration = Math.max(songBpmTimeToSeconds(data.endBeat, sources.songBpm) + 1, replayEnd);
    const clockPromise =
      transport.clockRef.current === null
        ? transport.load({
            audioData: sources.audioDataRef.current,
            fallbackDuration,
            hitsoundEvents,
            onAudioDecodeError() {
              setError(t('errors.audioDecode'));
            },
            shouldCommit() {
              return requestId === selectionRequestRef.current;
            },
            songBpm: sources.songBpm,
            volume: settings.masterMuted || settings.songMuted ? 0 : settings.masterVolume * settings.songVolume,
          })
        : null;
    const environmentResult = await viewer.view.setEnvironment(environmentId, data.chromaEnvironment);
    if (environmentResult.isErr()) {
      if (requestId >= selectionGenerationRef.current) reportEnvironmentError(environmentResult.error);
      if (requestId === selectionRequestRef.current) {
        if (clockPromise !== null) transport.clear();
        setDifficultyLoading(false);
      }
      return;
    }
    if (requestId < selectionGenerationRef.current) return;
    selectionGenerationRef.current = requestId;
    const generation = requestId;
    viewer.view.setLightshowMode(lightshowModeRef.current);

    activeSelectionRef.current = {
      data,
      environmentId,
      mapEnvironmentId,
      replayEnvironmentId: row.replayEnvironmentId,
      usesChromaOrNoodle: row.infoDifficulty.usesChromaOrNoodle,
      mapColorScheme: row.colorScheme,
    };

    const currentReplayHeights = sources.replayRef.current?.heights ?? [];
    applyReplayHeightEvents(data, currentReplayHeights.slice(data.replayHeights.length));
    viewer.view.setBeatSource(() => initialBeat);
    viewer.view.setMap(data, colorOverride(settings, row.colorScheme, sources.replayRef.current?.metadata));
    viewer.view.setReplay(
      sources.replayRef.current,
      hitScoreVisualizerForSettings(settings, sources.replayRef.current),
    );
    viewer.view.setReplayCameraSettings(settings);
    setActivePanel(null);

    let clock = transport.clockRef.current;
    if (clockPromise !== null) {
      clock = await clockPromise;
    } else {
      transport.setHitsoundEvents(hitsoundEvents);
    }
    if (clock === null || generation !== selectionGenerationRef.current) {
      if (requestId === selectionRequestRef.current) setDifficultyLoading(false);
      return;
    }

    viewer.view.setSongDuration(clock.duration);
    viewer.view.setBeatSource(() => clock.currentBeat());
    setSelectedKey(row.key);
    if (requestId === selectionRequestRef.current) setDifficultyLoading(false);
    return true;
  }

  async function selectEnvironment(nextEnvironmentId: string) {
    const viewer = viewerRef.current;
    if (viewer === null) return;
    setError('');
    const active = activeSelectionRef.current;
    const result = await viewer.view.setEnvironment(nextEnvironmentId, active?.data.chromaEnvironment);
    if (result.isErr()) {
      reportEnvironmentError(result.error);
      return;
    }
    if (active !== null) {
      active.environmentId = nextEnvironmentId;
      viewer.view.refreshMapColors(
        colorOverride(settingsRef.current, active.mapColorScheme, sources.replayRef.current?.metadata),
      );
    }
  }

  async function applyPendingView(row: DifficultyRow, beat: number | undefined) {
    await selectDifficulty(row, beat);
    const clock = transport.clockRef.current;
    if (clock === null) return;
    transport.seek(songBpmTimeToSeconds(beat ?? 0, sources.songBpm));
  }

  useEffect(() => {
    const pending = sources.pendingSharedViewRef.current;
    if (
      !viewerReady ||
      (pending === null && requestedMapRow === undefined) ||
      sources.rows.length === 0 ||
      sources.songBpm <= 0
    )
      return;
    const row =
      requestedMapRow ??
      sources.rows.find((candidate) => sources.replayRef.current !== null && candidate.replayMatch === true) ??
      sources.rows.find((candidate) => candidate.difficulty !== undefined);
    if (row === undefined) return;
    sources.pendingSharedViewRef.current = null;
    void applyPendingView(row, pending?.beat).then(() => {
      if (pending?.autoplay === true) transport.play({ autoplay: true });
    });
  }, [requestedMapRow, sources.rows, sources.songBpm, viewerReady]);

  function clearViewer() {
    selectionGenerationRef.current = ++selectionRequestRef.current;
    activeSelectionRef.current = null;
    setDifficultyLoading(false);
    setSelectedKey('');
    viewerRef.current?.view.clear();
  }

  function clearMapSelection() {
    setSelectedKey('');
  }

  function cycleLights() {
    const modes: LightshowMode[] = ['none', 'static', 'full', 'lightshow', 'full-lightshow'];
    const next = modes[(modes.indexOf(lightshowMode) + 1) % modes.length] ?? 'full';
    changeLightshowMode(next);
  }

  function changeLightshowMode(mode: LightshowMode, updateSettings = true) {
    lightshowModeRef.current = mode;
    setLightshowMode(mode);
    viewerRef.current?.view.setLightshowMode(mode);
    if (updateSettings && mode !== 'none') {
      setSettings((current) => ({ ...current, staticLights: mode === 'static' }));
    }
  }

  function applyAuthoritativeLightshowMode(mode: LightshowMode) {
    changeLightshowMode(mode, false);
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
  const isBeatLeaderReplay =
    sources.shareScoreIdBL !== null || sources.replayRef.current?.metadata.version.includes('BeatLeader') === true;
  const leaderboardPlatform: 'scoresaber' | 'beatleader' = isBeatLeaderReplay ? 'beatleader' : 'scoresaber';
  const leaderboard =
    selectedRow?.infoDifficulty === undefined || selectedGameMode === null
      ? undefined
      : (isBeatLeaderReplay ? sources.beatLeaderLeaderboards : sources.scoreSaberLeaderboards).find(
          (candidate) =>
            candidate.difficulty === difficultyRank(selectedRow.infoDifficulty?.difficulty ?? '') &&
            candidate.gameMode.toLowerCase() === selectedGameMode.toLowerCase(),
        );
  const leaderboardUrl =
    leaderboard === undefined
      ? null
      : isBeatLeaderReplay
        ? `https://beatleader.com/leaderboard/global/${leaderboard.id}`
        : `https://scoresaber.com/leaderboard/${leaderboard.id}`;

  return {
    canvasRef,
    appendLiveReplayHeightEvents,
    appendLiveReplayNoteEvents,
    applyAuthoritativeLightshowMode,
    changeLightshowMode,
    clearMapSelection,
    clearViewer,
    cycleCamera,
    cycleLights,
    difficultyOptions,
    difficultyLoading,
    environmentLoading,
    leaderboardUrl,
    leaderboardPlatform,
    orthoOverlayRef,
    selectDifficulty,
    selectedKey,
    viewerReady,
  };
}
