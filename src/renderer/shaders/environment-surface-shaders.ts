import { ACES_CHUNK, BASE_COLOR_CHUNK, DXT5_NORMAL_CHUNK, FOG_CHUNK } from './chunks';

export const ENVIRONMENT_LIT_VERT = /* glsl */ `
uniform vec3 _DisplacementAxisMultiplier;
uniform float _DisplacementStrength;
uniform float _MeshPackingId;
varying vec3 vWorldPos;
varying vec3 vWorldNormal;
varying vec3 vWorldTangent;
varying vec3 vWorldBitangent;
varying vec3 vViewPos;
varying vec3 vViewNormal;
varying vec2 vUv;
#ifdef USE_SECONDARY_UV
varying vec2 vSecondaryUv;
#endif
varying vec4 vScreenPos;
#ifdef USE_VERTEX_COLOR
attribute vec4 color;
varying vec4 vVertexColor;
#endif
#if defined(MESH_PACKING) || defined(USE_SECONDARY_UV)
attribute vec2 uv1;
#endif

void main() {
  vec3 localPosition = position;
  vec3 localNormal = normal;
  mat3 instanceBasis = mat3(1.0);
  #ifdef MESH_PACKING
  if (abs(uv1.y - _MeshPackingId) > 0.1) localPosition = vec3(0.0);
  #endif
  #ifdef VERTEX_DISPLACEMENT
  vec3 displacement = color.rgb;
  #ifdef DISPLACEMENT_BIDIRECTIONAL
  displacement = displacement * 2.0 - 1.0;
  #endif
  #ifdef DISPLACEMENT_SPATIAL
  localPosition += displacement * _DisplacementAxisMultiplier * _DisplacementStrength;
  #else
  localPosition += localNormal * displacement.r * _DisplacementAxisMultiplier.x * _DisplacementStrength;
  #endif
  #endif
  #ifdef USE_VERTEX_COLOR
  vVertexColor = color;
  #endif
  vec4 localPos = vec4(localPosition, 1.0);
  #ifdef USE_INSTANCING
  localPos = instanceMatrix * localPos;
  instanceBasis = mat3(instanceMatrix);
  #endif
  vec4 worldPos = modelMatrix * localPos;
  vec4 viewPos = viewMatrix * worldPos;
  vWorldPos = worldPos.xyz;
  vWorldNormal = normalize(mat3(modelMatrix) * instanceBasis * localNormal);
  #ifdef USE_TANGENT
  vWorldTangent = normalize(mat3(modelMatrix) * instanceBasis * tangent.xyz);
  vWorldBitangent = normalize(cross(vWorldNormal, vWorldTangent) * tangent.w);
  #endif
  vViewPos = viewPos.xyz;
  #ifdef USE_INSTANCING
  vViewNormal = normalize(mat3(viewMatrix) * vWorldNormal);
  #else
  vViewNormal = normalize(normalMatrix * localNormal);
  #endif
  vUv = uv;
  #ifdef USE_SECONDARY_UV
  vSecondaryUv = uv1;
  #endif
  gl_Position = projectionMatrix * viewPos;
  vScreenPos = vec4((gl_Position.xy + gl_Position.ww) * 0.5, gl_Position.zw);
}
`;

export const ENVIRONMENT_UNLIT_FRAG = /* glsl */ `
uniform vec3 _Color;
uniform float _ColorAlpha;
uniform float _FogStartOffset;
uniform float _FogScale;
varying vec3 vWorldPos;
varying vec4 vScreenPos;
${ACES_CHUNK}
${FOG_CHUNK}
void main() {
  vec4 albedo = vec4(chroToneMap(_Color), _ColorAlpha);
  albedo = applyChroFog(albedo, vScreenPos, vWorldPos, _FogStartOffset, _FogScale);
  gl_FragColor = clamp(albedo, 0.0, 1.0);
  #include <colorspace_fragment>
}
`;

const REFLECTION_PROBE_CHUNK = /* glsl */ `
uniform samplerCube _ReflectionProbe;
uniform samplerCube _ReflectionProbe2;
uniform vec3 _ReflectionProbePosition;
uniform vec3 _ReflectionProbeBoxMin;
uniform vec3 _ReflectionProbeBoxMax;
uniform vec4 _LightProbeLightBakeId[6];

vec3 chroDecodeProbeChannel(float encoded, vec4 lightColor) {
  float lowRange = min(encoded, 0.5);
  float highRange = max(encoded - 0.5, 0.0) * lightColor.a;
  return lowRange * lightColor.rgb + vec3(highRange * highRange);
}

vec3 chroProjectProbeDirection(vec3 direction, vec3 worldPosition) {
  vec3 inverseDirection = 1.0 / direction;
  vec3 projectedBounds = mix(
    (_ReflectionProbeBoxMin - worldPosition) * inverseDirection,
    (_ReflectionProbeBoxMax - worldPosition) * inverseDirection,
    step(vec3(0.0), direction)
  );
  float projectedDistance = min(min(projectedBounds.x, projectedBounds.y), projectedBounds.z);
  return worldPosition - _ReflectionProbePosition + direction * projectedDistance;
}

vec3 chroSampleProbe(vec3 reflectedView, vec3 worldPosition, float mip) {
  vec3 probeDirection = vec3(reflectedView.xy, -reflectedView.z);
  #ifdef BAKED_REFLECTION_PROBE
  vec3 unityWorldPosition = vec3(worldPosition.xy, -worldPosition.z);
  probeDirection = chroProjectProbeDirection(probeDirection, unityWorldPosition);
  vec3 firstProbe = textureCube(_ReflectionProbe, probeDirection, mip).rgb;
  vec3 secondProbe = textureCube(_ReflectionProbe2, probeDirection, mip).rgb;
  vec3 decoded = chroDecodeProbeChannel(firstProbe.r, _LightProbeLightBakeId[0]);
  decoded += chroDecodeProbeChannel(firstProbe.g, _LightProbeLightBakeId[1]);
  decoded += chroDecodeProbeChannel(firstProbe.b, _LightProbeLightBakeId[2]);
  decoded += chroDecodeProbeChannel(secondProbe.r, _LightProbeLightBakeId[3]);
  decoded += chroDecodeProbeChannel(secondProbe.g, _LightProbeLightBakeId[4]);
  decoded += chroDecodeProbeChannel(secondProbe.b, _LightProbeLightBakeId[5]);
  return clamp(decoded * 2.0, 0.0, 1.0);
  #else
  return textureCube(_ReflectionProbe, probeDirection, mip).rgb;
  #endif
}
`;

export const WATER_LIT_FRAG = /* glsl */ `
uniform sampler2D _NormalTexture;
uniform vec2 _NormalTextureScale;
uniform vec2 _NormalTextureOffset;
uniform vec2 _NormalTexScrolling;
uniform float _NormalScale;
uniform float _NormalScaleVertical;
uniform float _Metallic;
uniform float _ReflectionIntensity;
uniform float _Smoothness;
uniform vec3 _Color;
uniform float _ColorAlpha;
uniform float _TimeSeconds;
uniform float _FogStartOffset;
uniform float _FogScale;
uniform float _FallingFogStartOffset;
uniform float _ZFadePosition;
uniform float _ZFadeScale;
varying vec3 vWorldPos;
varying vec3 vWorldNormal;
varying vec3 vWorldTangent;
varying vec3 vWorldBitangent;
varying vec2 vUv;
varying vec4 vScreenPos;
${ACES_CHUNK}
${FOG_CHUNK}
${DXT5_NORMAL_CHUNK}
${REFLECTION_PROBE_CHUNK}
void main() {
  float unityTime = _TimeSeconds * 0.05;
  vec2 normalUv = (vUv + _NormalTexScrolling * unityTime) * _NormalTextureScale + _NormalTextureOffset;
  vec4 packedNormal = texture2D(_NormalTexture, normalUv);
  vec2 mappedXy = chroDxt5NormalXY(packedNormal);
  vec3 surfaceNormal = normalize(vWorldNormal);
  float mappedZ = sqrt(max(1.0 - min(dot(mappedXy, mappedXy), 1.0), 0.0));
  float verticalGain = 1.0 + _NormalScaleVertical * (1.0 - surfaceNormal.y);
  mappedXy *= verticalGain;
  vec3 mappedNormal = normalize(mat3(vWorldTangent, vWorldBitangent, surfaceNormal) * vec3(mappedXy, mappedZ));
  vec3 normal = normalize(mix(surfaceNormal, mappedNormal, _NormalScale));
  vec3 viewDirection = normalize(cameraPosition - vWorldPos);
  vec3 reflectedView = reflect(-viewDirection, normal);
  float roughness = 1.0 - _Smoothness;
  float roughnessMipWeight = 1.7 - 0.7 * roughness;
  float probeMip = roughness * roughnessMipWeight * 6.0;
  vec3 reflection = chroSampleProbe(reflectedView, vWorldPos, probeMip);
  #ifndef BAKED_REFLECTION_PROBE
  reflection = min(reflection * 2.0, vec3(1.0));
  #endif
  float reflectionWeight = _Smoothness * mix(0.4, 2.0, _Metallic);
  vec3 reflectionColor = mix(vec3(1.0), _Color, _Metallic);
  vec4 albedo = vec4(
    chroToneMap(reflection * reflectionColor * _ReflectionIntensity * reflectionWeight),
    _ColorAlpha
  );
  float fogStartOffset = _FogStartOffset + _FallingFogStartOffset * (1.0 - clamp(normal.y, 0.0, 1.0));
  albedo = applyChroFog(albedo, vScreenPos, vWorldPos, fogStartOffset, _FogScale);
  #ifdef Z_FADE
  float alpha = clamp((_ZFadePosition + vWorldPos.z) * _ZFadeScale, 0.0, 1.0) * _ColorAlpha;
  gl_FragColor = vec4(albedo.rgb, alpha);
  #else
  gl_FragColor = vec4(albedo.rgb, 0.0);
  #endif
  #include <colorspace_fragment>
}
`;

export const ENVIRONMENT_LIT_FRAG = /* glsl */ `
uniform vec3 _DirectionalLightDirections[5];
uniform vec3 _DirectionalLightColors[5];
uniform vec3 _DirectionalLightPositions[5];
uniform float _DirectionalLightRadii[5];
uniform float _AmbientMinimalValue;
uniform vec3 _NominalDiffuseLevel;
uniform float _AmbientMultiplier;
uniform float _DiffuseEnabled;
uniform float _BothSidesDiffuseMultiplier;
uniform float _Metallic;
uniform float _SpecularEnabled;
uniform float _Smoothness;
uniform float _SpecularIntensity;
uniform float _LightFalloffEnabled;
uniform float _PrivatePointLightEnabled;
uniform vec3 _PrivatePointLightColor;
uniform vec3 _PrivatePointLightPosition;
uniform float _PrivatePointLightLocal;
uniform float _PrivatePointLightIntensity;
uniform float _GroundFadeEnabled;
uniform float _GroundFadeScale;
uniform float _GroundFadeOffset;
uniform float _DistanceDarkeningEnabled;
uniform float _DarkeningScale;
uniform float _DarkeningIntensity;
uniform vec3 _DarkeningCenter;
uniform vec3 _DarkeningDirection;
uniform vec3 _EmissionColor;
uniform float _EmissionColorAlpha;
uniform float _VertexEmissionThreshold;
uniform float _VertexEmissionStrength;
uniform float _VertexEmissionBloomIntensity;
uniform sampler2D _DiffuseTex;
uniform vec2 _DiffuseTexScale;
uniform vec2 _DiffuseTexOffset;
uniform float _AlbedoMultiplier;
uniform sampler2D _MetalSmoothnessTex;
uniform vec2 _MetalSmoothnessTexScale;
uniform vec2 _MetalSmoothnessTexOffset;
uniform float _OcclusionIntensity;
uniform sampler2D _DirtDetailTex;
uniform vec2 _DirtDetailTexScale;
uniform vec2 _DirtDetailTexOffset;
uniform vec2 _OcclusionDetailOffset;
uniform float _OcclusionDetailIntensity;
uniform sampler2D _NormalTexture;
uniform vec2 _NormalTextureScale;
uniform vec2 _NormalTextureOffset;
uniform float _NormalScale;
uniform sampler2D _EmissionTex;
uniform vec2 _EmissionTexScale;
uniform vec2 _EmissionTexOffset;
uniform sampler2D _EmissionMask;
uniform vec2 _EmissionMaskScale;
uniform vec2 _EmissionMaskOffset;
uniform sampler2D _SecondaryEmissionMask;
uniform vec2 _SecondaryEmissionMaskScale;
uniform vec2 _SecondaryEmissionMaskOffset;
uniform vec2 _EmissionMaskSpeed;
uniform vec2 _SecondaryEmissionMaskSpeed;
uniform float _PrimaryEmissionGain;
uniform float _SecondaryEmissionGain;
uniform float _ReflectionIntensity;
uniform vec3 _EmissionTexColor;
uniform float _EmissionTexColorAlpha;
uniform float _EmissionBrightness;
uniform float _EmissionFogSuppression;
uniform float _EmissionTexBloomIntensity;
uniform float _EmissionTexWhiteBoostMultiplier;
uniform float _TimeSeconds;
uniform float _SongTime;
uniform float _TimeOffset;
uniform float _FogStartOffset;
uniform float _FogScale;
varying vec3 vWorldPos;
varying vec3 vWorldNormal;
varying vec3 vViewPos;
varying vec3 vViewNormal;
varying vec2 vUv;
#ifdef USE_SECONDARY_UV
varying vec2 vSecondaryUv;
#endif
varying vec4 vScreenPos;
#ifdef USE_VERTEX_COLOR
varying vec4 vVertexColor;
#endif
${BASE_COLOR_CHUNK}
${ACES_CHUNK}
${FOG_CHUNK}
${REFLECTION_PROBE_CHUNK}
float chroDiffuseTerm(vec3 normal, vec3 lightDirection) {
  return max(dot(normal, lightDirection), 0.0)
    + max(dot(normal, -lightDirection), 0.0) * _BothSidesDiffuseMultiplier;
}

float chroLightFalloff(vec3 lightOffset, float radius) {
  return clamp(1.0 - length(lightOffset) / max(radius, 0.00000001), 0.0, 1.0);
}

const float CHRO_PI = 3.14159265;

float chroGgxDistribution(float normalDotHalf, float roughnessSquared) {
  float roughnessFourth = roughnessSquared * roughnessSquared;
  float denominator = normalDotHalf * normalDotHalf * (roughnessFourth - 1.0) + 1.0;
  return roughnessFourth / (CHRO_PI * denominator * denominator);
}

float chroSmithMasking(float normalDotDirection, float geometryK) {
  return normalDotDirection / (normalDotDirection * (1.0 - geometryK) + geometryK);
}

vec3 chroSchlickFresnel(vec3 baseReflectance, float viewDotHalf) {
  return baseReflectance + (1.0 - baseReflectance) * pow(1.0 - viewDotHalf, 5.0);
}

vec3 chroSpecularTerm(
  vec3 lightDirection,
  vec3 viewDirection,
  vec3 normal,
  vec3 albedo,
  float metallic,
  float smoothness
) {
  vec3 halfDirection = normalize(lightDirection + viewDirection);
  float normalDotHalf = clamp(dot(normal, halfDirection), 0.0, 1.0);
  float normalDotView = clamp(dot(normal, viewDirection), 0.0, 1.0);
  float normalDotLight = clamp(dot(normal, lightDirection), 0.0, 1.0);
  float viewDotHalf = clamp(dot(viewDirection, halfDirection), 0.0, 1.0);
  float roughness = 1.0 - smoothness;
  float roughnessSquared = roughness * roughness;
  float distribution = chroGgxDistribution(normalDotHalf, roughnessSquared);
  vec3 baseReflectance = mix(vec3(0.04), albedo, metallic);
  vec3 fresnel = chroSchlickFresnel(baseReflectance, viewDotHalf);
  float geometryK = (roughnessSquared + 1.0) * (roughnessSquared + 1.0) / 8.0;
  float geometryView = chroSmithMasking(normalDotView, geometryK);
  float geometryLight = chroSmithMasking(normalDotLight, geometryK);
  return distribution * fresnel * geometryView * geometryLight
    / (4.0 * normalDotView * normalDotLight + 0.001) * normalDotLight;
}
void main() {
  float materialTime = _TimeSeconds;
  #ifdef CUSTOM_TIME_SONG
  materialTime = _SongTime;
  #elif defined(CUSTOM_TIME_FREEZE)
  materialTime = _TimeOffset;
  #endif
  vec3 albedo = baseColor();
  #ifdef DIFFUSE_TEXTURE
  albedo *= texture2D(_DiffuseTex, vUv * _DiffuseTexScale + _DiffuseTexOffset).rgb * _AlbedoMultiplier;
  #endif
  #ifdef USE_VERTEX_COLOR
  #ifndef VERTEX_EMISSION
  albedo *= vVertexColor.rgb;
  #endif
  #endif
  vec3 normal = normalize(vWorldNormal);
  #ifdef NORMAL_TEXTURE
  vec3 mappedNormal = texture2D(
    _NormalTexture,
    vUv * _NormalTextureScale + _NormalTextureOffset
  ).xyz * 2.0 - 1.0;
  mappedNormal.xy *= _NormalScale;
  vec3 positionDx = dFdx(vWorldPos);
  vec3 positionDy = dFdy(vWorldPos);
  vec2 uvDx = dFdx(vUv);
  vec2 uvDy = dFdy(vUv);
  vec3 tangent = normalize(positionDx * uvDy.y - positionDy * uvDx.y);
  vec3 bitangent = normalize(-positionDx * uvDy.x + positionDy * uvDx.x);
  normal = normalize(mat3(tangent, bitangent, normal) * mappedNormal);
  #endif
  vec3 viewDirection = normalize(cameraPosition - vWorldPos);
  float metallic = _Metallic;
  float smoothness = _Smoothness;
  vec4 packedSurface = vec4(1.0);
  #ifdef METAL_SMOOTHNESS_TEXTURE
  packedSurface = texture2D(
    _MetalSmoothnessTex,
    vUv * _MetalSmoothnessTexScale + _MetalSmoothnessTexOffset
  );
    #ifdef METALLIC_TEXTURE
  metallic *= packedSurface.r;
    #endif
    #ifdef SMOOTHNESS_TEXTURE
    #ifdef METAL_SMOOTHNESS_ALPHA
    smoothness *= packedSurface.a;
    #elif defined(METAL_SMOOTHNESS_GREEN_ROUGHNESS)
    smoothness *= 1.0 - packedSurface.g;
    #else
    smoothness *= packedSurface.g;
    #endif
    #endif
  #endif
  vec3 diffuseLight = vec3(0.0);
  vec3 specularLight = vec3(0.0);
  for (int i = 0; i < 5; i++) {
    vec3 lightColor = _DirectionalLightColors[i];
    if (lightColor.r == 0.0 && lightColor.g == 0.0 && lightColor.b == 0.0) continue;
    vec3 lightDir = normalize(_DirectionalLightDirections[i]);
    float attenuation = 1.0;
    if (_LightFalloffEnabled != 0.0) {
      vec3 lightOffset = vWorldPos - _DirectionalLightPositions[i];
      attenuation = chroLightFalloff(lightOffset, _DirectionalLightRadii[i]);
    }
    diffuseLight += chroDiffuseTerm(normal, lightDir) * attenuation * lightColor * _DiffuseEnabled;
    if (_SpecularEnabled != 0.0) {
      specularLight += chroSpecularTerm(lightDir, viewDirection, normal, albedo, metallic, smoothness)
        * attenuation * lightColor;
    }
  }
  if (_PrivatePointLightEnabled != 0.0) {
    vec3 pointOffset = _PrivatePointLightLocal != 0.0
      ? _PrivatePointLightPosition
      : _PrivatePointLightPosition - vWorldPos;
    vec3 lightDir = normalize(pointOffset);
    vec3 pointColor = _PrivatePointLightColor * _PrivatePointLightIntensity;
    diffuseLight += chroDiffuseTerm(normal, lightDir) * pointColor * _DiffuseEnabled;
    if (_SpecularEnabled != 0.0) {
      specularLight += chroSpecularTerm(lightDir, viewDirection, normal, albedo, metallic, smoothness) * pointColor;
    }
  }
  vec3 calculated = diffuseLight * albedo * (1.0 - metallic);
  if (_SpecularEnabled != 0.0) {
    calculated += specularLight * _SpecularIntensity;
  }
  calculated += max(_NominalDiffuseLevel * albedo, vec3(_AmbientMinimalValue)) * _AmbientMultiplier;
  #ifdef REFLECTION_PROBE
  vec3 reflectedView = reflect(-viewDirection, normal);
  float roughness = 1.0 - smoothness;
  float roughnessMipWeight = 1.7 - 0.7 * roughness;
  float probeMip = roughness * roughnessMipWeight * 6.0;
  vec3 reflection = chroSampleProbe(reflectedView, vWorldPos, probeMip);
    #ifdef MULTIPLY_REFLECTIONS
    reflection *= mix(vec3(1.0), albedo, metallic);
    #endif
  float reflectionWeight = smoothness * mix(0.4, 2.0, metallic);
  calculated += reflection * reflectionWeight * _ReflectionIntensity;
  #endif
  #ifdef OCCLUSION
  float occlusion = mix(1.0, packedSurface.b, _OcclusionIntensity);
    #ifdef OCCLUSION_DETAIL
    float detailOcclusion = texture2D(
      _DirtDetailTex,
      (vUv + _OcclusionDetailOffset) * _DirtDetailTexScale + _DirtDetailTexOffset
    ).b;
    occlusion *= mix(1.0, detailOcclusion, _OcclusionDetailIntensity);
    #endif
    #ifdef OCCLUSION_BEFORE_EMISSION
    calculated *= occlusion;
    #endif
  #endif
  #ifdef TONE_MAP_BEFORE_EMISSION
  calculated = chroToneMap(calculated);
  #endif
  float bloomEmission = 0.0;
  float fogSuppression = 1.0;
  #ifdef VERTEX_EMISSION
  float vertexEmissionT = clamp(
    (vVertexColor.g - _VertexEmissionThreshold) / (1.0 - _VertexEmissionThreshold),
    0.0,
    1.0
  );
  float vertexEmissionMask = vertexEmissionT * vertexEmissionT * (3.0 - 2.0 * vertexEmissionT)
    * _VertexEmissionStrength;
  calculated += _EmissionColor * _EmissionColorAlpha * vertexEmissionMask;
  fogSuppression = 1.0 - _EmissionFogSuppression * vertexEmissionMask
    * _EmissionColorAlpha * _EmissionColorAlpha;
  #endif
  #ifdef EMISSION_TEXTURE
  vec4 emission = texture2D(_EmissionTex, vUv * _EmissionTexScale + _EmissionTexOffset);
    #ifdef EMISSION_MASK
    vec2 primaryMaskUv = vUv;
      #ifdef EMISSION_MASK_SECONDARY_UV
      primaryMaskUv = vSecondaryUv;
      #endif
    vec4 primaryMask = texture2D(
      _EmissionMask,
      primaryMaskUv * _EmissionMaskScale + _EmissionMaskOffset + _EmissionMaskSpeed * materialTime
    );
    emission *= mix(vec4(1.0), primaryMask, _PrimaryEmissionGain);
    #endif
    #ifdef SECONDARY_EMISSION_MASK
    vec2 secondaryMaskUv = vUv;
      #ifdef SECONDARY_EMISSION_MASK_SECONDARY_UV
      secondaryMaskUv = vSecondaryUv;
      #endif
    vec4 secondaryMask = texture2D(
      _SecondaryEmissionMask,
      secondaryMaskUv * _SecondaryEmissionMaskScale + _SecondaryEmissionMaskOffset
        + _SecondaryEmissionMaskSpeed * materialTime
    );
    emission *= mix(vec4(1.0), secondaryMask, _SecondaryEmissionGain);
    #endif
    #ifdef EMISSION_TEXTURE_SIMPLE
    float visibleEmission = emission.r * _EmissionBrightness;
    bloomEmission = emission.g * _EmissionBrightness;
    vec3 visibleEmissionColor = _EmissionTexColor * visibleEmission * _EmissionTexColorAlpha;
      #ifdef EMISSION_WHITE_BOOST
      float whiteBoostSignal = bloomEmission * bloomEmission * _EmissionTexColorAlpha
        * _EmissionTexWhiteBoostMultiplier;
      float whiteEnergy = whiteBoostSignal * whiteBoostSignal * 0.997;
      visibleEmissionColor = clamp(visibleEmissionColor + vec3(whiteEnergy), 0.0, 1.0);
      #endif
    calculated += visibleEmissionColor;
    fogSuppression = 1.0 - visibleEmission * _EmissionFogSuppression * _EmissionTexColorAlpha;
    #else
    vec4 finalEmission = emission * vec4(_EmissionTexColor, _EmissionTexColorAlpha)
      * _EmissionBrightness;
    bloomEmission = finalEmission.a;
    calculated += finalEmission.rgb;
    fogSuppression = 1.0 - bloomEmission * _EmissionFogSuppression;
      #ifdef EMISSION_WHITE_BOOST
      float whiteBoostSignal = bloomEmission * bloomEmission * _EmissionTexWhiteBoostMultiplier;
      float whiteEnergy = whiteBoostSignal * whiteBoostSignal * 0.997;
      calculated += vec3(whiteEnergy);
      #endif
    #endif
  #endif
  #if defined(OCCLUSION) && !defined(OCCLUSION_BEFORE_EMISSION)
  calculated *= occlusion;
  #endif
  vec4 color = vec4(calculated, 0.0);
  #ifdef EMISSION_MAIN_EFFECT
  float mainEffectSignal = bloomEmission;
  color.a = mainEffectSignal * mainEffectSignal * 3.5
    * _EmissionTexColorAlpha * _EmissionTexBloomIntensity;
  #endif
  #ifdef VERTEX_EMISSION_MAIN_EFFECT
  color.a += vVertexColor.a * vVertexColor.a * _EmissionColorAlpha * _VertexEmissionBloomIntensity;
  #endif
  if (_GroundFadeEnabled != 0.0) {
    color *= clamp((vWorldPos.y + _GroundFadeOffset) * _GroundFadeScale, 0.0, 1.0);
  }
  #ifndef TONE_MAP_BEFORE_EMISSION
  color.rgb = chroToneMap(color.rgb);
  #endif
  color = applyChroFog(color, vScreenPos, vWorldPos, _FogStartOffset, _FogScale * fogSuppression);
  if (_DistanceDarkeningEnabled != 0.0) {
    vec3 offset = vWorldPos - _DarkeningCenter;
    float distanceAlongAxis = max(0.0, dot(offset, normalize(_DarkeningDirection)));
    float factor = clamp(distanceAlongAxis * _DarkeningScale, 0.0, 1.0) * _DarkeningIntensity;
    color.rgb = mix(color.rgb, vec3(0.0), factor);
  }
  // game writes to a unorm target: blend sources clamp to [0,1] per draw
  gl_FragColor = clamp(color, 0.0, 1.0);
  #include <colorspace_fragment>
}
`;
