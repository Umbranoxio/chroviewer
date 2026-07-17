import { useState } from 'react';

import { ArrowRight, FolderOpen, Link as LinkIcon } from 'lucide-react';
import { useTranslations } from 'use-intl';

import type { MapLookup } from '../../../sources/source-types';
import { isRemoteSourceUrl } from '../viewer-search';
import type { ViewerSource } from '../viewer-types';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { InputGroup, InputGroupButton, InputGroupInput } from '@/components/ui/input-group';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

interface SourcePickerProps {
  choices: MapLookup[];
  input: string;
  visible: boolean;
  onChoose: (choice: MapLookup) => void;
  onInputChange: (input: string) => void;
  onOpenFiles: () => void;
  onSubmit: (source: ViewerSource) => void;
}

export function SourcePicker({
  choices,
  input,
  visible,
  onChoose,
  onInputChange,
  onOpenFiles,
  onSubmit,
}: SourcePickerProps) {
  const t = useTranslations('source');
  const [source, setSource] = useState<ViewerSource>('beatsaver');
  const scoreSaber = source === 'scoresaber';
  const link = source === 'link';
  const trimmedInput = input.trim();
  const validInput =
    trimmedInput !== '' && (!scoreSaber || /^\d+$/.test(trimmedInput)) && (!link || isRemoteSourceUrl(trimmedInput));
  const inputLabel = scoreSaber ? t('scoresaberInputLabel') : link ? t('linkInputLabel') : t('beatsaverInputLabel');
  const inputPlaceholder = scoreSaber
    ? t('scoresaberInputPlaceholder')
    : link
      ? t('linkInputPlaceholder')
      : t('beatsaverInputPlaceholder');

  return (
    <>
      {visible && (
        <Card
          className="bg-card/88 fixed top-1/2 left-1/2 z-20 w-[min(30rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 p-5 backdrop-blur-xl"
          role="group"
          aria-label={t('loadGroup')}
        >
          <h1 className="mb-4 text-center text-base font-semibold">ChroViewer</h1>
          <ToggleGroup
            className="bg-muted/60 mb-3 grid grid-cols-3 rounded-lg border p-1"
            type="single"
            value={source}
            aria-label={t('sourceType')}
            onValueChange={(value) => {
              if (value === 'beatsaver' || value === 'link' || value === 'scoresaber') setSource(value);
            }}
          >
            <ToggleGroupItem
              className="data-[state=on]:bg-background data-[state=on]:text-foreground h-9 gap-3 data-[state=on]:shadow-sm"
              value="beatsaver"
              aria-label={t('beatsaver')}
            >
              <img className="size-5" src={`${import.meta.env.BASE_URL}beatsaver.svg`} alt="" aria-hidden="true" />
              {t('beatsaver')}
            </ToggleGroupItem>
            <ToggleGroupItem
              className="data-[state=on]:bg-background data-[state=on]:text-foreground h-9 gap-3 data-[state=on]:shadow-sm"
              value="scoresaber"
              aria-label={t('scoresaber')}
            >
              <img className="size-5" src={`${import.meta.env.BASE_URL}scoresaber.svg`} alt="" aria-hidden="true" />
              {t('scoresaber')}
            </ToggleGroupItem>
            <ToggleGroupItem
              className="data-[state=on]:bg-background data-[state=on]:text-foreground h-9 gap-3 data-[state=on]:shadow-sm"
              value="link"
              aria-label={t('link')}
            >
              <LinkIcon />
              {t('link')}
            </ToggleGroupItem>
          </ToggleGroup>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              onSubmit(source);
            }}
          >
            <InputGroup>
              <InputGroupInput
                type={link ? 'url' : 'text'}
                inputMode={scoreSaber ? 'numeric' : link ? 'url' : 'text'}
                pattern={scoreSaber ? '[0-9]*' : undefined}
                value={input}
                aria-label={inputLabel}
                placeholder={inputPlaceholder}
                onChange={(event) => {
                  onInputChange(event.currentTarget.value);
                }}
              />
              {!link && (
                <InputGroupButton aria-label={t('openFiles')} title={t('openFiles')} onClick={onOpenFiles}>
                  <FolderOpen />
                </InputGroupButton>
              )}
              <InputGroupButton
                type="submit"
                aria-label={scoreSaber ? t('loadReplay') : link ? t('loadLink') : t('loadMap')}
                disabled={!validInput}
              >
                <ArrowRight />
              </InputGroupButton>
            </InputGroup>
          </form>
          {scoreSaber && choices.length > 0 && (
            <section>
              <h2 className="text-muted-foreground mt-4 mb-2 text-xs font-medium">{t('multipleMatches')}</h2>
              <ul className="grid gap-1">
                {choices.map((choice) => (
                  <li key={choice.hash}>
                    <Button
                      type="button"
                      className="h-auto w-full justify-start text-left whitespace-normal"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        onChoose(choice);
                      }}
                    >
                      {choice.label}
                    </Button>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </Card>
      )}
    </>
  );
}
