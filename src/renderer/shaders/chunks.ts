import { LIGHT_EMISSIVE_FOG_FULL, LIGHT_EMISSIVE_FOG_MIN } from '../fog-math';

// recreated tone and fog response
export const ACES_CHUNK = /* glsl */ `
vec3 chroToneMap(vec3 color) {
  vec3 numerator = color * (2.505 * color + 0.031);
  vec3 denominator = color * (2.425 * color + 0.592) + 0.141;
  return clamp(numerator / denominator, 0.0, 1.0);
}
`;

export const DXT5_NORMAL_CHUNK = /* glsl */ `
vec2 chroDxt5NormalXY(vec4 packedNormal) {
  return vec2(packedNormal.r * packedNormal.a, packedNormal.g) * 2.0 - 1.0;
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
  vec4 col,
  vec4 screenPos,
  vec3 worldPos,
  float fogStartOffset,
  float fogScale
) {
  float fogFactor = chroFogAmount(worldPos, fogStartOffset, fogScale);
  col *= 1.0 - fogFactor;
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

export const NOODLE_CUTOUT_OFFSET_VERT_CHUNK = /* glsl */ `
vec3 noodleCutoutOffset(float seed) {
  vec3 offset = fract(sin(seed * vec3(12.9898, 78.233, 37.719)) * 43758.5453) * 2.0 - 1.0;
  return normalize(offset) * 10.0;
}
`;

export const OBJECT_VERT = /* glsl */ `
varying vec3 vWorldPos;
varying vec3 vWorldNormal;
varying vec3 vViewPos;
varying vec3 vViewNormal;
varying vec3 vCutoutPos;
varying vec2 vUv;
varying vec4 vScreenPos;
#ifdef USE_VERTEX_COLOR
attribute vec4 color;
varying vec4 vVertexColor;
#endif
#ifdef USE_INSTANCING_COLOR
varying vec3 vInstanceColor;
#endif
varying float vDissolve;
#ifdef REFLECTIVE_SURFACE
varying vec3 vReflectionDirection;
varying float vCameraDistance;
#endif
#ifdef REFLECTION_RIM
uniform float _EdgeStrength;
uniform float _EdgeBias;
uniform float _EdgeDistanceStart;
uniform float _EdgeDistanceGain;
varying float vReflectionEdge;
#endif
#ifdef USE_INSTANCING
attribute float instanceDissolve;
attribute float instanceCutoutSeed;
#endif
${NOODLE_CUTOUT_OFFSET_VERT_CHUNK}

vec3 chroTransformNormal(mat3 basis, vec3 normal) {
  vec3 x = basis[0];
  vec3 y = basis[1];
  vec3 z = basis[2];
  vec3 cofactorX = cross(y, z);
  vec3 cofactorY = cross(z, x);
  vec3 cofactorZ = cross(x, y);
  vec3 transformed = cofactorX * normal.x + cofactorY * normal.y + cofactorZ * normal.z;
  float orientation = dot(x, cofactorX);
  return normalize(transformed * (orientation < 0.0 ? -1.0 : 1.0));
}

void main() {
  vDissolve = 1.0;
  vec4 localPos = vec4(position, 1.0);
  mat3 instanceBasis = mat3(1.0);
  vec3 cutoutPos = position;
  vec3 cutoutOffset = vec3(0.0);
  #ifdef USE_INSTANCING
  localPos = instanceMatrix * localPos;
  instanceBasis = mat3(instanceMatrix);
  cutoutPos = instanceBasis * cutoutPos;
  cutoutOffset = noodleCutoutOffset(instanceCutoutSeed);
  vDissolve = instanceDissolve;
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
  vWorldNormal = chroTransformNormal(mat3(modelMatrix) * instanceBasis, normal);
  vCutoutPos = mat3(modelMatrix) * cutoutPos + cutoutOffset;
  vViewPos = viewPos.xyz;
  vViewNormal = normalize(mat3(viewMatrix) * vWorldNormal);
  vUv = uv;
  #ifdef REFLECTIVE_SURFACE
  vec3 viewDirection = normalize(cameraPosition - vWorldPos);
  vec3 reflectionDirection = reflect(-viewDirection, vWorldNormal);
  vReflectionDirection = vec3(-reflectionDirection.x, reflectionDirection.y, -reflectionDirection.z);
  vCameraDistance = distance(vWorldPos, cameraPosition);
  #ifdef REFLECTION_RIM
  vReflectionEdge = clamp(
    (1.0 + _EdgeBias - dot(viewDirection, vWorldNormal)) * _EdgeStrength
      + max(vCameraDistance - _EdgeDistanceStart, 0.0) * _EdgeDistanceGain,
    0.0,
    1.0
  );
  #endif
  #endif
  gl_Position = projectionMatrix * viewMatrix * worldPos;
  vScreenPos = vec4((gl_Position.xy + gl_Position.ww) * 0.5, gl_Position.zw);
}
`;

export function noise3dAtlasChunk(textureUniform: string, sampleFunction: string) {
  return /* glsl */ `
const float noiseSliceCount = 16.0;
const float noiseAtlasTiles = 4.0;
const float noiseSliceSize = 16.0;
const float noiseSliceGutter = 1.0;
const float noiseTileSize = noiseSliceSize + noiseSliceGutter * 2.0;
const float noiseAtlasSize = noiseTileSize * noiseAtlasTiles;

float ${sampleFunction}Slice(vec2 position, float slice) {
  float wrappedSlice = mod(mod(slice, noiseSliceCount) + noiseSliceCount, noiseSliceCount);
  vec2 tile = vec2(mod(wrappedSlice, noiseAtlasTiles), floor(wrappedSlice / noiseAtlasTiles));
  vec2 atlasUv = (tile * noiseTileSize + noiseSliceGutter + fract(position) * noiseSliceSize) / noiseAtlasSize;
  return texture2D(${textureUniform}, atlasUv).r;
}

float ${sampleFunction}(vec3 position) {
  float slicePosition = position.z * noiseSliceCount - 0.5;
  float slice = floor(slicePosition);
  float blend = fract(slicePosition);
  float nearNoise = ${sampleFunction}Slice(position.xy, slice);
  float farNoise = ${sampleFunction}Slice(position.xy, slice + 1.0);
  return mix(nearNoise, farNoise, blend);
}
`;
}

export const NOODLE_CUTOUT_NOISE_CHUNK = /* glsl */ `
float noodleNoiseHash(vec3 point) {
  return fract(sin(dot(point, vec3(127.1, 311.7, 74.7))) * 43758.5453);
}

float noodleCutoutNoise(vec3 point) {
  point *= 8.0;
  vec3 cell = floor(point);
  vec3 offset = fract(point);
  offset = offset * offset * (3.0 - 2.0 * offset);
  return mix(
    mix(
      mix(noodleNoiseHash(cell), noodleNoiseHash(cell + vec3(1.0, 0.0, 0.0)), offset.x),
      mix(noodleNoiseHash(cell + vec3(0.0, 1.0, 0.0)), noodleNoiseHash(cell + vec3(1.0, 1.0, 0.0)), offset.x),
      offset.y
    ),
    mix(
      mix(noodleNoiseHash(cell + vec3(0.0, 0.0, 1.0)), noodleNoiseHash(cell + vec3(1.0, 0.0, 1.0)), offset.x),
      mix(noodleNoiseHash(cell + vec3(0.0, 1.0, 1.0)), noodleNoiseHash(cell + vec3(1.0, 1.0, 1.0)), offset.x),
      offset.y
    ),
    offset.z
  );
}
`;

export const NOODLE_DISSOLVE_CHUNK = /* glsl */ `
varying float vDissolve;
varying vec3 vCutoutPos;
uniform float _CutoutSize;
uniform float _CutoutEdgeWidth;
uniform float _CutoutSoftening;
${NOODLE_CUTOUT_NOISE_CHUNK}
float applyNoodleDissolve() {
  float visibility = vDissolve;
  float cutout = 1.0 - visibility;
  cutout -= _CutoutSoftening * 4.0 * visibility * (1.0 - visibility);
  float cutoutDistance = noodleCutoutNoise(vCutoutPos * 0.25 * _CutoutSize) - cutout;
  if (cutoutDistance < 0.0) discard;
  return cutoutDistance < _CutoutEdgeWidth * cutout ? 1.0 : 0.0;
}
`;

export const NATIVE_CUTOUT_DISSOLVE_CHUNK = /* glsl */ `
varying float vDissolve;
varying vec3 vCutoutPos;
uniform sampler2D _CutoutNoiseTex;
uniform float _CutoutTexScale;
${noise3dAtlasChunk('_CutoutNoiseTex', 'nativeCutoutNoise')}
float applyNativeCutoutDissolve() {
  float cutout = 1.0 - vDissolve;
  float cutoutDistance = nativeCutoutNoise(vCutoutPos * _CutoutTexScale) - cutout * 1.1 + 0.1;
  if (cutoutDistance < 0.0) discard;
  return cutoutDistance < 0.05 ? 1.0 : 0.0;
}
`;

// three only injects USE_INSTANCING_COLOR into the vertex prefix, so fragment
// shaders gate on the material-level INSTANCED_COLOR define instead
export const BASE_COLOR_CHUNK = /* glsl */ `
uniform vec3 _Color;
#ifdef INSTANCED_COLOR
varying vec3 vInstanceColor;
#endif

vec3 baseColor() {
  #ifdef INSTANCED_COLOR
  return vInstanceColor;
  #else
  return _Color;
  #endif
}
`;
