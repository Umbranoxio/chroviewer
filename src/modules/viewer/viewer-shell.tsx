import { useEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent as ReactMouseEvent } from 'react';

import { useRouter, useSearch } from '@tanstack/react-router';
import {
  AlertCircle,
  Download,
  LoaderCircle,
  Menu,
  Pause,
  Play,
  RotateCcw,
  UsersRound,
  Volume2,
  X,
} from 'lucide-react';
import { useTranslations } from 'use-intl';

import type { LightshowMode } from '../../core/lighting/basic-light';
import { loadViewerSettings } from '../../core/viewer-settings';
import { environmentCatalog } from '../../renderer/environment/environment-catalog';
import { LudusPlayState } from '../live/generated/proto/scoresaber/live/v1/common_pb';
import type { LiveTarget } from '../live/live-types';
import { LiveViewerPanel } from '../live/live-viewer-panel';
import { useLiveExperience } from '../live/use-live-experience';
import { ReplayPlayerCard } from '../replay/replay-player-card';
import { SettingsDrawer } from '../settings/settings-drawer';
import { useWatchPartyExperience } from '../watch-party/use-watch-party-experience';
import { WatchPartyControls } from '../watch-party/watch-party-controls';
import { WatchPartyPanel } from '../watch-party/watch-party-panel';
import {
  applyWatchPartyViewerSettings,
  encodeWatchPartyViewerSettings,
  parseWatchPartyViewerSettings,
  preserveLocalWatchPartyViewerSettings,
} from '../watch-party/watch-party-viewer-settings';
import { MapSummaryCard } from './components/map-summary-card';
import { SourcePicker } from './components/source-picker';
import { ViewerActions } from './components/viewer-actions';
import { ViewerOverlay } from './components/viewer-overlay';
import { buildTimelineMarkers } from './timeline-markers';
import { TransportControls } from './transport/transport-controls';
import { useSongTransport } from './use-song-transport';
import { useViewerControls } from './use-viewer-controls';
import { useViewerSession } from './use-viewer-session';
import { useViewerShare } from './use-viewer-share';
import { useViewerSources } from './use-viewer-sources';
import { quantizedBeatAt } from './viewer-timeline';
import type { ViewerPanel } from './viewer-types';

import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

import { cn } from '@/lib/utils';

export function ViewerShell() {
  const router = useRouter();
  const search = useSearch({ from: '/' });
  const t = useTranslations('viewer');
  const commonT = useTranslations('common');
  const partyT = useTranslations('watchParty');
  const partyActive = search.party !== undefined;
  const [settings, setSettings] = useState(() => {
    const saved = loadViewerSettings();
    return search.lightshow === 'full-lightshow' ? { ...saved, staticLights: false } : saved;
  });
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const [partyViewerSettingsJson, setPartyViewerSettingsJson] = useState<string | null>(null);
  const partyViewerSettings = useMemo(
    () => (partyViewerSettingsJson === null ? null : parseWatchPartyViewerSettings(partyViewerSettingsJson)),
    [partyViewerSettingsJson],
  );
  const effectiveSettings = useMemo(
    () =>
      partyActive && partyViewerSettings !== null
        ? applyWatchPartyViewerSettings(settings, partyViewerSettings)
        : settings,
    [partyActive, partyViewerSettings, settings],
  );
  const effectiveSettingsRef = useRef(effectiveSettings);
  effectiveSettingsRef.current = effectiveSettings;
  const [error, setError] = useState('');
  const [lightshowMode, setLightshowMode] = useState<LightshowMode>(
    search.lightshow ?? (settings.staticLights ? 'static' : 'full'),
  );
  const lightshowModeRef = useRef(lightshowMode);
  const transport = useSongTransport({
    lightshowModeRef,
    settings,
    settingsRef,
  });
  const [activePanel, setActivePanel] = useState<ViewerPanel>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [chromeVisible, setChromeVisible] = useState(true);
  const [liveChatOpen, setLiveChatOpen] = useState(
    () => !settings.liveChatCollapsed && window.matchMedia('(min-width: 40rem)').matches,
  );
  const [mobileMapCollapseRequest, setMobileMapCollapseRequest] = useState(0);
  const [mobileViewport, setMobileViewport] = useState({
    chatHeight: 'min(44dvh, 20.4rem)',
    centerY: '50dvh',
    keyboardInset: 0,
  });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const liveChatInputRef = useRef<HTMLTextAreaElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const sources = useViewerSources({
    setError,
    setSettings,
    onClearViewer() {
      transport.clear();
      session.clearViewer();
    },
    onMapLoaded() {
      session.clearMapSelection();
    },
  });
  const session = useViewerSession({
    lightshowMode,
    lightshowModeRef,
    skipInitialMenuEnvironment: search.map !== undefined || search.scoreId !== undefined,
    setActivePanel,
    setError,
    setLightshowMode,
    setSettings,
    persistedSettings: settings,
    settings: effectiveSettings,
    settingsRef: effectiveSettingsRef,
    sources,
    transport,
  });
  const liveTarget: LiveTarget | null =
    search.playerId === undefined
      ? null
      : {
          playerId: search.playerId,
          tournamentId: search.tournamentId,
          roomId: search.roomId,
          matchId: search.matchId,
          watcherPlayerId: search.watcherPlayerId,
          authToken: search.authToken,
        };
  const liveActive = liveTarget !== null;
  const remoteActive = liveActive || partyActive;
  const live = useLiveExperience({
    appendReplayHeightEvents: session.appendLiveReplayHeightEvents,
    appendReplayNoteEvents: session.appendLiveReplayNoteEvents,
    hasLiveMap: (hash) => sources.hasLiveMap(hash),
    loadLiveReplay: (hash, replay) => sources.loadLiveReplay(hash, replay),
    selectedKey: session.selectedKey,
    target: liveTarget,
    transport,
  });
  const party = useWatchPartyExperience({
    partyPlayerId: search.party ?? null,
    session,
    setError,
    sources,
    transport,
  });
  const partyIsHost = party.selfCapabilities?.host === true;
  useEffect(() => {
    if (!partyActive) return;
    const previewUrl = document.querySelector<HTMLMetaElement>('meta[property="og:image"]')?.content;
    if (previewUrl === undefined) return;
    const prefetch = document.createElement('link');
    prefetch.rel = 'prefetch';
    prefetch.as = 'image';
    prefetch.href = previewUrl;
    document.head.append(prefetch);
    return () => {
      prefetch.remove();
    };
  }, [partyActive, search.party]);
  useEffect(() => {
    const viewerSettings = party.serverState?.viewerSettings;
    if (!partyActive || viewerSettings?.schemaVersion !== 1) {
      setPartyViewerSettingsJson(null);
      return;
    }
    setPartyViewerSettingsJson(viewerSettings.json);
  }, [party.serverState?.viewerSettings, partyActive]);
  useEffect(() => {
    if (!partyActive || partyViewerSettings === null) return;
    session.applyAuthoritativeLightshowMode(partyViewerSettings.lightshowMode);
  }, [partyActive, partyViewerSettings?.lightshowMode]);
  useEffect(() => {
    if (!partyActive || !partyIsHost) return;
    const json = encodeWatchPartyViewerSettings(settings, lightshowMode);
    setPartyViewerSettingsJson(json);
    if (party.serverState?.viewerSettings?.schemaVersion === 1 && party.serverState.viewerSettings.json === json) {
      return;
    }
    const timeout = window.setTimeout(() => {
      party.setViewerSettings(json);
    }, 200);
    return () => {
      window.clearTimeout(timeout);
    };
  }, [lightshowMode, party.serverState?.viewerSettings, partyActive, partyIsHost, party.setViewerSettings, settings]);
  const partyMapMatchesSource =
    party.serverState?.map !== undefined &&
    sources.mapIdentity?.hash.toLowerCase() === party.serverState.map.hash.toLowerCase();
  const showMapCard =
    sources.mapMeta !== null &&
    (!partyActive || (partyMapMatchesSource && (partyIsHost || party.serverState?.mapRevealed === true)));
  useEffect(() => {
    const viewport = window.visualViewport;
    if (viewport === null) return;
    const visualViewport: VisualViewport = viewport;
    let animationFrame = 0;

    function updateViewport() {
      window.cancelAnimationFrame(animationFrame);
      animationFrame = window.requestAnimationFrame(() => {
        const activeElement = document.activeElement;
        const editing =
          activeElement instanceof HTMLInputElement ||
          activeElement instanceof HTMLTextAreaElement ||
          (activeElement instanceof HTMLElement && activeElement.isContentEditable);
        const occludedBottom = Math.max(0, window.innerHeight - visualViewport.height - visualViewport.offsetTop);
        const keyboardInset = editing && occludedBottom > 80 ? occludedBottom : 0;
        const rootFontSize = Number.parseFloat(window.getComputedStyle(document.documentElement).fontSize);
        const chatHeight = Math.min(visualViewport.height * 0.44, rootFontSize * 20.4);
        setMobileViewport({
          chatHeight: `${chatHeight}px`,
          centerY: `${visualViewport.offsetTop + visualViewport.height / 2}px`,
          keyboardInset,
        });
      });
    }

    updateViewport();
    visualViewport.addEventListener('resize', updateViewport);
    visualViewport.addEventListener('scroll', updateViewport);
    window.addEventListener('orientationchange', updateViewport);
    document.addEventListener('focusin', updateViewport);
    document.addEventListener('focusout', updateViewport);
    return () => {
      window.cancelAnimationFrame(animationFrame);
      visualViewport.removeEventListener('resize', updateViewport);
      visualViewport.removeEventListener('scroll', updateViewport);
      window.removeEventListener('orientationchange', updateViewport);
      document.removeEventListener('focusin', updateViewport);
      document.removeEventListener('focusout', updateViewport);
    };
  }, []);
  useEffect(() => {
    if (!remoteActive) return;
    function openChat(event: KeyboardEvent) {
      if (event.key !== 'F8') return;
      event.preventDefault();
      setChromeVisible(true);
      setLiveChatOpen(true);
      setSettings((current) => ({ ...current, liveChatCollapsed: false }));
      setMobileMapCollapseRequest((request) => request + 1);
      window.requestAnimationFrame(() => liveChatInputRef.current?.focus());
    }
    window.addEventListener('keydown', openChat, true);
    return () => {
      window.removeEventListener('keydown', openChat, true);
    };
  }, [remoteActive]);
  function toggleHitsounds() {
    setSettings((current) => ({ ...current, hitsounds: !current.hitsounds }));
  }

  function toggleMasterMuted() {
    if (settingsRef.current.masterMuted) void transport.unlockAudio();
    setSettings((current) => ({ ...current, masterMuted: !current.masterMuted }));
  }

  function toggleSongMuted() {
    if (settingsRef.current.songMuted) void transport.unlockAudio();
    setSettings((current) => ({ ...current, songMuted: !current.songMuted }));
  }

  function toggleSettings(event: ReactMouseEvent<HTMLButtonElement>) {
    triggerRef.current = event.currentTarget;
    setActivePanel(null);
    setSettingsOpen((open) => !open);
  }

  useViewerControls({
    activePanel,
    autoHide: remoteActive ? false : settings.autoHide,
    beatStep: transport.beatStepNumerator / transport.beatStepDenominator,
    playing: transport.playing,
    transportReadOnly: remoteActive,
    setActivePanel,
    setChromeVisible,
    triggerRef,
    onSeekBeats: (beats) => {
      transport.seekBeats(beats, sources.songBpm);
    },
    onToggleHitsounds: toggleHitsounds,
    onTogglePlay: transport.togglePlay,
  });

  const beatStep = transport.beatStepNumerator / transport.beatStepDenominator;
  const displayBeat = quantizedBeatAt(transport.time, sources.songBpm, beatStep);
  const selectedDifficulty = useMemo(
    () => sources.rows.find((row) => row.key === session.selectedKey)?.difficulty ?? null,
    [session.selectedKey, sources.rows],
  );
  const replay = sources.replayRef.current;
  const replayNoteCount = replay?.notes.length ?? 0;
  const replayPauseCount = replay?.pauses.length ?? 0;
  const latestPauseDuration = replay?.pauses.at(-1)?.duration;
  const timelineMarkers = useMemo(
    () => buildTimelineMarkers(replay, selectedDifficulty, sources.songBpm, settings.showBookmarks),
    [
      latestPauseDuration,
      replay,
      replayNoteCount,
      replayPauseCount,
      selectedDifficulty,
      settings.showBookmarks,
      sources.songBpm,
    ],
  );
  const share = useViewerShare({
    beat: displayBeat,
    lightshowMode,
    liveTarget: liveTarget ?? undefined,
    mapIdentity: sources.mapIdentity,
    scoreId: sources.shareScoreId,
    selectedDifficultyIndex: session.selectedDifficultyIndex,
    settings,
    sourceLink: sources.sourceLink,
    setError,
  });
  const liveInterruption =
    live.status === 'connecting' || live.status === 'reconnecting'
      ? { icon: LoaderCircle, iconClassName: 'animate-spin', label: t('liveConnecting') }
      : live.status === 'loading'
        ? { icon: Download, iconClassName: '', label: t('liveDownloadingMap'), progress: sources.liveDownloadProgress }
        : live.status === 'buffering'
          ? { icon: LoaderCircle, iconClassName: 'animate-spin', label: t('liveBuffering') }
          : live.playState === LudusPlayState.PAUSED || live.status === 'paused'
            ? { icon: Pause, iconClassName: 'fill-current', label: t('livePaused') }
            : live.playState === LudusPlayState.IN_MENUS
              ? { icon: Menu, iconClassName: '', label: t('liveInMenus') }
              : null;
  const partyInterruption = !partyActive
    ? null
    : party.status === 'connecting'
      ? { icon: LoaderCircle, iconClassName: 'animate-spin', label: partyT('connecting') }
      : party.status === 'reconnecting'
        ? { icon: LoaderCircle, iconClassName: 'animate-spin', label: partyT('reconnecting') }
        : party.status === 'loading' || party.hostMapLoading
          ? {
              icon: Download,
              iconClassName: '',
              label: partyT('downloadingMap'),
              progress: sources.liveDownloadProgress,
            }
          : !partyIsHost && party.serverState?.map === undefined
            ? { icon: UsersRound, iconClassName: '', label: partyT('waitingForHostMap') }
            : !partyIsHost && party.mapReady && party.serverState?.mapRevealed !== true
              ? { icon: UsersRound, iconClassName: '', label: partyT('waitingForHostStart') }
              : null;
  const playbackOverlay = remoteActive
    ? null
    : sources.sourceLoading
      ? {
          icon: Download,
          iconClassName: '',
          label:
            sources.sourceDownload?.kind === 'scoresaber' || sources.sourceDownload?.kind === 'replay'
              ? t('downloadingReplay')
              : t('liveDownloadingMap'),
          progress: sources.sourceDownload?.progress ?? null,
        }
      : session.environmentLoading
        ? { icon: LoaderCircle, iconClassName: 'animate-spin', label: t('environmentLoading') }
        : session.selectedKey !== '' && transport.ended
          ? {
              actionLabel: commonT('replay'),
              icon: RotateCcw,
              label: commonT('replay'),
              onAction: () => {
                transport.togglePlay();
              },
            }
          : session.selectedKey !== '' && !transport.started
            ? {
                actionLabel: commonT('play'),
                icon: Play,
                label: commonT('play'),
                onAction: () => {
                  transport.togglePlay();
                },
              }
            : null;
  const viewportStyle: CSSProperties &
    Record<
      '--live-keyboard-inset' | '--live-mobile-chat-height' | '--live-safe-area-bottom' | '--live-viewport-center-y',
      string
    > = {
    '--live-keyboard-inset': `${mobileViewport.keyboardInset}px`,
    '--live-mobile-chat-height': mobileViewport.chatHeight,
    '--live-safe-area-bottom': mobileViewport.keyboardInset > 0 ? '0px' : 'env(safe-area-inset-bottom)',
    '--live-viewport-center-y': mobileViewport.centerY,
  };
  return (
    <main
      className="relative size-full overflow-hidden bg-black [--live-sidebar-width:18rem]"
      style={viewportStyle}
      onDragOver={(event) => {
        event.preventDefault();
      }}
      onDrop={(event) => {
        event.preventDefault();
        if (!remoteActive) void sources.loadFiles([...event.dataTransfer.files]);
      }}
    >
      <div
        className={cn(
          'absolute inset-0 transition-[bottom] duration-300 ease-out',
          remoteActive &&
            liveChatOpen &&
            'max-sm:bottom-[calc(var(--live-mobile-chat-height)+var(--live-safe-area-bottom)+var(--live-keyboard-inset))]',
        )}
      >
        <canvas
          ref={session.canvasRef}
          className={cn(
            'absolute inset-0 size-full',
            partyActive && !partyIsHost && !(party.mapReady && party.serverState?.mapRevealed === true) && 'invisible',
          )}
          onPointerDown={() => {
            setSettingsOpen(false);
          }}
          onWheel={(event) => {
            if (remoteActive || session.selectedKey === '' || event.deltaY === 0 || event.ctrlKey || event.metaKey)
              return;
            transport.seekBeats(Math.sign(event.deltaY) * beatStep, sources.songBpm);
          }}
        />
      </div>

      {liveActive && liveInterruption !== null && (
        <ViewerOverlay
          backdropBlur={false}
          className={cn(
            liveChatOpen &&
              'max-sm:bottom-[calc(var(--live-mobile-chat-height)+var(--live-safe-area-bottom)+var(--live-keyboard-inset))]',
          )}
          icon={liveInterruption.icon}
          iconClassName={liveInterruption.iconClassName}
          label={liveInterruption.label}
          progress={'progress' in liveInterruption ? liveInterruption.progress : undefined}
        />
      )}

      {partyInterruption !== null && (
        <ViewerOverlay
          backdropBlur={false}
          className={cn(
            'z-20',
            !partyIsHost && party.mapReady && party.serverState?.mapRevealed !== true && 'bg-black',
            liveChatOpen &&
              'max-sm:bottom-[calc(var(--live-mobile-chat-height)+var(--live-safe-area-bottom)+var(--live-keyboard-inset))]',
          )}
          icon={partyInterruption.icon}
          iconClassName={partyInterruption.iconClassName}
          label={partyInterruption.label}
          progress={'progress' in partyInterruption ? partyInterruption.progress : undefined}
        />
      )}

      {playbackOverlay !== null && (
        <ViewerOverlay
          {...playbackOverlay}
          className={'onAction' in playbackOverlay ? '!bottom-16 max-sm:!bottom-24' : undefined}
        />
      )}

      {!liveActive && transport.audioBlocked && (
        <Button
          className="fixed bottom-16 left-1/2 z-40 -translate-x-1/2 rounded-full shadow-xl backdrop-blur-xl max-sm:bottom-24"
          variant="outline"
          aria-label={t('clickToUnmute')}
          onClick={() => {
            void (partyActive ? party.unlockAudio() : transport.unlockAudio());
          }}
        >
          <Volume2 />
          {t('clickToUnmute')}
        </Button>
      )}

      {remoteActive && liveChatOpen && (
        <div
          className="fixed inset-x-0 top-0 bottom-[calc(var(--live-mobile-chat-height)+var(--live-safe-area-bottom)+var(--live-keyboard-inset))] z-20 hidden max-sm:block"
          aria-hidden="true"
          onPointerDown={() => {
            setLiveChatOpen(false);
            setSettings((current) => ({ ...current, liveChatCollapsed: true }));
          }}
        />
      )}

      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        multiple
        accept=".dat,.json,.zip,.ogg,.egg,.wav,.mp3"
        onChange={(event) => {
          void sources.loadFiles([...(event.currentTarget.files ?? [])]);
          event.currentTarget.value = '';
        }}
      />

      <SourcePicker
        choices={sources.sourceChoices}
        input={sources.sourceInput}
        visible={sources.mapMeta === null && !remoteActive && !sources.sourceLoading && !session.environmentLoading}
        onChoose={(choice) => {
          sources.loadLookup(choice);
        }}
        onInputChange={sources.setSourceInput}
        onOpenFiles={() => {
          fileInputRef.current?.click();
        }}
        onSubmit={(source) => {
          sources.loadSource(source);
        }}
      />

      {(showMapCard || remoteActive) && (
        <div
          className={cn(
            'fixed left-3 top-3 z-30 flex max-h-[calc(100dvh-1.5rem)] flex-col items-start gap-2 transition duration-200 max-sm:left-2 max-sm:top-2 max-sm:max-h-[calc(100dvh-1rem)]',
            remoteActive &&
              'h-[calc(100dvh-1.5rem)] max-sm:!left-0 max-sm:!top-0 max-sm:h-dvh max-sm:max-h-dvh max-sm:gap-0',
            !chromeVisible &&
              (!showMapCard || !settings.keepMapInfoVisible) &&
              'pointer-events-none -translate-y-2 opacity-0',
          )}
        >
          {(showMapCard || (partyActive && partyIsHost)) && (
            <div
              className={cn(
                partyActive && 'flex shrink-0 items-start gap-2 max-sm:w-screen max-sm:flex-col max-sm:gap-0',
              )}
            >
              {showMapCard && sources.mapMeta !== null && (
                <MapSummaryCard
                  difficultyReadOnly={partyActive}
                  dockedOnMobile={remoteActive}
                  mobileCollapseRequest={mobileMapCollapseRequest}
                  showBackButton={!partyActive}
                  title={sources.mapMeta.title}
                  subtitle={sources.mapMeta.subtitle}
                  author={sources.mapMeta.author}
                  mapper={sources.mapMeta.mapper}
                  coverUrl={sources.coverUrl}
                  mapKey={sources.mapIdentity?.key ?? null}
                  mapHash={sources.mapIdentity?.hash ?? null}
                  scoreSaberUrl={session.scoreSaberUrl}
                  options={session.difficultyOptions}
                  selectedKey={session.selectedKey}
                  settingsOpen={settingsOpen}
                  onSelectDifficulty={(key) => {
                    const row = sources.rows.find((candidate) => candidate.key === key);
                    if (row !== undefined) void session.selectDifficulty(row);
                  }}
                  onBack={() => {
                    void router.navigate({ to: '/', search: {}, replace: true, reloadDocument: true });
                  }}
                  onCopyError={() => {
                    setError(t('errors.copyMapInfo'));
                  }}
                  onSettingsClick={toggleSettings}
                />
              )}
              {partyActive && partyIsHost && (
                <div className={chromeVisible ? 'contents' : 'hidden'}>
                  <WatchPartyControls party={party} />
                </div>
              )}
            </div>
          )}
          <div className={chromeVisible ? 'contents' : 'hidden'}>
            {liveActive ? (
              <LiveViewerPanel
                chatInputRef={liveChatInputRef}
                chatOpen={liveChatOpen}
                live={live}
                onChatOpenChange={(open) => {
                  setLiveChatOpen(open);
                  setSettings((current) => ({ ...current, liveChatCollapsed: !open }));
                  if (open) setMobileMapCollapseRequest((request) => request + 1);
                }}
              />
            ) : partyActive ? (
              <WatchPartyPanel
                chatInputRef={liveChatInputRef}
                chatOpen={liveChatOpen}
                party={party}
                onLeave={() => {
                  void router.navigate({ to: '/', search: {}, replace: true });
                }}
                onChatOpenChange={(open) => {
                  setLiveChatOpen(open);
                  setSettings((current) => ({ ...current, liveChatCollapsed: !open }));
                  if (open) setMobileMapCollapseRequest((request) => request + 1);
                }}
              />
            ) : (
              sources.replayPlayer !== null && <ReplayPlayerCard player={sources.replayPlayer} />
            )}
          </div>
        </div>
      )}

      <ViewerActions
        chromeVisible={chromeVisible}
        hasMap={showMapCard}
        shareEnabled={!partyActive}
        settingsOpen={settingsOpen}
        shareCategories={share.shareCategories}
        shareIncludeTimecode={share.includeTimecode}
        shareOpen={activePanel === 'share'}
        shareUrl={share.shareUrl}
        shortcutsOpen={activePanel === 'shortcuts'}
        onCopyShare={share.copyShareLink}
        onSettingsClick={toggleSettings}
        onShareCategoriesChange={share.setShareCategories}
        onShareIncludeTimecodeChange={share.setIncludeTimecode}
        onShareOpenChange={(open) => {
          setActivePanel(open ? 'share' : null);
        }}
        onShortcutsOpenChange={(open) => {
          setActivePanel(open ? 'shortcuts' : null);
        }}
      />

      {session.selectedKey !== '' &&
        (!partyActive || (party.mapReady && (partyIsHost || party.serverState?.mapRevealed === true))) && (
          <TransportControls
            mode={partyActive ? 'party' : liveActive ? 'live' : 'playback'}
            visible={chromeVisible}
            playing={transport.playing}
            ended={transport.ended}
            time={transport.time}
            duration={transport.duration}
            songBpm={sources.songBpm}
            beatStepNumerator={transport.beatStepNumerator}
            beatStepDenominator={transport.beatStepDenominator}
            timelineShareUrl={share.timelineShareUrl}
            timelineCopied={share.timelineCopied}
            panel={
              activePanel === 'speed' ||
              activePanel === 'lights' ||
              activePanel === 'camera' ||
              activePanel === 'volume'
                ? activePanel
                : null
            }
            playbackRate={transport.playbackRate}
            lightshowMode={lightshowMode}
            lightshowReadOnly={partyActive && !partyIsHost}
            replayCamera={settings.replayCamera}
            hasReplay={sources.replayRef.current !== null}
            songMuted={settings.songMuted}
            masterMuted={settings.masterMuted}
            masterVolume={settings.masterVolume}
            songVolume={settings.songVolume}
            hitsounds={settings.hitsounds}
            hitsoundVolume={settings.hitsoundVolume}
            reverseTimelineScroll={settings.reverseTimelineScroll}
            markers={timelineMarkers}
            onTogglePlay={() => {
              transport.togglePlay();
            }}
            onSeek={transport.seek}
            onSeekBeats={(beats) => {
              transport.seekBeats(beats, sources.songBpm);
            }}
            onNumeratorChange={transport.setBeatStepNumerator}
            onDenominatorChange={transport.setBeatStepDenominator}
            onCopyTimeline={(target) => {
              void share.copyTimelineShareLink(target);
            }}
            onPanelChange={setActivePanel}
            onPlaybackRateChange={(rate) => {
              transport.setPlaybackRate(rate);
            }}
            onLightshowModeChange={session.changeLightshowMode}
            onReplayCameraChange={(replayCamera) => {
              setSettings({ ...settings, replayCamera });
              setActivePanel(null);
            }}
            onMasterVolumeChange={(masterVolume) => {
              if (settingsRef.current.masterVolume === 0 && masterVolume > 0) void transport.unlockAudio();
              setSettings((current) => ({ ...current, masterVolume }));
            }}
            onSongVolumeChange={(songVolume) => {
              if (settingsRef.current.songVolume === 0 && songVolume > 0) void transport.unlockAudio();
              setSettings((current) => ({ ...current, songVolume }));
            }}
            onHitsoundVolumeChange={(hitsoundVolume) => {
              setSettings((current) => ({ ...current, hitsoundVolume }));
            }}
            onToggleMasterMuted={toggleMasterMuted}
            onToggleSongMuted={toggleSongMuted}
            onToggleHitsounds={toggleHitsounds}
          />
        )}

      {error !== '' && (
        <Alert
          className="fixed bottom-20 left-1/2 z-50 w-[min(34rem,calc(100vw-1.5rem))] -translate-x-1/2"
          aria-live="assertive"
        >
          <span className="flex items-center gap-2">
            <AlertCircle className="text-destructive size-4 shrink-0" />
            {error}
          </span>
          {partyActive && party.canRetryMap && (
            <Button variant="outline" size="sm" onClick={party.retryMap}>
              {partyT('retry')}
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={t('dismissError')}
            onClick={() => {
              setError('');
            }}
          >
            <X />
          </Button>
        </Alert>
      )}
      <SettingsDrawer
        open={settingsOpen}
        settings={partyActive && !partyIsHost ? effectiveSettings : settings}
        environments={environmentCatalog}
        hasReplay={sources.replayRef.current !== null}
        isMapPreview={session.selectedKey !== '' && sources.replayRef.current === null}
        onChange={(nextSettings) => {
          setSettings((current) =>
            partyActive && !partyIsHost ? preserveLocalWatchPartyViewerSettings(current, nextSettings) : nextSettings,
          );
        }}
        onClose={() => {
          setSettingsOpen(false);
        }}
      />
    </main>
  );
}
