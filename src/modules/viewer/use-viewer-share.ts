import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';

import { useRouter } from '@tanstack/react-router';
import { Result } from 'better-result';
import { useTranslations } from 'use-intl';

import { settingsForShareCategories, type ShareSettingsCategory } from '../../core/share-link';
import type { ViewerSettings } from '../../core/viewer-settings';
import type { LiveTarget } from '../live/live-types';
import { viewerSearchForShare, type ViewerShareSource } from './viewer-search';
import type { MapIdentity } from './viewer-types';

interface UseViewerShareOptions {
  beat: number;
  liveTarget?: LiveTarget;
  mapIdentity: MapIdentity | null;
  scoreId: string | null;
  selectedDifficultyIndex: number;
  settings: ViewerSettings;
  setError: Dispatch<SetStateAction<string>>;
}

export function useViewerShare({
  beat,
  liveTarget,
  mapIdentity,
  scoreId,
  selectedDifficultyIndex,
  settings,
  setError,
}: UseViewerShareOptions) {
  const router = useRouter();
  const t = useTranslations('viewer');
  const [categories, setCategories] = useState<ShareSettingsCategory[]>([]);
  const [includeTimecode, setIncludeTimecode] = useState(true);
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
  if (source === null && mapIdentity !== null) {
    source = {
      type: 'map',
      mapKey: mapIdentity.key,
      difficultyIndex: selectedDifficultyIndex < 0 ? undefined : selectedDifficultyIndex,
    };
  }

  function shareUrlFor(selectedCategories: readonly ShareSettingsCategory[], includeBeat: boolean) {
    if (source === null) return null;
    const location = router.buildLocation({
      to: '/',
      search: viewerSearchForShare(
        source,
        includeBeat ? beat : undefined,
        settingsForShareCategories(settings, selectedCategories),
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
    setShareCategories: setCategories,
    shareCategories: categories,
    shareUrl: shareUrlFor(categories, includeTimecode),
    timelineCopied,
    timelineShareUrl: source?.type === 'live' ? null : shareUrlFor([], true),
  };
}
