export const MIN_RENDER_SCALE = 0.25;
export const MAX_RENDER_SCALE = 2;
export const MAX_DEVICE_PIXEL_RATIO = 2;

export function clampRenderScale(scale: number): number {
  if (!Number.isFinite(scale)) return 1;
  return Math.min(Math.max(scale, MIN_RENDER_SCALE), MAX_RENDER_SCALE);
}

export function effectivePixelRatio(devicePixelRatio: number, renderScale: number): number {
  return Math.min(devicePixelRatio, MAX_DEVICE_PIXEL_RATIO) * clampRenderScale(renderScale);
}
