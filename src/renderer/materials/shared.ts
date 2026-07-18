import {
  AddEquation,
  Color,
  CustomBlending,
  type IUniform,
  OneFactor,
  type ShaderMaterial,
  Vector2,
  type Texture,
  type Vector3,
  type Vector4,
} from 'three';

import type { Rgb } from '../../core/colors';
import type { FogUniforms } from '../bloomfog/pipeline';

export interface DirectionalLightUniforms {
  directions: { value: Vector3[] };
  colors: { value: Vector3[] };
  positions: { value: Vector3[] };
  radii: { value: number[] };
}

export const additive = {
  transparent: true,
  blending: CustomBlending,
  blendEquation: AddEquation,
  blendSrc: OneFactor,
  blendDst: OneFactor,
  blendEquationAlpha: AddEquation,
  blendSrcAlpha: OneFactor,
  blendDstAlpha: OneFactor,
};

export const linearColor = (color: Rgb) => new Color().setRGB(...color).convertSRGBToLinear();

interface ShaderUniformValues {
  _AlphaWidth: Vector4;
  _ArcColor: Vector4;
  _Color: Color;
  _ColorMultiplier: number;
  _CoreColor: Color;
  _DisplacementAxisMultiplier: Vector3;
  _EmissionTexColor: Color;
  _SizeParams: Vector4;
  _TintColor: Color;
}

type ShaderUniformValue = ShaderUniformValues[keyof ShaderUniformValues];

export function shaderUniformValue<Name extends keyof ShaderUniformValues>(
  material: ShaderMaterial | undefined,
  name: Name,
): ShaderUniformValues[Name] | undefined;
export function shaderUniformValue(material: ShaderMaterial | undefined, name: string): ShaderUniformValue | undefined;
export function shaderUniformValue(material: ShaderMaterial | undefined, name: string): ShaderUniformValue | undefined {
  if (material === undefined) return undefined;
  const uniform: IUniform<ShaderUniformValue> | undefined = material.uniforms[name];
  return uniform?.value;
}

export function shaderColorUniform(material: ShaderMaterial, name: string) {
  const uniform: IUniform<Color> | undefined = material.uniforms[name];
  return uniform?.value;
}

export function shaderNumberUniform(material: ShaderMaterial, name: string) {
  const uniform: IUniform<number> | undefined = material.uniforms[name];
  return uniform?.value;
}

export interface MaterialFogSettings {
  enabled?: boolean;
  startOffset?: number;
  scale?: number;
  heightEnabled?: boolean;
  heightOffset?: number;
  heightScale?: number;
}

export function materialFogUniforms(fog: FogUniforms, settings: MaterialFogSettings = {}) {
  return {
    ...fog,
    _FogEnabled: { value: settings.enabled === false ? 0 : 1 },
    _HeightFogEnabled: { value: settings.heightEnabled ? 1 : 0 },
    _FogStartOffset: { value: settings.startOffset ?? 0 },
    _FogScale: { value: settings.scale ?? 1 },
    _FogHeightOffset: { value: settings.heightOffset ?? 0 },
    _FogHeightScale: { value: settings.heightScale ?? 1 },
  };
}

export interface MaterialTexture {
  texture: Texture;
  scale: [number, number];
  offset: [number, number];
}

export function textureUniforms(name: string, texture: MaterialTexture | undefined) {
  return {
    [name]: { value: texture?.texture ?? null },
    [`${name}Scale`]: { value: new Vector2(...(texture?.scale ?? [1, 1])) },
    [`${name}Offset`]: { value: new Vector2(...(texture?.offset ?? [0, 0])) },
  };
}
