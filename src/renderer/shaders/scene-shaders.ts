import { ACES_CHUNK, BASE_COLOR_CHUNK, DXT5_NORMAL_CHUNK, FOG_CHUNK, noise3dAtlasChunk } from './chunks';

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
  float sourceVisibility = 1.0 - chroFogAmount(
    vWorldPos,
    _FogStartOffset,
    _FogScale / max(sourceAlpha, 1.0)
  );
  float emission = sourceAlpha * sourceAlpha * sourceVisibility;
  float fogFactor = chroFogAmount(
    vWorldPos,
    _FogStartOffset,
    _FogScale / max(emission, 1.0)
  );
  vec3 light = baseColor() * emission;
  vec4 albedo = vec4(
    light * 2.0 + fogFactor * (chroFogColor(vScreenPos).rgb - light),
    emission
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
${ACES_CHUNK}
${FOG_CHUNK}
void main() {
  float alphaWidth = abs(mix(_AlphaWidth.x, _AlphaWidth.y, vLengthFactor));
  float sourceAlpha = _ColorMultiplier * alphaWidth * alphaWidth * alphaWidth;
  float emission = sourceAlpha * sourceAlpha;
  vec4 albedo = applyTransparentLightFog(
    vec4(baseColor() * emission, emission),
    vWorldPos,
    _FogStartOffset,
    _FogScale / max(sourceAlpha, 1.0)
  );
  albedo.rgb = chroToneMap(albedo.rgb);
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
#ifdef PARAMETRIC_SLICE
varying float vLengthFactor;
#endif
${BASE_COLOR_CHUNK}
${ACES_CHUNK}
${FOG_CHUNK}
#ifdef WORLD_NOISE
${noise3dAtlasChunk('_WorldNoiseTex', 'fakeGlowWorldNoise')}
#endif
vec4 shapeChroGlow(vec4 color, float mainAlpha) {
  #ifdef PARAMETRIC_SLICE
  #ifdef ALPHA_WIDTH_SCALE
  float alphaFactor = mix(_AlphaWidth.x, _AlphaWidth.y, vLengthFactor);
  float signal = mainAlpha * mainAlpha * _ColorMultiplier
    * alphaFactor * alphaFactor * alphaFactor;
  #else
  float signal = mainAlpha * mainAlpha * _ColorMultiplier
    * vLengthFactor * vLengthFactor * vLengthFactor;
  #endif
  if (_BloomType < 0.5) return vec4(color.rgb * signal, 0.0);
  if (_BloomType < 1.5) return vec4(color.rgb * signal, signal * _BloomMultiplier);
  float whiteEnergy = signal * signal * _BloomWhiteMultiplier;
  return vec4((color.rgb + vec3(whiteEnergy)) * signal, 0.0);
  #else
  if (_SquareAlpha != 0.0) color.a *= color.a;
  float alphaFactor = mix(_AlphaWidth.x, _AlphaWidth.y, vUv.y);
  if (_SquareAlpha != 0.0) alphaFactor *= alphaFactor;
  color *= alphaFactor;
  float magnitude = abs(color.a);
  if (_BloomType < 0.5) {
    color.rgb *= magnitude;
    color.a = 0.0;
  } else if (_BloomType < 1.5) {
    color.rgb *= magnitude * _BloomMultiplier;
    color.a = clamp(magnitude, 0.0, 1.0);
  } else {
    float whiteEnergy = magnitude * magnitude * _BloomWhiteMultiplier;
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
    #ifdef ALPHA_WIDTH_SCALE
    float fogAlphaFactor = mix(_AlphaWidth.x, _AlphaWidth.y, vLengthFactor);
    float fogSignal = max(
      _ColorMultiplier * fogAlphaFactor * fogAlphaFactor * fogAlphaFactor,
      1.0
    );
    #else
    float fogSignal = max(
      _ColorMultiplier * vLengthFactor * vLengthFactor * vLengthFactor,
      1.0
    );
    #endif
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
  float capVertex = step(0.49, abs(uv.y - 0.5));
  #ifdef ALPHA_WIDTH_SCALE
  float widthFactor = 1.0;
  float startWidthFactor = _AlphaWidth.z;
  float endWidthFactor = _AlphaWidth.w;
  float startCapWidthFactor = max(
    endWidthFactor + (startWidthFactor - endWidthFactor) * (4.0 / 3.0),
    startWidthFactor * 0.01
  );
  float endCapWidthFactor = max(
    startWidthFactor + (endWidthFactor - startWidthFactor) * (4.0 / 3.0),
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
  float capDirection = sign(uv.y - 0.5);
  #else
  float startWidthFactor = _AlphaWidth.z;
  float endWidthFactor = _AlphaWidth.w;
  float startCapWidthFactor = max(
    endWidthFactor + (startWidthFactor - endWidthFactor) * (4.0 / 3.0),
    startWidthFactor * 0.01
  );
  float endCapWidthFactor = max(
    startWidthFactor + (endWidthFactor - startWidthFactor) * (4.0 / 3.0),
    endWidthFactor * 0.01
  );
  float widthFactor = uv.y > 0.9
    ? endCapWidthFactor
    : uv.y > 0.5
      ? endWidthFactor
      : uv.y > 0.1
        ? startWidthFactor
        : startCapWidthFactor;
  float height = (position.y - _SizeParams.z) * _SizeParams.y
    + (position.y - 0.5) * capVertex * _SizeParams.w;
  vLengthFactor = height > 0.5 - _SizeParams.z ? _AlphaWidth.y : _AlphaWidth.x;
  float width = position.x * _SizeParams.x * widthFactor;
  float capDirection = -sign(uv.y - 0.5);
  #endif
  float sliceUvY = uv.y + capDirection * (1.0 - capVertex) * (0.25 - _CapUVSize);
  vUv = uv;
  vSliceUv = vec3(uv.x * widthFactor, sliceUvY, widthFactor);
  #ifdef Y_AXIS_BILLBOARD
  vec3 worldOrigin = (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
  mat3 localToWorld = mat3(modelMatrix);
  vec3 columnCross = cross(localToWorld[1], localToWorld[2]);
  float inverseDeterminant = 1.0 / dot(localToWorld[0], columnCross);
  vec3 toCamera = cameraPosition - worldOrigin;
  vec3 localCamera = vec3(
    dot(toCamera, columnCross),
    dot(toCamera, cross(localToWorld[2], localToWorld[0])),
    dot(toCamera, cross(localToWorld[0], localToWorld[1]))
  ) * inverseDeterminant;
  vec2 look = normalize(localCamera.xz);
  #ifdef ALPHA_WIDTH_SCALE
  float billboardX = position.x * width;
  #else
  float billboardX = width;
  #endif
  vec3 slicePosition = vec3(
    -look.y * billboardX - look.x * position.z,
    height,
    look.x * billboardX - look.y * position.z
  );
  vec3 worldPosition = (modelMatrix * vec4(slicePosition, 1.0)).xyz;
  #else
  #ifdef ALPHA_WIDTH_SCALE
  vec3 slicePosition = vec3(position.x * width, height, position.z);
  #else
  vec3 slicePosition = vec3(width, height, position.z);
  #endif
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
uniform vec2 _TextureScrolling;
uniform vec2 _DetailNormalTexScrolling;
uniform float _DetailNormalTextureScale;
uniform float _DetailNormalIntensity;
uniform float _BumpIntensity;
uniform float _TimeSeconds;
uniform float _FogStartOffset;
uniform float _FogScale;
varying vec3 vWorldPos;
varying vec2 vUv;
varying vec4 vScreenPos;
${FOG_CHUNK}
${DXT5_NORMAL_CHUNK}
void main() {
  vec2 screenUV = vScreenPos.xy / vScreenPos.w;
  screenUV.x = 1.0 - screenUV.x;
  #ifdef NORMAL_TEXTURE
  float scrollTime = _TimeSeconds * 0.05;
  vec2 baseNormalUv = vUv * _NormalScale + _NormalOffset + _TextureScrolling * scrollTime;
  vec2 normalOffset = chroDxt5NormalXY(texture2D(_NormalTex, baseNormalUv));
  #ifdef DETAIL_NORMAL_MAP
  vec2 detailNormalUv = (baseNormalUv + _DetailNormalTexScrolling * scrollTime) * _DetailNormalTextureScale;
  vec2 detailNormalOffset = chroDxt5NormalXY(texture2D(_NormalTex, detailNormalUv));
  normalOffset = mix(normalOffset, detailNormalOffset, _DetailNormalIntensity);
  #endif
  normalOffset *= _BumpIntensity;
  float viewHeight = normalize(vWorldPos - cameraPosition).y;
  screenUV -= normalOffset * viewHeight;
  #endif
  float reflectionScale = _ReflectionIntensity * _ReflectionIntensity;
  vec4 albedo = texture2D(_ReflectionTex, screenUV) * reflectionScale;
  #ifdef DIRT
  vec4 dirt = texture2D(_DirtTex, vUv * _DirtScale + _DirtOffset);
  albedo *= mix(vec4(1.0), dirt, _DirtIntensity);
  #endif
  albedo = applyChroFog(albedo, vScreenPos, vWorldPos, _FogStartOffset, _FogScale);
  gl_FragColor = vec4(albedo.rgb, 0.0);
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
