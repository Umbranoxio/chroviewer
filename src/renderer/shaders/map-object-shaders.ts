import { LIGHT_EMISSIVE_FOG_MIN } from '../fog-math';
import {
  ACES_CHUNK,
  BASE_COLOR_CHUNK,
  FOG_CHUNK,
  NATIVE_CUTOUT_DISSOLVE_CHUNK,
  NOODLE_CUTOUT_NOISE_CHUNK,
  NOODLE_CUTOUT_OFFSET_VERT_CHUNK,
  NOODLE_DISSOLVE_CHUNK,
} from './chunks';

const decorativeArrowFogFadeFull = 0.1;

const REFLECTIVE_SURFACE_CHUNK = /* glsl */ `
float chroReflectionMip(float gloss, float edge, float cameraDistance) {
  float distanceRoughness = clamp(cameraDistance * 0.01 - 0.3, 0.0, 1.0);
  float roughness = max(1.0 - gloss + edge + distanceRoughness, 0.0);
  float roughnessCurve = roughness * (1.7 - 0.7 * roughness);
  return roughnessCurve * 6.0;
}

varying vec3 vReflectionDirection;
varying float vCameraDistance;
#ifdef MIRROR_FACE_CORRECTION
uniform float _MirrorPass;
#endif

vec3 chroReflection(float mip) {
  bool frontFacing = gl_FrontFacing;
  #ifdef MIRROR_FACE_CORRECTION
  frontFacing = frontFacing != (_MirrorPass > 0.5);
  #endif
  float sideGain = frontFacing ? 1.0 : 7.0 / 27.0;
  vec3 direction = frontFacing ? vReflectionDirection : -vReflectionDirection;
  float reflectionMip = max(mip - 1.5, 2.1);
  return textureCubeLodEXT(_ReflectionMap, direction, reflectionMip).rgb * sideGain;
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
uniform float _CutoutEdgeGlow;
uniform float _FogStartOffset;
uniform float _FogScale;
varying vec3 vWorldPos;
varying vec3 vWorldNormal;
varying vec4 vScreenPos;
varying float vReflectionEdge;
${BASE_COLOR_CHUNK}
${ACES_CHUNK}
${FOG_CHUNK}
${REFLECTIVE_SURFACE_CHUNK}
${NATIVE_CUTOUT_DISSOLVE_CHUNK}
void main() {
  float dissolveEdge = applyNativeCutoutDissolve();
  float mip = chroReflectionMip(_SurfaceGloss, vReflectionEdge, vCameraDistance);
  vec3 reflectionColor = chroReflection(mip);
  vec3 surfaceColor = reflectionColor * baseColor() * _SurfaceGain;
  surfaceColor *= 1.0 - vReflectionEdge * _EdgeShadow;
  vec4 albedo = vec4(mix(surfaceColor, baseColor(), dissolveEdge), 0.0);
  albedo.a = max(albedo.a, dissolveEdge * _CutoutEdgeGlow);

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
uniform float _CutoutEdgeGlow;
uniform float _FogStartOffset;
uniform float _FogScale;
varying vec3 vWorldPos;
varying vec3 vWorldNormal;
varying vec4 vScreenPos;
${BASE_COLOR_CHUNK}
${ACES_CHUNK}
${FOG_CHUNK}
${REFLECTIVE_SURFACE_CHUNK}
${NOODLE_DISSOLVE_CHUNK}
void main() {
  float dissolveEdge = applyNoodleDissolve();
  float mip = chroReflectionMip(_SurfaceGloss, 0.0, vCameraDistance);
  vec3 reflectionColor = chroReflection(mip);
  vec4 color = vec4(
    chroToneMap(mix(reflectionColor * baseColor() * _SurfaceGain, baseColor(), dissolveEdge)),
    dissolveEdge * _CutoutEdgeGlow
  );
  color = applyChroFog(color, vScreenPos, vWorldPos, _FogStartOffset, _FogScale);
  gl_FragColor = color;
  #include <colorspace_fragment>
}
`;

export const GLOWING_FRAG = /* glsl */ `
uniform float _ColorMultiplier;
uniform float _CutoutEdgeGlow;
uniform float _FogStartOffset;
uniform float _FogScale;
varying vec3 vWorldPos;
varying vec4 vScreenPos;
${BASE_COLOR_CHUNK}
${ACES_CHUNK}
${FOG_CHUNK}
${NATIVE_CUTOUT_DISSOLVE_CHUNK}
void main() {
  float dissolveEdge = applyNativeCutoutDissolve();
  vec4 albedo = vec4(baseColor() * _ColorMultiplier, dissolveEdge * _CutoutEdgeGlow);
  albedo.rgb = chroToneMap(albedo.rgb);
  #ifdef DECORATIVE_ARROW
  float fogVisibility = 1.0 - chroFogAmount(vWorldPos, _FogStartOffset, _FogScale);
  float distanceFade = smoothstep(${LIGHT_EMISSIVE_FOG_MIN}, ${decorativeArrowFogFadeFull}, fogVisibility);
  if (distanceFade <= 0.0) discard;
  albedo.a = distanceFade;
  #else
  albedo = applyChroFog(albedo, vScreenPos, vWorldPos, _FogStartOffset, _FogScale);
  #endif
  gl_FragColor = albedo;
  #include <colorspace_fragment>
}
`;

const NOTE_FACE_FEATHER_CHUNK = /* glsl */ `
float chroSegmentDistance(vec2 point, vec2 start, vec2 end) {
  vec2 segment = end - start;
  vec2 offset = point - start;
  float progress = clamp(dot(offset, segment) / dot(segment, segment), 0.0, 1.0);
  return length(offset - segment * progress);
}

float chroArrowFeather(vec2 uv) {
  vec2 point = vec2((uv.x - 0.5) * 2.0, 1.0 - uv.y);
  vec2 a = vec2(-0.535714, 0.334286);
  vec2 b = vec2(0.535714, 0.334286);
  vec2 c = vec2(0.535714, 0.423571);
  vec2 d = vec2(0.0, 0.655714);
  vec2 e = vec2(-0.535714, 0.423571);
  float inside = step(0.0, min(
    min((b.x - a.x) * (point.y - a.y) - (b.y - a.y) * (point.x - a.x),
        (c.x - b.x) * (point.y - b.y) - (c.y - b.y) * (point.x - b.x)),
    min(min((d.x - c.x) * (point.y - c.y) - (d.y - c.y) * (point.x - c.x),
            (e.x - d.x) * (point.y - d.y) - (e.y - d.y) * (point.x - d.x)),
        (a.x - e.x) * (point.y - e.y) - (a.y - e.y) * (point.x - e.x))
  ));
  float distanceToArrow = min(
    min(chroSegmentDistance(point, a, b), chroSegmentDistance(point, b, c)),
    min(min(chroSegmentDistance(point, c, d), chroSegmentDistance(point, d, e)),
        chroSegmentDistance(point, e, a))
  );
  distanceToArrow *= 1.0 - inside;
  float halo = exp(-10.76 * distanceToArrow);
  halo *= 1.0 - smoothstep(0.08, 0.34, distanceToArrow);
  return mix(halo, 1.0, inside);
}

float chroDotFeather(vec2 uv) {
  float radius = length(uv - 0.5);
  float core = 1.0 - smoothstep(0.153, 0.158, radius);
  float halo = 0.46 * exp(-20.25 * max(radius - 0.158, 0.0));
  halo *= 1.0 - smoothstep(0.269, 0.316, radius);
  return max(core, halo);
}
`;

export const ARROW_GLOW_FRAG = /* glsl */ `
uniform float _FogStartOffset;
uniform float _FogScale;
varying vec3 vWorldPos;
varying vec2 vUv;
varying float vDissolve;
${BASE_COLOR_CHUNK}
${FOG_CHUNK}
${NOTE_FACE_FEATHER_CHUNK}
void main() {
  float alpha = chroArrowFeather(vUv) * clamp(vDissolve, 0.0, 1.0);
  alpha *= alpha;
  float fogVisibility = 1.0 - chroFogAmount(vWorldPos, _FogStartOffset, _FogScale);
  #ifdef DECORATIVE_ARROW
  alpha *= smoothstep(${LIGHT_EMISSIVE_FOG_MIN}, ${decorativeArrowFogFadeFull}, fogVisibility);
  #endif
  alpha *= fogVisibility;
  gl_FragColor = vec4(clamp(baseColor() * alpha, 0.0, 1.0), clamp(alpha, 0.0, 1.0));
  #include <colorspace_fragment>
}
`;

export const CIRCLE_GLOW_FRAG = /* glsl */ `
uniform float _FogStartOffset;
uniform float _FogScale;
varying vec3 vWorldPos;
varying vec2 vUv;
varying vec4 vScreenPos;
varying float vDissolve;
${BASE_COLOR_CHUNK}
${FOG_CHUNK}
${NOTE_FACE_FEATHER_CHUNK}
void main() {
  float sourceAlpha = chroDotFeather(vUv) * clamp(vDissolve, 0.0, 1.0);
  float alpha = sourceAlpha * clamp(sourceAlpha, 0.0, 1.0);
  float fog = chroFogAmount(vWorldPos, _FogStartOffset, _FogScale);
  vec3 color = mix(baseColor(), chroFogColor(vScreenPos).rgb, fog);
  float whiteBoost = abs((1.0 - fog) * alpha);
  gl_FragColor = vec4(
    clamp(color * alpha + vec3(whiteBoost), 0.0, 1.0),
    clamp(alpha, 0.0, 1.0)
  );
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
${NOODLE_DISSOLVE_CHUNK}
void main() {
  applyNoodleDissolve();
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
${NOODLE_DISSOLVE_CHUNK}
void main() {
  applyNoodleDissolve();
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

export const LEGACY_SOLID_OBSTACLE_FRAG = /* glsl */ `
${BASE_COLOR_CHUNK}
${NOODLE_DISSOLVE_CHUNK}
void main() {
  applyNoodleDissolve();
  gl_FragColor = vec4(clamp(baseColor(), 0.0, 1.0), 1.0);
  #include <colorspace_fragment>
}
`;

export const OBSTACLE_DISPLACEMENT_VERT = /* glsl */ `
attribute vec4 tangent;
attribute float instanceColorAlpha;
attribute vec3 instanceUvScale;
varying vec2 vDisplacementUv;
varying vec3 vWorldPos;
varying vec3 vWorldNormal;
varying vec3 vCutoutPos;
varying float vColorAlpha;
varying vec4 vScreenPos;
#ifdef USE_INSTANCING_COLOR
varying vec3 vInstanceColor;
#endif
varying float vDissolve;
#ifdef USE_INSTANCING
attribute float instanceDissolve;
attribute float instanceCutoutSeed;
#endif
${NOODLE_CUTOUT_OFFSET_VERT_CHUNK}
void main() {
  vDissolve = 1.0;
  vec4 localPos = vec4(position, 1.0);
  vec3 localNormal = normal;
  vec3 cutoutPos = position;
  vec3 cutoutOffset = vec3(0.0);
  vec3 uvScale = vec3(1.0);
  vColorAlpha = 1.0;
  #ifdef USE_INSTANCING
  localPos = instanceMatrix * localPos;
  localNormal = mat3(instanceMatrix) * localNormal;
  cutoutPos = mat3(instanceMatrix) * cutoutPos;
  cutoutOffset = noodleCutoutOffset(instanceCutoutSeed);
  vDissolve = instanceDissolve;
  vColorAlpha = instanceColorAlpha;
  uvScale = instanceUvScale;
  #endif
  #ifdef USE_INSTANCING_COLOR
  vInstanceColor = instanceColor;
  #endif

  vec3 uvTangent = tangent.xyz;
  vec3 uvBitangent = cross(uvTangent, normal);
  vDisplacementUv = uv * 0.3 * vec2(dot(uvScale, uvTangent), dot(uvScale, uvBitangent));
  vec4 worldPos = modelMatrix * localPos;
  vWorldPos = worldPos.xyz;
  vWorldNormal = normalize(mat3(modelMatrix) * localNormal);
  vCutoutPos = mat3(modelMatrix) * cutoutPos + cutoutOffset;
  gl_Position = projectionMatrix * viewMatrix * worldPos;
  vScreenPos = vec4((gl_Position.xy + gl_Position.ww) * 0.5, gl_Position.zw);
}
`;

export const OBSTACLE_DISPLACEMENT_FRAG = /* glsl */ `
uniform sampler2D _WallSceneTexture;
uniform sampler2D _WallNoiseTexture;
uniform float _WallDisplacementStrength;
uniform float _WallDisplacementAlpha;
uniform float _WallViewAngleDistortionParam;
uniform float _WallTintToWhite;
uniform float _WallAddColorMultiplier;
uniform float _FogStartOffset;
uniform float _FogScale;
varying vec2 vDisplacementUv;
varying vec3 vWorldPos;
varying vec3 vWorldNormal;
varying float vColorAlpha;
varying vec4 vScreenPos;
${BASE_COLOR_CHUNK}
${FOG_CHUNK}
${NOODLE_DISSOLVE_CHUNK}
vec3 wallSrgbToLinear(vec3 color) {
  vec3 linear = pow((color + 0.055) / 1.055, vec3(2.4));
  vec3 toe = color / 12.92;
  return mix(linear, toe, 1.0 - step(vec3(0.04045), color));
}

vec3 wallLinearToSrgb(vec3 color) {
  vec3 srgb = 1.055 * pow(color, vec3(1.0 / 2.4)) - 0.055;
  vec3 toe = color * 12.92;
  return mix(srgb, toe, 1.0 - step(vec3(0.0031308), color));
}

void main() {
  applyNoodleDissolve();
  vec2 displacement = texture2D(_WallNoiseTexture, vDisplacementUv).rg - vec2(0.5);
  vec3 viewDirection = normalize(cameraPosition - vWorldPos);
  float viewAngle = clamp(
    sqrt(abs(dot(viewDirection, normalize(vWorldNormal)))) * _WallViewAngleDistortionParam,
    0.0,
    1.0
  );
  float tintAlpha = mix(vColorAlpha, 1.0, _WallTintToWhite);
  displacement *= _WallDisplacementStrength * tintAlpha * viewAngle;

  vec2 screenUv = (vScreenPos.xy + displacement) / vScreenPos.w;
  vec4 sceneColor = texture2D(_WallSceneTexture, screenUv);
  vec3 obstacleColor = wallLinearToSrgb(baseColor());
  vec3 tintColor = wallSrgbToLinear(mix(obstacleColor, vec3(1.0), _WallTintToWhite));
  vec3 addColor = wallSrgbToLinear(obstacleColor * _WallAddColorMultiplier);
  vec4 color = sceneColor * vec4(tintColor, tintAlpha) + vec4(addColor, 0.0);
  color.a *= _WallDisplacementAlpha;
  color = applyChroFog(color, vScreenPos, vWorldPos, _FogStartOffset, _FogScale);
  gl_FragColor = clamp(color, 0.0, 1.0);
  #include <colorspace_fragment>
}
`;

export const OBSTACLE_OUTLINE_VERT = /* glsl */ `
attribute float instanceColorAlpha;
attribute vec2 instanceObstacleEdgeScale;
varying vec3 vWorldPos;
varying vec3 vCutoutPos;
varying vec3 vLocalNormal;
varying vec3 vInstanceScale;
varying vec2 vObstacleEdgeScale;
varying vec2 vUv;
varying float vColorAlpha;
varying vec4 vScreenPos;
#ifdef USE_INSTANCING_COLOR
varying vec3 vInstanceColor;
#endif
varying float vDissolve;
#ifdef USE_INSTANCING
attribute float instanceDissolve;
attribute float instanceCutoutSeed;
#endif
${NOODLE_CUTOUT_OFFSET_VERT_CHUNK}
void main() {
  vDissolve = 1.0;
  vec4 localPos = vec4(position, 1.0);
  vec3 cutoutPos = position;
  vec3 cutoutOffset = vec3(0.0);
  vColorAlpha = 1.0;
  vInstanceScale = vec3(1.0);
  vObstacleEdgeScale = vec2(1.0);
  #ifdef USE_INSTANCING
  vInstanceScale = vec3(
    length(instanceMatrix[0].xyz),
    length(instanceMatrix[1].xyz),
    length(instanceMatrix[2].xyz)
  );
  vObstacleEdgeScale = instanceObstacleEdgeScale;
  localPos = instanceMatrix * localPos;
  cutoutPos = mat3(instanceMatrix) * cutoutPos;
  cutoutOffset = noodleCutoutOffset(instanceCutoutSeed);
  vDissolve = instanceDissolve;
  vColorAlpha = instanceColorAlpha;
  #endif
  #ifdef USE_INSTANCING_COLOR
  vInstanceColor = instanceColor;
  #endif
  vec4 worldPos = modelMatrix * localPos;
  vWorldPos = worldPos.xyz;
  vCutoutPos = mat3(modelMatrix) * cutoutPos + cutoutOffset;
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
varying vec2 vObstacleEdgeScale;
varying vec2 vUv;
varying float vColorAlpha;
varying vec4 vScreenPos;
${BASE_COLOR_CHUNK}
${FOG_CHUNK}
${NOODLE_DISSOLVE_CHUNK}
void main() {
  applyNoodleDissolve();
  vec2 uvScalar;
  vec2 edgeScale;
  if (vLocalNormal.x != 0.0) {
    uvScalar = vInstanceScale.zy;
    edgeScale = vec2(1.0, vObstacleEdgeScale.y);
  } else if (vLocalNormal.y != 0.0) {
    uvScalar = vInstanceScale.xz;
    edgeScale = vec2(vObstacleEdgeScale.x, 1.0);
  } else {
    uvScalar = vInstanceScale.xy;
    edgeScale = vec2(1.0);
  }

  vec2 halfUv = 0.5 - abs(0.5 - vUv);
  if (
    halfUv.x * uvScalar.x >= 0.04 * edgeScale.x &&
    halfUv.y * uvScalar.y >= 0.04 * edgeScale.y
  ) {
    discard;
  }

  vec4 color = mix(
    vec4(baseColor(), vColorAlpha * 2.0),
    chroFogColor(vScreenPos),
    chroFogAmount(vWorldPos, _FogStartOffset, _FogScale)
  );
  // the game writes raw hdr chroma colors into a unorm target, which clamps
  // to [0,1] before bloom; our scene target is half-float, so clamp here
  gl_FragColor = clamp(color, 0.0, 1.0);
  #include <colorspace_fragment>
}
`;

export const OBSTACLE_FAKE_GLOW_VERT = /* glsl */ `
attribute float instanceColorAlpha;
attribute vec2 instanceObstacleEdgeScale;
varying vec3 vWorldPos;
varying vec3 vCutoutPos;
varying vec3 vLocalNormal;
varying vec3 vInstanceScale;
varying vec2 vObstacleEdgeScale;
varying vec2 vUv;
varying float vColorAlpha;
varying float vViewAngle;
#ifdef USE_INSTANCING_COLOR
varying vec3 vInstanceColor;
#endif
varying float vDissolve;
#ifdef USE_INSTANCING
attribute float instanceDissolve;
attribute float instanceCutoutSeed;
#endif
${NOODLE_CUTOUT_OFFSET_VERT_CHUNK}
void main() {
  vDissolve = 1.0;
  vColorAlpha = 1.0;
  vec4 localPos = vec4(position, 1.0);
  vec3 localNormal = normal;
  vec3 cutoutPos = position;
  vec3 cutoutOffset = vec3(0.0);
  vInstanceScale = vec3(1.0);
  vObstacleEdgeScale = vec2(1.0);
  #ifdef USE_INSTANCING
  vInstanceScale = vec3(
    length(instanceMatrix[0].xyz),
    length(instanceMatrix[1].xyz),
    length(instanceMatrix[2].xyz)
  );
  vObstacleEdgeScale = instanceObstacleEdgeScale;
  localPos = instanceMatrix * localPos;
  localNormal = mat3(instanceMatrix) * localNormal;
  cutoutPos = mat3(instanceMatrix) * cutoutPos;
  cutoutOffset = noodleCutoutOffset(instanceCutoutSeed);
  vDissolve = instanceDissolve;
  vColorAlpha = instanceColorAlpha;
  #endif
  #ifdef USE_INSTANCING_COLOR
  vInstanceColor = instanceColor;
  #endif
  vec4 worldPos = modelMatrix * localPos;
  vec3 worldNormal = normalize(mat3(modelMatrix) * localNormal);
  vec3 viewDirection = normalize(worldPos.xyz - cameraPosition);
  vWorldPos = worldPos.xyz;
  vCutoutPos = mat3(modelMatrix) * cutoutPos + cutoutOffset;
  vLocalNormal = normal;
  vUv = uv;
  vViewAngle = min(abs(dot(viewDirection, worldNormal)), 1.0);
  gl_Position = projectionMatrix * viewMatrix * worldPos;
}
`;

export const OBSTACLE_FAKE_GLOW_FRAG = /* glsl */ `
uniform float _FogStartOffset;
uniform float _FogScale;
varying vec3 vWorldPos;
varying vec3 vLocalNormal;
varying vec3 vInstanceScale;
varying vec2 vObstacleEdgeScale;
varying vec2 vUv;
varying float vColorAlpha;
varying float vViewAngle;
${BASE_COLOR_CHUNK}
${FOG_CHUNK}
${NOODLE_DISSOLVE_CHUNK}
void main() {
  applyNoodleDissolve();
  vec2 uvScalar;
  vec2 edgeScale;
  if (vLocalNormal.x != 0.0) {
    uvScalar = vInstanceScale.zy;
    edgeScale = vec2(1.0, vObstacleEdgeScale.y);
  } else if (vLocalNormal.y != 0.0) {
    uvScalar = vInstanceScale.xz;
    edgeScale = vec2(vObstacleEdgeScale.x, 1.0);
  } else {
    uvScalar = vInstanceScale.xy;
    edgeScale = vec2(1.0);
  }

  // legacy noodle scaled the prefab glow together with the obstacle root
  vec2 halfUv = (0.5 - abs(0.5 - vUv)) * uvScalar;
  vec2 edgeDistance = halfUv / max(edgeScale, vec2(0.0001));
  float distanceToEdge = min(edgeDistance.x, edgeDistance.y);
  float textureAlpha = exp(-pow(distanceToEdge / 0.035, 2.0));
  float signal = clamp(
    vColorAlpha * vViewAngle * (1.0 - chroFogAmount(vWorldPos, _FogStartOffset, _FogScale)),
    0.0,
    1.0
  );
  signal *= textureAlpha * textureAlpha;
  gl_FragColor = clamp(vec4(baseColor() * signal, signal), 0.0, 1.0);
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
  float width = _ArcRadius * clamp(aheadDistance * 4.0 + 2.0, 0.0, 1.0);
  vec3 localPos = center + normal * ((arcData.x - 0.5) * 2.0 * width);
  vec4 worldPos = modelMatrix * vec4(localPos, 1.0);
  vWorldPos = worldPos.xyz;
  gl_Position = projectionMatrix * viewMatrix * worldPos;

  float pointElapsed = _PlaybackBeat - (pointBeat - _JumpBeats);
  float spawnFade = clamp(pointElapsed / (_JumpBeats * 0.5), 0.0, 1.0);
  float cutFade = clamp(aheadDistance * 4.0, 0.0, 1.0);
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
uniform float _NoodleDissolve;
varying vec2 vUv;
varying vec3 vWorldPos;
varying float vEdge;
varying float vAlpha;
${FOG_CHUNK}
${NOODLE_CUTOUT_NOISE_CHUNK}
void main() {
  float cutout = 1.0 - clamp(_NoodleDissolve, 0.0, 1.0);
  if (noodleCutoutNoise(vWorldPos * 0.25) < cutout) discard;
  float edge = max(1.0 - 2.0 * abs(vEdge - 0.5), 0.0);
  edge *= mix(0.015, 1.0, edge);
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
