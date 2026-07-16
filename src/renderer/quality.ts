export type MirrorQuality = 'none' | 'low' | 'medium' | 'high';

export interface QualitySettings {
  mirrorQuality: MirrorQuality;
}

export const DEFAULT_QUALITY: QualitySettings = {
  mirrorQuality: 'high',
};

export const mirrorTextureSize = (quality: MirrorQuality) =>
  quality === 'low' ? 512 : quality === 'medium' ? 1024 : 2048;
