import {
  BoxGeometry,
  BufferGeometry,
  CapsuleGeometry,
  CylinderGeometry,
  Euler,
  Float32BufferAttribute,
  Matrix4,
  PlaneGeometry,
  Quaternion,
  SphereGeometry,
  Vector3,
} from 'three';

import type {
  ChromaEnvironmentData,
  ChromaEnvironmentEnhancement,
  ChromaMaterial,
  ChromaVector,
} from '../../core/chroma-environment';
import { chromaMaterialPresetKey } from './chroma-material-assets';
import { referenceKey } from './environment-component-utils';
import type {
  EnvironmentData,
  EnvironmentMaterialData,
  EnvironmentMeshData,
  EnvironmentObjectData,
  ObjectReference,
} from './types';

export interface ChromaEnvironmentVariant {
  data: EnvironmentData;
  tracks: Map<string, number[]>;
  materialTracks: Map<string, string[]>;
  fogTracks: Set<string>;
  tubeTracks: Map<string, number[]>;
  source: ChromaEnvironmentData;
}

const laneSize = 0.6;
const identityRotation: [number, number, number, number] = [0, 0, 0, 1];
const identityScale: [number, number, number] = [1, 1, 1];
const trackWrapperPrefix = '__chroma_track_';
const lightShaders = new Set(['OpaqueLight', 'TransparentLight', 'BillieWater']);

interface LookupEntry {
  id: string;
  index: number;
}

interface RendererGeometry {
  type: string;
  material: string | ChromaMaterial;
  collision?: boolean;
}

interface RendererComponents {
  ILightWithId?: { lightId?: number; type?: number };
  BloomFogEnvironment?: {
    attenuation?: number;
    offset?: number;
    startY?: number;
    height?: number;
  };
  TubeBloomPrePassLight?: {
    colorAlphaMultiplier?: number;
    bloomFogIntensityMultiplier?: number;
  };
}

type RendererEnhancement = Omit<ChromaEnvironmentEnhancement, 'geometry' | 'track'> & {
  geometry?: RendererGeometry;
  track?: string | string[];
  components?: RendererComponents;
};

function mapPosition(value: ChromaVector, version: number): [number, number, number] {
  const scale = version === 2 ? laneSize : 1;
  return [value[0] * scale, value[1] * scale, -value[2] * scale];
}

function mapRotation(value: ChromaVector): [number, number, number, number] {
  const rotation = new Quaternion().setFromEuler(
    new Euler((-value[0] * Math.PI) / 180, (-value[1] * Math.PI) / 180, (value[2] * Math.PI) / 180, 'YXZ'),
  );
  return [rotation.x, rotation.y, rotation.z, rotation.w];
}

function objectWorldMatrix(data: EnvironmentData, index: number): Matrix4 {
  const object = data.objects[index];
  if (object === undefined) return new Matrix4();
  const matrix = new Matrix4().compose(
    new Vector3().fromArray(object.position),
    new Quaternion().fromArray(object.rotation),
    new Vector3().fromArray(object.scale),
  );
  return object.parent < 0 ? matrix : objectWorldMatrix(data, object.parent).multiply(matrix);
}

function setWorldPosition(data: EnvironmentData, index: number, position: ChromaVector, version: number) {
  const object = data.objects[index];
  if (object === undefined) return;
  const mapped = mapPosition(position, version);
  const local = new Vector3().fromArray(mapped);
  if (object.parent >= 0) local.applyMatrix4(objectWorldMatrix(data, object.parent).invert());
  // singular parent matrix (scale-0 ancestor) divides by zero; keep the mapped value
  object.position = Number.isFinite(local.x + local.y + local.z) ? [local.x, local.y, local.z] : mapped;
}

function setWorldRotation(data: EnvironmentData, index: number, rotation: ChromaVector) {
  const object = data.objects[index];
  if (object === undefined) return;
  const local = new Quaternion().fromArray(mapRotation(rotation));
  if (object.parent >= 0) {
    const parent = new Quaternion();
    objectWorldMatrix(data, object.parent).decompose(new Vector3(), parent, new Vector3());
    local.premultiply(parent.invert());
  }
  object.rotation = [local.x, local.y, local.z, local.w];
}

function applyTransform(data: EnvironmentData, index: number, enhancement: RendererEnhancement, version: number) {
  const object = data.objects[index];
  if (object === undefined) return;
  if (enhancement.scale !== undefined) object.scale = [...enhancement.scale];
  if (enhancement.localPosition !== undefined) object.position = mapPosition(enhancement.localPosition, version);
  else if (enhancement.position !== undefined) setWorldPosition(data, index, enhancement.position, version);
  if (enhancement.localRotation !== undefined) object.rotation = mapRotation(enhancement.localRotation);
  else if (enhancement.rotation !== undefined) setWorldRotation(data, index, enhancement.rotation);
}

function matcherFor(enhancement: RendererEnhancement) {
  const query = enhancement.id ?? '';
  switch (enhancement.lookupMethod) {
    case 'Exact':
      return (id: string) => id === query;
    case 'StartsWith':
      return (id: string) => id.startsWith(query);
    case 'EndsWith':
      return (id: string) => id.endsWith(query);
    case 'Regex':
      try {
        const expression = new RegExp(query);
        return (id: string) => expression.test(id);
      } catch {
        return () => false;
      }
    default:
      return (id: string) => id.includes(query);
  }
}

function addRuntimeRingLookups(data: EnvironmentData, lookups: LookupEntry[]) {
  const ringRoots = [
    ...new Set(
      data.objects.flatMap((object) =>
        (object.components?.TrackLaneRingsManager ?? []).flatMap((manager) =>
          manager.SpawnAsChildren === 0 ? manager.Rings.map((ring) => ring.obj) : [],
        ),
      ),
    ),
  ];
  if (ringRoots.length === 0) return;

  ringRoots.sort((left, right) => {
    const leftId = lookups.find((lookup) => lookup.index === left)?.id;
    const rightId = lookups.find((lookup) => lookup.index === right)?.id;
    const leftOrder = Number(/^.*\.\[(\d+)]/.exec(leftId ?? '')?.[1] ?? Number.MAX_SAFE_INTEGER);
    const rightOrder = Number(/^.*\.\[(\d+)]/.exec(rightId ?? '')?.[1] ?? Number.MAX_SAFE_INTEGER);
    return leftOrder - rightOrder || left - right;
  });
  const environmentRootCount =
    Math.max(
      -1,
      ...lookups.flatMap((lookup) => {
        if (data.objects[lookup.index]?.parent !== -1) return [];
        const match = new RegExp(`^${data.id}\\.\\[(\\d+)]`).exec(lookup.id);
        return match?.[1] === undefined ? [] : [Number(match[1])];
      }),
    ) + 1;
  const sourceLookups = [...lookups];
  const known = new Set(lookups.map((lookup) => `${lookup.index}:${lookup.id}`));

  ringRoots.forEach((root, ringIndex) => {
    const object = data.objects[root];
    const originalRootId = sourceLookups.find((lookup) => lookup.index === root)?.id;
    if (object === undefined || originalRootId === undefined) return;
    const runtimeRootId = `${data.id}.[${String(environmentRootCount + ringIndex)}]${object.name}`;
    for (const index of subtreeIndices(data.objects, root)) {
      for (const lookup of sourceLookups.filter((entry) => entry.index === index)) {
        if (!lookup.id.startsWith(originalRootId)) continue;
        const id = `${runtimeRootId}${lookup.id.slice(originalRootId.length)}`;
        const key = `${index}:${id}`;
        if (known.has(key)) continue;
        known.add(key);
        lookups.push({ id, index });
      }
    }
  });
}

function subtreeIndices(objects: EnvironmentObjectData[], root: number) {
  const descendants = new Set([root]);
  for (let index = 0; index < objects.length; index++) {
    let parent = objects[index]?.parent ?? -1;
    while (parent >= 0) {
      if (parent === root) {
        descendants.add(index);
        break;
      }
      parent = objects[parent]?.parent ?? -1;
    }
  }
  return [...descendants].sort((left, right) => left - right);
}

function cloneWithRemappedReferences<T>(value: T, remap: Map<number, number>): T {
  return JSON.parse(
    JSON.stringify(value, (key, current: unknown) =>
      key === 'obj' && typeof current === 'number' ? (remap.get(current) ?? current) : current,
    ),
  ) as T;
}

function appendReferences(references: ObjectReference[], remap: Map<number, number>) {
  const clones = references
    .filter((reference) => remap.has(reference.obj))
    .map((reference) => cloneWithRemappedReferences(reference, remap));
  references.push(...clones);
}

function appendReferenceEntries<T>(
  entries: T[],
  reference: (entry: T) => ObjectReference | undefined,
  remap: Map<number, number>,
) {
  const clones = entries
    .filter((entry) => {
      const target = reference(entry);
      return target !== undefined && remap.has(target.obj);
    })
    .map((entry) => cloneWithRemappedReferences(entry, remap));
  entries.push(...clones);
}

function appendRemappedComponentReferences(
  components: NonNullable<EnvironmentObjectData['components']>,
  remap: Map<number, number>,
) {
  for (const manager of components.TrackLaneRingsManager ?? []) appendReferences(manager.Rings, remap);
  for (const controller of components.DirectionalLightsController ?? []) {
    appendReferences(controller.LightIntensityData, remap);
  }
  for (const controller of components.MaterialLightsController ?? []) {
    appendReferences(controller.LightIntensityData, remap);
  }
  for (const controller of components.MaterialPropertyBlockController ?? []) {
    appendReferences(controller.Renderers, remap);
  }
  for (const effect of components.LightColorGroupEffect ?? []) appendReferences(effect.lightEntries, remap);
  for (const effect of components.LocalScaleFx ?? []) appendReferences(effect.TargetTransforms, remap);
  for (const effect of components.MpbArrayFx ?? []) appendReferences(effect.MpbControllers, remap);
  for (const effect of components.AlphaFx ?? []) appendReferences(effect.MpbControllers, remap);
  for (const effect of components.CollectionFx ?? []) appendReferences(effect.Targets, remap);
  for (const effect of components.GameObjectSwitch ?? []) {
    appendReferences(effect.NormalGameObjects, remap);
    appendReferences(effect.BoostGameObjects, remap);
  }
  for (const effect of components.GameObjectIntSwitch ?? []) {
    for (const container of effect.GameObjectsValueContainers) appendReferences(container.GameObjects, remap);
  }
  for (const effect of components.LightRotationGroupEffect ?? []) {
    for (const entry of effect.transformEntries) appendReferences(entry.Transforms, remap);
  }
  for (const effect of components.LightTranslationGroupEffect ?? []) {
    for (const entry of effect.transformEntries) appendReferences(entry.Transforms, remap);
  }
  for (const effect of components.FloatFxGroupEffect ?? []) {
    for (const entry of effect.fxEntries) appendReferences(entry.Targets, remap);
  }
  for (const effect of components.LightPairRotation ?? []) {
    appendReferenceEntries(effect.Transforms, (entry) => entry.Transform, remap);
  }
  for (const effect of components.SwitchGameObjectArrayFx ?? []) {
    appendReferenceEntries(effect.GameObjects, (entry) => entry.GameObject, remap);
  }
  for (const constraint of components.PositionConstraint ?? []) {
    appendReferenceEntries(constraint.m_Sources, (entry) => entry.sourceTransform, remap);
  }
  for (const manager of [
    ...(components.LightColorGroupEffectManager ?? []),
    ...(components.LightRotationGroupEffectManager ?? []),
    ...(components.LightTranslationGroupEffectManager ?? []),
    ...(components.FloatFxGroupEffectManager ?? []),
  ]) {
    appendReferenceEntries(manager.effectEntries, (entry) => entry.Effect, remap);
  }
  for (const reflection of components.LightReflection ?? []) {
    appendReferenceEntries(reflection.ParametricLightReflection, (entry) => entry.Light, remap);
  }
}

function markerFor(data: EnvironmentData, index: number) {
  return data.objects[index]?.components?.ChromaIDMarker?.find((marker) => marker.enabled);
}

function nextCloneRootId(lookups: LookupEntry[], originalId: string) {
  const separator = originalId.lastIndexOf('.[');
  if (separator < 0) return `${originalId}(Clone)`;
  const parent = originalId.slice(0, separator);
  const segment = originalId.slice(separator + 1);
  const parsed = /^\[(\d+)\](.*)$/.exec(segment);
  if (parsed === null) return `${originalId}(Clone)`;
  let sibling = Number(parsed[1]);
  const prefix = `${parent}.[`;
  for (const lookup of lookups) {
    if (!lookup.id.startsWith(prefix)) continue;
    const suffix = lookup.id.slice(parent.length + 1);
    if (suffix.includes('.')) continue;
    const candidate = /^\[(\d+)\]/.exec(suffix);
    if (candidate !== null) sibling = Math.max(sibling, Number(candidate[1]));
  }
  return `${parent}.[${String(sibling + 1)}]${parsed[2]}(Clone)`;
}

function addDuplicatedLookups(
  data: EnvironmentData,
  lookups: LookupEntry[],
  originals: readonly number[],
  remap: Map<number, number>,
  root: number,
) {
  const originalRootId = lookups.find((lookup) => lookup.index === root)?.id;
  if (originalRootId === undefined) return;
  const cloneRootId = nextCloneRootId(lookups, originalRootId);
  for (const original of originals) {
    const cloneIndex = remap.get(original);
    if (cloneIndex === undefined) continue;
    for (const lookup of lookups.filter((entry) => entry.index === original)) {
      const cloneId = lookup.id.startsWith(originalRootId)
        ? `${cloneRootId}${lookup.id.slice(originalRootId.length)}`
        : `${lookup.id}(Clone)`;
      const cloneMarker = markerFor(data, cloneIndex);
      if (cloneMarker !== undefined) cloneMarker.ChromaID = cloneId;
      lookups.push({ id: cloneId, index: cloneIndex });
    }
  }
}

function nextGeneratedRootId(data: EnvironmentData, lookups: LookupEntry[], name: string) {
  const scene = lookups[0]?.id.split('.[')[0] ?? data.id;
  const prefix = `${scene}.[`;
  let sibling = -1;
  for (const lookup of lookups) {
    if (!lookup.id.startsWith(prefix)) continue;
    const suffix = lookup.id.slice(scene.length + 1);
    if (suffix.includes('.')) continue;
    const parsed = /^\[(\d+)\]/.exec(suffix);
    if (parsed !== null) sibling = Math.max(sibling, Number(parsed[1]));
  }
  return `${scene}.[${String(sibling + 1)}]${name}`;
}

function foldWrapperTransform(clone: EnvironmentObjectData, wrapper: EnvironmentObjectData) {
  const rotation = new Quaternion().fromArray(wrapper.rotation);
  const position = new Vector3()
    .fromArray(clone.position)
    .multiply(new Vector3().fromArray(wrapper.scale))
    .applyQuaternion(rotation)
    .add(new Vector3().fromArray(wrapper.position));
  const combined = rotation.multiply(new Quaternion().fromArray(clone.rotation));
  clone.position = [position.x, position.y, position.z];
  clone.rotation = [combined.x, combined.y, combined.z, combined.w];
  clone.scale = [
    wrapper.scale[0] * clone.scale[0],
    wrapper.scale[1] * clone.scale[1],
    wrapper.scale[2] * clone.scale[2],
  ];
}

function duplicateSubtree(data: EnvironmentData, lookups: LookupEntry[], root: number) {
  const sourceObjectCount = data.objects.length;
  const originals = subtreeIndices(data.objects, root);
  const remap = new Map<number, number>();
  for (const index of originals) remap.set(index, data.objects.length + remap.size);
  for (const index of originals) {
    const source = data.objects[index];
    if (source === undefined) continue;
    const clone = cloneWithRemappedReferences(source, remap);
    clone.chromaGenerated = true;
    if (index === root) {
      clone.name = `${clone.name}(Clone)`;
      // in-game clones are siblings of the original; hop out of track wrappers and bake their transform in
      let parent = source.parent;
      for (;;) {
        const ancestor = parent >= 0 ? data.objects[parent] : undefined;
        if (!ancestor?.name.startsWith(trackWrapperPrefix)) break;
        foldWrapperTransform(clone, ancestor);
        parent = ancestor.parent;
      }
      clone.parent = parent;
    } else {
      clone.parent = remap.get(source.parent) ?? source.parent;
    }
    data.objects.push(clone);
  }
  addDuplicatedLookups(data, lookups, originals, remap, root);
  const linkedObjects: number[] = [];
  for (let ownerIndex = 0; ownerIndex < sourceObjectCount; ownerIndex++) {
    if (remap.has(ownerIndex)) continue;
    const owner = data.objects[ownerIndex];
    const effects = (owner?.components?.BasicLightEffect ?? []).flatMap((effect) => {
      const lightEntries = effect.lightEntries
        .filter((entry) => remap.has(entry.obj))
        .map((entry) => ({
          ...entry,
          obj: remap.get(entry.obj) ?? entry.obj,
        }));
      return lightEntries.length === 0 ? [] : [{ ...structuredClone(effect), lightEntries }];
    });
    if (effects.length > 0) {
      linkedObjects.push(data.objects.length);
      data.objects.push({
        name: '__chroma_light_effect',
        parent: -1,
        active: true,
        position: [0, 0, 0],
        rotation: [...identityRotation],
        scale: [...identityScale],
        components: { BasicLightEffect: effects },
      });
    }
    if (owner?.components !== undefined) appendRemappedComponentReferences(owner.components, remap);
  }
  return {
    root: remap.get(root) ?? root,
    indices: [...originals.flatMap((index) => remap.get(index) ?? []), ...linkedObjects],
  };
}

function remapLights(data: EnvironmentData, indices: readonly number[], lightId?: number, lightType?: number) {
  for (const index of indices) {
    const components = data.objects[index]?.components;
    if (lightId !== undefined) {
      for (const controller of components?.ParametricBloomFogLightController ?? []) controller.ID = lightId;
      for (const controller of components?.InstancedMaterialLightController ?? []) controller.ID = lightId;
      for (const controller of components?.MaterialLightController ?? []) controller.ID = lightId;
      for (const controller of components?.SpriteLightController ?? []) controller.ID = lightId;
      for (const controller of components?.LightIntensityController ?? []) controller.ID = lightId;
    }
    if (lightType !== undefined) {
      for (const effect of components?.BasicLightEffect ?? []) effect.ID = lightType;
      for (const effect of components?.LightRotationEffect ?? []) effect.ID = lightType;
    }
  }
}

function lightIdForReference(data: EnvironmentData, reference: ObjectReference) {
  const components = data.objects[reference.obj]?.components;
  const index = reference.componentIndex ?? 0;
  switch (reference.component) {
    case 'ParametricBloomFogLightController':
      return components?.ParametricBloomFogLightController?.[index]?.ID;
    case 'InstancedMaterialLightController':
      return components?.InstancedMaterialLightController?.[index]?.ID;
    case 'MaterialLightController':
      return components?.MaterialLightController?.[index]?.ID;
    case 'SpriteLightController':
      return components?.SpriteLightController?.[index]?.ID;
    case 'LightIntensityController':
      return components?.LightIntensityController?.[index]?.ID;
    default:
      return undefined;
  }
}

function registeredLightIds(data: EnvironmentData) {
  const registered = new Map<number, Set<number>>();
  for (const object of data.objects) {
    for (const effect of object.components?.BasicLightEffect ?? []) {
      let ids = registered.get(effect.ID);
      if (ids === undefined) {
        ids = new Set();
        registered.set(effect.ID, ids);
      }
      for (const [id] of effect.LightIdRemapEntries) ids.add(id);
      for (const entry of effect.lightEntries) {
        const id = lightIdForReference(data, entry);
        if (id !== undefined && !effect.LightIdRemapEntries.some(([, target]) => target === id)) ids.add(id);
      }
    }
  }
  return registered;
}

function reserveLightId(registered: Map<number, Set<number>>, types: readonly number[], requested?: number) {
  let id = requested ?? Math.max(-1, ...types.flatMap((type) => [...(registered.get(type) ?? [])])) + 1;
  while (types.some((type) => registered.get(type)?.has(id) === true)) id++;
  for (const type of types) {
    const ids = registered.get(type);
    if (ids === undefined) registered.set(type, new Set([id]));
    else ids.add(id);
  }
  return id;
}

function registerLights(
  data: EnvironmentData,
  indices: readonly number[],
  registered: Map<number, Set<number>>,
  requestedId?: number,
  lightType?: number,
) {
  const effectsByTarget = new Map<string, number[]>();
  for (const index of indices) {
    for (const effect of data.objects[index]?.components?.BasicLightEffect ?? []) {
      if (lightType !== undefined) effect.ID = lightType;
      for (const entry of effect.lightEntries) {
        const key = referenceKey(entry);
        const types = effectsByTarget.get(key);
        if (types === undefined) effectsByTarget.set(key, [effect.ID]);
        else if (!types.includes(effect.ID)) types.push(effect.ID);
      }
    }
  }
  const requestedTypes = [...new Set([...effectsByTarget.values()].flat())];
  const reservedRequestedId =
    requestedId === undefined || requestedTypes.length === 0
      ? undefined
      : reserveLightId(registered, requestedTypes, requestedId);

  function remap(index: number, component: ObjectReference['component'], controllers: { ID: number }[]) {
    for (const [componentIndex, controller] of controllers.entries()) {
      const types = effectsByTarget.get(referenceKey({ obj: index, component, componentIndex })) ?? [];
      if (types.length > 0) controller.ID = reservedRequestedId ?? reserveLightId(registered, types);
    }
  }

  for (const index of indices) {
    const components = data.objects[index]?.components;
    remap(index, 'ParametricBloomFogLightController', components?.ParametricBloomFogLightController ?? []);
    remap(index, 'InstancedMaterialLightController', components?.InstancedMaterialLightController ?? []);
    remap(index, 'MaterialLightController', components?.MaterialLightController ?? []);
    remap(index, 'SpriteLightController', components?.SpriteLightController ?? []);
    remap(index, 'LightIntensityController', components?.LightIntensityController ?? []);
  }
}

function registerGeometryLight(
  data: EnvironmentData,
  index: number,
  registered: Map<number, Set<number>>,
  requestedId?: number,
  lightType?: number,
) {
  const components = data.objects[index]?.components;
  const effects = components?.BasicLightEffect ?? [];
  if (lightType !== undefined) {
    for (const effect of effects) effect.ID = lightType;
  }
  const types = [...new Set(effects.map((effect) => effect.ID))];
  if (types.length === 0) return;
  const id = reserveLightId(registered, types, requestedId);
  for (const controller of components?.ParametricBloomFogLightController ?? []) controller.ID = id;
  for (const controller of components?.MaterialLightController ?? []) controller.ID = id;
}

function applyComponents(
  data: EnvironmentData,
  indices: readonly number[],
  enhancement: RendererEnhancement,
  version: number,
  remapLightComponents = true,
) {
  const light = enhancement.components?.ILightWithId;
  const applyLegacyLight = version !== 2 || enhancement.duplicate !== undefined;
  if (remapLightComponents) {
    remapLights(
      data,
      indices,
      applyLegacyLight ? (light?.lightId ?? enhancement.lightId) : undefined,
      applyLegacyLight ? (light?.type ?? enhancement.lightType) : undefined,
    );
  }

  const fog = enhancement.components?.BloomFogEnvironment;
  if (fog !== undefined) {
    if (fog.attenuation !== undefined) data.fogParams.attenuation = fog.attenuation;
    if (fog.offset !== undefined) data.fogParams.offset = fog.offset;
    if (fog.startY !== undefined) data.fogParams.startY = fog.startY;
    if (fog.height !== undefined) data.fogParams.height = fog.height;
  }

  const tube = enhancement.components?.TubeBloomPrePassLight;
  if (tube === undefined) return;
  for (const index of indices) {
    const components = data.objects[index]?.components;
    for (const controller of components?.ParametricBloomFogLightController ?? []) {
      if (tube.colorAlphaMultiplier !== undefined) controller.ColorAlphaMultiplier = tube.colorAlphaMultiplier;
      if (tube.bloomFogIntensityMultiplier !== undefined) {
        controller.BloomFogIntensityMultiplier = tube.bloomFogIntensityMultiplier;
      }
    }
    for (const controller of components?.MaterialLightController ?? []) {
      if (tube.colorAlphaMultiplier !== undefined) controller.AlphaIntensity = tube.colorAlphaMultiplier;
    }
  }
}

function geometryComponents(shader: ChromaMaterial['shader'], objectIndex: number, mesh: string, collision: boolean) {
  const components: NonNullable<EnvironmentObjectData['components']> = {};
  if (collision) components.MeshCollider = [{ Mesh: mesh, enabled: true }];
  if (!lightShaders.has(shader)) return components;
  components.MaterialLightController = [
    {
      ID: 0,
      Renderer: { obj: objectIndex },
      SetAlphaOnly: 0,
      AlphaIntensity: 1,
      AlphaIntoColor: 0,
      SetColorOnly: 0,
      MultiplyColorWithAlpha: shader === 'OpaqueLight' ? 0 : 1,
      MultiplyColor: 0,
      ColorMultiplier: 1,
      Alpha: 1,
      Property: '_Color',
      enabled: true,
    },
  ];
  components.ParametricBloomFogLightController = [
    {
      ID: 0,
      Length: 1,
      Center: 0.5,
      BloomFogIntensityMultiplier: 1,
      LightWidthMultiplier: 1,
      StartWidth: 1,
      EndWidth: 1,
      StartAlpha: 1,
      EndAlpha: 1,
      BoostToWhite: 0,
      ColorAlphaMultiplier: 1,
      FakeBloomIntensityMultiplier: 1,
      Width: 1,
      OverrideChildrenLength: 0,
      AddWidthToLength: 0,
      BakedGlowWidthScale: 1,
      ThickenWithDistance: 0,
      ThickenCurve: { keys: [] },
      MinDistance: 30,
      MaxDistance: 200,
      MinWidthMultiplier: 1,
      MaxWidthMultiplier: 10,
      DisableRenderersOnZeroAlpha: 0,
      MultiplyLengthByAlpha: 0,
      AlphaToLengthCurve: { keys: [] },
      AlphaToLengthBloomFogCurve: { keys: [] },
      LimitAlpha: 0,
      MinAlpha: 0,
      MaxAlpha: 1,
      OverrideChildrenAlpha: 1,
      OverrideChildrenWidth: 0,
      BoxLight: null,
      SpriteLight: null,
      enabled: true,
    },
  ];
  components.BasicLightEffect = [
    {
      ID: 0,
      OffIntensity: 0,
      LightOnStart: 0,
      InvertColorScheme: 0,
      LightIdRemapEntries: [],
      lightEntries: [
        { obj: objectIndex, component: 'MaterialLightController' },
        { obj: objectIndex, component: 'ParametricBloomFogLightController' },
      ],
      enabled: true,
    },
  ];
  return components;
}

function bufferValues(geometry: BufferGeometry, name: string) {
  return Array.from(geometry.getAttribute(name).array);
}

function meshData(geometry: BufferGeometry): EnvironmentMeshData {
  const positions = bufferValues(geometry, 'position');
  const indices =
    geometry.index === null
      ? Array.from({ length: positions.length / 3 }, (_, index) => index)
      : Array.from(geometry.index.array);
  return {
    positions,
    normals: bufferValues(geometry, 'normal'),
    uvs: bufferValues(geometry, 'uv'),
    indices,
    groups: geometry.groups.map(({ start, count, materialIndex }) => ({
      start,
      count,
      materialIndex: materialIndex ?? 0,
    })),
  };
}

function geometryMesh(type: string) {
  let geometry: BufferGeometry;
  switch (type) {
    case 'Sphere':
      geometry = new SphereGeometry(0.5, 24, 16);
      break;
    case 'Capsule':
      geometry = new CapsuleGeometry(0.5, 1, 8, 24);
      break;
    case 'Cylinder':
      geometry = new CylinderGeometry(0.5, 0.5, 2, 20);
      break;
    case 'Cube':
      geometry = new BoxGeometry(1, 1, 1);
      break;
    case 'Plane':
      geometry = new PlaneGeometry(10, 10, 10, 10).rotateX(-Math.PI / 2);
      break;
    case 'Quad':
      geometry = new PlaneGeometry(1, 1);
      break;
    case 'Triangle':
      geometry = new BufferGeometry();
      geometry.setAttribute('position', new Float32BufferAttribute([-0.5, -0.5, 0, 0.5, -0.5, 0, 0, 0.5, 0], 3));
      geometry.setAttribute('uv', new Float32BufferAttribute([0, 0, 1, 0, 0.5, 1], 2));
      geometry.setIndex([0, 2, 1]);
      geometry.computeVertexNormals();
      break;
    default:
      return undefined;
  }
  const data = meshData(geometry);
  geometry.dispose();
  return data;
}

function standardMaterial(color: ChromaMaterial['color']): EnvironmentMaterialData {
  return {
    name: '__chroma_standard',
    shader: 'ChroMapper/Lit',
    family: 'lit',
    colors: { _Color: [...(color ?? [0, 0, 0, 0])] },
    floats: {
      _AmbientMinimalValue: 0,
      _AmbientMultiplier: 1,
      _EnableDiffuse: 1,
      _EnableSpecular: 1,
      _Smoothness: 0.5,
      _SpecularIntensity: 1,
      _EnableFog: 1,
      _CullMode: 2,
      _ZWrite: 1,
    },
    keywords: ['FOG', 'DIFFUSE', 'SPECULAR', 'REFLECTION_PROBE_BOX_PROJECTION', 'MULTIPLY_REFLECTIONS'],
  };
}

function lightMaterial(
  shader: 'OpaqueLight' | 'TransparentLight',
  color: ChromaMaterial['color'],
): EnvironmentMaterialData {
  const opaque = shader === 'OpaqueLight';
  return {
    name: `__chroma_${shader}`,
    shader: opaque ? 'ChroMapper/Parametric Box Opaque' : 'ChroMapper/Parametric Box Transparent',
    family: opaque ? 'lightTubeOpaque' : 'lightTubeTransparent',
    colors: {
      _AlphaWidth: [1, 1, 1, 1],
      _Color: [...(color ?? [0, 0, 0, opaque ? 0 : 1])],
      _SizeParams: [0.2, 1, 0, 0],
      _WorldNoiseScrolling: [0, 0, 0, 1],
    },
    floats: {
      _BloomBoost: 1,
      _BloomWhite: 0,
      _CullMode: opaque ? 0 : 2,
      _EnableFog: 0,
      _EnableHeightFog: 1,
      _FogHeightOffset: 0,
      _FogHeightScale: 1,
      _FogScale: 1,
      _FogStartOffset: 0,
      _MultiplyColorWithAlpha: opaque ? 0 : 1,
      _ZWrite: opaque ? 1 : 0,
    },
    keywords: ['ENABLE_HEIGHT_FOG'],
  };
}

function baseWaterMaterial(color: ChromaMaterial['color']): EnvironmentMaterialData {
  return {
    name: '__chroma_BaseWater',
    shader: 'ChroMapper/Water Lit',
    family: 'lit',
    colors: { _Color: [...(color ?? [0, 0, 0, 0])] },
    floats: { _CullMode: 2, _EnableFog: 1, _EnableHeightFog: 1, _ZWrite: 1 },
    keywords: [
      'FOG',
      'HEIGHT_FOG',
      'INVERT_RIMLIGHT',
      'MASK_RED_IS_ALPHA',
      'NOISE_DITHERING',
      'NORMAL_MAP',
      'REFLECTION_PROBE',
      'REFLECTION_PROBE_BOX_PROJECTION',
      '_DECALBLEND_ALPHABLEND',
      '_DISSOLVEAXIS_LOCALX',
      '_EMISSIONCOLORTYPE_FLAT',
      '_EMISSIONTEXTURE_NONE',
      '_RIMLIGHT_NONE',
      '_ROTATE_UV_NONE',
      '_VERTEXMODE_NONE',
      '_WHITEBOOSTTYPE_NONE',
      '_ZWRITE_ON',
    ],
  };
}

function glowingMaterial(color: ChromaMaterial['color']): EnvironmentMaterialData {
  return {
    name: '__chroma_Glowing',
    shader: 'ChroMapper/Glowing',
    family: 'fakeGlow',
    colors: { _Color: [...(color ?? [0, 0, 0, 0])] },
    floats: {
      _BloomType: 0,
      _BloomWhiteMultiplier: 1,
      _CullMode: 2,
      _EnableFog: 0,
      _FogStartOffset: Number.POSITIVE_INFINITY,
      _FogScale: 1,
      _ZTest: 4,
      _ZWrite: 1,
    },
    keywords: [],
  };
}

function materialData(data: EnvironmentData, material: ChromaMaterial) {
  const useGlowingCompatibility =
    (material.shader === 'Standard' || material.shader === 'BTSPillar') && material.keywords?.length === 0;
  const color =
    useGlowingCompatibility && material.color !== undefined
      ? ([material.color[0], material.color[1], material.color[2], 0] as const)
      : material.color;
  const preset = data.materials[chromaMaterialPresetKey(material.shader)];
  let result: EnvironmentMaterialData | undefined;
  if (useGlowingCompatibility) result = glowingMaterial(color);
  else if (preset !== undefined) result = structuredClone(preset);
  else {
    switch (material.shader) {
      case 'Standard':
        result = standardMaterial(color);
        break;
      case 'OpaqueLight':
      case 'TransparentLight':
        result = lightMaterial(material.shader, color);
        break;
      case 'BaseWater':
        result = baseWaterMaterial(color);
        break;
      case 'Glowing':
        result = glowingMaterial(color);
        break;
      case 'Obstacle':
        return undefined;
      default:
        result = standardMaterial(color);
    }
  }
  if (color !== undefined) result.colors._Color = [...color];
  if (material.keywords !== undefined && material.keywords.length > 0) result.keywords = [...material.keywords];
  return result;
}

function addMaterialTrack(materialTracks: Map<string, string[]>, track: string, material: string) {
  const targets = materialTracks.get(track);
  if (targets === undefined) materialTracks.set(track, [material]);
  else if (!targets.includes(material)) targets.push(material);
}

function addGeometryMaterial(
  data: EnvironmentData,
  source: ChromaEnvironmentData,
  materialTracks: Map<string, string[]>,
  value: string | ChromaMaterial,
  enhancementIndex: number,
) {
  const name = typeof value === 'string' ? value : `inline_${String(enhancementIndex)}`;
  const material = typeof value === 'string' ? source.materials[value] : value;
  if (material === undefined) return undefined;
  const key = `__chroma_material_${name}`;
  const definition = materialData(data, material);
  if (definition === undefined) return undefined;
  data.materials[key] ??= { ...definition, name: key };
  for (const track of material.tracks) addMaterialTrack(materialTracks, track, key);
  return key;
}

function addTrack(tracks: Map<string, number[]>, name: string, index: number) {
  const targets = tracks.get(name);
  if (targets === undefined) tracks.set(name, [index]);
  else if (!targets.includes(index)) targets.push(index);
}

function enhancementTracks(enhancement: RendererEnhancement) {
  return typeof enhancement.track === 'string' ? [enhancement.track] : (enhancement.track ?? []);
}

function disableTrackedBoxLightTransforms(data: EnvironmentData, indices: readonly number[]) {
  for (const index of indices) {
    for (const light of data.objects[index]?.components?.ParametricBoxLight ?? []) light.UpdateTransform = 0;
  }
}

function wrapTrackedObject(
  data: EnvironmentData,
  tracks: Map<string, number[]>,
  targetIndex: number,
  enhancement: RendererEnhancement,
  version: number,
) {
  const target = data.objects[targetIndex];
  const trackNames = enhancementTracks(enhancement);
  if (target === undefined || trackNames.length === 0) return targetIndex;
  const wrapperIndex = data.objects.length;
  const wrapper: EnvironmentObjectData = {
    name: `${trackWrapperPrefix}${trackNames.join('_')}`,
    parent: target.parent,
    active: true,
    position: [...target.position],
    rotation: [...target.rotation],
    scale: [...target.scale],
  };
  data.objects.push(wrapper);
  target.parent = wrapperIndex;
  target.position = [0, 0, 0];
  target.rotation = [...identityRotation];
  target.scale = [...identityScale];
  applyTransform(data, wrapperIndex, enhancement, version);
  for (const track of trackNames) addTrack(tracks, track, wrapperIndex);
  return wrapperIndex;
}

export function buildChromaEnvironmentVariant(
  sourceData: EnvironmentData,
  source: ChromaEnvironmentData,
): ChromaEnvironmentVariant {
  const data = structuredClone(sourceData);
  const tracks = new Map<string, number[]>();
  const materialTracks = new Map<string, string[]>();
  const fogTracks = new Set<string>();
  const tubeTracks = new Map<string, number[]>();
  const registeredLights = registeredLightIds(data);
  const animatedFogTracks = new Set(
    source.componentAnimations.flatMap((animation) =>
      animation.components.BloomFogEnvironment === undefined ? [] : animation.track,
    ),
  );
  const animatedTubeTracks = new Set(
    source.componentAnimations.flatMap((animation) =>
      animation.components.TubeBloomPrePassLight === undefined ? [] : animation.track,
    ),
  );
  const lookups = data.objects.flatMap((object, index) =>
    (object.components?.ChromaIDMarker ?? []).flatMap((marker) =>
      marker.enabled ? [{ id: marker.ChromaID, index }] : [],
    ),
  );
  addRuntimeRingLookups(data, lookups);

  function addComponentTracks(enhancement: RendererEnhancement, indices: readonly number[]) {
    for (const track of enhancementTracks(enhancement)) {
      if (animatedFogTracks.has(track) || enhancement.components?.BloomFogEnvironment !== undefined) {
        fogTracks.add(track);
      }
      if (!animatedTubeTracks.has(track) && enhancement.components?.TubeBloomPrePassLight === undefined) continue;
      for (const index of indices) addTrack(tubeTracks, track, index);
    }
  }

  for (const [enhancementIndex, coreEnhancement] of source.enhancements.entries()) {
    const enhancement = coreEnhancement as RendererEnhancement;
    if (enhancement.geometry !== undefined) {
      const meshName = `__chroma_geometry_${enhancement.geometry.type}`;
      const mesh = data.meshes[meshName] ?? geometryMesh(enhancement.geometry.type);
      const material =
        typeof enhancement.geometry.material === 'string'
          ? source.materials[enhancement.geometry.material]
          : enhancement.geometry.material;
      const materialName = addGeometryMaterial(
        data,
        source,
        materialTracks,
        enhancement.geometry.material,
        enhancementIndex,
      );
      if (mesh === undefined || material === undefined || materialName === undefined) continue;
      data.meshes[meshName] = mesh;
      const objectIndex = data.objects.length;
      const objectName = `${enhancement.geometry.type}${material.shader}`;
      data.objects.push({
        name: objectName,
        parent: -1,
        active: enhancement.active ?? true,
        chromaGenerated: true,
        position: [0, 0, 0],
        rotation: [...identityRotation],
        scale: [...identityScale],
        mesh: meshName,
        materials: [materialName],
        components: geometryComponents(material.shader, objectIndex, meshName, enhancement.geometry.collision ?? false),
      });
      lookups.push({
        id: nextGeneratedRootId(data, lookups, objectName),
        index: objectIndex,
      });
      applyTransform(data, objectIndex, enhancement, source.version);
      applyComponents(data, [objectIndex], enhancement, source.version, false);
      const light = enhancement.components?.ILightWithId;
      registerGeometryLight(
        data,
        objectIndex,
        registeredLights,
        light?.lightId ?? enhancement.lightId,
        light?.type ?? enhancement.lightType,
      );
      addComponentTracks(enhancement, [objectIndex]);
      for (const track of enhancementTracks(enhancement)) addTrack(tracks, track, objectIndex);
      continue;
    }

    const matches = matcherFor(enhancement);
    const matched = [...new Set(lookups.filter((lookup) => matches(lookup.id)).map((lookup) => lookup.index))];
    for (const original of matched) {
      const targets: { root: number; indices: number[] }[] = [];
      if (enhancement.duplicate === undefined)
        targets.push({
          root: original,
          indices: subtreeIndices(data.objects, original),
        });
      else {
        for (let index = 0; index < Math.max(enhancement.duplicate, 0); index++) {
          targets.push(duplicateSubtree(data, lookups, original));
        }
      }
      for (const target of targets) {
        const object = data.objects[target.root];
        if (object === undefined) continue;
        if (enhancement.active !== undefined) object.active = enhancement.active;
        if (enhancementTracks(enhancement).length > 0) disableTrackedBoxLightTransforms(data, target.indices);
        if (enhancement.duplicate === undefined) applyComponents(data, target.indices, enhancement, source.version);
        else {
          const light = enhancement.components?.ILightWithId;
          registerLights(
            data,
            target.indices,
            registeredLights,
            light?.lightId ?? enhancement.lightId,
            light?.type ?? enhancement.lightType,
          );
          applyComponents(data, target.indices, enhancement, source.version, false);
        }
        addComponentTracks(enhancement, target.indices);
        if (enhancementTracks(enhancement).length === 0) {
          applyTransform(data, target.root, enhancement, source.version);
        } else {
          wrapTrackedObject(data, tracks, target.root, enhancement, source.version);
        }
      }
    }
  }

  return { data, tracks, materialTracks, fogTracks, tubeTracks, source };
}
