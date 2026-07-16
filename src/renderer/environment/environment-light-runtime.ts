import { Vector3, type Object3D } from 'three';

import type { Rgb } from '../../core/colors';
import type { EnvironmentLightBinding, EnvironmentLightSegment } from './environment-runtime';
import type {
  BackgroundGradientControllerData,
  BasicLightEffectData,
  BloomFogControllerData,
  EnvironmentData,
} from './types';

export const lightBindings = (effects: BasicLightEffectData[], lightId: number): EnvironmentLightBinding[] =>
  effects.map((effect) => ({
    eventType: effect.ID,
    offIntensity: effect.OffIntensity,
    lightOnStart: effect.LightOnStart !== 0,
    invertColorScheme: effect.InvertColorScheme !== 0,
    lightId,
    lightIdRemap: effect.LightIdRemapEntries,
  }));

function referencedColor(controller: BloomFogControllerData, data: EnvironmentData): Rgb {
  const boxObject = controller.BoxLight === null ? undefined : data.objects[controller.BoxLight.obj];
  const materialName = boxObject?.materials?.find((name) => name !== null);
  const color = materialName === undefined ? undefined : data.materials[materialName]?.colors._Color;
  const fallback = data.colorScheme.envColorRight;
  return [color?.[0] ?? fallback[0], color?.[1] ?? fallback[1], color?.[2] ?? fallback[2]];
}

export function backgroundGradientTransform(controller: BackgroundGradientControllerData) {
  return (color: Rgb, alpha: number) => {
    const weightedAlpha =
      controller.MixType === 0
        ? Math.sqrt(Math.max(alpha * controller.LightIntensity, 0))
        : alpha * controller.LightIntensity;
    if (controller.MultiplyColorByAlpha === 0) {
      return {
        color,
        alpha: Math.min(weightedAlpha * controller.Intensity, controller.MaxIntensity),
        visible: true,
      };
    }
    const controlled: Rgb = [
      color[0] * weightedAlpha * controller.Intensity,
      color[1] * weightedAlpha * controller.Intensity,
      color[2] * weightedAlpha * controller.Intensity,
    ];
    const grayscale = controlled[0] * 0.299 + controlled[1] * 0.587 + controlled[2] * 0.114;
    const scale = grayscale > controller.MaxIntensity ? controller.MaxIntensity / grayscale : 1;
    const scaled: Rgb = [controlled[0] * scale, controlled[1] * scale, controlled[2] * scale];
    return {
      color: scaled,
      alpha: weightedAlpha * controller.Intensity,
      visible: true,
    };
  };
}

export function lightSegment(
  controller: BloomFogControllerData,
  node: Object3D,
  data: EnvironmentData,
  bindings: BasicLightEffectData[],
): EnvironmentLightSegment {
  const startY = -controller.Length * controller.Center;
  const endY = controller.Length * (1 - controller.Center);
  const start = new Vector3(0, startY, 0).applyMatrix4(node.matrixWorld);
  const end = new Vector3(0, endY, 0).applyMatrix4(node.matrixWorld);
  return {
    start: [start.x, start.y, start.z],
    end: [end.x, end.y, end.z],
    color: referencedColor(controller, data),
    alpha: 1,
    startWidth: controller.StartWidth,
    endWidth: controller.EndWidth,
    startAlpha: controller.StartAlpha,
    endAlpha: controller.EndAlpha,
    widthMultiplier: controller.LightWidthMultiplier,
    intensityMultiplier: controller.BloomFogIntensityMultiplier,
    boostToWhite: controller.BoostToWhite,
    limitAlpha: controller.LimitAlpha !== 0,
    minAlpha: controller.MinAlpha,
    maxAlpha: controller.MaxAlpha,
    blendMode: controller.BlendMode,
    bindings: lightBindings(bindings, controller.ID),
    node,
    localStart: [0, startY, 0],
    localEnd: [0, endY, 0],
    baseLength: controller.Length,
    center: controller.Center,
    multiplyLengthByAlpha: controller.MultiplyLengthByAlpha !== 0,
    alphaToLengthCurve: controller.AlphaToLengthCurve,
    alphaToBloomLengthCurve: controller.AlphaToLengthBloomFogCurve,
  };
}
