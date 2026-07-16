import { ACES_CHUNK, BASE_COLOR_CHUNK, FOG_CHUNK } from './chunks';

export const PARAMETRIC_BOX_VERT = /* glsl */ `
uniform vec4 _AlphaWidth;
varying vec3 vWorldPos;
varying vec4 vScreenPos;
varying float vLengthFactor;
#ifdef USE_INSTANCING_COLOR
varying vec3 vInstanceColor;
#endif
void main() {
  vec4 localPos = vec4(position, 1.0);
  #ifdef OPAQUE_LENGTH_FACTOR
  vLengthFactor = position.y * 0.5;
  #else
  vLengthFactor = (position.y + 1.0) * 0.5;
  #endif
  float width = mix(_AlphaWidth.z, _AlphaWidth.w, vLengthFactor);
  localPos.xz *= width;
  #ifdef USE_INSTANCING
  localPos = instanceMatrix * localPos;
  #endif
  #ifdef USE_INSTANCING_COLOR
  vInstanceColor = instanceColor;
  #endif
  vec4 worldPos = modelMatrix * localPos;
  vWorldPos = worldPos.xyz;
  gl_Position = projectionMatrix * viewMatrix * worldPos;
  vScreenPos = vec4((gl_Position.xy + gl_Position.ww) * 0.5, gl_Position.zw);
}
`;

export const OPAQUE_LIGHT_FRAG = /* glsl */ `
uniform float _ColorMultiplier;
uniform float _FogStartOffset;
uniform float _FogScale;
uniform vec4 _AlphaWidth;
varying vec3 vWorldPos;
varying vec4 vScreenPos;
varying float vLengthFactor;
${BASE_COLOR_CHUNK}
${FOG_CHUNK}
void main() {
  float sourceAlpha = abs(_ColorMultiplier * mix(_AlphaWidth.x, _AlphaWidth.y, vLengthFactor));
  vec4 albedo = applyOpaqueLightFog(
    baseColor(),
    sourceAlpha,
    vScreenPos,
    vWorldPos,
    _FogStartOffset,
    _FogScale
  );
  gl_FragColor = albedo;
  #include <colorspace_fragment>
}
`;

export const TRANSPARENT_LIGHT_FRAG = /* glsl */ `
uniform float _ColorMultiplier;
uniform float _FogStartOffset;
uniform float _FogScale;
uniform vec4 _AlphaWidth;
varying vec3 vWorldPos;
varying vec4 vScreenPos;
varying float vLengthFactor;
${BASE_COLOR_CHUNK}
${FOG_CHUNK}
void main() {
  float emission = abs(_ColorMultiplier * mix(_AlphaWidth.x, _AlphaWidth.y, vLengthFactor));
  emission = pow(emission, 2.015);
  vec4 albedo = applyTransparentLightFog(
    vec4(baseColor() * emission, emission),
    vWorldPos,
    _FogStartOffset,
    _FogScale
  );
  gl_FragColor = albedo;
  #include <colorspace_fragment>
}
`;

export const FAKE_GLOW_FRAG = /* glsl */ `
uniform float _ColorMultiplier;
uniform float _BloomType;
uniform float _BloomMultiplier;
uniform float _BloomWhiteMultiplier;
uniform float _SquareAlpha;
uniform float _UseFogForLights;
uniform vec4 _AlphaWidth;
uniform sampler2D _MainTex;
uniform vec2 _MainTexScale;
uniform vec2 _MainTexOffset;
uniform float _FogStartOffset;
uniform float _FogScale;
#ifdef WORLD_NOISE
uniform float _TimeSeconds;
uniform sampler2D _WorldNoiseTex;
uniform float _WorldNoiseScale;
uniform float _WorldNoiseIntensityOffset;
uniform float _WorldNoiseIntensityScale;
uniform vec3 _WorldNoiseScrolling;
#endif
#ifdef WORLD_SPACE_FADE
uniform float _WorldSpaceFadePos;
uniform float _WorldSpaceFadeSlope;
#endif
varying vec3 vWorldPos;
varying vec2 vUv;
varying vec3 vSliceUv;
varying vec4 vScreenPos;
varying float vLengthFactor;
${BASE_COLOR_CHUNK}
${ACES_CHUNK}
${FOG_CHUNK}
#ifdef WORLD_NOISE
float fakeGlowNoiseSlice(vec2 position, float slice) {
  float wrappedSlice = mod(mod(slice, 16.0) + 16.0, 16.0);
  vec2 tile = vec2(mod(wrappedSlice, 4.0), floor(wrappedSlice / 4.0));
  vec2 atlasUv = (tile * 18.0 + 1.0 + fract(position) * 16.0) / 72.0;
  return texture2D(_WorldNoiseTex, atlasUv).r;
}
float fakeGlowWorldNoise(vec3 position) {
  float slicePosition = position.z * 16.0 - 0.5;
  float slice = floor(slicePosition);
  float blend = fract(slicePosition);
  float nearNoise = fakeGlowNoiseSlice(position.xy, slice);
  float farNoise = fakeGlowNoiseSlice(position.xy, slice + 1.0);
  return mix(nearNoise, farNoise, blend);
}
#endif
vec4 shapeChroGlow(vec4 color, float mainAlpha) {
  #ifdef PARAMETRIC_SLICE
  float alphaFactor = mix(_AlphaWidth.x, _AlphaWidth.y, vLengthFactor);
  float signal = mainAlpha * mainAlpha * _ColorMultiplier
    * alphaFactor * alphaFactor * alphaFactor;
  if (_BloomType < 0.5) return vec4(color.rgb * signal, 0.0);
  if (_BloomType < 1.5) return vec4(color.rgb * signal, signal * _BloomMultiplier);
  float whiteEnergy = signal * signal * _BloomWhiteMultiplier;
  return vec4((color.rgb + vec3(whiteEnergy)) * signal, 0.0);
  #else
  if (_SquareAlpha != 0.0) color.a *= color.a;
  float alphaFactor = mix(_AlphaWidth.x, _AlphaWidth.y, vLengthFactor);
  if (_SquareAlpha != 0.0) alphaFactor *= alphaFactor;
  color *= alphaFactor;
  float magnitude = abs(color.a);
  if (_BloomType < 0.5) {
    color.rgb *= magnitude * 0.998;
    color.a = 0.0;
  } else if (_BloomType < 1.5) {
    color.rgb *= magnitude * _BloomMultiplier * 1.002;
    color.a = clamp(magnitude, 0.0, 1.0);
  } else {
    float whiteEnergy = magnitude * magnitude * _BloomWhiteMultiplier * 0.997;
    color.rgb = (color.rgb + vec3(whiteEnergy)) * magnitude;
    color.a = 0.0;
  }
  return color;
  #endif
}
void main() {
  vec4 albedo = vec4(baseColor(), _ColorMultiplier);
  float mainAlpha = 1.0;
  #ifdef MAIN_TEXTURE
  vec2 mainUv = vUv;
  #ifdef PARAMETRIC_SLICE
  mainUv = vec2(vSliceUv.x / vSliceUv.z, vSliceUv.y);
  #endif
  vec4 mainSample = texture2D(_MainTex, mainUv * _MainTexScale + _MainTexOffset);
  #ifdef PARAMETRIC_SLICE
  mainAlpha = mainSample.a;
  #else
  albedo *= mainSample;
  #endif
  #endif
  float effectMask = 1.0;
  #ifdef WORLD_NOISE
  vec3 sourceWorldPosition = vec3(vWorldPos.xy, -vWorldPos.z);
  vec3 sourceWorldScrolling = vec3(_WorldNoiseScrolling.xy, -_WorldNoiseScrolling.z);
  vec3 noisePosition = sourceWorldPosition + sourceWorldScrolling * (_TimeSeconds / 20.0);
  float worldNoise = fakeGlowWorldNoise(noisePosition * _WorldNoiseScale);
  effectMask *= worldNoise * _WorldNoiseIntensityScale + _WorldNoiseIntensityOffset;
  #endif
  #ifdef WORLD_SPACE_FADE
  effectMask *= clamp((vWorldPos.y - _WorldSpaceFadePos) * _WorldSpaceFadeSlope, 0.0, 1.0);
  #endif
  if (_UseFogForLights != 0.0) {
    albedo = shapeChroGlow(albedo, mainAlpha);
    albedo *= effectMask;
    #ifdef PARAMETRIC_SLICE
    float fogAlphaFactor = mix(_AlphaWidth.x, _AlphaWidth.y, vLengthFactor);
    float fogSignal = max(
      _ColorMultiplier * fogAlphaFactor * fogAlphaFactor * fogAlphaFactor,
      1.0
    );
    albedo = applyTransparentLightFog(albedo, vWorldPos, _FogStartOffset, _FogScale / fogSignal);
    #else
    albedo.rgb = chroToneMap(albedo.rgb);
    albedo = applyTransparentLightFog(albedo, vWorldPos, _FogStartOffset, _FogScale);
    #endif
  } else {
    albedo = applyChroFog(albedo, vScreenPos, vWorldPos, _FogStartOffset, _FogScale);
    albedo = shapeChroGlow(albedo, mainAlpha);
    albedo *= effectMask;
    #ifndef PARAMETRIC_SLICE
    albedo.rgb = chroToneMap(albedo.rgb);
    #endif
  }
  gl_FragColor = albedo;
  #include <colorspace_fragment>
}
`;

export const FAKE_GLOW_VERT = /* glsl */ `
uniform vec4 _SizeParams;
uniform vec4 _AlphaWidth;
uniform float _CapUVSize;
varying vec3 vWorldPos;
varying vec2 vUv;
varying vec3 vSliceUv;
varying vec4 vScreenPos;
varying float vLengthFactor;
#ifdef USE_INSTANCING_COLOR
varying vec3 vInstanceColor;
#endif
void main() {
  vec3 localPosition = position;
  #ifdef PARAMETRIC_SLICE
  float widthFactor = 1.0;
  float startWidthFactor = 1.0;
  float endWidthFactor = 1.0;
  #ifdef ALPHA_WIDTH_SCALE
  startWidthFactor = _AlphaWidth.z;
  endWidthFactor = _AlphaWidth.w;
  #endif
  float startCapWidthFactor = max(
    endWidthFactor + (startWidthFactor - endWidthFactor) * 1.3333,
    startWidthFactor * 0.01
  );
  float endCapWidthFactor = max(
    startWidthFactor + (endWidthFactor - startWidthFactor) * 1.3333,
    endWidthFactor * 0.01
  );
  float height;
  float offset = _SizeParams.y * _SizeParams.z;
  if (uv.y < 0.25) {
    float t = 1.0 - uv.y / 0.25;
    widthFactor = mix(startWidthFactor, startCapWidthFactor, t);
    height = -_SizeParams.w * 0.5 * t;
  } else if (uv.y < 0.75) {
    float t = (uv.y - 0.25) * 2.0;
    widthFactor = mix(startWidthFactor, endWidthFactor, t);
    height = _SizeParams.y * t;
  } else {
    float t = (uv.y - 0.75) / 0.25;
    widthFactor = mix(endWidthFactor, endCapWidthFactor, t);
    height = _SizeParams.y + _SizeParams.w * 0.5 * t;
  }
  vLengthFactor = (height + _SizeParams.w) / (_SizeParams.y + _SizeParams.w * 2.0);
  height -= offset;
  float width = _SizeParams.x * widthFactor;
  float capVertex = step(0.49, abs(uv.y - 0.5));
  float capDirection = sign(uv.y - 0.5);
  float sliceUvY = uv.y + capDirection * (1.0 - capVertex) * (0.25 - _CapUVSize);
  vUv = uv;
  vSliceUv = vec3(uv.x * widthFactor, sliceUvY, widthFactor);
  #ifdef Y_AXIS_BILLBOARD
  vec3 worldOrigin = (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
  vec3 localUp = normalize((modelMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz);
  vec3 toCamera = cameraPosition - worldOrigin;
  vec3 look = normalize(toCamera - localUp * dot(toCamera, localUp));
  vec3 right = -normalize(cross(localUp, look));
  vec3 worldPosition = worldOrigin + right * position.x * width + localUp * height;
  #else
  vec3 slicePosition = vec3(position.x * width, height, position.z);
  vec3 worldPosition = (modelMatrix * vec4(slicePosition, 1.0)).xyz;
  #endif
  vWorldPos = worldPosition;
  gl_Position = projectionMatrix * viewMatrix * vec4(worldPosition, 1.0);
  vScreenPos = vec4((gl_Position.xy + gl_Position.ww) * 0.5, gl_Position.zw);
  return;
  #else
  vLengthFactor = uv.y;
  if (localPosition.x < 0.0) {
    localPosition.x = (localPosition.x + 1.0) / _SizeParams.x * _SizeParams.w - 1.0;
  } else if (localPosition.x > 0.0) {
    localPosition.x = (localPosition.x - 1.0) / _SizeParams.x * _SizeParams.w + 1.0;
  }
  if (localPosition.y < 0.0) {
    localPosition.y = (localPosition.y + 1.0) / _SizeParams.y * _SizeParams.w - 1.0;
  } else if (localPosition.y > 0.0) {
    localPosition.y = (localPosition.y - 1.0) / _SizeParams.y * _SizeParams.w + 1.0;
  }
  #endif

  vec4 localPos = vec4(localPosition, 1.0);
  #ifdef USE_INSTANCING
  localPos = instanceMatrix * localPos;
  #endif
  #ifdef USE_INSTANCING_COLOR
  vInstanceColor = instanceColor;
  #endif
  vec4 worldPos = modelMatrix * localPos;
  vWorldPos = worldPos.xyz;
  vUv = uv;
  gl_Position = projectionMatrix * viewMatrix * worldPos;
  vScreenPos = vec4((gl_Position.xy + gl_Position.ww) * 0.5, gl_Position.zw);
}
`;

export const MIRROR_FRAG = /* glsl */ `
uniform sampler2D _ReflectionTex;
uniform float _ReflectionIntensity;
uniform sampler2D _DirtTex;
uniform vec2 _DirtScale;
uniform vec2 _DirtOffset;
uniform float _DirtIntensity;
uniform sampler2D _NormalTex;
uniform vec2 _NormalScale;
uniform vec2 _NormalOffset;
uniform float _BumpIntensity;
uniform float _FogStartOffset;
uniform float _FogScale;
varying vec3 vWorldPos;
varying vec2 vUv;
varying vec4 vScreenPos;
${BASE_COLOR_CHUNK}
${ACES_CHUNK}
${FOG_CHUNK}
void main() {
  vec2 screenUV = vScreenPos.xy / vScreenPos.w;
  #ifdef NORMAL_TEXTURE
  vec4 packedNormal = texture2D(_NormalTex, vUv * _NormalScale + _NormalOffset);
  packedNormal.r *= packedNormal.a;
  vec2 normalOffset = packedNormal.rg * 2.0 - 1.0;
  screenUV += normalOffset * _BumpIntensity * 0.998;
  #endif
  vec4 albedo = vec4(1.0);
  #ifdef DIRT
  albedo = texture2D(_DirtTex, vUv * _DirtScale + _DirtOffset) * _DirtIntensity;
  #endif
  vec4 reflectionCol = texture2D(_ReflectionTex, screenUV) * _ReflectionIntensity;
  albedo *= reflectionCol * vec4(baseColor(), 1.0);
  albedo.rgb = chroToneMap(albedo.rgb);
  albedo = applyChroFog(albedo, vScreenPos, vWorldPos, _FogStartOffset, _FogScale);
  gl_FragColor = albedo;
  #include <colorspace_fragment>
}
`;

export const SKYBOX_VERT = /* glsl */ `
varying vec4 vScreenPos;
void main() {
  gl_Position = vec4(position.xy, 1.0, 1.0);
  vScreenPos = vec4((gl_Position.xy + gl_Position.ww) * 0.5, gl_Position.zw);
}
`;

export const SKYBOX_FRAG = /* glsl */ `
uniform sampler2D _BloomPrePassTexture;
uniform vec2 _CustomFogTextureToScreenRatio;
varying vec4 vScreenPos;
void main() {
  vec2 uv = (vScreenPos.xy / vScreenPos.w - 0.5) * _CustomFogTextureToScreenRatio + 0.5;
  gl_FragColor = vec4(texture2D(_BloomPrePassTexture, uv).rgb, 0.0);
  #include <colorspace_fragment>
}
`;

export const BACKGROUND_GRADIENT_FRAG = /* glsl */ `
uniform sampler2D _BloomPrePassTexture;
uniform vec2 _CustomFogTextureToScreenRatio;
uniform vec3 _TintColor;
uniform float _TintColorAlpha;
uniform vec4 _GradientColors[8];
uniform vec2 _GradientStops[8];
uniform int _GradientCount;
varying vec4 vScreenPos;
${ACES_CHUNK}
void main() {
  vec2 screenUv = vScreenPos.xy / vScreenPos.w;
  vec2 fogUv = (screenUv - 0.5) * _CustomFogTextureToScreenRatio + 0.5;
  float t = clamp(screenUv.y, 0.0, 1.0);
  vec4 gradient = _GradientColors[0];
  bool selected = false;
  for (int i = 6; i >= 0; i--) {
    if (!selected && i < _GradientCount - 1 && t >= _GradientStops[i].x) {
      float span = max(_GradientStops[i + 1].x - _GradientStops[i].x, 0.0001);
      float blend = pow(max((t - _GradientStops[i].x) / span, 0.0), _GradientStops[i].y);
      gradient = mix(_GradientColors[i], _GradientColors[i + 1], blend);
      selected = true;
    }
  }
  vec3 background = chroToneMap(gradient.rgb * _TintColor);
  vec3 bloomFog = texture2D(_BloomPrePassTexture, fogUv).rgb;
  gl_FragColor = vec4(background + bloomFog, 0.0);
  #include <colorspace_fragment>
}
`;
