import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';

import { useRouter } from '@tanstack/react-router';
import { Result } from 'better-result';
import { useTranslations } from 'use-intl';

import { difficultyRank, type InfoDifficulty } from '../../core/beatmap/info';
import { isForcedLightshowMode, type LightshowMode } from '../../core/lighting/basic-light';
import type { ShareSettingsCategory } from '../../core/share-link';
import { encodeShareSettings } from '../../core/share-settings-codec';
import type { ViewerSettings } from '../../core/viewer-settings';
import type { LiveTarget } from '../live/live-types';
import { viewerSearchForShare, type ViewerShareSource } from './viewer-search';
import type { MapIdentity, ViewerSourceLink } from './viewer-types';

interface UseViewerShareOptions {
  beat: number;
  lightshowMode: LightshowMode;
  liveTarget?: LiveTarget;
  mapIdentity: MapIdentity | null;
  scoreId: string | null;
  scoreIdBL: string | null;
  selectedDifficulty?: InfoDifficulty;
  settings: ViewerSettings;
  sourceLink: ViewerSourceLink | null;
  setError: Dispatch<SetStateAction<string>>;
}

export function useViewerShare({
  beat,
  lightshowMode,
  liveTarget,
  mapIdentity,
  scoreId,
  scoreIdBL,
  selectedDifficulty,
  settings,
  sourceLink,
  setError,
}: UseViewerShareOptions) {
  const router = useRouter();
  const t = useTranslations('viewer');
  const [categories, setCategories] = useState<ShareSettingsCategory[]>([]);
  const [includeTimecode, setIncludeTimecode] = useState(false);
  const [resetOthers, setResetOthers] = useState(true);
  const [timelineCopied, setTimelineCopied] = useState<'time' | 'beat' | null>(null);
  const timelineCopyTimeoutRef = useRef(0);
  const selectedRank = selectedDifficulty === undefined ? -1 : difficultyRank(selectedDifficulty.difficulty);
  const mapSelection =
    selectedDifficulty === undefined || selectedRank === -1
      ? {}
      : { difficulty: selectedRank, characteristic: selectedDifficulty.characteristic };

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
  if (source === null && scoreIdBL !== null) source = { type: 'score-bl', scoreId: scoreIdBL };
  if (source === null && sourceLink !== null) {
    source =
      sourceLink.type === 'map'
        ? {
            type: 'map',
            mapKey: sourceLink.url,
            ...mapSelection,
          }
        : { type: 'replay', replayUrl: sourceLink.url };
  }
  if (source === null && mapIdentity !== null) {
    source = {
      type: 'map',
      mapKey: mapIdentity.key,
      ...mapSelection,
    };
  }

  function shareUrlFor(selectedCategories: readonly ShareSettingsCategory[], includeBeat: boolean) {
    if (source === null) return null;
    const location = router.buildLocation({
      to: '/',
      search: viewerSearchForShare(
        source,
        includeBeat ? beat : undefined,
        isForcedLightshowMode(lightshowMode) ? lightshowMode : undefined,
      ),
    });
    const url = new URL(location.href, window.location.origin);
    url.hash = '';
    const code = encodeShareSettings(settings, selectedCategories, resetOthers);
    return code === undefined ? url.href : `${url.href}#${code}`;
  }

  async function copyShareLink(url: string) {
    const result = await Result.tryPromise(() => navigator.clipboard.writeText(url));
    if (result.isOk()) return true;
    setError(t('errors.copyShareLink'));
    return false;
  }

  async function copyTimelineShareLink(target: 'time' | 'beat') {
    const url = shareUrlFor([], true);
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
    setIncludeTimecode,
    resetOthers,
    setResetOthers,
    setShareCategories: setCategories,
    shareCategories: categories,
    shareUrl: shareUrlFor(categories, includeTimecode),
    timelineCopied,
    timelineShareUrl: source?.type === 'live' ? null : shareUrlFor([], true),
  };
}
