import type { Rgb } from '../../core/colors';
import {
  componentAt,
  groupEffects,
  referenceKey,
  shaderMaterialsForMpbController,
} from './environment-component-utils';
import { lightBindings } from './environment-light-runtime';
import type { EnvironmentLighting } from './environment-lighting';
import type { EnvironmentGlsColorGroup, EnvironmentGlsColorTarget } from './environment-runtime';
import type { EnvironmentSceneBuild } from './environment-scene-builder';
import type { EnvironmentData, ObjectReference } from './types';
type ControlledMaterialType = 'MaterialLightController' | 'InstancedMaterialLightController' | 'SpriteLightController';

const controlledMaterialTypes: ControlledMaterialType[] = [
  'MaterialLightController',
  'InstancedMaterialLightController',
  'SpriteLightController',
];

function glsLightControllerAt(data: EnvironmentData, reference: ObjectReference) {
  const index = reference.componentIndex ?? 0;
  switch (reference.component) {
    case 'InstancedMaterialLightController':
      return componentAt(data, reference.obj, 'InstancedMaterialLightController', index);
    case 'LightIntensityController':
      return componentAt(data, reference.obj, 'LightIntensityController', index);
    case 'LightSink':
      return componentAt(data, reference.obj, 'LightSink', index);
    case 'MaterialLightController':
      return componentAt(data, reference.obj, 'MaterialLightController', index);
    case 'ParametricBloomFogLightController':
      return componentAt(data, reference.obj, 'ParametricBloomFogLightController', index);
    case 'SpriteLightController':
      return componentAt(data, reference.obj, 'SpriteLightController', index);
    default:
      return undefined;
  }
}

export function buildEnvironmentGlsColors(
  data: EnvironmentData,
  scene: EnvironmentSceneBuild,
  lighting: EnvironmentLighting,
): EnvironmentGlsColorGroup[] {
  function controllerMaterials(reference: ObjectReference) {
    const components = data.objects[reference.obj]?.components;
    const componentIndex = reference.componentIndex ?? 0;
    if (reference.component === 'MaterialLightController') {
      const controller = components?.MaterialLightController?.[componentIndex];
      return controller?.Renderer === null || controller?.Renderer === undefined
        ? []
        : (scene.objectShaderMaterials[controller.Renderer.obj] ?? []);
    }
    if (reference.component === 'InstancedMaterialLightController') {
      const controller = components?.InstancedMaterialLightController?.[componentIndex];
      const setterReference = controller?.MpbColorSetter;
      const setter =
        setterReference === undefined
          ? undefined
          : data.objects[setterReference.obj]?.components?.MaterialPropertyBlockColorSetter?.[
              setterReference.componentIndex ?? 0
            ];
      return setter === undefined
        ? []
        : shaderMaterialsForMpbController(data, scene.objectShaderMaterials, setter.Controller);
    }
    if (reference.component === 'SpriteLightController') {
      const controller = components?.SpriteLightController?.[componentIndex];
      return controller?.Renderer === null || controller?.Renderer === undefined
        ? []
        : (scene.objectShaderMaterials[controller.Renderer.obj] ?? []);
    }
    return scene.objectShaderMaterials[reference.obj] ?? [];
  }

  function controllerColorTransform(reference: ObjectReference): EnvironmentGlsColorTarget['transform'] {
    const components = data.objects[reference.obj]?.components;
    const componentIndex = reference.componentIndex ?? 0;
    if (reference.component === 'MaterialLightController') {
      const controller = components?.MaterialLightController?.[componentIndex];
      if (controller !== undefined) {
        return (color, alpha) => {
          const adjustedAlpha = alpha * controller.AlphaIntensity;
          let adjustedColor: Rgb =
            controller.AlphaIntoColor !== 0 ? [adjustedAlpha, adjustedAlpha, adjustedAlpha] : color;
          let multiplier = 1;
          if (controller.MultiplyColorWithAlpha !== 0) multiplier *= adjustedAlpha;
          if (controller.MultiplyColor !== 0) multiplier *= controller.ColorMultiplier;
          adjustedColor = [adjustedColor[0] * multiplier, adjustedColor[1] * multiplier, adjustedColor[2] * multiplier];
          return {
            color: adjustedColor,
            alpha: controller.SetColorOnly !== 0 ? controller.Alpha : adjustedAlpha,
            visible: true,
          };
        };
      }
    }
    if (reference.component === 'InstancedMaterialLightController') {
      const controller = components?.InstancedMaterialLightController?.[componentIndex];
      const setterReference = controller?.MpbColorSetter;
      const setter =
        setterReference === undefined
          ? undefined
          : data.objects[setterReference.obj]?.components?.MaterialPropertyBlockColorSetter?.[
              setterReference.componentIndex ?? 0
            ];
      if (controller !== undefined) {
        return (color, alpha) => {
          let adjustedAlpha =
            controller.SetColorOnly !== 0 ? alpha : Math.max(controller.MinAlpha, alpha) * controller.Intensity;
          if (controller.SaturateIntensity !== 0) adjustedAlpha = Math.min(Math.max(adjustedAlpha, 0), 1);
          const colorMultiplier =
            controller.MultiplyColorByAlpha === 1 ? alpha : controller.MultiplyColorByAlpha === 2 ? adjustedAlpha : 1;
          const intensity = controller.HDR !== 0 ? controller.Intensity : 1;
          const setterMultiplier = setter?.MultiplyWithAlpha === 0 ? 1 : adjustedAlpha * intensity;
          return {
            color: [
              color[0] * colorMultiplier * intensity * setterMultiplier,
              color[1] * colorMultiplier * intensity * setterMultiplier,
              color[2] * colorMultiplier * intensity * setterMultiplier,
            ],
            alpha: adjustedAlpha * intensity,
            visible: true,
          };
        };
      }
    }
    if (reference.component === 'SpriteLightController') {
      const controller = components?.SpriteLightController?.[componentIndex];
      if (controller !== undefined) {
        return (color, alpha) => {
          const adjustedAlpha = controller.SetColorOnly !== 0 ? alpha : Math.max(alpha, controller.MinAlpha);
          const colorMultiplier =
            controller.MultiplyColorByAlpha === 1 ? alpha : controller.MultiplyColorByAlpha === 2 ? adjustedAlpha : 1;
          return {
            color: [
              color[0] * colorMultiplier * controller.Intensity,
              color[1] * colorMultiplier * controller.Intensity,
              color[2] * colorMultiplier * controller.Intensity,
            ],
            alpha: adjustedAlpha * controller.Intensity,
            visible:
              controller.HideIfAlphaOutOfRange === 0 ||
              (adjustedAlpha >= controller.HideAlphaRangeMin && adjustedAlpha <= controller.HideAlphaRangeMax),
          };
        };
      }
    }
    return (color, alpha) => ({ color, alpha, visible: true });
  }

  function controllerColorProperty(reference: ObjectReference) {
    const componentIndex = reference.componentIndex ?? 0;
    const components = data.objects[reference.obj]?.components;
    if (reference.component === 'MaterialLightController') {
      return components?.MaterialLightController?.[componentIndex]?.Property;
    }
    if (reference.component === 'InstancedMaterialLightController') {
      const setterReference = components?.InstancedMaterialLightController?.[componentIndex]?.MpbColorSetter;
      return setterReference === undefined
        ? undefined
        : data.objects[setterReference.obj]?.components?.MaterialPropertyBlockColorSetter?.[
            setterReference.componentIndex ?? 0
          ]?.Property;
    }
    return '_Color';
  }

  data.objects.forEach((object, objectIndex) => {
    for (const component of controlledMaterialTypes) {
      object.components?.[component]?.forEach((controller, componentIndex) => {
        if (!controller.enabled) return;
        const reference: ObjectReference = { obj: objectIndex, component, componentIndex };
        const effects = scene.lightEffectsByTarget.get(referenceKey(reference)) ?? [];
        if (effects.length === 0) return;
        const materials = controllerMaterials(reference);
        if (materials.length === 0) return;
        lighting.materialLights.push({
          materials,
          bindings: lightBindings(effects, controller.ID),
          intensityMultiplier: 1,
          node: scene.nodes[objectIndex],
          transform: controllerColorTransform(reference),
          colorProperty: controllerColorProperty(reference) ?? '_Color',
        });
      });
    }
  });

  return groupEffects(data, 'LightColorGroupEffectManager', 'LightColorGroupEffect').flatMap(({ groupId, effect }) => {
    if (!effect.enabled) return [];
    const targets = effect.lightEntries.flatMap((reference): EnvironmentGlsColorTarget[] => {
      const controller = glsLightControllerAt(data, reference);
      if (controller?.enabled !== true) return [];
      const parametric = lighting.parametricTargets.get(referenceKey(reference));
      return [
        {
          id: controller.ID,
          node: reference.component === 'ParametricBloomFogLightController' ? undefined : scene.nodes[reference.obj],
          materials: controllerMaterials(reference),
          colorProperty: controllerColorProperty(reference) ?? '_Color',
          segments: parametric?.segments ?? [],
          materialLights: parametric?.materialLights ?? [],
          transform: controllerColorTransform(reference),
        },
      ];
    });
    return [{ groupId, count: effect.Count, targets }];
  });
}
