export type MirrorQuality = 'none' | 'low' | 'high';

export interface QualitySettings {
  mirrorQuality: MirrorQuality;
}

export const DEFAULT_QUALITY: QualitySettings = {
  mirrorQuality: 'high',
};

export const mirrorTextureSize = (quality: MirrorQuality) => (quality === 'low' ? 512 : 2048);
