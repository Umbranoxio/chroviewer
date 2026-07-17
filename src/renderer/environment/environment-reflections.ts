import {
  BoxGeometry,
  Color,
  DoubleSide,
  Matrix3,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  Raycaster,
  Vector3,
  type BufferGeometry,
  type Object3D,
  type ShaderMaterial,
} from 'three';

import { shaderColorUniform } from '../materials/shared';
import { evaluateAnimationCurve, type AnimationCurveData } from './animation-curve';
import { referenceKey } from './environment-component-utils';
import type { EnvironmentLighting, EnvironmentParametricTarget } from './environment-lighting';
import type { EnvironmentLightSegment } from './environment-runtime';
import type { EnvironmentSceneBuild } from './environment-scene-builder';
import type { EnvironmentData, ObjectReference, ReflectedLightData } from './types';

const LOCAL_UP = new Vector3(0, 1, 0);
const LOCAL_FORWARD = new Vector3(0, 0, 1);
const RAY_EPSILON = 0.001;
const inverseParent = new Matrix4();
const localPosition = new Vector3();
const localDirection = new Vector3();

interface ReflectionCollider {
  mesh: Mesh;
  node: Object3D;
  reflective: boolean;
}

interface ReflectionLight {
  target: EnvironmentParametricTarget;
  outputIndex: number;
  hitPointNode: Object3D;
  hitPointTransform: Object3D;
  hitPointMaterials: ShaderMaterial[];
  hitPointCurve: AnimationCurveData;
  showHitPoint: boolean;
}

interface ReflectionSource {
  main: ReflectionLight;
  bounces: ReflectionLight[];
}

interface ReflectionHit {
  distance: number;
  point: Vector3;
  normal: Vector3;
  reflective: boolean;
}

function buildReflectionColliders(
  data: EnvironmentData,
  scene: EnvironmentSceneBuild,
  collisionMaterial: MeshBasicMaterial,
  ownedGeometries: BoxGeometry[],
) {
  const colliders: ReflectionCollider[] = [];
  const explicitColliders = new Set<string>();
  const registeredColliders = new Map<string, boolean>();
  for (const object of data.objects) {
    for (const collider of object.components?.ColliderFx ?? []) {
      if (collider.enabled) registeredColliders.set(referenceKey(collider.Collider), collider.Value > 0);
    }
  }

  function addCollider(geometry: BufferGeometry | undefined, node: Object3D | undefined, reflective: boolean) {
    if (geometry === undefined || node === undefined) return;
    const mesh = new Mesh(geometry, collisionMaterial);
    mesh.matrixAutoUpdate = false;
    colliders.push({ mesh, node, reflective });
  }

  for (const [objectIndex, object] of data.objects.entries()) {
    for (const [componentIndex, shape] of (object.components?.BoxCollider ?? []).entries()) {
      const reference: ObjectReference = { obj: objectIndex, component: 'BoxCollider', componentIndex };
      const key = referenceKey(reference);
      explicitColliders.add(key);
      if (!shape.enabled) continue;
      const geometry = new BoxGeometry(...shape.Size);
      geometry.translate(...shape.Center);
      ownedGeometries.push(geometry);
      addCollider(geometry, scene.nodes[objectIndex], registeredColliders.get(key) ?? false);
    }
    for (const [componentIndex, shape] of (object.components?.MeshCollider ?? []).entries()) {
      const reference: ObjectReference = { obj: objectIndex, component: 'MeshCollider', componentIndex };
      const key = referenceKey(reference);
      explicitColliders.add(key);
      if (!shape.enabled) continue;
      addCollider(scene.geometries.get(shape.Mesh), scene.nodes[objectIndex], registeredColliders.get(key) ?? false);
    }
  }

  for (const object of data.objects) {
    for (const collider of object.components?.ColliderFx ?? []) {
      if (!collider.enabled || explicitColliders.has(referenceKey(collider.Collider))) continue;
      const target = data.objects[collider.Collider.obj];
      const geometry = target?.mesh === undefined ? undefined : scene.geometries.get(target.mesh);
      addCollider(geometry, scene.nodes[collider.Collider.obj], collider.Value > 0);
    }
  }
  return colliders;
}

function worldVisible(node: Object3D) {
  let current: Object3D | null = node;
  while (current !== null) {
    if (!current.visible) return false;
    current = current.parent;
  }
  return true;
}

function setWorldTransform(node: Object3D, position: Vector3, localAxis: Vector3, worldDirection: Vector3) {
  localPosition.copy(position);
  localDirection.copy(worldDirection);
  if (node.parent !== null) {
    inverseParent.copy(node.parent.matrixWorld).invert();
    localPosition.applyMatrix4(inverseParent);
    localDirection.transformDirection(inverseParent);
  }
  node.position.copy(localPosition);
  node.quaternion.setFromUnitVectors(localAxis, localDirection.normalize());
  node.updateMatrix();
}

function setSegmentLength(segment: EnvironmentLightSegment, length: number) {
  const clippedLength = Math.max(length, 0);
  segment.localStart[1] = -clippedLength * segment.center;
  segment.localEnd[1] = clippedLength * (1 - segment.center);
}

function setReflectedSegment(
  light: ReflectionLight,
  segment: EnvironmentLightSegment,
  length: number,
  collisionLength: number,
  startAlpha: number,
  changedNodes: Set<Object3D>,
) {
  const clippedLength = Math.min(collisionLength, length);
  const lengthFactor = segment.multiplyLengthByAlpha
    ? evaluateAnimationCurve(segment.alphaToLengthCurve, segment.alpha)
    : 1;
  const bloomLengthFactor = segment.multiplyLengthByAlpha
    ? evaluateAnimationCurve(segment.alphaToBloomLengthCurve, segment.alpha)
    : 1;
  setSegmentLength(segment, clippedLength * bloomLengthFactor);
  segment.startAlpha = startAlpha;
  segment.endAlpha =
    (startAlpha + (light.target.endAlpha - startAlpha) * (length <= 0 ? 1 : Math.min(clippedLength / length, 1))) *
    lengthFactor;
  light.target.setLength(length, collisionLength, startAlpha);
  for (const target of light.target.matrixTargets) changedNodes.add(target);
}

function updateChangedSubtrees(changedNodes: Set<Object3D>) {
  for (const node of changedNodes) {
    let ancestor = node.parent;
    while (ancestor !== null && !changedNodes.has(ancestor)) ancestor = ancestor.parent;
    if (ancestor === null) node.updateMatrixWorld(true);
  }
}

function buildReflectionLight(
  scene: EnvironmentSceneBuild,
  lighting: EnvironmentLighting,
  reflected: ReflectedLightData,
) {
  const target = lighting.parametricTargets.get(referenceKey(reflected.Light));
  const segment = target?.segments[0];
  if (target === undefined || segment === undefined) return undefined;
  const outputIndex = lighting.lightSegments.indexOf(segment);
  const hitPointNode = scene.nodes[reflected.HitPointGameObject.obj];
  const hitPointTransform = scene.nodes[reflected.HitPointTransform.obj];
  if (outputIndex < 0 || hitPointNode === undefined || hitPointTransform === undefined) return undefined;
  hitPointNode.visible = false;
  return {
    target,
    outputIndex,
    hitPointNode,
    hitPointTransform,
    hitPointMaterials: scene.objectShaderMaterials[reflected.HitPointGameObject.obj] ?? [],
    hitPointCurve: reflected.HitPointDistanceToAlphaCurve,
    showHitPoint: reflected.ShowHitPoint !== 0,
  } satisfies ReflectionLight;
}

function buildReflectionSources(data: EnvironmentData, scene: EnvironmentSceneBuild, lighting: EnvironmentLighting) {
  const sources: ReflectionSource[] = [];
  for (const object of data.objects) {
    for (const reflection of object.components?.LightReflection ?? []) {
      if (!reflection.enabled) continue;
      const main = buildReflectionLight(scene, lighting, reflection.MainParametricLight);
      if (main === undefined) continue;
      const bounces: ReflectionLight[] = [];
      for (const bounce of reflection.ParametricLightReflection) {
        const light = buildReflectionLight(scene, lighting, bounce);
        if (light === undefined) continue;
        light.target.node.visible = false;
        bounces.push(light);
      }
      sources.push({ main, bounces });
    }
  }
  return sources;
}

function setHitPoint(
  light: ReflectionLight,
  hit: ReflectionHit | undefined,
  maximumDistance: number,
  segment: EnvironmentLightSegment,
  color: Color,
  changedNodes: Set<Object3D>,
) {
  light.hitPointNode.visible = light.showHitPoint && hit !== undefined;
  if (!light.hitPointNode.visible || hit === undefined) return;
  setWorldTransform(light.hitPointTransform, hit.point, LOCAL_FORWARD, hit.normal);
  changedNodes.add(light.hitPointTransform);
  const distance = maximumDistance <= 0 ? 1 : Math.min(Math.max(hit.distance / maximumDistance, 0), 1);
  const intensity = Math.max(evaluateAnimationCurve(light.hitPointCurve, distance), 0) * segment.alpha;
  color.setRGB(...segment.color).convertSRGBToLinear();
  for (const material of light.hitPointMaterials) {
    shaderColorUniform(material, '_Color')?.copy(color);
    const multiplier = material.uniforms._ColorMultiplier;
    if (multiplier !== undefined) multiplier.value = intensity;
  }
}

export function buildEnvironmentReflections(
  data: EnvironmentData,
  scene: EnvironmentSceneBuild,
  lighting: EnvironmentLighting,
) {
  const sources = buildReflectionSources(data, scene, lighting);
  if (sources.length === 0) return { apply: () => undefined, dispose: () => undefined };

  const collisionMaterial = new MeshBasicMaterial({ side: DoubleSide });
  const ownedGeometries: BoxGeometry[] = [];
  const colliders = buildReflectionColliders(data, scene, collisionMaterial, ownedGeometries);

  const raycaster = new Raycaster();
  raycaster.near = RAY_EPSILON;
  const activeMeshes: Mesh[] = [];
  const colliderByMesh = new Map(colliders.map((collider) => [collider.mesh, collider]));
  const normalMatrix = new Matrix3();
  const origin = new Vector3();
  const direction = new Vector3();
  const reflectedDirection = new Vector3();
  const hitColor = new Color();
  const changedNodes = new Set<Object3D>();

  function trace(rayOrigin: Vector3, rayDirection: Vector3, maximumDistance: number): ReflectionHit | undefined {
    raycaster.far = maximumDistance;
    raycaster.set(rayOrigin, rayDirection);
    for (const intersection of raycaster.intersectObjects<Mesh>(activeMeshes, false)) {
      const collider = colliderByMesh.get(intersection.object);
      const faceNormal = intersection.face?.normal;
      if (collider === undefined || faceNormal === undefined) continue;
      const normal = faceNormal
        .clone()
        .applyNormalMatrix(normalMatrix.getNormalMatrix(intersection.object.matrixWorld));
      if (normal.dot(rayDirection) >= 0) continue;
      return {
        distance: intersection.distance,
        point: intersection.point.clone(),
        normal,
        reflective: collider.reflective,
      };
    }
    return undefined;
  }

  function hideReflection(light: ReflectionLight, segments: EnvironmentLightSegment[]) {
    light.target.node.visible = false;
    light.hitPointNode.visible = false;
    const output = segments[light.outputIndex];
    if (output !== undefined) output.alpha = 0;
  }

  function apply(segments: EnvironmentLightSegment[]) {
    changedNodes.clear();
    activeMeshes.length = 0;
    for (const collider of colliders) {
      if (!worldVisible(collider.node)) continue;
      collider.mesh.matrixWorld.copy(collider.node.matrixWorld);
      activeMeshes.push(collider.mesh);
    }
    for (const source of sources) {
      const mainOutput = segments[source.main.outputIndex];
      if (mainOutput === undefined) continue;
      const maximumLength = mainOutput.baseLength;
      if (mainOutput.alpha <= 0.01 || !worldVisible(source.main.target.node)) {
        source.main.hitPointNode.visible = false;
        for (const bounce of source.bounces) hideReflection(bounce, segments);
        continue;
      }
      source.main.target.node.getWorldPosition(origin);
      direction.copy(LOCAL_UP).transformDirection(source.main.target.node.matrixWorld);
      let hit = trace(origin, direction, maximumLength);
      const mainLength = hit?.distance ?? maximumLength;
      setReflectedSegment(
        source.main,
        mainOutput,
        maximumLength,
        mainLength,
        source.main.target.startAlpha,
        changedNodes,
      );
      setHitPoint(source.main, hit, maximumLength, mainOutput, hitColor, changedNodes);

      let canReflect = hit?.reflective === true;
      let remainingLength = Math.max(maximumLength - mainLength, 0);
      let startAlpha = mainOutput.endAlpha ?? 1;
      let bounceOrigin = hit?.point;
      if (hit !== undefined) reflectedDirection.copy(direction).reflect(hit.normal).normalize();

      for (const bounce of source.bounces) {
        const bounceOutput = segments[bounce.outputIndex];
        if (!canReflect || bounceOutput === undefined || bounceOrigin === undefined) {
          hideReflection(bounce, segments);
          continue;
        }

        bounce.target.node.visible = true;
        setWorldTransform(bounce.target.node, bounceOrigin, LOCAL_UP, reflectedDirection);
        changedNodes.add(bounce.target.node);
        bounceOutput.color = [mainOutput.color[0], mainOutput.color[1], mainOutput.color[2]];
        bounceOutput.alpha = mainOutput.alpha;
        const bounceMaximum = remainingLength;
        const rayOrigin = bounceOrigin.clone().addScaledVector(reflectedDirection, RAY_EPSILON);
        hit = trace(rayOrigin, reflectedDirection, bounceMaximum);
        const bounceLength = Math.min(
          (hit?.distance ?? bounceMaximum) + (hit === undefined ? 0 : RAY_EPSILON),
          bounceMaximum,
        );
        setReflectedSegment(bounce, bounceOutput, bounceMaximum, bounceLength, startAlpha, changedNodes);
        setHitPoint(bounce, hit, bounceMaximum, bounceOutput, hitColor, changedNodes);

        canReflect = hit?.reflective === true;
        remainingLength = Math.max(bounceMaximum - bounceLength, 0);
        startAlpha = bounceOutput.endAlpha ?? 1;
        bounceOrigin = hit?.point;
        if (hit !== undefined) reflectedDirection.reflect(hit.normal).normalize();
      }
    }
    updateChangedSubtrees(changedNodes);
  }

  return {
    apply,
    dispose() {
      for (const geometry of ownedGeometries) geometry.dispose();
      collisionMaterial.dispose();
    },
  };
}
