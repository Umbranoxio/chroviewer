import type { EnvironmentData } from './types';

export const CHROMA_MATERIAL_SUPPORT_ID = 'support/chroma-materials';

export function chromaMaterialPresetKey(shader: string) {
  return `__chroma_preset_${shader}`;
}

export function mergeChromaMaterialPresets(data: EnvironmentData, support: EnvironmentData): EnvironmentData {
  return {
    ...data,
    materials: { ...support.materials, ...data.materials },
  };
}
