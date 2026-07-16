import type { ViewerSettings } from '../../core/viewer-settings';
import { CameraTransformSettings } from './camera-settings/camera-transform-settings';
import { HeadMovementSettings } from './camera-settings/head-movement-settings';
import { PreviewCameraSettings } from './camera-settings/preview-camera-settings';
import { ReplayCameraSettings } from './camera-settings/replay-camera-settings';

import { Separator } from '@/components/ui/separator';
import { TabsContent } from '@/components/ui/tabs';

interface CameraSettingsProps {
  settings: ViewerSettings;
  hasReplay: boolean;
  onChange: (settings: ViewerSettings) => void;
}

export function CameraSettings({ settings, hasReplay, onChange }: CameraSettingsProps) {
  function update<Key extends keyof ViewerSettings>(key: Key, value: ViewerSettings[Key]) {
    onChange({ ...settings, [key]: value });
  }

  return (
    <TabsContent value="camera" className="min-h-0 overflow-y-auto data-[state=inactive]:hidden">
      <div className="flex flex-col gap-5 px-5 py-4">
        {hasReplay && (
          <>
            <ReplayCameraSettings settings={settings} update={update} />
            <Separator />
          </>
        )}
        <PreviewCameraSettings hasReplay={hasReplay} settings={settings} update={update} />
        {hasReplay && settings.replayCamera === 'first-person' && (
          <>
            <Separator />
            <HeadMovementSettings settings={settings} update={update} />
            <Separator />
            <CameraTransformSettings settings={settings} update={update} onChange={onChange} />
          </>
        )}
      </div>
    </TabsContent>
  );
}
