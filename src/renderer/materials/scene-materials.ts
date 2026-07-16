import { ShaderMaterial, Vector2, Vector4, type Texture } from 'three';

import type { Rgb } from '../../core/colors';
import type { FogUniforms } from '../bloomfog/pipeline';
import { OBJECT_VERT } from '../shaders/chunks';
import { BACKGROUND_GRADIENT_FRAG, MIRROR_FRAG, SKYBOX_FRAG, SKYBOX_VERT } from '../shaders/scene-shaders';
import { linearColor, materialFogUniforms } from './shared';

export function createMirrorMaterial(
  fog: FogUniforms,
  reflectionTexture: { value: Texture },
  color: Rgb = [1, 1, 1],
  reflectionIntensity = 0.5,
  dirt?: {
    texture: Texture;
    scale: [number, number];
    offset: [number, number];
    intensity: number;
  },
  normal?: {
    texture: Texture;
    scale: [number, number];
    offset: [number, number];
    intensity: number;
  },
) {
  return new ShaderMaterial({
    vertexShader: OBJECT_VERT,
    fragmentShader: MIRROR_FRAG,
    uniforms: {
      ...materialFogUniforms(fog, { startOffset: 1 }),
      _ReflectionTex: reflectionTexture,
      _ReflectionIntensity: { value: reflectionIntensity },
      _Color: { value: linearColor(color) },
      _DirtTex: { value: dirt?.texture ?? null },
      _DirtScale: { value: new Vector2(...(dirt?.scale ?? [1, 1])) },
      _DirtOffset: { value: new Vector2(...(dirt?.offset ?? [0, 0])) },
      _DirtIntensity: { value: dirt?.intensity ?? 1 },
      _NormalTex: { value: normal?.texture ?? null },
      _NormalScale: { value: new Vector2(...(normal?.scale ?? [1, 1])) },
      _NormalOffset: { value: new Vector2(...(normal?.offset ?? [0, 0])) },
      _BumpIntensity: { value: normal?.intensity ?? 0 },
    },
    defines: {
      ...(dirt === undefined ? {} : { DIRT: 1 }),
      ...(normal === undefined ? {} : { NORMAL_TEXTURE: 1 }),
    },
  });
}

export function createSkyboxMaterial(fog: FogUniforms) {
  return new ShaderMaterial({
    vertexShader: SKYBOX_VERT,
    fragmentShader: SKYBOX_FRAG,
    uniforms: {
      _BloomPrePassTexture: fog._BloomPrePassTexture,
      _CustomFogTextureToScreenRatio: fog._CustomFogTextureToScreenRatio,
    },
    depthWrite: false,
  });
}

export function createBackgroundGradientMaterial(
  fog: FogUniforms,
  tint: [number, number, number, number],
  elements: { color: [number, number, number, number]; startT: number; exp: number }[],
) {
  const gradientColors = Array.from({ length: 8 }, (_, index) => {
    const source = elements[Math.min(index, elements.length - 1)]?.color ?? [0, 0, 0, 1];
    const color = linearColor([source[0], source[1], source[2]]);
    return new Vector4(color.r, color.g, color.b, source[3]);
  });
  const gradientStops = Array.from({ length: 8 }, (_, index) => {
    const source = elements[Math.min(index, elements.length - 1)] ?? { startT: 1, exp: 1 };
    return new Vector2(source.startT, source.exp);
  });
  return new ShaderMaterial({
    vertexShader: SKYBOX_VERT,
    fragmentShader: BACKGROUND_GRADIENT_FRAG,
    uniforms: {
      _BloomPrePassTexture: fog._BloomPrePassTexture,
      _CustomFogTextureToScreenRatio: fog._CustomFogTextureToScreenRatio,
      _TintColor: { value: linearColor([tint[0], tint[1], tint[2]]) },
      _TintColorAlpha: { value: tint[3] },
      _GradientColors: { value: gradientColors },
      _GradientStops: { value: gradientStops },
      _GradientCount: { value: Math.min(elements.length, 8) },
    },
    depthTest: false,
    depthWrite: false,
  });
}
