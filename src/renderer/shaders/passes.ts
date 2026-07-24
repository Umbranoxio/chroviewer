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
  vec4 color = texture2D(_SourceTex, vUv - d.xy);
  color += texture2D(_SourceTex, vUv - d.wy) * 2.0;
  color += texture2D(_SourceTex, vUv - d.zy);
  color += texture2D(_SourceTex, vUv + d.zw) * 2.0;
  color += texture2D(_SourceTex, vUv) * 4.0;
  color += texture2D(_SourceTex, vUv + d.xw) * 2.0;
  color += texture2D(_SourceTex, vUv + d.zy);
  color += texture2D(_SourceTex, vUv + d.wy) * 2.0;
  color += texture2D(_SourceTex, vUv + d.xy);
  vec4 upsampled = color / 16.0;
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
const vec3 BLOOMFOG_LUMINANCE_WEIGHTS = vec3(0.301, 0.588, 0.111);
const float BLOOMFOG_EXPOSURE_SCALE = 0.1;
const float BLOOMFOG_EXPOSURE_LIMIT_SCALE = 0.004;
void main() {
  vec4 color = bloomfogUpsample();
  vec3 globalIntensity = texture2D(_GlobalIntensityTex, vec2(0.5)).rgb;
  float luminance = dot(globalIntensity, BLOOMFOG_LUMINANCE_WEIGHTS);
  float exposure = min(
    BLOOMFOG_EXPOSURE_SCALE * inversesqrt(max(luminance, 1e-12)),
    _AutoExposureLimit * BLOOMFOG_EXPOSURE_LIMIT_SCALE
  );
  color.rgb *= exposure;
  color.rgb = chroToneMap(color.rgb);
  gl_FragColor = clamp(color, 0.0, 1.0);
}
`;

export const SKY_GRADIENT_VERT = /* glsl */ `
uniform mat4 _InverseProjectionMatrix;
uniform mat4 _CameraToWorldMatrix;
varying vec3 vWorldDir;
void main() {
  gl_Position = vec4(position.xy, 1.0, 1.0);
  vec4 viewDir = _InverseProjectionMatrix * vec4(position.xy, 1.0, 1.0);
  vWorldDir = mat3(_CameraToWorldMatrix) * viewDir.xyz;
}
`;

export const SKY_GRADIENT_FRAG = /* glsl */ `
uniform sampler2D _GradientTex;
uniform vec4 _Color;
varying vec3 vWorldDir;
${ACES_CHUNK}
void main() {
  float t = normalize(vWorldDir).y * 0.5 + 0.5;
  vec3 skyColor = texture2D(_GradientTex, vec2(t, 0.5)).rgb * _Color.rgb;
  gl_FragColor = vec4(chroToneMap(skyColor), 0.0);
}
`;

export const CAPTURE_VERT = /* glsl */ `
attribute vec3 viewPos;
attribute vec4 quadColor;
attribute vec3 uv3;
varying vec4 vTangent;
varying vec4 vColor;
varying vec3 vUv3;
vec3 captureGammaToLinear(vec3 color) {
  return color * (color * (color * 0.305 + 0.683) + 0.012);
}
void main() {
  gl_Position = vec4(position.xy * 2.0 - 1.0, 0.0, 1.0);
  vTangent = vec4(viewPos / viewPos.z, 1.0 / viewPos.z);
  vec3 color = captureGammaToLinear(quadColor.rgb);
  vColor = vec4(color, quadColor.a);
  vUv3 = uv3;
}
`;

export const CAPTURE_FRAG = /* glsl */ `
uniform sampler2D _BloomfogAlphaMask;
uniform float _CaptureFalloff;
uniform float _CaptureOffset;
varying vec4 vTangent;
varying vec4 vColor;
varying vec3 vUv3;
void main() {
  vec3 viewPos = vTangent.xyz / vTangent.w;
  float travel = max(dot(viewPos, viewPos) / max(vColor.a, 1.0) - _CaptureOffset, 0.0);
  float response = 1.0 / (1.0 + travel * _CaptureFalloff);
  vec4 lineMask = texture2D(_BloomfogAlphaMask, vec2(vUv3.x / vUv3.z, vUv3.y));
  float weight = response * lineMask.a * vColor.a * vColor.a;
  gl_FragColor = vec4(vColor.rgb * lineMask.rgb * weight, weight);
}
`;
