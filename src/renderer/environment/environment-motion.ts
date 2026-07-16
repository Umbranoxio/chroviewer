import type { Group } from 'three';

import { groupEffects } from './environment-component-utils';
import type {
  EnvironmentGlsRotationGroup,
  EnvironmentGlsTranslationGroup,
  EnvironmentRingGroup,
  EnvironmentRotation,
} from './environment-runtime';
import type { EnvironmentData } from './types';

export interface EnvironmentMotion {
  rotations: EnvironmentRotation[];
  ringGroups: EnvironmentRingGroup[];
  glsRotationGroups: EnvironmentGlsRotationGroup[];
  glsTranslationGroups: EnvironmentGlsTranslationGroup[];
}

function buildRotations(data: EnvironmentData, nodes: Group[]) {
  const rotations: EnvironmentRotation[] = [];
  data.objects.forEach((object, objectIndex) => {
    object.components?.LightRotation?.forEach((rotation, rotationIndex) => {
      if (!rotation.enabled || rotation.Effect.component !== 'LightRotationEffect') return;
      const effectObject = data.objects[rotation.Effect.obj];
      const effect = effectObject?.components?.LightRotationEffect?.[rotation.Effect.componentIndex ?? 0];
      const target = nodes[rotation.Transform.obj];
      if (effect === undefined || !effect.enabled || target === undefined) return;
      rotations.push({
        target,
        eventType: effect.ID,
        startRotation: rotation.StartRotation,
        axis: rotation.RotationVector,
        speedMultiplier: rotation.SpeedMultiplier,
        seed: objectIndex * 31 + rotationIndex,
      });
    });
    object.components?.LightPairRotation?.forEach((rotation, rotationIndex) => {
      if (!rotation.enabled) return;
      const pairSeed = objectIndex * 31 + rotationIndex;
      rotation.Transforms.slice(0, 2).forEach((container, transformIndex) => {
        const effectReference = transformIndex === 0 ? rotation.LeftEffect : rotation.RightEffect;
        if (effectReference.component !== 'LightRotationEffect') return;
        const effect =
          data.objects[effectReference.obj]?.components?.LightRotationEffect?.[effectReference.componentIndex ?? 0];
        const target = nodes[container.Transform.obj];
        if (effect === undefined || !effect.enabled || target === undefined) return;
        rotations.push({
          target,
          eventType: effect.ID,
          startRotation: target.quaternion.toArray(),
          axis: rotation.RotationVector,
          speedMultiplier: 1,
          seed: pairSeed,
          pair: {
            mirrored: transformIndex === 1,
            startAngle: rotation.StartRotation * (transformIndex === 1 ? -1 : 1),
          },
        });
      });
    });
  });
  return rotations;
}

function buildRingGroups(data: EnvironmentData, nodes: Group[]) {
  const ringGroups: EnvironmentRingGroup[] = [];
  data.objects.forEach((object, objectIndex) => {
    object.components?.TrackLaneRingsManager?.forEach((manager, managerIndex) => {
      if (!manager.enabled) return;
      const rings = manager.Rings.flatMap((reference) => {
        const ring = data.objects[reference.obj]?.components?.TrackLaneRing?.[reference.componentIndex ?? 0];
        const target = nodes[reference.obj];
        return ring === undefined || !ring.enabled || target === undefined
          ? []
          : [{ target, positionOffset: ring.PositionOffset, initialPosition: ring.PositionZ }];
      });
      if (rings.length === 0) return;

      const rotation = data.objects
        .flatMap((candidate, candidateIndex) =>
          (candidate.components?.TrackLaneRingsRotation ?? []).map((component, componentIndex) => ({
            candidateIndex,
            componentIndex,
            component,
          })),
        )
        .find(
          ({ component }) =>
            component.enabled &&
            component.Manager.obj === objectIndex &&
            (component.Manager.componentIndex ?? 0) === managerIndex,
        );
      const rotationEffect =
        rotation === undefined
          ? undefined
          : data.objects
              .flatMap((candidate) => candidate.components?.TrackLaneRingsRotationEffect ?? [])
              .find(
                (effect) =>
                  effect.enabled &&
                  effect.Effect.obj === rotation.candidateIndex &&
                  (effect.Effect.componentIndex ?? 0) === rotation.componentIndex,
              );

      const positionSpawner = data.objects
        .flatMap((candidate) => candidate.components?.TrackLaneRingsPositionSpawner ?? [])
        .find(
          (spawner) =>
            spawner.enabled &&
            spawner.RingManager.obj === objectIndex &&
            (spawner.RingManager.componentIndex ?? 0) === managerIndex,
        );
      const positionEffect =
        positionSpawner === undefined
          ? undefined
          : data.objects[positionSpawner.EffectManager.obj]?.components?.TrackLaneRingsPositionEffect?.[
              positionSpawner.EffectManager.componentIndex ?? 0
            ];

      ringGroups.push({
        rings: rings.map(({ target, positionOffset }) => ({ target, positionOffset })),
        rotationEventType: rotationEffect?.ID,
        rotationConfig:
          rotation === undefined || rotationEffect === undefined
            ? undefined
            : {
                name: object.name,
                ringCount: rings.length,
                startupRotationAngle: rotation.component.StartupRotationAngle,
                startupRotationStep: rotation.component.StartupRotationStep,
                startupPropagationSpeed: rotation.component.StartupRotationPropagationSpeed,
                startupFlexySpeed: rotation.component.StartupRotationFlexySpeed,
                rotationStep: rotation.component.RotationStep,
                counterSpin: rotation.component.CounterSpin !== 0,
                rotation: rotationEffect.Rotation,
                step: rotationEffect.Step,
                stepType: rotationEffect.StepType,
                propagationSpeed: rotationEffect.PropagationSpeed,
                flexySpeed: rotationEffect.FlexySpeed,
              },
        initialRotations: rings.map(() => 0),
        positionEventType: positionEffect?.ID,
        positionConfig:
          positionSpawner === undefined || positionEffect?.enabled !== true
            ? undefined
            : {
                positionOffsets: rings.map(({ positionOffset }) => positionOffset[2]),
                initialPositions: rings.map(({ initialPosition }) => initialPosition),
                minPositionStep: positionSpawner.MinPositionStep,
                maxPositionStep: positionSpawner.MaxPositionStep,
                moveSpeed: positionSpawner.MoveSpeed,
              },
        seed: objectIndex,
      });
    });
  });
  return ringGroups;
}

function buildGlsRotationGroups(data: EnvironmentData, nodes: Group[]) {
  return groupEffects(data, 'LightRotationGroupEffectManager', 'LightRotationGroupEffect').flatMap(
    ({ groupId, effect }): EnvironmentGlsRotationGroup[] =>
      effect.enabled
        ? [
            {
              groupId,
              count: effect.Count,
              entries: effect.transformEntries.map((entry) => ({
                id: entry.ID,
                axis: entry.Axis,
                mirrored: entry.Mirrored !== 0,
                targets: entry.Transforms.flatMap((reference) => nodes[reference.obj] ?? []),
              })),
            },
          ]
        : [],
  );
}

function buildGlsTranslationGroups(data: EnvironmentData, nodes: Group[]) {
  return groupEffects(data, 'LightTranslationGroupEffectManager', 'LightTranslationGroupEffect').flatMap(
    ({ groupId, effect }): EnvironmentGlsTranslationGroup[] =>
      effect.enabled
        ? [
            {
              groupId,
              count: effect.Count,
              translationLimits: effect.TranslationLimits,
              distributionLimits: effect.DistributionLimits,
              entries: effect.transformEntries.map((entry) => ({
                id: entry.ID,
                axis: entry.Axis,
                mirrored: entry.Mirrored !== 0,
                targets: entry.Transforms.flatMap((reference) => nodes[reference.obj] ?? []),
              })),
            },
          ]
        : [],
  );
}

export function buildEnvironmentMotion(data: EnvironmentData, nodes: Group[]): EnvironmentMotion {
  return {
    rotations: buildRotations(data, nodes),
    ringGroups: buildRingGroups(data, nodes),
    glsRotationGroups: buildGlsRotationGroups(data, nodes),
    glsTranslationGroups: buildGlsTranslationGroups(data, nodes),
  };
}
