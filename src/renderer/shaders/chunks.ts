import { LIGHT_EMISSIVE_FOG_FULL, LIGHT_EMISSIVE_FOG_MIN } from '../fog-math';

// recreated tone and fog response
export const ACES_CHUNK = /* glsl */ `
vec3 chroToneMap(vec3 color) {
  vec3 numerator = color * (2.505 * color + 0.031);
  vec3 denominator = color * (2.425 * color + 0.592) + 0.141;
  return clamp(numerator / denominator, 0.0, 1.0);
}
`;

export const FOG_CHUNK = /* glsl */ `
uniform sampler2D _BloomPrePassTexture;
uniform vec2 _CustomFogTextureToScreenRatio;
uniform float _CustomFogOffset;
uniform float _CustomFogAttenuation;
uniform float _CustomFogHeightFogStartY;
uniform float _CustomFogHeightFogHeight;
uniform float _FogEnabled;
uniform float _HeightFogEnabled;
uniform float _FogHeightOffset;
uniform float _FogHeightScale;

float chroDistanceFog(vec3 worldPos, float fogStartOffset, float fogScale) {
  vec3 delta = worldPos - cameraPosition;
  float result = max(dot(delta, delta) - fogStartOffset, 0.0);
  result = max(result * fogScale - _CustomFogOffset, 0.0);
  return 1.0 - 1.0 / (result * _CustomFogAttenuation + 1.0);
}

float chroHeightFog(vec3 worldPos) {
  float result = worldPos.y * _FogHeightScale + _FogHeightOffset
    - (_CustomFogHeightFogHeight + _CustomFogHeightFogStartY);
  result = clamp(result / _CustomFogHeightFogHeight, 0.0, 1.0);
  return result * result * (3.0 - 2.0 * result);
}

float chroFogAmount(vec3 worldPos, float fogStartOffset, float fogScale) {
  if (_FogEnabled == 0.0) return 0.0;
  float fogFactor = chroDistanceFog(worldPos, fogStartOffset, fogScale);
  if (_HeightFogEnabled != 0.0) {
    fogFactor = 1.0 - chroHeightFog(worldPos) * (1.0 - fogFactor);
  }
  return clamp(fogFactor, 0.0, 1.0);
}

vec4 chroFogColor(vec4 screenPos) {
  vec2 uv = (screenPos.xy / screenPos.w - 0.5) * _CustomFogTextureToScreenRatio + 0.5;
  return vec4(texture2D(_BloomPrePassTexture, uv).rgb, 0.0);
}

vec4 applyChroFog(vec4 col, vec4 screenPos, vec3 worldPos, float fogStartOffset, float fogScale) {
  float fogFactor = chroFogAmount(worldPos, fogStartOffset, fogScale);
  if (fogFactor == 0.0) return col;
  return mix(col, chroFogColor(screenPos), fogFactor);
}

vec4 applyOpaqueLightFog(
  vec3 color,
  float sourceAlpha,
  vec4 screenPos,
  vec3 worldPos,
  float fogStartOffset,
  float fogScale
) {
  float sourceVisibility = 1.0 - chroFogAmount(
    worldPos,
    fogStartOffset,
    fogScale / max(sourceAlpha, 1.0)
  );
  float emission = sourceAlpha * sourceAlpha * sourceVisibility;
  float fogFactor = chroFogAmount(worldPos, fogStartOffset, fogScale / max(emission, 1.0));
  vec4 col = vec4(color * emission, emission);
  col.rgb = col.rgb * 2.0 + fogFactor * (chroFogColor(screenPos).rgb - col.rgb);
  return col;
}

vec4 applyTransparentLightFog(vec4 col, vec3 worldPos, float fogStartOffset, float fogScale) {
  return col * (1.0 - chroFogAmount(worldPos, fogStartOffset, fogScale));
}

float chroEmissiveAlpha(float alpha, vec3 worldPos, float fogStartOffset, float fogScale) {
  float fogFactor = chroFogAmount(worldPos, fogStartOffset, fogScale);
  return smoothstep(${LIGHT_EMISSIVE_FOG_MIN}, ${LIGHT_EMISSIVE_FOG_FULL}, abs(alpha) * (1.0 - fogFactor));
}
`;

export const OBJECT_VERT = /* glsl */ `
varying vec3 vWorldPos;
varying vec3 vWorldNormal;
varying vec3 vViewPos;
varying vec3 vViewNormal;
varying vec2 vUv;
varying vec4 vScreenPos;
#ifdef USE_VERTEX_COLOR
attribute vec4 color;
varying vec4 vVertexColor;
#endif
#ifdef USE_INSTANCING_COLOR
varying vec3 vInstanceColor;
#endif

void main() {
  vec4 localPos = vec4(position, 1.0);
  vec3 localNormal = normal;
  #ifdef USE_INSTANCING
  localPos = instanceMatrix * localPos;
  localNormal = mat3(instanceMatrix) * localNormal;
  #endif
  #ifdef USE_INSTANCING_COLOR
  vInstanceColor = instanceColor;
  #endif
  #ifdef USE_VERTEX_COLOR
  vVertexColor = color;
  #endif
  vec4 worldPos = modelMatrix * localPos;
  vec4 viewPos = viewMatrix * worldPos;
  vWorldPos = worldPos.xyz;
  vWorldNormal = normalize(mat3(modelMatrix) * localNormal);
  vViewPos = viewPos.xyz;
  vViewNormal = normalize(normalMatrix * localNormal);
  vUv = uv;
  gl_Position = projectionMatrix * viewMatrix * worldPos;
  vScreenPos = vec4((gl_Position.xy + gl_Position.ww) * 0.5, gl_Position.zw);
}
`;

export const BASE_COLOR_CHUNK = /* glsl */ `
uniform vec3 _Color;
#ifdef USE_INSTANCING_COLOR
varying vec3 vInstanceColor;
#endif

vec3 baseColor() {
  #ifdef USE_INSTANCING_COLOR
  return vInstanceColor;
  #else
  return _Color;
  #endif
}
`;
