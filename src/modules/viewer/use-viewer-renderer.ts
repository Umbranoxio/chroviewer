import { useEffect, useRef, useState, type RefObject } from 'react';

import { useTranslations } from 'use-intl';

import type { SongClock } from '../../core/clock/song-clock';
import type { LightshowMode } from '../../core/lighting/basic-light';
import { hitScoreVisualizerForSettings } from '../../core/replay/replay-display';
import type { Replay } from '../../core/replay/types';
import { colorOverride, type ViewerSettings } from '../../core/viewer-settings';
import { resolveEnvironmentId } from '../../renderer/environment/environment-catalog';
import { EnvironmentLoadAborted } from '../../renderer/environment/environment-error';
import type { MapView } from '../../renderer/map-view';
import type { RendererLifecycle } from '../../renderer/renderer-lifecycle';
import type { ActiveSelection } from './viewer-types';

export interface ViewerHandle {
  view: MapView;
  lifecycle: RendererLifecycle;
}

interface ViewerRendererOptions {
  activeSelectionRef: RefObject<ActiveSelection | null>;
  clockRef: RefObject<SongClock | null>;
  lightshowModeRef: RefObject<LightshowMode>;
  replayRef: RefObject<Replay | null>;
  settings: ViewerSettings;
  settingsRef: RefObject<ViewerSettings>;
  setError: (message: string) => void;
}

function isCurrentViewer(viewerRef: RefObject<ViewerHandle | null>, view: MapView) {
  return viewerRef.current?.view === view;
}

export function useViewerRenderer({
  activeSelectionRef,
  clockRef,
  lightshowModeRef,
  replayRef,
  settings,
  settingsRef,
  setError,
}: ViewerRendererOptions) {
  const t = useTranslations('viewer');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const viewerRef = useRef<ViewerHandle | null>(null);
  const initialEnvironmentLoadedRef = useRef(false);
  const [environmentLoading, setEnvironmentLoading] = useState(true);
  const [viewerReady, setViewerReady] = useState(false);

  useEffect(() => {
    const effect = new AbortController();
    let cleanup: (() => void) | null = null;

    async function initialize() {
      const [{ MapView }, { RendererLifecycle }] = await Promise.all([
        import('../../renderer/map-view'),
        import('../../renderer/renderer-lifecycle'),
      ]);
      const canvas = canvasRef.current;
      if (effect.signal.aborted || canvas === null) return;

      const active = activeSelectionRef.current;
      const lifecycle = new RendererLifecycle();
      lifecycle.attach(canvas);
      lifecycle.setRenderScale(settings.renderScale);
      const finishInitialEnvironmentLoad = () => {
        if (initialEnvironmentLoadedRef.current) return;
        initialEnvironmentLoadedRef.current = true;
        setEnvironmentLoading(false);
      };
      const view = new MapView({ mirrorQuality: settings.graphicsQuality }, finishInitialEnvironmentLoad);
      lifecycle.setView(view);
      view.setLightshowMode(active === null ? 'static' : lightshowModeRef.current);
      view.setReplayCameraSettings(settings);
      view.setReplaySaberSettings(settingsRef.current);
      view.setScreenDisplacementEffects(settingsRef.current.screenDisplacementEffects);
      view.setPreviewHitNotes(settingsRef.current.previewHitNotes);
      view.setPreviewHitLine(settingsRef.current.previewHitLine);
      view.setPreviewNotesLookAtPlayer(settingsRef.current.previewNotesLookAtPlayer);
      viewerRef.current = { view, lifecycle };
      setViewerReady(true);
      cleanup = () => {
        setViewerReady(false);
        viewerRef.current = null;
        view.dispose();
        lifecycle.dispose();
      };

      const initialLoad = !initialEnvironmentLoadedRef.current;
      if (initialLoad) setEnvironmentLoading(true);
      const environmentResult = await view.setEnvironment(
        active?.environmentId ??
          resolveEnvironmentId(
            settingsRef.current.overrideEnvironment
              ? settingsRef.current.environmentOverrideId
              : 'BigMirrorEnvironment',
          ),
      );
      if (!isCurrentViewer(viewerRef, view)) return;
      if (environmentResult.isErr() && !EnvironmentLoadAborted.is(environmentResult.error)) {
        finishInitialEnvironmentLoad();
        const fallback = initialLoad ? t('errors.failedEnvironment') : t('errors.failedQualityRebuild');
        setError(`${fallback}: ${environmentResult.error.message}`);
      }

      function restoreActiveView(selection: ActiveSelection, clock: SongClock) {
        view.setMap(
          selection.data,
          colorOverride(settingsRef.current, selection.mapColorScheme, replayRef.current?.metadata),
        );
        view.setReplay(replayRef.current, hitScoreVisualizerForSettings(settingsRef.current, replayRef.current));
        view.setBeatSource(() => clock.currentBeat());
      }

      const clock = clockRef.current;
      if (active !== null && clock !== null) restoreActiveView(active, clock);
    }

    queueMicrotask(() => {
      void initialize();
    });

    return () => {
      effect.abort();
      cleanup?.();
      cleanup = null;
    };
  }, [settings.graphicsQuality]);

  return { canvasRef, environmentLoading, viewerReady, viewerRef };
}
