import { CirclePlay, CircleStop, Download } from 'lucide-react';
import { useTranslations } from 'use-intl';

import { Button } from '@/components/ui/button';

interface RecordVideoPanelProps {
  videoUrl: string | null;
  recording: boolean;
  onStartRecord: () => void;
  onStopRecord: () => void;
}

export function RecordVideoPanel({ videoUrl, recording, onStartRecord, onStopRecord }: RecordVideoPanelProps) {
  const t = useTranslations('record');

  return (
    <div className="grid gap-3">
      <div>
        <h2 className="text-sm font-semibold">{t('title')}</h2>
        <p className="text-muted-foreground mt-1 text-sm">{recording ? t('recordProgress') : t('recordReady')}</p>
      </div>
      <Button size="sm" variant={'outline'} onClick={onStartRecord} disabled={recording}>
        <CirclePlay />
        {t('startRecord')}
      </Button>
      <Button size="sm" variant={'ghost'} onClick={onStopRecord} disabled={!recording}>
        <CircleStop />
        {t('endRecord')}
      </Button>
      {videoUrl === null ? (
        <></>
      ) : (
        <>
          <Button variant={'outline'} asChild>
            <a href={videoUrl} download="beat-saber.webm">
              <Download />
              {t('downloadVideo')}
            </a>
          </Button>
        </>
      )}
    </div>
  );
}
