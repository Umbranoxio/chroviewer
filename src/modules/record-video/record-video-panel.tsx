import { useEffect, useRef } from 'react';

import { useTranslations } from 'use-intl';

import { Button } from '@/components/ui/button';

interface SharePanelProps {
  videoUrl: string | null;
  recording: boolean;
  onStartRecord: () => void;
  onStopRecord: () => void;
}

export function RecordVideoPanel({ videoUrl, recording, onStartRecord, onStopRecord }: SharePanelProps) {
  const copyTimeoutRef = useRef(0);
  const t = useTranslations('record');

  useEffect(() => {
    return () => {
      window.clearTimeout(copyTimeoutRef.current);
    };
  }, []);

  return (
    <div className="grid gap-3">
      <div>
        <h2 className="text-sm font-semibold">{t('title')}</h2>
        <p className="text-muted-foreground mt-1 text-sm">{recording ? t('recordProgress') : t('recordReady')}</p>
      </div>
      <Button size="sm" variant={'ghost'} onClick={onStartRecord} disabled={recording}>
        {t('startRecord')}
      </Button>
      <Button size="sm" variant={'ghost'} onClick={onStopRecord} disabled={!recording}>
        {t('endRecord')}
      </Button>
      {videoUrl === null ? (
        <></>
      ) : (
        <>
          <Button variant={'ghost'} asChild>
            <a href={videoUrl} download="beat-saber.webm">
              Download
            </a>
          </Button>
        </>
      )}
    </div>
  );
}
