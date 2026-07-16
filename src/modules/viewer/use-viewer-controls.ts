import { useEffect, type Dispatch, type RefObject, type SetStateAction } from 'react';

import type { ViewerPanel } from './viewer-types';

interface ViewerControlsOptions {
  activePanel: ViewerPanel;
  autoHide: boolean;
  beatStep: number;
  playing: boolean;
  transportReadOnly: boolean;
  setActivePanel: Dispatch<SetStateAction<ViewerPanel>>;
  setChromeVisible: Dispatch<SetStateAction<boolean>>;
  triggerRef: RefObject<HTMLElement | null>;
  onSeekBeats: (beats: number) => void;
  onToggleHitsounds: () => void;
  onTogglePlay: () => boolean | undefined;
}

export function useViewerControls({
  activePanel,
  autoHide,
  beatStep,
  playing,
  transportReadOnly,
  setActivePanel,
  setChromeVisible,
  triggerRef,
  onSeekBeats,
  onToggleHitsounds,
  onTogglePlay,
}: ViewerControlsOptions) {
  useEffect(() => {
    if (activePanel === null) triggerRef.current?.focus();
  }, [activePanel]);

  useEffect(() => {
    function keydown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        setActivePanel(null);
        return;
      }
      const focused = document.activeElement;
      if (
        focused?.matches('input[type="text"], textarea, [contenteditable]:not([contenteditable="false"])') === true &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey
      )
        return;
      const key = event.key.toLowerCase();
      const transportKey = event.code === 'Space' || event.key === 'ArrowLeft' || event.key === 'ArrowRight';
      if (transportReadOnly && transportKey) return;
      if (!transportKey && key !== 'm' && key !== 'h' && key !== 'f' && event.key !== '?') return;
      document.querySelector<HTMLElement>('[data-transport-controls] :focus')?.blur();
      event.preventDefault();
      event.stopPropagation();
      if (event.repeat && event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
      if (event.code === 'Space') {
        const nextPlaying = onTogglePlay();
        if (nextPlaying !== undefined) {
          setChromeVisible(!nextPlaying);
          if (nextPlaying) setActivePanel(null);
        }
      } else if (event.key === 'ArrowLeft') onSeekBeats(-beatStep);
      else if (event.key === 'ArrowRight') onSeekBeats(beatStep);
      else if (key === 'm') onToggleHitsounds();
      else if (key === 'h') setChromeVisible((visible) => !visible);
      else if (key === 'f') {
        if (document.fullscreenElement === null) void document.documentElement.requestFullscreen();
        else void document.exitFullscreen();
      } else if (event.key === '?') {
        triggerRef.current = null;
        setActivePanel((panel) => (panel === 'shortcuts' ? null : 'shortcuts'));
      }
    }

    window.addEventListener('keydown', keydown, true);
    return () => {
      window.removeEventListener('keydown', keydown, true);
    };
  });

  useEffect(() => {
    let timeout = 0;

    function scheduleHide() {
      clearTimeout(timeout);
      if (autoHide && playing && activePanel === null) {
        timeout = window.setTimeout(() => {
          setChromeVisible(false);
        }, 2500);
      }
    }

    function show() {
      setChromeVisible(true);
      scheduleHide();
    }

    function showForKey(event: KeyboardEvent) {
      if (event.code !== 'Space' && event.key.toLowerCase() !== 'h') show();
    }

    window.addEventListener('pointermove', show);
    window.addEventListener('pointerdown', show);
    window.addEventListener('wheel', show);
    window.addEventListener('keydown', showForKey, true);
    scheduleHide();
    return () => {
      clearTimeout(timeout);
      window.removeEventListener('pointermove', show);
      window.removeEventListener('pointerdown', show);
      window.removeEventListener('wheel', show);
      window.removeEventListener('keydown', showForKey, true);
    };
  }, [activePanel, autoHide, playing]);
}
