export const POST_BLOOM_TEXTURE_WIDTH = 928;
export const POST_BLOOM_SCENE_SAMPLES = 4;
export const POST_BLOOM_ALPHA_WEIGHTS = 3.98;
export const POST_BLOOM_RADIUS = 5;
export const POST_BLOOM_PYRAMID_INTENSITY = 0.998;
export const POST_BLOOM_DOWN_INTENSITY_OFFSET = 1;
export const POST_BLOOM_PYRAMID_WEIGHTS_PARAM = 0.0102;
export const POST_BLOOM_INTENSITY = 0.299;
export const POST_BLOOM_BASE_COLOR_BOOST = 0.997;
export const POST_BLOOM_BASE_COLOR_BOOST_THRESHOLD = 0;

export function postBloomSize(viewWidth: number, viewHeight: number) {
  return {
    width: POST_BLOOM_TEXTURE_WIDTH,
    height: Math.max(1, Math.floor((POST_BLOOM_TEXTURE_WIDTH * Math.max(viewHeight, 1)) / Math.max(viewWidth, 1))),
  };
}

export function postBloomLayout(viewWidth: number, viewHeight: number) {
  let { width, height } = postBloomSize(viewWidth, viewHeight);
  const passFloat = Math.log2(Math.max(width, height)) + Math.min(POST_BLOOM_RADIUS, 10) - 10;
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

export function postBloomUpsampleWeights(index: number, passCount: number) {
  const currentLevel = Math.min(
    1,
    ((POST_BLOOM_PYRAMID_INTENSITY * (index + 1)) / (passCount - 1)) ** POST_BLOOM_PYRAMID_WEIGHTS_PARAM,
  );
  return {
    currentLevel,
    upsampled: Math.min(1, 1 + POST_BLOOM_DOWN_INTENSITY_OFFSET - currentLevel),
  };
}
