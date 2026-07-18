import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';

import { useRouter } from '@tanstack/react-router';
import { Result } from 'better-result';
import { useTranslations } from 'use-intl';

import { isForcedLightshowMode, type LightshowMode } from '../../core/lighting/basic-light';
import { settingsForShareCategories, type ShareSettingsCategory } from '../../core/share-link';
import type { ViewerSettings } from '../../core/viewer-settings';
import type { LiveTarget } from '../live/live-types';
import { viewerSearchForShare, type ViewerShareSource } from './viewer-search';
import type { MapIdentity, ViewerSourceLink } from './viewer-types';

interface UseViewerShareOptions {
  beat: number;
  trimStartBeat: number;
  trimEndBeat: number;
  lightshowMode: LightshowMode;
  liveTarget?: LiveTarget;
  mapIdentity: MapIdentity | null;
  scoreId: string | null;
  selectedDifficultyIndex: number;
  settings: ViewerSettings;
  sourceLink: ViewerSourceLink | null;
  setError: Dispatch<SetStateAction<string>>;
}

export function useViewerShare({
  beat,
  trimStartBeat,
  trimEndBeat,
  lightshowMode,
  liveTarget,
  mapIdentity,
  scoreId,
  selectedDifficultyIndex,
  settings,
  sourceLink,
  setError,
}: UseViewerShareOptions) {
  const router = useRouter();
  const t = useTranslations('viewer');
  const [categories, setCategories] = useState<ShareSettingsCategory[]>([]);
  const [includeTimecode, setIncludeTimecode] = useState(true);
  const [includeTrimSelection, setIncludeTrimSelection] = useState(true);
  const [timelineCopied, setTimelineCopied] = useState<'time' | 'beat' | null>(null);
  const timelineCopyTimeoutRef = useRef(0);

  useEffect(
    () => () => {
      window.clearTimeout(timelineCopyTimeoutRef.current);
    },
    [],
  );

  let source: ViewerShareSource | null =
    liveTarget === undefined
      ? null
      : {
          type: 'live',
          playerId: liveTarget.playerId,
          tournamentId: liveTarget.tournamentId,
          roomId: liveTarget.roomId,
          matchId: liveTarget.matchId,
        };
  if (source === null && scoreId !== null) source = { type: 'score', scoreId };
  if (source === null && sourceLink !== null) {
    source =
      sourceLink.type === 'map'
        ? {
            type: 'map',
            mapKey: sourceLink.url,
            difficultyIndex: selectedDifficultyIndex < 0 ? undefined : selectedDifficultyIndex,
          }
        : { type: 'replay', replayUrl: sourceLink.url };
  }
  if (source === null && mapIdentity !== null) {
    source = {
      type: 'map',
      mapKey: mapIdentity.key,
      difficultyIndex: selectedDifficultyIndex < 0 ? undefined : selectedDifficultyIndex,
    };
  }

  function shareUrlFor(
    selectedCategories: readonly ShareSettingsCategory[],
    includeBeat: boolean,
    includeTrimSelection: boolean,
  ) {
    if (source === null) return null;
    const location = router.buildLocation({
      to: '/',
      search: viewerSearchForShare(
        source,
        includeBeat ? beat : undefined,
        includeTrimSelection ? trimStartBeat : undefined,
        includeTrimSelection ? trimEndBeat : undefined,
        settingsForShareCategories(settings, selectedCategories),
        isForcedLightshowMode(lightshowMode) ? lightshowMode : undefined,
      ),
    });
    return new URL(location.href, window.location.origin).href;
  }

  async function copyShareLink(url: string) {
    const result = await Result.tryPromise(() => navigator.clipboard.writeText(url));
    if (result.isOk()) return true;
    setError(t('errors.copyShareLink'));
    return false;
  }

  async function copyTimelineShareLink(target: 'time' | 'beat') {
    const url = shareUrlFor([], true, false);
    if (url === null || !(await copyShareLink(url))) {
      setTimelineCopied(null);
      return;
    }
    window.clearTimeout(timelineCopyTimeoutRef.current);
    setTimelineCopied(target);
    timelineCopyTimeoutRef.current = window.setTimeout(() => {
      setTimelineCopied(null);
    }, 1500);
  }

  return {
    copyShareLink,
    copyTimelineShareLink,
    includeTimecode,
    includeTrimSelection,
    setIncludeTimecode,
    setIncludeTrimSelection,
    setShareCategories: setCategories,
    shareCategories: categories,
    shareUrl: shareUrlFor(categories, includeTimecode, includeTrimSelection),
    timelineCopied,
    timelineShareUrl: source?.type === 'live' ? null : shareUrlFor([], true, true),
  };
}
