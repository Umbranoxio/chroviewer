import {
  DynamicDrawUsage,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  Vector3,
  Vector4,
  type BufferGeometry,
  type Material,
  type Object3D,
  type ShaderMaterial,
} from 'three';

import { MAIN_ONLY_LAYER } from '../mirror/planar-mirror';
import { referenceKey, rendererObjectsForMpbController } from './environment-component-utils';
import { createPositionConstraintApplicator } from './environment-constraints';
import { createGeometry, ensureGeometryTangents, nodeFor } from './environment-geometry';
import { buildEnvironmentParticleSystems } from './environment-particle-systems';
import type { EnvironmentBoostSwitch, EnvironmentEventSwitch } from './environment-runtime';
import { createEnvironmentMaterial, type EnvironmentMaterialInstance } from './materials/create-environment-material';
import type { EnvironmentMaterialContext } from './materials/material-context';
import type { BasicLightEffectData, EnvironmentData, ObjectReference } from './types';

export interface EnvironmentSceneBuild {
  root: Group;
  geometries: Map<string, BufferGeometry>;
  materialInstances: Set<Material>;
  rendererMeshes: Map<Object3D, Mesh>;
  objectShaderMaterials: ShaderMaterial[][];
  nodes: Group[];
  lightEffectsByObject: Map<number, BasicLightEffectData[]>;
  lightEffectsByTarget: Map<string, BasicLightEffectData[]>;
  eventSwitches: EnvironmentEventSwitch[];
  boostSwitches: EnvironmentBoostSwitch[];
  applyChromaRemoval: (ids: readonly string[]) => void;
  enforceChromaRemoval: () => void;
  applyConstraints: () => boolean;
  syncInstancedMeshes: () => void;
  disposeInstancedMeshes: () => void;
}

interface InstancedSource {
  node: Group;
  rendererEnabled: boolean;
}

interface InstancedBatch {
  sources: InstancedSource[];
  regular: InstancedMesh;
  mirrored: InstancedMesh;
}

function visibleInHierarchy(node: Object3D) {
  for (let current: Object3D | null = node; current !== null; current = current.parent) {
    if (!current.visible) return false;
  }
  return true;
}

function controlledRendererObjects(data: EnvironmentData) {
  const controlledObjects = new Set<number>();
  data.objects.forEach((object, index) => {
    for (const controller of object.components?.ParametricBloomFogLightController ?? []) {
      if (!controller.enabled) continue;
      if (controller.BoxLight !== null) controlledObjects.add(controller.BoxLight.obj);
      if (controller.SpriteLight !== null) controlledObjects.add(controller.SpriteLight.obj);
    }
    for (const controller of object.components?.RectangleFakeGlowLightController ?? []) {
      if (!controller.enabled) continue;
      for (const rendererObject of rendererObjectsForMpbController(data, controller.MpbController)) {
        controlledObjects.add(rendererObject);
      }
    }
    for (const controller of object.components?.MaterialLightController ?? []) {
      if (controller.enabled && controller.Renderer !== null) controlledObjects.add(controller.Renderer.obj);
    }
    for (const controller of object.components?.MaterialLightsController ?? []) {
      if (controller.enabled) controlledObjects.add(controller.MeshRenderer?.obj ?? index);
    }
    for (const controller of object.components?.SpriteLightController ?? []) {
      if (controller.enabled) controlledObjects.add(controller.Renderer?.obj ?? index);
    }
    for (const controller of object.components?.MaterialPropertyBlockController ?? []) {
      if (!controller.enabled) continue;
      const renderers =
        controller.Renderers.length === 0 ? [index] : controller.Renderers.map((renderer) => renderer.obj);
      for (const renderer of renderers) controlledObjects.add(renderer);
    }
    for (const animator of object.components?.MaterialPropertyBlockPositionAnimator ?? []) {
      if (!animator.enabled) continue;
      for (const rendererObject of rendererObjectsForMpbController(data, animator.Controller)) {
        controlledObjects.add(rendererObject);
      }
    }
  });
  return controlledObjects;
}

function collectLightEffects(data: EnvironmentData) {
  const byObject = new Map<number, BasicLightEffectData[]>();
  const byTarget = new Map<string, BasicLightEffectData[]>();
  for (const object of data.objects) {
    for (const effect of object.components?.BasicLightEffect ?? []) {
      if (!effect.enabled) continue;
      for (const entry of effect.lightEntries) {
        const key = referenceKey(entry);
        const targetEffects = byTarget.get(key);
        if (targetEffects === undefined) byTarget.set(key, [effect]);
        else targetEffects.push(effect);
        if (entry.component !== 'ParametricBloomFogLightController') continue;
        const effects = byObject.get(entry.obj);
        if (effects === undefined) byObject.set(entry.obj, [effect]);
        else effects.push(effect);
      }
    }
  }
  return { byObject, byTarget };
}

function buildSwitches(data: EnvironmentData, nodes: Group[]) {
  function genericEventType(reference: ObjectReference) {
    if (reference.component !== 'GenericCallbackEventEffect') return undefined;
    const effect = data.objects[reference.obj]?.components?.GenericCallbackEventEffect?.[reference.componentIndex ?? 0];
    return effect?.enabled === true ? effect.ID : undefined;
  }

  const eventSwitches: EnvironmentEventSwitch[] = [];
  const boostSwitches: EnvironmentBoostSwitch[] = [];
  for (const object of data.objects) {
    for (const component of object.components?.GameObjectIntSwitch ?? []) {
      const eventType = genericEventType(component.Effect);
      if (!component.enabled || eventType === undefined) continue;
      const containers = component.GameObjectsValueContainers.map((container) => ({
        value: container.Value,
        targets: container.GameObjects.flatMap((reference) => nodes[reference.obj] ?? []),
      }));
      function apply(value: number) {
        for (const container of containers) {
          const visible = container.value === value;
          for (const target of container.targets) target.visible = visible;
        }
      }
      apply(component.DefaultValue);
      eventSwitches.push({
        eventType,
        defaultValue: component.DefaultValue,
        apply,
      });
    }
    for (const component of object.components?.GameObjectSwitch ?? []) {
      if (!component.enabled || component.Effect.component !== 'ColorBoostEffect') continue;
      const effect =
        data.objects[component.Effect.obj]?.components?.ColorBoostEffect?.[component.Effect.componentIndex ?? 0];
      if (effect?.enabled !== true) continue;
      const normal = component.NormalGameObjects.flatMap((reference) => nodes[reference.obj] ?? []);
      const boost = component.BoostGameObjects.flatMap((reference) => nodes[reference.obj] ?? []);
      function apply(boosted: boolean) {
        for (const target of normal) target.visible = !boosted;
        for (const target of boost) target.visible = boosted;
      }
      apply(false);
      boostSwitches.push({ apply });
    }
  }
  return { eventSwitches, boostSwitches };
}

export function buildEnvironmentScene(
  data: EnvironmentData,
  materialContext: EnvironmentMaterialContext,
  customEnvironment: boolean,
): EnvironmentSceneBuild {
  const root = new Group();
  root.name = data.id;
  const lightEffects = collectLightEffects(data);
  const controlledObjects = controlledRendererObjects(data);
  const geometries = new Map(Object.entries(data.meshes).map(([name, mesh]) => [name, createGeometry(mesh)]));
  const materials = new Map<string, EnvironmentMaterialInstance>();
  for (const [name, materialData] of Object.entries(data.materials)) {
    const material = createEnvironmentMaterial(materialData, materialContext, data.id);
    if (material !== null) materials.set(name, material);
  }
  const materialInstances = new Set([...materials.values()].map((instance) => instance.material));
  const rendererMeshes = new Map<Object3D, Mesh>();
  const objectShaderMaterials: ShaderMaterial[][] = data.objects.map(() => []);
  const nodes = data.objects.map((object) => {
    const node = nodeFor(object);
    if (object.customEnvironmentOnly === true && !customEnvironment) node.visible = false;
    return node;
  });
  const chromaMarkers = data.objects.flatMap((object, index) => {
    const marker = object.components?.ChromaIDMarker?.[0];
    const node = nodes[index];
    return marker?.enabled === true && node !== undefined ? [{ id: marker.ChromaID, node }] : [];
  });
  let removedNodes = new Set<Group>();
  const batchSources = new Map<
    string,
    {
      name: string;
      geometry: BufferGeometry;
      material: Material;
      layer: number | undefined;
      sources: InstancedSource[];
    }
  >();

  nodes.forEach((node, index) => {
    const object = data.objects[index];
    if (object === undefined) return;
    const parent = object.parent < 0 ? root : nodes[object.parent];
    parent?.add(node);
    const geometry = object.mesh === undefined ? undefined : geometries.get(object.mesh);
    const rendererInstances = (object.materials ?? []).flatMap((name) => {
      if (name === null) return [];
      const material = materials.get(name);
      const materialData = data.materials[name];
      if (material === undefined || materialData === undefined) return [];
      if (!controlledObjects.has(index)) return [material];
      const instance = createEnvironmentMaterial(materialData, materialContext, data.id);
      if (instance === null) return [];
      materialInstances.add(instance.material);
      return [instance];
    });
    const rendererMaterials = rendererInstances.map((instance) => instance.material);
    objectShaderMaterials[index] = rendererInstances.flatMap((instance) => instance.shader ?? []);
    if (geometry === undefined || rendererMaterials.length === 0) return;
    if (object.materials?.some((name) => name !== null && data.materials[name]?.shader === 'ChroMapper/Water Lit')) {
      ensureGeometryTangents(geometry);
    }
    const materialName = object.materials?.length === 1 ? object.materials[0] : undefined;
    const materialData = materialName === null || materialName === undefined ? undefined : data.materials[materialName];
    const rendererMaterial = rendererMaterials.length === 1 ? rendererMaterials[0] : undefined;
    if (
      object.mesh?.startsWith('__chroma_geometry_') === true &&
      materialData?.shader === 'ChroMapper/Lit' &&
      rendererMaterial !== undefined &&
      !controlledObjects.has(index) &&
      !rendererMaterial.transparent &&
      rendererMaterial.depthWrite &&
      !rendererMaterial.stencilWrite &&
      geometry.groups.length === 0 &&
      object.components?.PlanarReflection === undefined
    ) {
      const layer = object.layer;
      const key = `${object.mesh}:${materialName}:${String(layer)}`;
      const batch = batchSources.get(key);
      const source = { node, rendererEnabled: object.rendererEnabled !== false };
      if (batch === undefined) {
        batchSources.set(key, {
          name: object.name,
          geometry,
          material: rendererMaterial,
          layer,
          sources: [source],
        });
      } else {
        batch.sources.push(source);
      }
      return;
    }
    const mesh = new Mesh(geometry, rendererMaterials.length === 1 ? rendererMaterials[0] : rendererMaterials);
    rendererMeshes.set(node, mesh);
    mesh.name = `${object.name}:renderer`;
    mesh.userData.environmentLayer = object.layer;
    mesh.visible = object.rendererEnabled !== false;
    const materialFamilies = object.materials?.flatMap((name) => (name === null ? [] : [data.materials[name]?.family]));
    if (materialFamilies?.includes('clouds')) {
      mesh.frustumCulled = false;
    }
    if (
      object.materials?.some(
        (name) => name !== null && data.materials[name]?.shader === 'ChroMapper/Parametric Slice Billboard',
      )
    ) {
      mesh.renderOrder = 1;
    }
    if (materialFamilies?.includes('stencil')) {
      mesh.renderOrder = -1;
    }
    if (object.components?.PlanarReflection !== undefined) mesh.layers.set(MAIN_ONLY_LAYER);
    node.add(mesh);
  });

  const instancedBatches: InstancedBatch[] = [];
  for (const batch of batchSources.values()) {
    if (batch.sources.length === 1) {
      for (const source of batch.sources) {
        const mesh = new Mesh(batch.geometry, batch.material);
        mesh.name = `${batch.name}:renderer`;
        mesh.userData.environmentLayer = batch.layer;
        mesh.visible = source.rendererEnabled;
        rendererMeshes.set(source.node, mesh);
        source.node.add(mesh);
      }
      continue;
    }
    function createInstancedMesh(mirrored: boolean) {
      const mesh = new InstancedMesh(batch.geometry, batch.material, batch.sources.length);
      mesh.name = `${batch.name}:instances${mirrored ? ':mirrored' : ''}`;
      mesh.userData.environmentLayer = batch.layer;
      mesh.frustumCulled = false;
      mesh.count = 0;
      mesh.instanceMatrix.setUsage(DynamicDrawUsage);
      if (mirrored) mesh.scale.x = -1;
      root.add(mesh);
      return mesh;
    }
    instancedBatches.push({
      sources: batch.sources,
      regular: createInstancedMesh(false),
      mirrored: createInstancedMesh(true),
    });
  }
  const rootInverse = new Matrix4();
  const relativeMatrix = new Matrix4();
  const mirroredMatrix = new Matrix4();
  const mirrorX = new Matrix4().makeScale(-1, 1, 1);
  function syncInstancedMeshes() {
    if (instancedBatches.length === 0) return;
    rootInverse.copy(root.matrixWorld).invert();
    for (const batch of instancedBatches) {
      let regularCount = 0;
      let mirroredCount = 0;
      for (const source of batch.sources) {
        if (!source.rendererEnabled || !visibleInHierarchy(source.node)) continue;
        relativeMatrix.multiplyMatrices(rootInverse, source.node.matrixWorld);
        if (relativeMatrix.determinant() < 0) {
          mirroredMatrix.multiplyMatrices(mirrorX, relativeMatrix);
          batch.mirrored.setMatrixAt(mirroredCount++, mirroredMatrix);
        } else {
          batch.regular.setMatrixAt(regularCount++, relativeMatrix);
        }
      }
      batch.regular.count = regularCount;
      batch.mirrored.count = mirroredCount;
      if (regularCount > 0) batch.regular.instanceMatrix.needsUpdate = true;
      if (mirroredCount > 0) batch.mirrored.instanceMatrix.needsUpdate = true;
    }
  }
  function disposeInstancedMeshes() {
    for (const batch of instancedBatches) {
      batch.regular.dispose();
      batch.mirrored.dispose();
    }
  }

  buildEnvironmentParticleSystems(data.particleSystems ?? [], materialContext, root, geometries, materialInstances);

  for (const object of data.objects) {
    for (const setter of object.components?.MaterialPropertyBlockFloatSetter ?? []) {
      if (!setter.enabled) continue;
      for (const rendererObject of rendererObjectsForMpbController(data, setter.Controller)) {
        for (const material of objectShaderMaterials[rendererObject] ?? []) {
          for (const [property, value] of Object.entries(setter.Values)) {
            const uniform = material.uniforms[property];
            if (uniform === undefined) material.uniforms[property] = { value };
            else uniform.value = value;
          }
        }
      }
    }
  }

  const switches = buildSwitches(data, nodes);
  root.updateMatrixWorld(true);
  const applyConstraints = createPositionConstraintApplicator(data, nodes);
  applyConstraints();
  root.updateMatrixWorld(true);
  syncInstancedMeshes();

  for (const object of data.objects) {
    for (const animator of object.components?.MaterialPropertyBlockPositionAnimator ?? []) {
      if (!animator.enabled) continue;
      const target = nodes[animator.TargetTransform.obj];
      if (target === undefined) continue;
      const targetNode = target;
      const value = new Vector4();
      const worldPosition = new Vector3();
      function update() {
        targetNode.getWorldPosition(worldPosition);
        value.set(worldPosition.x, worldPosition.y, worldPosition.z, 1);
      }
      update();
      for (const rendererObject of rendererObjectsForMpbController(data, animator.Controller)) {
        for (const material of objectShaderMaterials[rendererObject] ?? []) {
          material.uniforms[animator.Property] = { value };
          const beforeRender = material.onBeforeRender.bind(material);
          material.onBeforeRender = (...args) => {
            beforeRender(...args);
            update();
          };
        }
      }
    }
  }

  function applyChromaRemoval(ids: readonly string[]) {
    for (const node of removedNodes) node.visible = data.objects[nodes.indexOf(node)]?.active ?? true;
    removedNodes = new Set(
      chromaMarkers.filter((marker) => ids.some((id) => marker.id.includes(id))).map((marker) => marker.node),
    );
    for (const node of removedNodes) node.visible = false;
  }

  function enforceChromaRemoval() {
    for (const node of removedNodes) node.visible = false;
  }

  return {
    root,
    geometries,
    materialInstances,
    rendererMeshes,
    objectShaderMaterials,
    nodes,
    lightEffectsByObject: lightEffects.byObject,
    lightEffectsByTarget: lightEffects.byTarget,
    eventSwitches: switches.eventSwitches,
    boostSwitches: switches.boostSwitches,
    applyChromaRemoval,
    enforceChromaRemoval,
    applyConstraints,
    syncInstancedMeshes,
    disposeInstancedMeshes,
  };
}
