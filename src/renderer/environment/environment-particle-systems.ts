import {
  AddEquation,
  BufferGeometry,
  CustomBlending,
  Euler,
  Float32BufferAttribute,
  Group,
  OneFactor,
  Points,
  Quaternion,
  ShaderMaterial,
  Vector2,
  Vector3,
  Vector4,
  type Material,
} from 'three';

import { materialFogUniforms } from '../materials/shared';
import { FOG_CHUNK } from '../shaders/chunks';
import type { EnvironmentMaterialContext } from './materials/material-context';
import type { EnvironmentParticleSystemData } from './types';

const PARTICLE_VERT = /* glsl */ `
attribute vec3 particleVelocity;
attribute float particleStart;
attribute float particleLifetime;
attribute float particleSize;
attribute float particleRotation;
uniform float _SongTime;
uniform float _Cycle;
uniform float _Prewarm;
uniform float _ViewportHeight;
varying float vAge;
varying float vLifetime;
varying float vRotation;
varying vec3 vWorldPos;
void main() {
  float elapsed = _SongTime - particleStart;
  float alive = step(0.0, elapsed);
  if (_Prewarm != 0.0) {
    elapsed += _Cycle;
    alive = 1.0;
  }
  float age = mod(max(elapsed, 0.0), _Cycle);
  alive *= 1.0 - step(particleLifetime, age);
  vec3 localPosition = position + particleVelocity * age;
  vec4 worldPosition = modelMatrix * vec4(localPosition, 1.0);
  vec4 viewPosition = viewMatrix * worldPosition;
  gl_Position = projectionMatrix * viewPosition;
  gl_PointSize = alive * particleSize * projectionMatrix[1][1] * _ViewportHeight * 0.5
    / max(-viewPosition.z, 0.001);
  vAge = age;
  vLifetime = particleLifetime;
  vRotation = particleRotation;
  vWorldPos = worldPosition.xyz;
}
`;

function alphaCurve(keys: readonly [number, number][]) {
  const glslFloat = (value: number) => (Number.isInteger(value) ? `${value}.0` : `${value}`);
  const sorted = [...keys].sort((a, b) => a[0] - b[0]);
  const first = sorted[0];
  if (first === undefined) return 'return 1.0;';
  let [previousTime, previousValue] = first;
  const lines = [`if (t <= ${glslFloat(previousTime)}) return ${glslFloat(previousValue)};`];
  for (const [time, value] of sorted.slice(1)) {
    lines.push(
      `if (t <= ${glslFloat(time)}) return mix(${glslFloat(previousValue)}, ${glslFloat(value)}, clamp((t - ${glslFloat(previousTime)}) / ${glslFloat(Math.max(time - previousTime, 1e-6))}, 0.0, 1.0));`,
    );
    previousTime = time;
    previousValue = value;
  }
  lines.push(`return ${glslFloat(previousValue)};`);
  return lines.join('\n');
}

function particleFragmentShader(system: EnvironmentParticleSystemData) {
  return /* glsl */ `
uniform sampler2D _MainTex;
uniform vec4 _Tint;
uniform float _Brightness;
uniform float _AlphaMultiplier;
uniform float _FogStartOffset;
uniform float _FogScale;
varying float vAge;
varying float vLifetime;
varying float vRotation;
varying vec3 vWorldPos;
${FOG_CHUNK}
float particleAlpha(float t) {
  ${alphaCurve(system.alphaKeys)}
}
void main() {
  float sine = sin(vRotation);
  float cosine = cos(vRotation);
  vec2 uv = gl_PointCoord - 0.5;
  uv = mat2(cosine, -sine, sine, cosine) * uv + 0.5;
  vec4 sampleColor = texture2D(_MainTex, uv);
  float textureAlpha = ${system.alphaChannelRed ? 'sampleColor.r' : 'sampleColor.a'};
  float alpha = textureAlpha * _Tint.a * _AlphaMultiplier
    * particleAlpha(clamp(vAge / max(vLifetime, 0.0001), 0.0, 1.0));
  ${system.squareAlpha ? 'alpha *= alpha;' : ''}
  vec3 color = _Tint.rgb * (1.0 + _Brightness);
  ${system.whiteBoost ? 'color += vec3(alpha);' : ''}
  vec4 outputColor = vec4(color * alpha, alpha);
  ${system.fogEnabled ? 'outputColor = applyTransparentLightFog(outputColor, vWorldPos, _FogStartOffset, _FogScale);' : ''}
  if (outputColor.a <= 0.0001) discard;
  gl_FragColor = outputColor;
}
`;
}

function random(index: number, salt: number) {
  const value = Math.sin((index + 1) * 12.9898 + salt * 78.233) * 43_758.5453;
  return value - Math.floor(value);
}

function randomUnitVector(index: number, salt: number) {
  const y = random(index, salt) * 2 - 1;
  const angle = random(index, salt + 1) * Math.PI * 2;
  const radius = Math.sqrt(1 - y * y);
  return new Vector3(Math.cos(angle) * radius, y, Math.sin(angle) * radius);
}

function particleGeometry(system: EnvironmentParticleSystemData) {
  const positions: number[] = [];
  const velocities: number[] = [];
  const starts: number[] = [];
  const lifetimes: number[] = [];
  const sizes: number[] = [];
  const rotations: number[] = [];
  const shapeRotation = new Quaternion().setFromEuler(
    new Euler(
      (system.shapeRotation[0] * Math.PI) / 180,
      (system.shapeRotation[1] * Math.PI) / 180,
      (system.shapeRotation[2] * Math.PI) / 180,
      'XYZ',
    ),
  );

  for (let index = 0; index < system.maxParticles; index += 1) {
    const direction = randomUnitVector(index, 0);
    const radius = system.shapeRadius * Math.cbrt(random(index, 2));
    const position = direction
      .clone()
      .multiplyScalar(radius)
      .multiply(new Vector3(...system.shapeScale))
      .applyQuaternion(shapeRotation)
      .add(new Vector3(...system.shapePosition));
    const emissionDirection =
      system.randomDirection === 0 ? new Vector3(0, 1, 0).applyQuaternion(shapeRotation) : direction;
    const speed = system.speed[0] + (system.speed[1] - system.speed[0]) * random(index, 3);
    positions.push(position.x, position.y, position.z);
    velocities.push(emissionDirection.x * speed, emissionDirection.y * speed, emissionDirection.z * speed);
    starts.push(system.rate > 0 ? index / system.rate : 0);
    lifetimes.push(system.lifetime[0] + (system.lifetime[1] - system.lifetime[0]) * random(index, 4));
    sizes.push(system.size[0] + (system.size[1] - system.size[0]) * random(index, 5));
    rotations.push(system.rotationRange[0] + (system.rotationRange[1] - system.rotationRange[0]) * random(index, 6));
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('particleVelocity', new Float32BufferAttribute(velocities, 3));
  geometry.setAttribute('particleStart', new Float32BufferAttribute(starts, 1));
  geometry.setAttribute('particleLifetime', new Float32BufferAttribute(lifetimes, 1));
  geometry.setAttribute('particleSize', new Float32BufferAttribute(sizes, 1));
  geometry.setAttribute('particleRotation', new Float32BufferAttribute(rotations, 1));
  return geometry;
}

export function buildEnvironmentParticleSystems(
  systems: readonly EnvironmentParticleSystemData[],
  context: EnvironmentMaterialContext,
  root: Group,
  geometries: Map<string, BufferGeometry>,
  materials: Set<Material>,
) {
  const viewport = new Vector2();
  for (const [index, system] of systems.entries()) {
    const texture = context.textures?.get(system.texture);
    if (texture === undefined || system.maxParticles === 0 || system.rate <= 0) continue;
    const geometry = particleGeometry(system);
    const material = new ShaderMaterial({
      vertexShader: PARTICLE_VERT,
      fragmentShader: particleFragmentShader(system),
      uniforms: {
        ...materialFogUniforms(context.fog, {
          enabled: system.fogEnabled,
          heightEnabled: system.heightFogEnabled,
        }),
        _MainTex: { value: texture },
        _Tint: { value: new Vector4(...system.tint) },
        _Brightness: { value: system.brightness },
        _AlphaMultiplier: { value: system.alphaMultiplier },
        _SongTime: context.songTime ?? { value: 0 },
        _Cycle: { value: system.maxParticles / system.rate },
        _Prewarm: { value: system.prewarm ? 1 : 0 },
        _ViewportHeight: { value: 1 },
      },
      transparent: true,
      depthWrite: false,
      blending: CustomBlending,
      blendEquation: AddEquation,
      blendSrc: OneFactor,
      blendDst: OneFactor,
      blendEquationAlpha: AddEquation,
      blendSrcAlpha: OneFactor,
      blendDstAlpha: OneFactor,
    });
    material.onBeforeRender = (renderer) => {
      const viewportHeight = material.uniforms._ViewportHeight;
      if (viewportHeight !== undefined) viewportHeight.value = renderer.getDrawingBufferSize(viewport).y;
    };

    const node = new Group();
    node.name = system.name;
    node.position.set(...system.position);
    node.quaternion.set(...system.rotation);
    node.scale.set(...system.scale);
    const points = new Points(geometry, material);
    points.name = `${system.name}:particles`;
    points.frustumCulled = false;
    points.renderOrder = system.sortingOrder;
    node.add(points);
    root.add(node);
    geometries.set(`particle-system:${index}:${system.name}`, geometry);
    materials.add(material);
  }
}
