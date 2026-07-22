import type { ChromaEnvironmentData } from '../../core/chroma-environment';
import { buildChromaEnvironmentVariant } from './chroma-environment';
import { CHROMA_MATERIAL_SUPPORT_ID, mergeChromaMaterialPresets } from './chroma-material-assets';
import { loadEnvironmentAssets, type LoadedEnvironmentAssets } from './environment-assets';
import { buildEnvironmentGlsColors } from './environment-gls-color';
import { buildEnvironmentGlsFxGroups } from './environment-gls-fx';
import { buildEnvironmentLighting } from './environment-lighting';
import { buildEnvironmentMotion } from './environment-motion';
import { buildEnvironmentReflections } from './environment-reflections';
import type { LoadedEnvironment } from './environment-runtime';
import { buildEnvironmentScene } from './environment-scene-builder';
import type { EnvironmentMaterialContext } from './materials/material-context';
import type { EnvironmentData } from './types';

export function buildEnvironment(
  data: EnvironmentData,
  materialContext: EnvironmentMaterialContext,
  chromaEnvironment?: ChromaEnvironmentData,
): LoadedEnvironment {
  const variant =
    chromaEnvironment === undefined
      ? {
          data,
          tracks: new Map<string, number[]>(),
          materialTracks: new Map<string, string[]>(),
          fogTracks: new Set<string>(),
          tubeTracks: new Map<string, number[]>(),
          source: undefined,
        }
      : buildChromaEnvironmentVariant(data, chromaEnvironment);
  const scene = buildEnvironmentScene(variant.data, materialContext, chromaEnvironment !== undefined);
  const lighting = buildEnvironmentLighting(variant.data, materialContext, scene);
  const reflections = buildEnvironmentReflections(variant.data, scene, lighting);
  const motion = buildEnvironmentMotion(variant.data, scene.nodes);
  const glsColorGroups = buildEnvironmentGlsColors(variant.data, scene, lighting);
  const glsFxGroups = buildEnvironmentGlsFxGroups(variant.data, scene.objectShaderMaterials, scene.nodes);
  scene.root.traverse((node) => {
    node.updateMatrix();
    node.matrixAutoUpdate = false;
  });
  scene.root.updateMatrixWorld(true);

  return {
    root: scene.root,
    lightSegments: lighting.lightSegments,
    materialLights: lighting.materialLights,
    backgroundGradient: lighting.backgroundGradient,
    rotations: motion.rotations,
    ringGroups: motion.ringGroups,
    glsColorGroups,
    glsRotationGroups: motion.glsRotationGroups,
    glsTranslationGroups: motion.glsTranslationGroups,
    glsFxGroups,
    eventSwitches: scene.eventSwitches,
    boostSwitches: scene.boostSwitches,
    directionalLights: lighting.directionalLights,
    bakedReflectionProbe: materialContext.bakedReflectionProbe,
    data: variant.data,
    chromaEnvironment: variant.source,
    chromaTracks: new Map(
      [...variant.tracks].map(([track, indices]) => [track, indices.flatMap((index) => scene.nodes[index] ?? [])]),
    ),
    chromaMaterialTracks: new Map(
      [...variant.materialTracks].map(([track, names]) => [
        track,
        [
          ...new Set(
            variant.data.objects.flatMap((object, index) =>
              object.materials?.some((name) => name !== null && names.includes(name))
                ? (scene.objectShaderMaterials[index] ?? [])
                : [],
            ),
          ),
        ],
      ]),
    ),
    chromaFogTracks: variant.fogTracks,
    chromaTubeTracks: new Map(
      [...variant.tubeTracks].map(([track, indices]) => [
        track,
        indices.flatMap((index) => {
          const prefix = `${String(index)}:ParametricBloomFogLightController:`;
          const parametric = [...lighting.parametricTargets]
            .filter(([key]) => key.startsWith(prefix))
            .map(([, target]) => target);
          const segments = [...new Set(parametric.flatMap((target) => target.segments))];
          const parametricMaterialLights = parametric.flatMap((target) => target.materialLights);
          const materialLights = [
            ...new Set([
              ...parametricMaterialLights,
              ...lighting.materialLights.filter((light) => light.node === scene.nodes[index]),
            ]),
          ];
          return segments.length === 0 && materialLights.length === 0 ? [] : [{ segments, materialLights }];
        }),
      ]),
    ),
    applyChromaRemoval: scene.applyChromaRemoval,
    enforceChromaRemoval: scene.enforceChromaRemoval,
    applyConstraints: scene.applyConstraints,
    applyReflections: reflections.apply,
    dispose() {
      reflections.dispose();
      for (const geometry of scene.geometries.values()) geometry.dispose();
      for (const material of scene.materialInstances) material.dispose();
    },
  };
}

export async function loadEnvironment(
  id: string,
  materialContext: EnvironmentMaterialContext,
  signal?: AbortSignal,
  chromaEnvironment?: ChromaEnvironmentData,
) {
  const assets = await loadEnvironmentAssets(id, signal);
  let supportAssets: LoadedEnvironmentAssets | undefined;
  try {
    if (chromaEnvironment?.enhancements.some((enhancement) => enhancement.geometry !== undefined)) {
      supportAssets = await loadEnvironmentAssets(CHROMA_MATERIAL_SUPPORT_ID, signal);
    }
    const environment = buildEnvironment(
      supportAssets === undefined ? assets.data : mergeChromaMaterialPresets(assets.data, supportAssets.data),
      {
        ...materialContext,
        textures:
          supportAssets === undefined ? assets.textures : new Map([...assets.textures, ...supportAssets.textures]),
        reflectionProbe: assets.reflectionProbe,
        bakedReflectionProbe: assets.bakedReflectionProbe,
      },
      chromaEnvironment,
    );
    const disposeEnvironment = environment.dispose;
    function dispose() {
      disposeEnvironment();
      assets.dispose();
      supportAssets?.dispose();
    }
    environment.dispose = dispose;
    return environment;
  } catch (error) {
    assets.dispose();
    supportAssets?.dispose();
    throw error;
  }
}
