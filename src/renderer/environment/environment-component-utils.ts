import type { ShaderMaterial } from 'three';

import type {
  EnvironmentData,
  EnvironmentObjectData,
  FloatFxGroupEffectData,
  GroupEffectManagerData,
  LightColorGroupEffectData,
  LightRotationGroupEffectData,
  LightTranslationGroupEffectData,
  ObjectReference,
} from './types';

type EnvironmentComponents = NonNullable<EnvironmentObjectData['components']>;
type EnvironmentComponent<Name extends keyof EnvironmentComponents> = NonNullable<EnvironmentComponents[Name]>[number];

export function componentAt<Name extends keyof EnvironmentComponents>(
  data: EnvironmentData,
  objectIndex: number,
  component: Name,
  componentIndex: number,
): EnvironmentComponent<Name> | undefined {
  return data.objects[objectIndex]?.components?.[component]?.[componentIndex];
}

export function referenceKey(reference: ObjectReference) {
  return `${String(reference.obj)}:${reference.component ?? ''}:${String(reference.componentIndex ?? 0)}`;
}

export function rendererObjectsForMpbController(data: EnvironmentData, reference: ObjectReference) {
  const controller =
    data.objects[reference.obj]?.components?.MaterialPropertyBlockController?.[reference.componentIndex ?? 0];
  return controller?.Renderers.length === 0
    ? [reference.obj]
    : (controller?.Renderers.map((renderer) => renderer.obj) ?? []);
}

export function shaderMaterialsForMpbController(
  data: EnvironmentData,
  objectMaterials: readonly ShaderMaterial[][],
  reference: ObjectReference,
) {
  return rendererObjectsForMpbController(data, reference).flatMap((objectIndex) => objectMaterials[objectIndex] ?? []);
}

interface GroupEffectTypeMap {
  LightColorGroupEffect: LightColorGroupEffectData;
  LightRotationGroupEffect: LightRotationGroupEffectData;
  LightTranslationGroupEffect: LightTranslationGroupEffectData;
  FloatFxGroupEffect: FloatFxGroupEffectData;
}

type GroupEffectType = keyof GroupEffectTypeMap;
type GroupEffectManagerType =
  | 'LightColorGroupEffectManager'
  | 'LightRotationGroupEffectManager'
  | 'LightTranslationGroupEffectManager'
  | 'FloatFxGroupEffectManager';

function groupEffectAt(data: EnvironmentData, reference: ObjectReference, effectType: GroupEffectType) {
  const componentIndex = reference.componentIndex ?? 0;
  switch (effectType) {
    case 'FloatFxGroupEffect':
      return componentAt(data, reference.obj, 'FloatFxGroupEffect', componentIndex);
    case 'LightColorGroupEffect':
      return componentAt(data, reference.obj, 'LightColorGroupEffect', componentIndex);
    case 'LightRotationGroupEffect':
      return componentAt(data, reference.obj, 'LightRotationGroupEffect', componentIndex);
    case 'LightTranslationGroupEffect':
      return componentAt(data, reference.obj, 'LightTranslationGroupEffect', componentIndex);
  }
}

export function groupEffects(
  data: EnvironmentData,
  managerType: 'LightColorGroupEffectManager',
  effectType: 'LightColorGroupEffect',
): { groupId: number; effect: LightColorGroupEffectData }[];
export function groupEffects(
  data: EnvironmentData,
  managerType: 'LightRotationGroupEffectManager',
  effectType: 'LightRotationGroupEffect',
): { groupId: number; effect: LightRotationGroupEffectData }[];
export function groupEffects(
  data: EnvironmentData,
  managerType: 'LightTranslationGroupEffectManager',
  effectType: 'LightTranslationGroupEffect',
): { groupId: number; effect: LightTranslationGroupEffectData }[];
export function groupEffects(
  data: EnvironmentData,
  managerType: 'FloatFxGroupEffectManager',
  effectType: 'FloatFxGroupEffect',
): { groupId: number; effect: FloatFxGroupEffectData }[];
export function groupEffects(data: EnvironmentData, managerType: GroupEffectManagerType, effectType: GroupEffectType) {
  const effects: { groupId: number; effect: GroupEffectTypeMap[GroupEffectType] }[] = [];
  for (const object of data.objects) {
    const managers: GroupEffectManagerData[] | undefined = object.components?.[managerType];
    for (const manager of managers ?? []) {
      if (!manager.enabled) continue;
      for (const entry of manager.effectEntries) {
        if (entry.Effect.component !== effectType) continue;
        const effect = groupEffectAt(data, entry.Effect, effectType);
        if (effect !== undefined) effects.push({ groupId: entry.Group, effect });
      }
    }
  }
  return effects;
}
