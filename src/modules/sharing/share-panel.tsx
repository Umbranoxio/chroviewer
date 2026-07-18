import { useEffect, useRef, useState } from 'react';

import { Check, Copy } from 'lucide-react';
import { useTranslations } from 'use-intl';

import type { ShareSettingsCategory } from '../../core/share-link';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

interface SharePanelProps {
  url: string | null;
  categories: ShareSettingsCategory[];
  includeTimecode: boolean;
  includeTrimSelection: boolean;
  onCategoriesChange: (categories: ShareSettingsCategory[]) => void;
  onCopy: (url: string) => Promise<boolean>;
  onIncludeTimecodeChange: (include: boolean) => void;
  onIncludeTrimSelectionChange: (include: boolean) => void;
}

const shareCategories: ShareSettingsCategory[] = ['general', 'graphics', 'cosmetics', 'camera'];

export function SharePanel({
  url,
  categories,
  includeTimecode,
  includeTrimSelection,
  onCategoriesChange,
  onCopy,
  onIncludeTimecodeChange,
  onIncludeTrimSelectionChange,
}: SharePanelProps) {
  const [copied, setCopied] = useState(false);
  const copyTimeoutRef = useRef(0);
  const t = useTranslations('share');
  const tc = useTranslations('common');

  useEffect(() => {
    return () => {
      window.clearTimeout(copyTimeoutRef.current);
    };
  }, []);

  function selectCategories(values: string[]) {
    const selected: ShareSettingsCategory[] = [];
    for (const value of values) {
      switch (value) {
        case 'general':
        case 'graphics':
        case 'cosmetics':
        case 'camera':
          selected.push(value);
      }
    }
    onCategoriesChange(selected);
  }

  async function copy() {
    if (url === null) return;
    const success = await onCopy(url);
    window.clearTimeout(copyTimeoutRef.current);
    setCopied(success);
    if (!success) return;
    copyTimeoutRef.current = window.setTimeout(() => {
      setCopied(false);
    }, 1500);
  }

  return (
    <div className="grid gap-3">
      <div>
        <h2 className="text-sm font-semibold">{t('title')}</h2>
        <p className="text-muted-foreground mt-1 text-xs">{t('description')}</p>
      </div>
      {url === null ? (
        <p className="text-muted-foreground text-sm">{t('localFilesUnavailable')}</p>
      ) : (
        <>
          <label className="flex items-center justify-between gap-3 text-xs font-medium">
            {t('includeTimecode')}
            <Switch checked={includeTimecode} onCheckedChange={onIncludeTimecodeChange} />
          </label>
          <label className="flex items-center justify-between gap-3 text-xs font-medium">
            {t('includeTrimSelection')}
            <Switch checked={includeTrimSelection} onCheckedChange={onIncludeTrimSelectionChange} />
          </label>
          <div className="grid gap-1.5">
            <span className="text-xs font-medium">{t('includeSettings')}</span>
            <ToggleGroup
              className="grid grid-cols-4"
              type="multiple"
              value={categories}
              aria-label={t('categoriesLabel')}
              onValueChange={selectCategories}
            >
              {shareCategories.map((category) => (
                <ToggleGroupItem className="h-7 px-1 text-xs" key={category} value={category}>
                  {tc(category)}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>
          <Input
            readOnly
            value={url}
            onFocus={(event) => {
              event.currentTarget.select();
            }}
          />
          <Button
            size="sm"
            onClick={() => {
              void copy();
            }}
          >
            {copied ? <Check data-icon="inline-start" /> : <Copy data-icon="inline-start" />}
            <span
              key={copied ? 'copied' : 'copy'}
              className={copied ? 'animate-in fade-in-0 zoom-in-95 duration-200' : undefined}
            >
              {copied ? tc('copied') : t('copyLink')}
            </span>
          </Button>
        </>
      )}
    </div>
  );
}
