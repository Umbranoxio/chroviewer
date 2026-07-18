import { loadEnvironmentAssets } from './environment-assets';
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
): LoadedEnvironment {
  const scene = buildEnvironmentScene(data, materialContext);
  const lighting = buildEnvironmentLighting(data, materialContext, scene);
  const reflections = buildEnvironmentReflections(data, scene, lighting);
  const motion = buildEnvironmentMotion(data, scene.nodes);
  const glsColorGroups = buildEnvironmentGlsColors(data, scene, lighting);
  const glsFxGroups = buildEnvironmentGlsFxGroups(data, scene.objectShaderMaterials, scene.nodes);
  scene.root.traverse((node) => {
    node.updateMatrix();
    node.matrixAutoUpdate = false;
  });
  scene.root.updateMatrixWorld(true);

  return {
    root: scene.root,
    lightSegments: lighting.lightSegments,
    materialLights: lighting.materialLights,
    rotations: motion.rotations,
    ringGroups: motion.ringGroups,
    glsColorGroups,
    glsRotationGroups: motion.glsRotationGroups,
    glsTranslationGroups: motion.glsTranslationGroups,
    glsFxGroups,
    eventSwitches: scene.eventSwitches,
    boostSwitches: scene.boostSwitches,
    directionalLights: lighting.directionalLights,
    data,
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

export async function loadEnvironment(id: string, materialContext: EnvironmentMaterialContext, signal?: AbortSignal) {
  const assets = await loadEnvironmentAssets(id, signal);
  try {
    const environment = buildEnvironment(assets.data, {
      ...materialContext,
      textures: assets.textures,
      reflectionProbe: assets.reflectionProbe,
    });
    const disposeEnvironment = environment.dispose;
    function dispose() {
      disposeEnvironment();
      assets.dispose();
    }
    environment.dispose = dispose;
    return environment;
  } catch (error) {
    assets.dispose();
    throw error;
  }
}
