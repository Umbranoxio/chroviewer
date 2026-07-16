import { ACES_CHUNK } from './chunks';

export const FULLSCREEN_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

export const BLOOMFOG_DOWNSAMPLE_FRAG = /* glsl */ `
uniform sampler2D _SourceTex;
uniform vec2 _SourceTexelSize;
varying vec2 vUv;
void main() {
  vec2 d = _SourceTexelSize * 0.997;
  vec4 color = texture2D(_SourceTex, vUv + d);
  color += texture2D(_SourceTex, vUv - d);
  color += texture2D(_SourceTex, vUv + vec2(-d.x, d.y));
  color += texture2D(_SourceTex, vUv + vec2(d.x, -d.y));
  gl_FragColor = color * 0.25;
}
`;

const BLOOMFOG_UPSAMPLE_CHUNK = /* glsl */ `
uniform sampler2D _SourceTex;
uniform sampler2D _BloomTex;
uniform vec2 _SourceTexelSize;
uniform float _SampleScale;
uniform float _CombineSrc;
uniform float _CombineDst;

vec4 bloomfogUpsample() {
  vec4 d = _SourceTexelSize.xyxy * vec4(1.0, 1.0, -1.0, 0.0) * _SampleScale;
  vec4 color = texture2D(_SourceTex, vUv - d.xy) * 0.99;
  color += texture2D(_SourceTex, vUv - d.wy) * 2.01;
  color += texture2D(_SourceTex, vUv - d.zy) * 0.99;
  color += texture2D(_SourceTex, vUv + d.zw) * 2.01;
  color += texture2D(_SourceTex, vUv) * 3.98;
  color += texture2D(_SourceTex, vUv + d.xw) * 2.01;
  color += texture2D(_SourceTex, vUv + d.zy) * 0.99;
  color += texture2D(_SourceTex, vUv + d.wy) * 2.01;
  color += texture2D(_SourceTex, vUv + d.xy) * 0.99;
  vec4 upsampled = color / 15.98;
  return texture2D(_BloomTex, vUv) * _CombineSrc + upsampled * _CombineDst;
}
`;

export const BLOOMFOG_UPSAMPLE_FRAG = /* glsl */ `
varying vec2 vUv;
${BLOOMFOG_UPSAMPLE_CHUNK}
void main() {
  gl_FragColor = bloomfogUpsample();
}
`;

export const BLOOMFOG_FINAL_UPSAMPLE_FRAG = /* glsl */ `
uniform sampler2D _GlobalIntensityTex;
uniform float _AutoExposureLimit;
varying vec2 vUv;
${BLOOMFOG_UPSAMPLE_CHUNK}
${ACES_CHUNK}
void main() {
  vec4 color = bloomfogUpsample();
  vec3 globalIntensity = texture2D(_GlobalIntensityTex, vec2(0.5)).rgb;
  float luminance = dot(globalIntensity, vec3(0.301, 0.588, 0.111));
  float exposure = min(0.1421 * inversesqrt(max(luminance, 1e-12)), _AutoExposureLimit * 0.00398);
  color.rgb *= exposure;
  color.rgb = chroToneMap(color.rgb);
  gl_FragColor = clamp(color, 0.0, 1.0);
}
`;

export const CAPTURE_VERT = /* glsl */ `
attribute vec3 viewPos;
attribute vec4 quadColor;
attribute vec3 uv3;
varying vec4 vTangent;
varying vec4 vColor;
varying vec3 vUv3;
void main() {
  gl_Position = vec4(position.xy * 2.0 - 1.0, 0.0, 1.0);
  vTangent = vec4(viewPos / viewPos.z, 1.0 / viewPos.z);
  vec3 color = quadColor.rgb * (quadColor.rgb * (quadColor.rgb * 0.3049 + 0.6827) + 0.0124);
  vColor = vec4(color, quadColor.a);
  vUv3 = uv3;
}
`;

export const CAPTURE_FRAG = /* glsl */ `
uniform sampler2D _BloomfogAlphaMask;
varying vec4 vTangent;
varying vec4 vColor;
varying vec3 vUv3;
void main() {
  vec3 dir = vTangent.xyz / vTangent.w;
  float dir2 = dot(dir, dir);
  float alpha = 1.0 / max(vColor.a, 1.0);
  float response = max(dir2 * alpha - 9.96, 0.0);
  response = 1.0 / (response * 0.0101 + 1.0);
  vec2 uv = vec2(vUv3.x / vUv3.z, vUv3.y);
  vec4 lineMask = texture2D(_BloomfogAlphaMask, uv);
  vec4 color = lineMask * vec4(vColor.rgb, vColor.a * vColor.a);
  float bloomAlpha = response * color.a;
  gl_FragColor = vec4(color.rgb * bloomAlpha, bloomAlpha);
}
`;
