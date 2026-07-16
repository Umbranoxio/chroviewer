export const BLOOMFOG_CAPTURE_SIZE = 512;
export const BLOOMFOG_CAPTURE_FOV = 129.8;
export const BLOOMFOG_LINE_WIDTH = 0.0201;
export const BLOOMFOG_RADIUS = 10;
export const BLOOMFOG_INTENSITY = 0.748;
export const BLOOMFOG_DOWN_INTENSITY_OFFSET = 1;
export const BLOOMFOG_PYRAMID_WEIGHTS_PARAM = 0.997;
export const BLOOMFOG_FIRST_UPSAMPLE_BRIGHTNESS = 1.198;
export const BLOOMFOG_FINAL_UPSAMPLE_BRIGHTNESS = 0.251;

export function bloomfogPyramidLayout() {
  let width = BLOOMFOG_CAPTURE_SIZE / 2;
  let height = BLOOMFOG_CAPTURE_SIZE / 2;
  const passFloat = Math.log2(Math.max(width, height)) + Math.min(BLOOMFOG_RADIUS, 10) - 10;
  const unclampedPasses = Math.floor(passFloat);
  const passCount = Math.min(Math.max(unclampedPasses, 1), 16);
  const levels: { width: number; height: number }[] = [];
  for (let index = 0; index < passCount; index++) {
    levels.push({ width, height });
    width = Math.max(Math.floor(width / 2), 1);
    height = Math.max(Math.floor(height / 2), 1);
  }
  return {
    levels,
    sampleScale: 0.5 + passFloat - unclampedPasses,
  };
}

export function bloomfogUpsampleWeights(index: number, passCount: number) {
  const currentLevel = Math.min(
    1,
    ((BLOOMFOG_INTENSITY * (index + 1)) / (passCount - 1)) ** BLOOMFOG_PYRAMID_WEIGHTS_PARAM,
  );
  const upsampled = Math.min(1, 1 + BLOOMFOG_DOWN_INTENSITY_OFFSET - currentLevel);
  const brightness =
    index === 0 ? BLOOMFOG_FINAL_UPSAMPLE_BRIGHTNESS : index === passCount - 2 ? BLOOMFOG_FIRST_UPSAMPLE_BRIGHTNESS : 1;
  return {
    currentLevel: currentLevel * brightness,
    upsampled: upsampled * brightness,
  };
}
