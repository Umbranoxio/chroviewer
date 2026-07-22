export const POST_BLOOM_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

const DOWNSAMPLE_13_CHUNK = /* glsl */ `
#ifndef BLOOM_TAP
#define BLOOM_TAP(tex, uv) texture2D(tex, uv)
#endif
vec4 downsample13(sampler2D tex, vec2 uv, vec2 texelSize) {
  vec4 a = BLOOM_TAP(tex, uv + texelSize * vec2(-1.0, -1.0));
  vec4 b = BLOOM_TAP(tex, uv + texelSize * vec2(0.0, -1.0));
  vec4 c = BLOOM_TAP(tex, uv + texelSize * vec2(1.0, -1.0));
  vec4 d = BLOOM_TAP(tex, uv + texelSize * vec2(-0.5, -0.5));
  vec4 e = BLOOM_TAP(tex, uv + texelSize * vec2(0.5, -0.5));
  vec4 f = BLOOM_TAP(tex, uv + texelSize * vec2(-1.0, 0.0));
  vec4 g = BLOOM_TAP(tex, uv);
  vec4 h = BLOOM_TAP(tex, uv + texelSize * vec2(1.0, 0.0));
  vec4 i = BLOOM_TAP(tex, uv + texelSize * vec2(-0.5, 0.5));
  vec4 j = BLOOM_TAP(tex, uv + texelSize * vec2(0.5, 0.5));
  vec4 k = BLOOM_TAP(tex, uv + texelSize * vec2(-1.0, 1.0));
  vec4 l = BLOOM_TAP(tex, uv + texelSize * vec2(0.0, 1.0));
  vec4 m = BLOOM_TAP(tex, uv + texelSize * vec2(1.0, 1.0));
  vec4 color = (d + e + i + j) * 0.124;
  color += (a + b + f + g) * 0.0315;
  color += (b + c + g + h) * 0.0315;
  color += (f + g + k + l) * 0.0315;
  color += (g + h + l + m) * 0.0315;
  return color;
}
`;

export const POST_BLOOM_PREFILTER_13_FRAG = /* glsl */ `
uniform sampler2D _SourceTex;
uniform vec2 _SourceTexelSize;
uniform float _AlphaWeights;
varying vec2 vUv;
// the game blooms from a unorm target, so stacked additive lights cap at 1;
// our scene target is half-float, clamp each source tap to match
#define BLOOM_TAP(tex, uv) clamp(texture2D(tex, uv), 0.0, 1.0)
${DOWNSAMPLE_13_CHUNK}
void main() {
  vec4 color = downsample13(_SourceTex, vUv, _SourceTexelSize);
  color.rgb *= clamp(color.a * _AlphaWeights, 0.0, 1.0);
  gl_FragColor = color;
}
`;

export const POST_BLOOM_DOWNSAMPLE_13_FRAG = /* glsl */ `
uniform sampler2D _SourceTex;
uniform vec2 _SourceTexelSize;
varying vec2 vUv;
${DOWNSAMPLE_13_CHUNK}
void main() {
  gl_FragColor = downsample13(_SourceTex, vUv, _SourceTexelSize);
}
`;

export const POST_BLOOM_UPSAMPLE_TENT_FRAG = /* glsl */ `
uniform sampler2D _SourceTex;
uniform sampler2D _BloomTex;
uniform vec2 _SourceTexelSize;
uniform float _SampleScale;
uniform float _CombineSrc;
uniform float _CombineDst;
varying vec2 vUv;
void main() {
  vec2 d = _SourceTexelSize * _SampleScale;
  vec4 color = texture2D(_SourceTex, vUv + vec2(-d.x, -d.y)) * 0.99;
  color += texture2D(_SourceTex, vUv + vec2(0.0, -d.y)) * 2.01;
  color += texture2D(_SourceTex, vUv + vec2(d.x, -d.y)) * 0.99;
  color += texture2D(_SourceTex, vUv + vec2(-d.x, 0.0)) * 2.01;
  color += texture2D(_SourceTex, vUv) * 3.98;
  color += texture2D(_SourceTex, vUv + vec2(d.x, 0.0)) * 2.01;
  color += texture2D(_SourceTex, vUv + vec2(-d.x, d.y)) * 0.99;
  color += texture2D(_SourceTex, vUv + vec2(0.0, d.y)) * 2.01;
  color += texture2D(_SourceTex, vUv + d) * 0.99;
  vec4 upsampled = color / 15.98;
  gl_FragColor = texture2D(_BloomTex, vUv) * _CombineSrc + upsampled * _CombineDst;
}
`;

export const POST_BLOOM_COMPOSITE_FRAG = /* glsl */ `
uniform sampler2D _SourceTex;
uniform sampler2D _BloomTex;
uniform sampler2D _BlueNoiseTex;
uniform vec2 _SourceTexelSize;
uniform vec2 _BlueNoiseScale;
uniform float _RandomValue;
uniform float _BloomIntensity;
uniform float _BaseColorBoost;
uniform float _BaseColorBoostThreshold;
uniform float _Fade;
varying vec2 vUv;
void main() {
  vec2 d = _SourceTexelSize * 0.5;
  float alpha = clamp(texture2D(_SourceTex, vUv + vec2(-d.x, d.y)).a, 0.0, 1.0);
  alpha += clamp(texture2D(_SourceTex, vUv + d).a, 0.0, 1.0);
  alpha += clamp(texture2D(_SourceTex, vUv - d).a, 0.0, 1.0);
  alpha += clamp(texture2D(_SourceTex, vUv + vec2(d.x, -d.y)).a, 0.0, 1.0);
  alpha *= 0.25;
  float whiteSignal = alpha * alpha * _BaseColorBoost - _BaseColorBoostThreshold;
  float whiteBoost = min(max(whiteSignal, 0.0), 1.0);
  vec3 color = min(texture2D(_SourceTex, vUv).rgb + vec3(whiteBoost), vec3(1.0));
  vec2 noiseUv = (vUv + vec2(0.103, 0.197)) * _BlueNoiseScale + vec2(_RandomValue);
  float noise = (texture2D(_BlueNoiseTex, noiseUv).r - 0.5) / 255.0;
  color += texture2D(_BloomTex, vUv).rgb * _BloomIntensity + vec3(noise);
  gl_FragColor = vec4(color * _Fade, 1.0);
  #include <colorspace_fragment>
  gl_FragColor.a = 1.0;
}
`;
