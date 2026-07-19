import { useEffect, useRef, useState, type MouseEventHandler } from 'react';

import { Result } from 'better-result';
import { ArrowLeft, Check, ChevronDown, ChevronUp, Disc3, Hash, Settings } from 'lucide-react';
import { useTranslations } from 'use-intl';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

import { cn } from '@/lib/utils';

export interface DifficultyOption {
  key: string;
  label: string;
  disabled: boolean;
  difficulty: string;
}

const difficultyAccent: Record<string, string> = {
  Easy: 'before:bg-difficulty-easy',
  Normal: 'before:bg-difficulty-normal',
  Hard: 'before:bg-difficulty-hard',
  Expert: 'before:bg-difficulty-expert',
  ExpertPlus: 'before:bg-difficulty-expert-plus',
  'Expert+': 'before:bg-difficulty-expert-plus',
};

interface MapSummaryCardProps {
  difficultyReadOnly?: boolean;
  dockedOnMobile?: boolean;
  mobileCollapseRequest?: number;
  showBackButton?: boolean;
  title: string;
  subtitle: string;
  author: string;
  mapper: string;
  coverUrl: string | null;
  mapKey: string | null;
  mapHash: string | null;
  scoreSaberUrl: string | null;
  options: DifficultyOption[];
  selectedKey: string;
  settingsOpen: boolean;
  onSelectDifficulty: (key: string) => void;
  onBack: () => void;
  onCopyError: () => void;
  onSettingsClick: MouseEventHandler<HTMLButtonElement>;
}

export function MapSummaryCard({
  difficultyReadOnly = false,
  dockedOnMobile = false,
  mobileCollapseRequest = 0,
  showBackButton = true,
  title,
  subtitle,
  author,
  mapper,
  coverUrl,
  mapKey,
  mapHash,
  scoreSaberUrl,
  options,
  selectedKey,
  settingsOpen,
  onSelectDifficulty,
  onBack,
  onCopyError,
  onSettingsClick,
}: MapSummaryCardProps) {
  const t = useTranslations('viewer.map');
  const tc = useTranslations('common');
  const fullTitle = subtitle === '' ? title : `${title} ${subtitle}`;
  const selectedDifficulty = options.find((option) => option.key === selectedKey)?.difficulty ?? '';
  const [hashCopied, setHashCopied] = useState(false);
  const [mobileCollapsed, setMobileCollapsed] = useState(false);
  const copyTimeoutRef = useRef(0);
  const mapUrl = mapKey === null ? null : `https://beatsaver.com/maps/${mapKey}`;

  useEffect(
    () => () => {
      window.clearTimeout(copyTimeoutRef.current);
    },
    [],
  );

  useEffect(() => {
    if (mobileCollapseRequest > 0) setMobileCollapsed(true);
  }, [mobileCollapseRequest]);

  async function copyHash() {
    if (mapHash === null) return;
    const result = await Result.tryPromise(() => navigator.clipboard.writeText(mapHash));
    if (result.isErr()) {
      onCopyError();
      return;
    }
    window.clearTimeout(copyTimeoutRef.current);
    setHashCopied(true);
    copyTimeoutRef.current = window.setTimeout(() => {
      setHashCopied(false);
    }, 2000);
  }

  return (
    <Card
      className={cn(
        'bg-card/88 relative flex w-[min(25rem,calc(100vw-1.5rem))] overflow-hidden backdrop-blur-xl',
        dockedOnMobile
          ? 'max-sm:w-screen max-sm:rounded-none max-sm:pt-[env(safe-area-inset-top)] max-sm:pr-[env(safe-area-inset-right)] max-sm:pl-[env(safe-area-inset-left)]'
          : 'max-sm:w-[calc(100vw-1rem)]',
      )}
    >
      <div className="absolute top-[max(0.375rem,env(safe-area-inset-top))] right-[max(0.375rem,env(safe-area-inset-right))] z-10 hidden items-center gap-0.5 max-sm:flex">
        <Button
          className="size-6"
          variant="ghost"
          size="icon-sm"
          aria-label={tc('settings')}
          title={tc('settings')}
          aria-expanded={settingsOpen}
          onClick={onSettingsClick}
        >
          <Settings />
        </Button>
        <Button
          className="size-6"
          variant="ghost"
          size="icon-sm"
          aria-label={t(mobileCollapsed ? 'expandInfo' : 'collapseInfo')}
          title={t(mobileCollapsed ? 'expandInfo' : 'collapseInfo')}
          aria-expanded={!mobileCollapsed}
          onClick={() => {
            setMobileCollapsed((collapsed) => !collapsed);
          }}
        >
          {mobileCollapsed ? <ChevronDown /> : <ChevronUp />}
        </Button>
      </div>
      <div
        className={cn(
          'bg-muted relative w-28 shrink-0 overflow-hidden border-r max-sm:w-17',
          mobileCollapsed && 'max-sm:hidden',
        )}
      >
        {coverUrl === null ? (
          <Disc3
            className="text-muted-foreground absolute top-1/2 left-1/2 size-8 -translate-x-1/2 -translate-y-1/2"
            aria-hidden
          />
        ) : (
          <img className="size-full object-cover" src={coverUrl} alt="" />
        )}
      </div>
      <div className="flex min-w-0 flex-1 gap-2 p-2 max-sm:flex-col max-sm:gap-1 max-sm:p-1.5">
        <p
          className="hidden min-w-0 pr-14 text-sm font-semibold max-sm:line-clamp-2 max-sm:whitespace-normal"
          title={fullTitle}
        >
          {fullTitle}
        </p>
        {author !== '' && (
          <p
            className={cn(
              'text-muted-foreground hidden truncate text-xs max-sm:block',
              mobileCollapsed && 'max-sm:hidden',
            )}
            title={author}
          >
            {t('byAuthor', { author })}
          </p>
        )}
        {mapper !== '' && (
          <p
            className={cn(
              'text-muted-foreground hidden truncate text-xs max-sm:block',
              mobileCollapsed && 'max-sm:hidden',
            )}
            title={mapper}
          >
            {t('mappedBy', { mapper })}
          </p>
        )}
        <div
          className={cn(
            '-ml-1 flex shrink-0 flex-col items-center gap-0.5 max-sm:ml-0 max-sm:flex-row',
            mobileCollapsed && 'max-sm:hidden',
          )}
        >
          {showBackButton && (
            <Button
              className="size-6 max-sm:hidden"
              variant="ghost"
              size="icon-sm"
              aria-label={tc('back')}
              title={tc('back')}
              onClick={onBack}
            >
              <ArrowLeft />
            </Button>
          )}
          {mapUrl !== null && (
            <Button className="size-5" variant="ghost" size="icon-sm" asChild>
              <a
                href={mapUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={t('openBeatSaver')}
                title={t('openBeatSaver')}
              >
                <img
                  className="block size-4 shrink-0 object-contain"
                  src={`${import.meta.env.BASE_URL}beatsaver.svg`}
                  alt=""
                />
              </a>
            </Button>
          )}
          {scoreSaberUrl !== null && (
            <Button className="size-5" variant="ghost" size="icon-sm" asChild>
              <a
                href={scoreSaberUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={t('openScoreSaber')}
                title={t('openScoreSaber')}
              >
                <img
                  className="block size-4 shrink-0 object-contain"
                  src={`${import.meta.env.BASE_URL}scoresaber.svg`}
                  alt=""
                />
              </a>
            </Button>
          )}
          {mapHash !== null && (
            <Button
              className="size-5"
              variant="ghost"
              size="icon-sm"
              aria-label={t('copyHash')}
              title={hashCopied ? t('copiedHash') : t('copyHash')}
              onClick={() => {
                void copyHash();
              }}
            >
              {hashCopied ? <Check /> : <Hash />}
            </Button>
          )}
        </div>
        <div className="flex min-w-0 flex-1 flex-col">
          <p className="truncate text-sm font-semibold max-sm:hidden" title={fullTitle}>
            {fullTitle}
          </p>
          {author !== '' && (
            <p className="text-muted-foreground truncate text-xs max-sm:hidden" title={author}>
              {t('byAuthor', { author })}
            </p>
          )}
          {mapper !== '' && (
            <p className="text-muted-foreground truncate text-xs max-sm:hidden" title={mapper}>
              {t('mappedBy', { mapper })}
            </p>
          )}
          <div className="mt-auto pt-2 max-sm:pt-1">
            <Select value={selectedKey} disabled={difficultyReadOnly} onValueChange={onSelectDifficulty}>
              <SelectTrigger
                className={cn(
                  'relative h-8 bg-background/70 pl-5 text-xs before:absolute before:left-2 before:h-4 before:w-0.5 before:bg-border max-sm:h-7',
                  difficultyAccent[selectedDifficulty],
                )}
                aria-label={t('difficulty')}
              >
                <SelectValue placeholder={t('selectDifficulty')} />
              </SelectTrigger>
              <SelectContent
                align="start"
                sideOffset={6}
                className="w-max max-w-[calc(100vw-1rem)] min-w-(--radix-select-trigger-width)"
              >
                <SelectGroup>
                  {options.map((option) => (
                    <SelectItem
                      className={cn(
                        'my-0.5 pl-5 before:absolute before:left-2 before:h-4 before:w-0.5 before:bg-border',
                        difficultyAccent[option.difficulty],
                      )}
                      key={option.key}
                      value={option.key}
                      disabled={option.disabled}
                    >
                      <span className="block max-w-[min(22rem,calc(100vw-5rem))] truncate" title={option.label}>
                        {option.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
    </Card>
  );
}
