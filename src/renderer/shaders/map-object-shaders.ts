import { ACES_CHUNK, BASE_COLOR_CHUNK, FOG_CHUNK } from './chunks';

const REFLECTIVE_SURFACE_CHUNK = /* glsl */ `
float chroReflectionMip(float gloss, float edge, float cameraDistance) {
  float distanceSoftening = clamp(cameraDistance * 0.01 - 0.3, 0.0, 1.0);
  float roughness = max(1.0 - gloss + edge + distanceSoftening, 0.0);
  return roughness * (1.7 - 0.7 * roughness) * 6.0;
}

vec3 chroReflection(vec3 viewDirection, vec3 surfaceNormal, float mip) {
  vec3 ray = reflect(-viewDirection, surfaceNormal);
  return textureCubeLodEXT(_ReflectionMap, vec3(-ray.x, ray.y, -ray.z), mip).rgb;
}
`;

export const NOTE_FRAG = /* glsl */ `
uniform samplerCube _ReflectionMap;
uniform float _SurfaceGain;
uniform float _EdgeStrength;
uniform float _EdgeBias;
uniform float _EdgeDistanceStart;
uniform float _EdgeDistanceGain;
uniform float _EdgeShadow;
uniform float _SurfaceGloss;
uniform float _FogStartOffset;
uniform float _FogScale;
varying vec3 vWorldPos;
varying vec3 vWorldNormal;
varying vec4 vScreenPos;
${BASE_COLOR_CHUNK}
${ACES_CHUNK}
${FOG_CHUNK}
${REFLECTIVE_SURFACE_CHUNK}
void main() {
  vec3 surfaceNormal = normalize(vWorldNormal);
  vec3 viewDirection = normalize(cameraPosition - vWorldPos);
  float cameraDistance = distance(vWorldPos, cameraPosition);
  float edge = clamp(
    (1.0 + _EdgeBias - dot(viewDirection, surfaceNormal)) * _EdgeStrength
      + max(cameraDistance - _EdgeDistanceStart, 0.0) * _EdgeDistanceGain,
    0.0,
    1.0
  );
  float mip = chroReflectionMip(_SurfaceGloss, edge, cameraDistance);
  vec3 reflectionColor = chroReflection(viewDirection, surfaceNormal, mip);
  vec4 albedo = vec4(reflectionColor * baseColor() * _SurfaceGain, 0.0);
  albedo.rgb *= 1.0 - edge * _EdgeShadow;

  albedo.rgb = chroToneMap(albedo.rgb);
  albedo = applyChroFog(albedo, vScreenPos, vWorldPos, _FogStartOffset, _FogScale);
  gl_FragColor = albedo;
  #include <colorspace_fragment>
}
`;

export const BOMB_FRAG = /* glsl */ `
uniform samplerCube _ReflectionMap;
uniform float _SurfaceGain;
uniform float _SurfaceGloss;
uniform float _FogStartOffset;
uniform float _FogScale;
varying vec3 vWorldPos;
varying vec3 vWorldNormal;
varying vec4 vScreenPos;
${BASE_COLOR_CHUNK}
${ACES_CHUNK}
${FOG_CHUNK}
${REFLECTIVE_SURFACE_CHUNK}
void main() {
  vec3 surfaceNormal = normalize(vWorldNormal);
  vec3 viewDirection = normalize(cameraPosition - vWorldPos);
  float cameraDistance = distance(vWorldPos, cameraPosition);
  float mip = chroReflectionMip(_SurfaceGloss, 0.0, cameraDistance);
  vec3 reflectionColor = chroReflection(viewDirection, surfaceNormal, mip);
  vec4 color = vec4(chroToneMap(reflectionColor * baseColor() * _SurfaceGain), 0.0);
  color = applyChroFog(color, vScreenPos, vWorldPos, _FogStartOffset, _FogScale);
  gl_FragColor = color;
  #include <colorspace_fragment>
}
`;

export const GLOWING_FRAG = /* glsl */ `
uniform float _ColorMultiplier;
uniform float _FogStartOffset;
uniform float _FogScale;
varying vec3 vWorldPos;
varying vec4 vScreenPos;
${BASE_COLOR_CHUNK}
${ACES_CHUNK}
${FOG_CHUNK}
void main() {
  vec4 albedo = vec4(baseColor() * _ColorMultiplier, 0.0);
  albedo.rgb = chroToneMap(albedo.rgb);
  albedo = applyChroFog(albedo, vScreenPos, vWorldPos, _FogStartOffset, _FogScale);
  gl_FragColor = albedo;
  #include <colorspace_fragment>
}
`;

export const SABER_GLOW_FRAG = /* glsl */ `
uniform float _ColorMultiplier;
uniform vec3 _CoreColor;
uniform float _CoreMultiplier;
uniform float _CoreBlend;
uniform float _BloomAlpha;
uniform float _CoreBloomAlpha;
uniform float _FogStartOffset;
uniform float _FogScale;
varying vec3 vWorldPos;
varying vec3 vWorldNormal;
varying vec2 vUv;
varying vec4 vScreenPos;
${BASE_COLOR_CHUNK}
${ACES_CHUNK}
${FOG_CHUNK}
void main() {
  vec3 viewDirection = normalize(cameraPosition - vWorldPos);
  float facing = abs(dot(normalize(vWorldNormal), viewDirection));
  float coreBlend = smoothstep(0.15, 0.95, facing) * _CoreBlend;
  vec3 emission = mix(baseColor() * _ColorMultiplier, _CoreColor * _CoreMultiplier, coreBlend);
  float surfaceTexture = 0.9 + 0.1 * sin((vUv.y * 16.0 + vUv.x * 2.0) * 6.2831853);
  emission *= surfaceTexture;
  float bloomAlpha = mix(_BloomAlpha, _CoreBloomAlpha, coreBlend);
  vec4 albedo = vec4(emission, bloomAlpha);
  albedo.rgb = chroToneMap(albedo.rgb);
  albedo = applyChroFog(albedo, vScreenPos, vWorldPos, _FogStartOffset, _FogScale);
  gl_FragColor = albedo;
  #include <colorspace_fragment>
}
`;

export const SABER_TRAIL_VERT = /* glsl */ `
attribute float trailAlpha;
varying float vTrailAlpha;
void main() {
  vTrailAlpha = trailAlpha;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const SABER_TRAIL_FRAG = /* glsl */ `
uniform vec3 _Color;
varying float vTrailAlpha;
void main() {
  float alpha = vTrailAlpha * 0.3;
  gl_FragColor = vec4(_Color * (0.45 + vTrailAlpha * 0.55), alpha);
  #include <colorspace_fragment>
}
`;

export const OBSTACLE_FRAG = /* glsl */ `
uniform float _FogStartOffset;
uniform float _FogScale;
varying vec3 vWorldPos;
varying vec3 vWorldNormal;
varying vec4 vScreenPos;
${BASE_COLOR_CHUNK}
${ACES_CHUNK}
${FOG_CHUNK}
void main() {
  vec3 viewDirection = normalize(cameraPosition - vWorldPos);
  float angle = pow(1.0 - abs(dot(normalize(vWorldNormal), viewDirection)), 2.0);
  vec3 sceneGlow = chroFogColor(vScreenPos).rgb;
  float fog = chroFogAmount(vWorldPos, _FogStartOffset, _FogScale);
  vec3 tint = baseColor();
  vec4 color = vec4(sceneGlow * tint * 2.0 + tint * (0.045 + angle * 0.08), (0.2 + angle * 0.18) * (1.0 - fog));
  color.rgb = chroToneMap(color.rgb);
  gl_FragColor = color;
  #include <colorspace_fragment>
}
`;

export const OBSTACLE_DISPLACEMENT_VERT = /* glsl */ `
attribute vec4 tangent;
varying vec2 vUv;
varying vec3 vWorldPos;
varying vec3 vWorldNormal;
varying vec4 vScreenPos;
#ifdef USE_INSTANCING_COLOR
varying vec3 vInstanceColor;
#endif
void main() {
  vec4 localPos = vec4(position, 1.0);
  vec3 localNormal = normal;
  vec3 instanceScale = vec3(1.0);
  #ifdef USE_INSTANCING
  instanceScale = vec3(
    length(instanceMatrix[0].xyz),
    length(instanceMatrix[1].xyz),
    length(instanceMatrix[2].xyz)
  );
  localPos = instanceMatrix * localPos;
  localNormal = mat3(instanceMatrix) * localNormal;
  #endif
  #ifdef USE_INSTANCING_COLOR
  vInstanceColor = instanceColor;
  #endif

  vec3 uvTangent = tangent.xyz;
  vec3 uvBitangent = cross(normal, uvTangent) * tangent.w;
  float tangentScale = dot(abs(uvTangent), instanceScale);
  float bitangentScale = dot(abs(uvBitangent), instanceScale);
  vUv = uv * 0.3 * vec2(tangentScale, bitangentScale);

  vec4 worldPos = modelMatrix * localPos;
  vWorldPos = worldPos.xyz;
  vWorldNormal = normalize(mat3(modelMatrix) * localNormal);
  gl_Position = projectionMatrix * viewMatrix * worldPos;
  vScreenPos = vec4((gl_Position.xy + gl_Position.ww) * 0.5, gl_Position.zw);
}
`;

export const OBSTACLE_DISPLACEMENT_FRAG = /* glsl */ `
uniform sampler2D _WallSceneTexture;
uniform sampler2D _WallNoiseTexture;
uniform float _WallDistortion;
uniform float _WallOpacity;
uniform float _WallFacingStrength;
uniform float _WallTintToWhite;
uniform float _WallGlow;
uniform float _FogStartOffset;
uniform float _FogScale;
varying vec2 vUv;
varying vec3 vWorldPos;
varying vec3 vWorldNormal;
varying vec4 vScreenPos;
${BASE_COLOR_CHUNK}
${FOG_CHUNK}
vec2 wallNoise(vec2 uv) {
  vec2 broad = texture2D(_WallNoiseTexture, uv).rg - vec2(0.5);
  vec2 detailUv = vec2(-uv.y, uv.x) * 1.73 + vec2(0.31, 0.19);
  vec2 detail = texture2D(_WallNoiseTexture, detailUv).gr - vec2(0.5);
  return broad + detail * 0.06;
}
void main() {
  vec2 displacement = wallNoise(vUv);
  vec3 viewDirection = normalize(cameraPosition - vWorldPos);
  float viewAngle = clamp(
    sqrt(abs(dot(viewDirection, normalize(vWorldNormal)))) * _WallFacingStrength,
    0.0,
    1.0
  );
  displacement *= _WallDistortion * viewAngle;
  vec2 screenUv = (vScreenPos.xy + displacement) / vScreenPos.w;
  vec4 sceneColor = texture2D(_WallSceneTexture, screenUv);
  vec3 obstacleColor = baseColor();
  vec3 tint = mix(obstacleColor, vec3(1.0), _WallTintToWhite);
  vec4 color = sceneColor * vec4(tint, 1.0) + vec4(obstacleColor * _WallGlow, 0.0);
  color.a *= _WallOpacity;
  color = applyChroFog(color, vScreenPos, vWorldPos, _FogStartOffset, _FogScale);
  gl_FragColor = color;
  #include <colorspace_fragment>
}
`;

export const OBSTACLE_OUTLINE_VERT = /* glsl */ `
varying vec3 vWorldPos;
varying vec3 vLocalNormal;
varying vec3 vInstanceScale;
varying vec2 vUv;
varying vec4 vScreenPos;
#ifdef USE_INSTANCING_COLOR
varying vec3 vInstanceColor;
#endif
void main() {
  vec4 localPos = vec4(position, 1.0);
  vInstanceScale = vec3(1.0);
  #ifdef USE_INSTANCING
  vInstanceScale = vec3(
    length(instanceMatrix[0].xyz),
    length(instanceMatrix[1].xyz),
    length(instanceMatrix[2].xyz)
  );
  localPos = instanceMatrix * localPos;
  #endif
  #ifdef USE_INSTANCING_COLOR
  vInstanceColor = instanceColor;
  #endif
  vec4 worldPos = modelMatrix * localPos;
  vWorldPos = worldPos.xyz;
  vLocalNormal = normal;
  vUv = uv;
  gl_Position = projectionMatrix * viewMatrix * worldPos;
  vScreenPos = vec4((gl_Position.xy + gl_Position.ww) * 0.5, gl_Position.zw);
}
`;

export const OBSTACLE_OUTLINE_FRAG = /* glsl */ `
uniform float _FogStartOffset;
uniform float _FogScale;
varying vec3 vWorldPos;
varying vec3 vLocalNormal;
varying vec3 vInstanceScale;
varying vec2 vUv;
varying vec4 vScreenPos;
${BASE_COLOR_CHUNK}
${ACES_CHUNK}
${FOG_CHUNK}
void main() {
  vec2 uvScalar;
  if (vLocalNormal.x != 0.0) {
    uvScalar = vInstanceScale.zy;
  } else if (vLocalNormal.y != 0.0) {
    uvScalar = vInstanceScale.xz;
  } else {
    uvScalar = vInstanceScale.xy;
  }

  vec2 halfUv = 0.5 - abs(0.5 - vUv);
  if (halfUv.x * uvScalar.x >= 0.04 && halfUv.y * uvScalar.y >= 0.04) {
    discard;
  }

  vec4 color = vec4(baseColor(), 1.0);
  color = applyChroFog(color, vScreenPos, vWorldPos, _FogStartOffset, _FogScale);
  color.rgb = chroToneMap(color.rgb);
  gl_FragColor = color;
  #include <colorspace_fragment>
}
`;

export const ARC_VERT = /* glsl */ `
uniform float _PlaybackBeat;
uniform float _StartBeat;
uniform float _EndBeat;
uniform float _JumpBeats;
uniform float _TravelPerBeat;
uniform float _CurveLength;
uniform float _StartFadeDistance;
uniform float _EndFadeDistance;
uniform float _NoiseSeed;
uniform float _ClockSeconds;
uniform float _ArcDrop;
uniform float _ArcRadius;
attribute vec3 arcData;
varying vec2 vUv;
varying vec3 vWorldPos;
varying float vEdge;
varying float vAlpha;
void main() {
  float pointBeat = mix(_StartBeat, _EndBeat, arcData.z);
  float jumpProgress = clamp((_PlaybackBeat - pointBeat + _JumpBeats) / _JumpBeats, 0.0, 1.0);
  vec3 center = position;
  float gravityPhase = 1.0 - jumpProgress;
  center.y -= _ArcDrop * gravityPhase * gravityPhase;
  center.z = -arcData.z * (_EndBeat - _StartBeat) * _TravelPerBeat;

  float aheadDistance = (pointBeat - _PlaybackBeat) * _TravelPerBeat;
  float width = _ArcRadius * clamp(aheadDistance * 3.98 + 2.01, 0.0, 1.0);
  vec3 localPos = center + normal * ((arcData.x - 0.5) * 2.0 * width);
  vec4 worldPos = modelMatrix * vec4(localPos, 1.0);
  vWorldPos = worldPos.xyz;
  gl_Position = projectionMatrix * viewMatrix * worldPos;

  float pointElapsed = _PlaybackBeat - (pointBeat - _JumpBeats);
  float spawnFade = clamp(pointElapsed / (_JumpBeats * 0.5), 0.0, 1.0);
  float cutFade = clamp(aheadDistance * 3.98, 0.0, 1.0);
  float startFade = clamp(arcData.y * _CurveLength / _StartFadeDistance, 0.0, 1.0);
  float endFade = clamp((1.0 - arcData.y) * _CurveLength / _EndFadeDistance, 0.0, 1.0);
  vAlpha = spawnFade * cutFade * startFade * startFade * endFade * endFade;
  vEdge = 1.0 - arcData.x;
  vUv = vec2(arcData.y, 1.0 - arcData.x) * vec2(0.101, 2.985)
    + _ClockSeconds * vec2(1.79, 0.172);
  vUv.x += _NoiseSeed;
}
`;

export const ARC_FRAG = /* glsl */ `
uniform vec4 _ArcColor;
uniform sampler2D _ArcNoise;
uniform float _FogStartOffset;
uniform float _FogScale;
varying vec2 vUv;
varying vec3 vWorldPos;
varying float vEdge;
varying float vAlpha;
${FOG_CHUNK}
void main() {
  float edge = max(1.0 - 2.0 * abs(vEdge - 0.5), 0.0);
  edge *= edge * 0.985 + 0.015;
  float fogVisibility = 1.0 - chroFogAmount(vWorldPos, _FogStartOffset, _FogScale);
  float broadNoise = texture2D(_ArcNoise, vUv).r;
  float detailNoise = texture2D(_ArcNoise, vUv.yx + vec2(0.37, -0.21)).g;
  float noise = mix(broadNoise, detailNoise, 0.035);
  float alpha = edge * noise * vAlpha * fogVisibility;
  float boostInput = fogVisibility * fogVisibility * alpha * 0.998;
  float whiteBoost = clamp(boostInput * boostInput, 0.0, 1.0);
  gl_FragColor = vec4(min(_ArcColor.rgb * alpha + vec3(whiteBoost), vec3(1.0)), alpha);
  #include <colorspace_fragment>
}
`;
