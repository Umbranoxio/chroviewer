import { RotateCcw } from 'lucide-react';
import { useTranslations } from 'use-intl';

import type { ViewerSettings } from '../../../core/viewer-settings';

import { Button } from '@/components/ui/button';

export type CameraSettingsUpdate = <Key extends keyof ViewerSettings>(key: Key, value: ViewerSettings[Key]) => void;

export function CameraResetButton({ label, onClick }: { label?: string; onClick: () => void }) {
  const t = useTranslations('settings');

  return (
    <Button type="button" variant="ghost" size="sm" onClick={onClick}>
      <RotateCcw data-icon="inline-start" />
      {label ?? t('reset')}
    </Button>
  );
}
