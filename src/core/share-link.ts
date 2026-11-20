import { sanitizeViewerSettings, type ViewerSettings } from './viewer-settings';

export type { ShareSettingsCategory } from './share-settings-codec';
export type SharedViewerSettings = Partial<ViewerSettings>;

export function applySharedViewerSettings(settings: ViewerSettings, shared: SharedViewerSettings) {
  return sanitizeViewerSettings({ ...settings, ...shared });
}
