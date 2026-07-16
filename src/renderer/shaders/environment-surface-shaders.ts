import { ACES_CHUNK, BASE_COLOR_CHUNK, FOG_CHUNK } from './chunks';

export const ENVIRONMENT_LIT_VERT = /* glsl */ `
uniform vec3 _DisplacementAxisMultiplier;
uniform float _DisplacementStrength;
uniform float _MeshPackingId;
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
attribute vec4 color;
varying vec4 vVertexColor;
#endif
#if defined(MESH_PACKING) || defined(USE_SECONDARY_UV)
attribute vec2 uv1;
#endif

void main() {
  vec3 localPosition = position;
  vec3 localNormal = normal;
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
  vec4 worldPos = modelMatrix * vec4(localPosition, 1.0);
  vec4 viewPos = viewMatrix * worldPos;
  vWorldPos = worldPos.xyz;
  vWorldNormal = normalize(mat3(modelMatrix) * localNormal);
  vViewPos = viewPos.xyz;
  vViewNormal = normalize(normalMatrix * localNormal);
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
  gl_FragColor = albedo;
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
uniform samplerCube _ReflectionProbe;
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
float chroDiffuseTerm(vec3 normal, vec3 lightDirection) {
  return max(dot(normal, lightDirection), 0.0)
    + max(dot(normal, -lightDirection), 0.0) * _BothSidesDiffuseMultiplier;
}

float chroLightFalloff(vec3 lightOffset, float radius) {
  float normalizedDistance = dot(lightOffset, lightOffset) / max(radius * radius, 0.00000001);
  return 1.0 / (1.0 + normalizedDistance * 24.8);
}

float chroSpecularTerm(vec3 lightDirection, vec3 reflectedView, float focus) {
  vec3 alignment = lightDirection - reflectedView;
  float lobe = clamp(1.0 - dot(alignment, alignment) * focus * 0.502, 0.0, 1.0);
  float lobe2 = lobe * lobe;
  return lobe2 * lobe2 * lobe2 * lobe2 * focus;
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
  vec3 reflectedView = reflect(normalize(vWorldPos - cameraPosition), normal);
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
  float smoothness2 = smoothness * smoothness;
  float specularFocus = smoothness2 * smoothness2 * 496.0;
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
      specularLight += chroSpecularTerm(lightDir, reflectedView, specularFocus)
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
      specularLight += chroSpecularTerm(lightDir, reflectedView, specularFocus) * pointColor;
    }
  }
  vec3 diffuseColor = diffuseLight * albedo;
  vec3 calculated = diffuseColor * (1.0 - metallic);
  if (_SpecularEnabled != 0.0) {
    vec3 specularColor = mix(vec3(0.041), albedo, metallic);
    calculated = diffuseColor * ((1.0 - metallic) * 0.958)
      + specularLight * specularColor * _SpecularIntensity;
  }
  calculated = (calculated + albedo * max(
    _NominalDiffuseLevel * _AmbientMultiplier,
    vec3(_AmbientMinimalValue)
  ));
  #ifdef REFLECTION_PROBE
  vec3 probeDirection = vec3(reflectedView.x, reflectedView.y, -reflectedView.z);
  float perceptualRoughness = 1.0 - smoothness;
  float probeMip = perceptualRoughness * (1.7 - 0.7 * perceptualRoughness) * 6.0;
  vec3 reflection = textureCube(
    _ReflectionProbe,
    probeDirection,
    probeMip
  ).rgb;
    #ifdef MULTIPLY_REFLECTIONS
    reflection *= mix(vec3(1.0), albedo, metallic);
    #endif
  float reflectionWeight = 2.0 * (0.2 + 0.8 * metallic) * smoothness;
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
  gl_FragColor = color;
  #include <colorspace_fragment>
}
`;
