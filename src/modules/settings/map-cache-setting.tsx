import { useEffect, useState } from 'react';

import { useFormatter, useTranslations } from 'use-intl';

import { browserMapArchiveCache } from '../../sources/map-archive-cache';
import { SettingRow } from './components/setting-row';

import { Button } from '@/components/ui/button';

const kilobyte = 1024;
const megabyte = kilobyte * 1024;
const gigabyte = megabyte * 1024;

export function scaledMapCacheSize(bytes: number) {
  if (bytes < megabyte) return { value: bytes / kilobyte, unit: 'KB' };
  if (bytes < gigabyte) return { value: bytes / megabyte, unit: 'MB' };
  return { value: bytes / gigabyte, unit: 'GB' };
}

interface MapCacheSettingProps {
  active: boolean;
}

type PersistenceState = 'checking' | 'persistent' | 'best-effort' | 'denied' | 'unavailable';
type CacheUsage = { state: 'loading' } | { state: 'unavailable' } | { state: 'ready'; bytes: number };

export function MapCacheSetting({ active }: MapCacheSettingProps) {
  const format = useFormatter();
  const t = useTranslations('settings.general');
  const tc = useTranslations('common');
  const [cacheUsage, setCacheUsage] = useState<CacheUsage>({ state: 'loading' });
  const [clearing, setClearing] = useState(false);
  const [persistence, setPersistence] = useState<PersistenceState>('checking');
  const [requestingPersistence, setRequestingPersistence] = useState(false);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;

    async function refreshCache() {
      if (browserMapArchiveCache === null) {
        setCacheUsage({ state: 'unavailable' });
        setPersistence('unavailable');
        return;
      }
      setCacheUsage({ state: 'loading' });
      setPersistence('checking');
      const [usage, persisted] = await Promise.all([
        browserMapArchiveCache.usage(),
        browserMapArchiveCache.isPersistent(),
      ]);
      if (cancelled) return;
      setCacheUsage(usage.isOk() ? { state: 'ready', bytes: usage.value } : { state: 'unavailable' });
      setPersistence(persisted.isErr() ? 'unavailable' : persisted.value ? 'persistent' : 'best-effort');
    }

    void refreshCache();
    return () => {
      cancelled = true;
    };
  }, [active]);

  async function clearCache() {
    if (browserMapArchiveCache === null) return;
    setClearing(true);
    const result = await browserMapArchiveCache.clear();
    setCacheUsage(result.isOk() ? { state: 'ready', bytes: 0 } : { state: 'unavailable' });
    setClearing(false);
  }

  async function requestPersistence() {
    if (browserMapArchiveCache === null) return;
    setRequestingPersistence(true);
    const result = await browserMapArchiveCache.requestPersistence();
    setPersistence(result.isErr() ? 'unavailable' : result.value ? 'persistent' : 'denied');
    setRequestingPersistence(false);
  }

  let cacheSizeLabel = '...';
  if (cacheUsage.state === 'unavailable') {
    cacheSizeLabel = t('mapCacheUnavailable');
  } else if (cacheUsage.state === 'ready') {
    const cacheSize = scaledMapCacheSize(cacheUsage.bytes);
    cacheSizeLabel = `${format.number(cacheSize.value, { maximumFractionDigits: cacheSize.value < 10 ? 1 : 0 })} ${cacheSize.unit}`;
  }
  const persistenceMessage =
    persistence === 'best-effort'
      ? t('mapCachePersistenceMessage')
      : persistence === 'denied'
        ? t('mapCachePersistenceDenied')
        : persistence === 'unavailable'
          ? t('mapCachePersistenceUnavailable')
          : undefined;
  const canRequestPersistence = persistence === 'best-effort' || persistence === 'denied';

  return (
    <SettingRow label={t('mapCache')} detail={persistenceMessage}>
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground min-w-16 text-right text-xs tabular-nums">{cacheSizeLabel}</span>
        {canRequestPersistence && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={requestingPersistence}
            onClick={() => {
              void requestPersistence();
            }}
          >
            {persistence === 'denied' ? t('retryPersistentStorage') : t('allowPersistentStorage')}
          </Button>
        )}
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={
            browserMapArchiveCache === null ||
            clearing ||
            cacheUsage.state === 'loading' ||
            (cacheUsage.state === 'ready' && cacheUsage.bytes === 0)
          }
          onClick={() => {
            void clearCache();
          }}
        >
          {tc('clear')}
        </Button>
      </div>
    </SettingRow>
  );
}
