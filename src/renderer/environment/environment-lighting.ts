import { Mesh, type Object3D } from 'three';

import { createBackgroundGradientMaterial } from '../materials/scene-materials';
import { shaderUniformValue } from '../materials/shared';
import { MAIN_ONLY_LAYER } from '../mirror/planar-mirror';
import { evaluateAnimationCurve } from './animation-curve';
import { referenceKey, rendererObjectsForMpbController } from './environment-component-utils';
import { fullscreenTriangleGeometry } from './environment-geometry';
import { backgroundGradientTransform, lightBindings, lightSegment } from './environment-light-runtime';
import type {
  EnvironmentDirectionalLight,
  EnvironmentLightSegment,
  EnvironmentMaterialLight,
} from './environment-runtime';
import type { EnvironmentSceneBuild } from './environment-scene-builder';
import type { EnvironmentMaterialContext } from './materials/material-context';
import type { EnvironmentData, ObjectReference } from './types';

const OPAQUE_LIGHT_MIN_EMISSION = 0.25;

export interface EnvironmentParametricTarget {
  node: Object3D;
  segments: EnvironmentLightSegment[];
  materialLights: EnvironmentMaterialLight[];
  startAlpha: number;
  endAlpha: number;
  setLength: (length: number, collisionLength?: number, startAlpha?: number) => void;
}

export interface EnvironmentLighting {
  directionalLights: EnvironmentDirectionalLight[];
  lightSegments: EnvironmentLightSegment[];
  materialLights: EnvironmentMaterialLight[];
  parametricTargets: Map<string, EnvironmentParametricTarget>;
}

function buildDirectionalLights(data: EnvironmentData, scene: EnvironmentSceneBuild) {
  const directionalLights: EnvironmentDirectionalLight[] = [];
  data.objects.forEach((object, index) => {
    for (const light of object.components?.DirectionalLight ?? []) {
      if (!light.enabled) continue;
      const controller = (object.components?.DirectionalLightsController ?? []).find(
        (candidate) => candidate.enabled && candidate.Light.obj === index,
      );
      const inputs = (controller?.LightIntensityData ?? []).flatMap((reference) => {
        if (reference.component !== 'LightIntensityController') return [];
        const input =
          data.objects[reference.obj]?.components?.LightIntensityController?.[reference.componentIndex ?? 0];
        if (!input?.enabled) return [];
        const effects = scene.lightEffectsByTarget.get(referenceKey(reference)) ?? [];
        return lightBindings(effects, input.ID).map((binding) => ({ binding, intensity: input.Intensity ?? 1 }));
      });
      directionalLights.push({
        node: scene.nodes[index] ?? scene.root,
        color: [light.Color[0], light.Color[1], light.Color[2]],
        intensity: light.Intensity,
        controllerIntensity: controller?.Intensity ?? 1,
        radius: light.Radius,
        maxIntensity: controller?.MaxIntensity ?? 1,
        multiplyColorByAlpha: controller?.MultiplyColorByAlpha !== 0,
        mixType: controller?.MixType ?? 0,
        inputs,
      });
    }
  });
  return directionalLights;
}

function addBackgroundGradients(
  data: EnvironmentData,
  materialContext: EnvironmentMaterialContext,
  scene: EnvironmentSceneBuild,
  materialLights: EnvironmentMaterialLight[],
) {
  data.objects.forEach((object, objectIndex) => {
    object.components?.BackgroundGradientController?.forEach((controller, componentIndex) => {
      if (!controller.enabled) return;
      const material = createBackgroundGradientMaterial(materialContext.fog, controller.TintColor, controller.Elements);
      const geometry = fullscreenTriangleGeometry();
      scene.geometries.set(`__background-gradient-${String(objectIndex)}-${String(componentIndex)}`, geometry);
      scene.materialInstances.add(material);
      const mesh = new Mesh(geometry, material);
      mesh.name = `${object.name}:background-gradient`;
      mesh.frustumCulled = false;
      mesh.renderOrder = -999;
      mesh.layers.set(MAIN_ONLY_LAYER);
      scene.nodes[objectIndex]?.add(mesh);
      const reference: ObjectReference = {
        obj: objectIndex,
        component: 'BackgroundGradientController',
        componentIndex,
      };
      const effects = scene.lightEffectsByTarget.get(referenceKey(reference)) ?? [];
      materialLights.push({
        materials: [material],
        bindings: lightBindings(effects, controller.ID),
        intensityMultiplier: 1,
        node: mesh,
        colorProperty: '_TintColor',
        transform: backgroundGradientTransform(controller),
      });
    });
  });
}

function addParametricLights(
  data: EnvironmentData,
  scene: EnvironmentSceneBuild,
  lightSegments: EnvironmentLightSegment[],
  materialLights: EnvironmentMaterialLight[],
) {
  const parametricTargets = new Map<string, EnvironmentParametricTarget>();
  const reflectionLights = new Set(
    data.objects.flatMap((object) =>
      (object.components?.LightReflection ?? []).flatMap((reflection) =>
        reflection.ParametricLightReflection.map((bounce) => bounce.Light.obj),
      ),
    ),
  );
  data.objects.forEach((object, index) => {
    const node = scene.nodes[index];
    if (node === undefined || (!object.active && !reflectionLights.has(index))) return;
    for (const [controllerIndex, controller] of (
      object.components?.ParametricBloomFogLightController ?? []
    ).entries()) {
      if (!controller.enabled) continue;
      const bindings = scene.lightEffectsByObject.get(index) ?? [];
      const segment = lightSegment(controller, node, data, bindings);
      lightSegments.push(segment);
      const lengthSetters: ((length: number, collisionLength: number, startAlpha: number) => void)[] = [];
      function setLength(
        length: number,
        collisionLength = Number.POSITIVE_INFINITY,
        startAlpha = controller.StartAlpha,
      ) {
        for (const setter of lengthSetters) setter(length, collisionLength, startAlpha);
      }
      const bindingTarget: EnvironmentParametricTarget = {
        node,
        segments: [segment],
        materialLights: [],
        startAlpha: controller.StartAlpha,
        endAlpha: controller.EndAlpha,
        setLength,
      };
      parametricTargets.set(
        `${String(index)}:ParametricBloomFogLightController:${String(controllerIndex)}`,
        bindingTarget,
      );
      const targets: ['box' | 'sprite', ObjectReference | null, number][] = [
        ['box', controller.BoxLight, controller.ColorAlphaMultiplier],
        ['sprite', controller.SpriteLight, controller.ColorAlphaMultiplier * controller.FakeBloomIntensityMultiplier],
      ];
      for (const [kind, target, intensityMultiplier] of targets) {
        if (target === null) continue;
        const targetNode = scene.nodes[target.obj];
        const targetMaterials = scene.objectShaderMaterials[target.obj] ?? [];
        if (targetNode === undefined || targetMaterials.length === 0) continue;
        const childComponents = data.objects[target.obj]?.components;
        const box = kind === 'box' ? childComponents?.ParametricBoxLight?.[target.componentIndex ?? 0] : undefined;
        const sprite =
          kind === 'sprite' ? childComponents?.ParametricSpriteLight?.[target.componentIndex ?? 0] : undefined;
        const lightNode = targetNode;
        const controllerNode = node;
        if (sprite !== undefined) {
          lightNode.traverse((child) => {
            const mesh = scene.rendererMeshes.get(child);
            if (mesh !== undefined) mesh.frustumCulled = false;
          });
        }
        const initialVisible = lightNode.visible;
        const opaque = targetMaterials.some((material) => !material.transparent && material.depthWrite);
        let currentAlpha = 1;
        let currentLength = controller.Length;
        let currentCollisionLength = Number.POSITIVE_INFINITY;
        let currentStartAlpha = controller.StartAlpha;
        function applyAlpha(alpha: number) {
          currentAlpha = alpha;
          const renderedAlpha = Math.max(Math.abs(alpha * intensityMultiplier), controller.MinAlpha);
          lightNode.visible =
            initialVisible &&
            (controller.DisableRenderersOnZeroAlpha === 0 || alpha > 0.01) &&
            (!opaque || renderedAlpha * renderedAlpha > OPAQUE_LIGHT_MIN_EMISSION);
          const lengthFactor =
            controller.MultiplyLengthByAlpha === 0 ? 1 : evaluateAnimationCurve(controller.AlphaToLengthCurve, alpha);
          let widthFactor = 1;
          if (controller.ThickenWithDistance !== 0) {
            const range = controller.MaxDistance - controller.MinDistance;
            const worldZ = controllerNode.matrixWorld.elements[14];
            const distance = range === 0 ? 0 : Math.min(Math.max((worldZ - controller.MinDistance) / range, 0), 1);
            const thickening = evaluateAnimationCurve(controller.ThickenCurve, distance);
            widthFactor =
              controller.MinWidthMultiplier +
              (controller.MaxWidthMultiplier - controller.MinWidthMultiplier) * thickening;
          }
          if (box !== undefined) {
            const width = controller.Width * widthFactor;
            const fullHeight =
              controller.OverrideChildrenLength === 0
                ? box.Height
                : (currentLength + (controller.AddWidthToLength === 0 ? 0 : controller.Width)) * lengthFactor;
            const height = Math.min(fullHeight, currentCollisionLength);
            lightNode.scale.set(width * 0.5, height * 0.5, width * 0.5);
            lightNode.position.set(0, (0.5 - controller.Center) * height, 0);
            const alphaStart = controller.OverrideChildrenAlpha === 0 ? box.AlphaStart : currentStartAlpha;
            const alphaEnd = controller.OverrideChildrenAlpha === 0 ? box.AlphaEnd : controller.EndAlpha;
            const clippedAlphaEnd =
              alphaStart + (alphaEnd - alphaStart) * (fullHeight <= 0 ? 1 : Math.min(height / fullHeight, 1));
            for (const material of targetMaterials) {
              const alphaWidth = shaderUniformValue(material, '_AlphaWidth');
              alphaWidth?.set(
                alphaStart,
                clippedAlphaEnd,
                controller.OverrideChildrenWidth === 0 ? box.WidthStart : controller.StartWidth,
                controller.OverrideChildrenWidth === 0 ? box.WidthEnd : controller.EndWidth,
              );
            }
          }
          if (sprite !== undefined) {
            const width = controller.Width * controller.BakedGlowWidthScale * widthFactor;
            const fullLength =
              controller.OverrideChildrenLength === 0
                ? sprite.Length
                : (currentLength + (controller.AddWidthToLength === 0 ? 0 : width)) * lengthFactor;
            const length = Math.min(fullLength, currentCollisionLength);
            const alphaStart = controller.OverrideChildrenAlpha === 0 ? sprite.AlphaStart : currentStartAlpha;
            const alphaEnd = controller.OverrideChildrenAlpha === 0 ? sprite.AlphaEnd : controller.EndAlpha;
            const clippedAlphaEnd =
              alphaStart + (alphaEnd - alphaStart) * (fullLength <= 0 ? 1 : Math.min(length / fullLength, 1));
            for (const material of targetMaterials) {
              const alphaWidth = shaderUniformValue(material, '_AlphaWidth');
              alphaWidth?.set(
                alphaStart,
                clippedAlphaEnd,
                controller.OverrideChildrenWidth === 0 ? sprite.WidthStart : controller.StartWidth,
                controller.OverrideChildrenWidth === 0 ? sprite.WidthEnd : controller.EndWidth,
              );
              const size = shaderUniformValue(material, '_SizeParams');
              size?.set(width * sprite.WidthMultiplier, length, controller.Center, width * 2 * sprite.WidthMultiplier);
            }
          }
        }
        lengthSetters.push((length, collisionLength, startAlpha) => {
          currentLength = Math.max(length, 0);
          currentCollisionLength = Math.max(collisionLength, 0);
          currentStartAlpha = startAlpha;
          applyAlpha(currentAlpha);
        });
        const materialLight: EnvironmentMaterialLight = {
          materials: targetMaterials,
          bindings: lightBindings(bindings, controller.ID),
          intensityMultiplier,
          minimumAlpha: controller.MinAlpha,
          applyAlpha,
        };
        applyAlpha(1);
        materialLights.push(materialLight);
        bindingTarget.materialLights.push(materialLight);
      }
    }
  });
  return parametricTargets;
}

function addRectangleFakeGlowLights(
  data: EnvironmentData,
  scene: EnvironmentSceneBuild,
  materialLights: EnvironmentMaterialLight[],
) {
  data.objects.forEach((object, index) => {
    for (const [controllerIndex, controller] of (object.components?.RectangleFakeGlowLightController ?? []).entries()) {
      if (!controller.enabled) continue;
      const targets = rendererObjectsForMpbController(data, controller.MpbController);
      const targetMaterials = targets.flatMap((target) => scene.objectShaderMaterials[target] ?? []);
      if (targetMaterials.length === 0) continue;
      const sizeParams: [number, number, number, number] = [
        controller.Size[0] * 0.5,
        controller.Size[1] * 0.5,
        1,
        controller.EdgeSize * 0.5,
      ];
      for (const material of targetMaterials) {
        shaderUniformValue(material, '_SizeParams')?.fromArray(sizeParams);
      }
      const effects =
        scene.lightEffectsByTarget.get(
          referenceKey({
            obj: index,
            component: 'RectangleFakeGlowLightController',
            componentIndex: controllerIndex,
          }),
        ) ?? [];
      materialLights.push({
        materials: targetMaterials,
        bindings: lightBindings(effects, controller.ID),
        intensityMultiplier: controller.AlphaMultiplier,
        minimumAlpha: controller.MinAlpha,
      });
    }
  });
}

export function buildEnvironmentLighting(
  data: EnvironmentData,
  materialContext: EnvironmentMaterialContext,
  scene: EnvironmentSceneBuild,
): EnvironmentLighting {
  const lightSegments: EnvironmentLightSegment[] = [];
  const materialLights: EnvironmentMaterialLight[] = [];
  addBackgroundGradients(data, materialContext, scene, materialLights);
  const parametricTargets = addParametricLights(data, scene, lightSegments, materialLights);
  addRectangleFakeGlowLights(data, scene, materialLights);
  return {
    directionalLights: buildDirectionalLights(data, scene),
    lightSegments,
    materialLights,
    parametricTargets,
  };
}
