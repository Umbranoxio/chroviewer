import { ACES_CHUNK, FOG_CHUNK } from './chunks';

export const CUSTOM_PARTICLES_VERT = /* glsl */ `
uniform float _BillboardScale;
varying vec3 vWorldPos;
varying vec3 vWorldNormal;
varying vec2 vUv;
varying vec4 vScreenPos;
#ifdef USE_VERTEX_COLOR
attribute vec4 color;
varying vec4 vVertexColor;
#endif
void main() {
  vec3 worldPosition;
  #ifdef BILLBOARD_CAMERA
  vec3 worldOrigin = (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
  vec3 cameraRight = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
  vec3 cameraUp = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
  vec3 cameraForward = vec3(viewMatrix[0][2], viewMatrix[1][2], viewMatrix[2][2]);
  worldPosition = worldOrigin + (
    cameraRight * position.x + cameraUp * position.y + cameraForward * position.z
  ) * _BillboardScale;
  vWorldNormal = normalize(cameraForward);
  #elif defined(BILLBOARD_Y_AXIS)
  vec3 worldOrigin = (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
  vec3 localUp = normalize(mat3(modelMatrix) * vec3(0.0, 1.0, 0.0));
  vec3 towardCamera = cameraPosition - worldOrigin;
  vec3 look = normalize(towardCamera - localUp * dot(towardCamera, localUp));
  vec3 right = -normalize(cross(localUp, look));
  worldPosition = worldOrigin + (right * position.x + localUp * position.y) * _BillboardScale;
  vWorldNormal = look;
  #else
  worldPosition = (modelMatrix * vec4(position, 1.0)).xyz;
  vWorldNormal = normalize(mat3(modelMatrix) * normal);
  #endif
  #ifdef USE_VERTEX_COLOR
  vVertexColor = color;
  #endif
  vWorldPos = worldPosition;
  vUv = uv;
  gl_Position = projectionMatrix * viewMatrix * vec4(worldPosition, 1.0);
  vScreenPos = vec4((gl_Position.xy + gl_Position.ww) * 0.5, gl_Position.zw);
}
`;

export const CUSTOM_PARTICLES_FRAG = /* glsl */ `
uniform vec3 _Color;
uniform float _ColorMultiplier;
uniform sampler2D _MainTex;
uniform vec2 _MainTexScale;
uniform vec2 _MainTexOffset;
uniform sampler2D _MaskTex;
uniform vec2 _MaskTexScale;
uniform vec2 _MaskTexOffset;
uniform float _MaskStrength;
uniform sampler2D _Mask2Tex;
uniform vec2 _Mask2TexScale;
uniform vec2 _Mask2TexOffset;
uniform float _Mask2Strength;
uniform float _BaseLayer;
uniform float _Intensity;
uniform float _AlphaMultiplier;
uniform float _WhiteBoostStart;
uniform float _BloomType;
uniform float _BloomMultiplier;
uniform float _BloomWhiteMultiplier;
uniform float _TimeSeconds;
uniform float _SongTime;
uniform float _TimeOffset;
uniform float _FlipbookColumns;
uniform float _FlipbookRows;
uniform float _FlipbookSpeed;
uniform sampler2D _ColorGradient;
uniform vec2 _ColorGradientScale;
uniform vec2 _ColorGradientOffset;
uniform float _GradientPosition;
uniform float _GradientPanningSpeed;
uniform vec2 _UvPanning;
uniform vec2 _MaskPanning;
uniform vec2 _Mask2Panning;
uniform float _FogStartOffset;
uniform float _FogScale;
varying vec3 vWorldPos;
varying vec3 vWorldNormal;
varying vec2 vUv;
varying vec4 vScreenPos;
#ifdef USE_VERTEX_COLOR
varying vec4 vVertexColor;
#endif
${ACES_CHUNK}
${FOG_CHUNK}
void main() {
  float materialTime = _TimeSeconds;
  #ifdef CUSTOM_TIME_SONG
  materialTime = _SongTime;
  #elif defined(CUSTOM_TIME_FREEZE)
  materialTime = _TimeOffset;
  #endif
  vec4 sourceColor = vec4(_Color, _ColorMultiplier);
  #ifdef USE_VERTEX_COLOR
    #ifdef VERTEX_RED_IS_ALPHA
    sourceColor.a *= vVertexColor.r;
    #else
    sourceColor.a *= vVertexColor.a;
    #endif
    #ifndef VERTEX_CHANNELS_A
    sourceColor.rgb *= vVertexColor.rgb;
    #endif
    #ifdef VERTEX_SQUARE_ALPHA
    sourceColor.a *= sourceColor.a;
    #endif
  #endif

  vec4 albedo = sourceColor;
  #ifdef MAIN_TEXTURE
  vec2 mainUv = vUv;
    #ifdef TEXTURE_FLIPBOOK
    vec2 atlasSize = max(vec2(_FlipbookColumns, _FlipbookRows), vec2(1.0));
    float frame = floor(materialTime * _FlipbookSpeed);
    mainUv = (mainUv + vec2(
      mod(frame, atlasSize.x),
      mod(floor(frame / atlasSize.x), atlasSize.y)
    )) / atlasSize;
    #endif
  vec4 mainSample = texture2D(
    _MainTex,
    (mainUv + _UvPanning * materialTime) * _MainTexScale + _MainTexOffset
  );
    #ifdef TEXTURE_COLOR
    albedo *= mainSample * _BaseLayer;
    #elif defined(ALPHA_CHANNEL_RED)
    albedo.a *= mainSample.r * _BaseLayer;
    #else
    albedo.a *= mainSample.a * _BaseLayer;
    #endif
  #endif
  albedo.rgb *= _Intensity;
  #ifdef COLOR_GRADIENT
  vec2 gradientUv = vUv * _ColorGradientScale + _ColorGradientOffset;
  gradientUv += vec2(materialTime * (_GradientPosition + _GradientPanningSpeed));
  albedo.rgb += texture2D(_ColorGradient, gradientUv).rgb;
  #endif

  // game applies strength as lerp toward no-mask: factor = 1 + strength * (mask - 1)
  #ifdef MASK
  vec4 mask = texture2D(
    _MaskTex,
    (vUv + _MaskPanning * materialTime) * _MaskTexScale + _MaskTexOffset
  );
    #ifdef MASK_RED_IS_ALPHA
    mask.a = mask.r;
    #endif
    #ifdef MASK_BLEND_ADD
    albedo.rgb += mask.rgb * _MaskStrength;
    albedo.a *= mix(1.0, mask.a, _MaskStrength);
    #elif defined(MASK_BLEND_MASKED_ADD)
    albedo.rgb += albedo.rgb * mask.rgb * _MaskStrength;
    albedo.a *= mix(1.0, mask.a, _MaskStrength);
    #elif defined(MASK_RED_IS_ALPHA)
    albedo.a *= mix(1.0, mask.a, _MaskStrength);
    #else
    albedo *= mix(vec4(1.0), mask, _MaskStrength);
    #endif
  #endif
  #ifdef MASK2
  vec4 mask2 = texture2D(
    _Mask2Tex,
    (vUv + _Mask2Panning * materialTime) * _Mask2TexScale + _Mask2TexOffset
  );
    #ifdef MASK2_RED_IS_ALPHA
    mask2.a = mask2.r;
    #endif
    #ifdef MASK2_BLEND_ADD
    albedo.rgb += mask2.rgb * _Mask2Strength;
    albedo.a *= mix(1.0, mask2.a, _Mask2Strength);
    #elif defined(MASK2_BLEND_MASKED_ADD)
    albedo.rgb += albedo.rgb * mask2.rgb * _Mask2Strength;
    albedo.a *= mix(1.0, mask2.a, _Mask2Strength);
    #elif defined(MASK2_RED_IS_ALPHA)
    albedo.a *= mix(1.0, mask2.a, _Mask2Strength);
    #else
    albedo *= mix(vec4(1.0), mask2, _Mask2Strength);
    #endif
  #endif

  albedo.a *= _AlphaMultiplier;
  #ifdef FOG_LERP
  albedo = applyChroFog(albedo, vScreenPos, vWorldPos, _FogStartOffset, _FogScale);
  #endif
  #ifdef FORCED_WHITE_BOOST
  float whiteMix = clamp(
    (abs(albedo.a) - _WhiteBoostStart) / max(1.0 - _WhiteBoostStart, 0.0001),
    0.0,
    1.0
  );
  albedo.rgb = mix(albedo.rgb, vec3(1.0), whiteMix);
  #endif
  #ifdef SQUARE_ALPHA
  albedo.a *= albedo.a;
  #endif
  #ifdef FOG_ALPHA
  albedo.a *= 1.0 - chroFogAmount(vWorldPos, _FogStartOffset, _FogScale);
  #endif

  float bloomMagnitude = abs(albedo.a);
  if (_BloomType < 0.5) {
    albedo.rgb *= bloomMagnitude;
    albedo.a = clamp(bloomMagnitude, 0.0, 1.0);
  } else if (_BloomType < 1.5) {
    albedo.rgb *= bloomMagnitude;
    albedo.a = clamp(bloomMagnitude * _BloomMultiplier, 0.0, 1.0);
  } else {
    float whiteEnergy = bloomMagnitude * bloomMagnitude * _BloomWhiteMultiplier;
    albedo.rgb = clamp(albedo.rgb * bloomMagnitude + vec3(whiteEnergy), 0.0, 1.0);
    albedo.a = clamp(bloomMagnitude * _BloomMultiplier, 0.0, 1.0);
  }
  gl_FragColor = albedo;
  #include <colorspace_fragment>
}
`;

export const LIGHTNING_VERT = /* glsl */ `
uniform vec4 _TargetPoint;
uniform float _Width;
uniform float _Jitter;
uniform float _Speed;
uniform float _TimeSeconds;
uniform vec2 _MainTexScale;
uniform vec2 _MainTexOffset;
varying vec3 vWorldPos;
varying vec2 vUv;
varying vec4 vScreenPos;
float lightningNoise(float value, float time) {
  float result = sin(value * 10.08 - time * 14.93);
  result += sin(value * 24.87 + time * 22.11) * 0.503;
  result += sin(value * 49.72 - time * 35.18) * 0.247;
  return result;
}
void main() {
  vec3 worldOrigin = (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
  vec3 worldTarget = _TargetPoint.xyz;
  vec3 beamDirection = worldOrigin - worldTarget;
  vec3 side = cross(beamDirection, vec3(1.0, 0.0, 0.0));
  if (dot(side, side) < 0.00001) side = cross(beamDirection, vec3(0.0, 1.0, 0.0));
  side = normalize(side) * _Width;
  float jump = (fract(sin(floor(_TimeSeconds * 8.03 * _Speed)) * 43741.289) - 0.5) * 2.0;
  float mask = uv.x * (1.0 - uv.x);
  float noise = (lightningNoise(uv.x + _Width, _TimeSeconds * _Speed) + jump) * _Jitter * mask;
  float offset = (uv.y - 0.5) * 2.0;
  vec3 finalWorldPosition = mix(worldOrigin, worldTarget, uv.x) + side * (offset + noise);
  vWorldPos = finalWorldPosition;
  vUv = uv * _MainTexScale + _MainTexOffset;
  gl_Position = projectionMatrix * viewMatrix * vec4(finalWorldPosition, 1.0);
  vScreenPos = vec4((gl_Position.xy + gl_Position.ww) * 0.5, gl_Position.zw);
}
`;

export const LIGHTNING_FRAG = /* glsl */ `
uniform vec3 _Color;
uniform float _ColorMultiplier;
uniform sampler2D _MainTex;
uniform float _FogStartOffset;
uniform float _FogScale;
varying vec3 vWorldPos;
varying vec2 vUv;
varying vec4 vScreenPos;
${ACES_CHUNK}
${FOG_CHUNK}
void main() {
  float mask = clamp(sin(vUv.x * 3.14159265) * 4.0, 0.0, 1.0);
  vec4 albedo = vec4(_Color, _ColorMultiplier) * mask;
  #ifdef MAIN_TEXTURE
  albedo *= texture2D(_MainTex, vUv);
  #endif
  albedo.a = abs(albedo.a);
  albedo.rgb += albedo.a * albedo.a;
  albedo.rgb *= albedo.a;
  albedo.a = 0.0;
  albedo.rgb = chroToneMap(albedo.rgb);
  albedo = applyChroFog(albedo, vScreenPos, vWorldPos, _FogStartOffset, _FogScale);
  gl_FragColor = albedo;
  #include <colorspace_fragment>
}
`;

export const CLOUDS_VERT = /* glsl */ `
uniform float _Speed;
uniform float _WorldNoiseIntensityOffset;
uniform float _WorldNoiseIntensityScale;
uniform vec2 _WorldNoiseScrolling;
uniform float _TimeSeconds;
uniform sampler2D _NoiseTex;
uniform vec2 _NoiseTexScale;
uniform vec2 _NoiseTexOffset;
attribute vec4 color;
varying vec3 vWorldPos;
varying vec3 vCloudNormal;
varying vec2 vUv;
varying vec4 vVertexColor;
varying vec4 vScreenPos;
void main() {
  float radius = max(-position.z, 0.0001);
  float wave = sin(radius * 12.345);
  float direction = wave > 0.0 ? -1.0 : 1.0;
  float angularSpeed = (wave * 0.5 + 1.0) * _Speed * direction;
  float angle = (position.x + _TimeSeconds * angularSpeed) / radius;
  vec3 wrappedPosition = vec3(sin(angle) * radius, position.y, -cos(angle) * radius);
  vec4 baseWorldPosition = modelMatrix * vec4(wrappedPosition, 1.0);
  float noise = 1.0;
  #ifdef NOISE_TEXTURE
  vec2 noiseUv = vec2(baseWorldPosition.x, -baseWorldPosition.z) * _NoiseTexScale + _NoiseTexOffset;
  noiseUv += _WorldNoiseScrolling * (_TimeSeconds * 0.05);
  noise = texture2D(_NoiseTex, noiseUv).r;
  #endif
  wrappedPosition.y += noise * _WorldNoiseIntensityScale + _WorldNoiseIntensityOffset;
  vec4 worldPosition = modelMatrix * vec4(wrappedPosition, 1.0);
  vWorldPos = baseWorldPosition.xyz;
  vCloudNormal = normalize(baseWorldPosition.xyz);
  vUv = uv;
  vVertexColor = color;
  gl_Position = projectionMatrix * viewMatrix * worldPosition;
  vScreenPos = vec4((gl_Position.xy + gl_Position.ww) * 0.5, gl_Position.zw);
}
`;

export const CLOUDS_FRAG = /* glsl */ `
uniform sampler2D _MainTex;
uniform vec2 _MainTexScale;
uniform vec2 _MainTexOffset;
uniform vec3 _DirectionalLightDirections[5];
uniform vec3 _DirectionalLightColors[5];
uniform float _FogStartOffset;
uniform float _FogScale;
varying vec3 vWorldPos;
varying vec3 vCloudNormal;
varying vec2 vUv;
varying vec4 vVertexColor;
varying vec4 vScreenPos;
${ACES_CHUNK}
${FOG_CHUNK}
void main() {
  vec3 atlas = vec3(1.0);
  #ifdef MAIN_TEXTURE
  atlas = texture2D(_MainTex, vUv * _MainTexScale + _MainTexOffset).rgb;
  #endif
  vec3 diffuseLight = vec3(0.0);
  for (int index = 0; index < 5; index++) {
    float amount = max(dot(vCloudNormal, normalize(_DirectionalLightDirections[index])), 0.0);
    diffuseLight += _DirectionalLightColors[index] * amount;
  }
  vec4 albedo = vec4(clamp(diffuseLight * atlas * vVertexColor.rgb, 0.0, 1.0), 0.0);
  albedo.rgb = chroToneMap(albedo.rgb);
  albedo = applyChroFog(albedo, vScreenPos, vWorldPos, _FogStartOffset, _FogScale);
  gl_FragColor = albedo;
  #include <colorspace_fragment>
}
`;

export const TRANSPARENT_CLOUDS_VERT = /* glsl */ `
uniform float _TimeSeconds;
uniform float _VertexWaveFrequency;
uniform float _VertexWaveAmplitude;
uniform vec3 _RotateLayerSpeeds;
attribute vec4 color;
varying vec3 vWorldPos;
varying vec3 vCloudNormal;
varying vec2 vUv;
void main() {
  vec4 worldPosition = modelMatrix * vec4(position, 1.0);
  worldPosition.y += sin(worldPosition.x * _VertexWaveFrequency + _TimeSeconds * 2.0) * _VertexWaveAmplitude;
  float angle = dot(color.rgb, _RotateLayerSpeeds) * (_TimeSeconds / 20.0) * 0.01745329252;
  float angleSin = sin(angle);
  float angleCos = cos(angle);
  worldPosition.xz = mat2(angleCos, angleSin, -angleSin, angleCos) * worldPosition.xz;
  vWorldPos = worldPosition.xyz;
  vCloudNormal = normalize(vec3(-worldPosition.x, 0.0, -worldPosition.z));
  vUv = uv;
  gl_Position = projectionMatrix * viewMatrix * worldPosition;
}
`;

export const TRANSPARENT_CLOUDS_FRAG = /* glsl */ `
uniform sampler2D _DiffuseTexture;
uniform vec2 _DiffuseTextureScale;
uniform vec2 _DiffuseTextureOffset;
uniform sampler2D _DistortTex;
uniform vec2 _DistortTexScale;
uniform vec2 _DistortTexOffset;
uniform vec2 _DistortTexSpeed;
uniform float _DistortAmount;
uniform float _TimeSeconds;
uniform vec3 _Color;
uniform float _ColorAlpha;
uniform vec3 _DirectionalLightDirections[5];
uniform vec3 _DirectionalLightColors[5];
uniform float _BackLightingBoost;
uniform float _FadeBottomMin;
uniform float _FadeBottomMax;
uniform float _RunwayFadeOffset;
uniform float _RunwayFadeScale;
varying vec3 vWorldPos;
varying vec3 vCloudNormal;
varying vec2 vUv;
${ACES_CHUNK}
void main() {
  vec2 diffuseUv = vUv * _DiffuseTextureScale + _DiffuseTextureOffset;
  #ifdef DISTORT_TEXTURE
  vec2 distortUv = vUv * _DistortTexScale + _DistortTexOffset;
  distortUv += _DistortTexSpeed * (_TimeSeconds / 20.0);
  vec4 distort = texture2D(_DistortTex, distortUv);
  diffuseUv += (vec2(distort.r, distort.a) - diffuseUv) * _DistortAmount;
  #endif
  vec4 diffuse = vec4(1.0);
  #ifdef DIFFUSE_TEXTURE
  diffuse = texture2D(_DiffuseTexture, diffuseUv);
  #endif
  vec3 frontLight = vec3(0.0);
  vec3 backLight = vec3(0.0);
  for (int index = 0; index < 5; index++) {
    float amount = dot(vCloudNormal, normalize(_DirectionalLightDirections[index]));
    frontLight += _DirectionalLightColors[index] * max(amount, 0.0);
    backLight += _DirectionalLightColors[index] * max(-amount, 0.0);
  }
  vec3 diffuseLight = frontLight + backLight * diffuse.g * _BackLightingBoost;
  float bottomRange = _FadeBottomMax - _FadeBottomMin;
  float bottomFade = clamp((vWorldPos.y - _FadeBottomMin) / bottomRange, 0.0, 1.0);
  bottomFade *= bottomFade;
  float behindRunway = vWorldPos.z < 0.0 ? 1.0 : 0.0;
  vec3 runwayPosition = vec3(vWorldPos.x, vWorldPos.y - 1.0, behindRunway);
  float runwayRadius = behindRunway * inversesqrt(dot(runwayPosition, runwayPosition));
  float runwayFade = 1.0 - clamp(runwayRadius * _RunwayFadeScale + _RunwayFadeOffset, 0.0, 1.0);
  vec4 albedo = vec4(diffuseLight * _Color * diffuse.b, _ColorAlpha * diffuse.a) * bottomFade;
  albedo.rgb = chroToneMap(albedo.rgb);
  albedo.a *= runwayFade;
  gl_FragColor = albedo;
  #include <colorspace_fragment>
}
`;
