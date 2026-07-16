import { MathUtils, Vector3, type Group, type ShaderMaterial } from 'three';

import { shaderNumberUniform, shaderUniformValue } from '../materials/shared';
import { evaluateAnimationCurve } from './animation-curve';
import {
  componentAt,
  groupEffects,
  referenceKey,
  shaderMaterialsForMpbController,
} from './environment-component-utils';
import type { EnvironmentGlsFxGroup, EnvironmentGlsFxTarget } from './environment-runtime';
import type { EnvironmentData, ObjectReference } from './types';

export function buildEnvironmentGlsFxGroups(
  data: EnvironmentData,
  objectMaterials: ShaderMaterial[][],
  nodes: Group[],
): EnvironmentGlsFxGroup[] {
  function materialFloatTarget(
    controllers: ObjectReference[],
    property: string,
    valueFor: (value: number) => number,
  ): EnvironmentGlsFxTarget {
    const materials = controllers.flatMap((controller) =>
      shaderMaterialsForMpbController(data, objectMaterials, controller),
    );
    const initial = materials.map((material) => shaderNumberUniform(material, property));
    return {
      apply: (value) => {
        const next = valueFor(value);
        materials.forEach((material) => {
          const uniform = material.uniforms[property];
          if (uniform === undefined) {
            material.uniforms[property] = { value: next };
            material.needsUpdate = true;
          } else {
            uniform.value = next;
          }
        });
      },
      reset: () => {
        materials.forEach((material, index) => {
          const value = initial[index];
          if (value !== undefined && material.uniforms[property] !== undefined) {
            material.uniforms[property].value = value;
          }
        });
      },
    };
  }

  function resolveFxTarget(reference: ObjectReference, seen = new Set<string>()): EnvironmentGlsFxTarget[] {
    const key = referenceKey(reference);
    if (seen.has(key) || reference.component === undefined) return [];
    seen.add(key);
    const componentIndex = reference.componentIndex ?? 0;
    if (reference.component === 'MpbFx') {
      const fx = componentAt(data, reference.obj, 'MpbFx', componentIndex);
      if (fx?.enabled !== true) return [];
      return [
        materialFloatTarget([fx.MpbController], fx.PropertyName, (value) =>
          MathUtils.clamp(value * fx.GranularityMultiplier, fx.ValueBounds[0], fx.ValueBounds[1]),
        ),
      ];
    }
    if (reference.component === 'MpbArrayFx') {
      const fx = componentAt(data, reference.obj, 'MpbArrayFx', componentIndex);
      if (fx?.enabled !== true) return [];
      return [
        materialFloatTarget(fx.MpbControllers, fx.PropertyName, (value) =>
          MathUtils.clamp(value * fx.GranularityMultiplier, fx.ValueBounds[0], fx.ValueBounds[1]),
        ),
      ];
    }
    if (reference.component === 'LocalScaleFx') {
      const fx = componentAt(data, reference.obj, 'LocalScaleFx', componentIndex);
      if (fx?.enabled !== true) return [];
      const targets = fx.TargetTransforms.flatMap((reference) => {
        const target = nodes[reference.obj];
        return target === undefined ? [] : [{ target, initialScale: target.scale.clone() }];
      });
      return [
        {
          apply: (value) => {
            targets.forEach(({ target, initialScale }) => {
              target.scale
                .copy(initialScale)
                .multiplyScalar(MathUtils.clamp(value, fx.ValueBounds[0], fx.ValueBounds[1]));
            });
          },
          reset: () => {
            targets.forEach(({ target, initialScale }) => {
              target.scale.copy(initialScale);
            });
          },
        },
      ];
    }
    if (reference.component === 'MoveInDirectionFx') {
      const fx = componentAt(data, reference.obj, 'MoveInDirectionFx', componentIndex);
      if (fx?.enabled !== true) return [];
      const target = nodes[fx.TargetTransform.obj];
      if (target === undefined) return [];
      const initial = target.position.clone();
      const origin = new Vector3(fx.MoveOrigin[0], fx.MoveOrigin[1], -fx.MoveOrigin[2]);
      const direction = initial.clone().sub(origin).normalize();
      return [
        {
          apply: (value) => {
            target.position.copy(initial).addScaledVector(direction, value * fx.MoveScale);
          },
          reset: () => {
            target.position.copy(initial);
          },
        },
      ];
    }
    if (reference.component === 'AlphaFx') {
      const fx = componentAt(data, reference.obj, 'AlphaFx', componentIndex);
      if (fx?.enabled !== true) return [];
      return [materialFloatTarget(fx.MpbControllers, '_ColorMultiplier', (value) => value)];
    }
    if (reference.component === 'SwitchGameObjectFx') {
      const fx = componentAt(data, reference.obj, 'SwitchGameObjectFx', componentIndex);
      if (fx?.enabled !== true) return [];
      const a = nodes[fx.GameObjectA.obj];
      const b = nodes[fx.GameObjectB.obj];
      if (a === undefined || b === undefined) return [];
      const initial: [boolean, boolean] = [a.visible, b.visible];
      return [
        {
          apply: (value) => {
            a.visible = Math.abs(value) < 1e-6;
            b.visible = !a.visible;
          },
          reset: () => {
            a.visible = initial[0];
            b.visible = initial[1];
          },
        },
      ];
    }
    if (reference.component === 'SwitchGameObjectArrayFx') {
      const fx = componentAt(data, reference.obj, 'SwitchGameObjectArrayFx', componentIndex);
      if (fx?.enabled !== true) return [];
      const entries = fx.GameObjects.flatMap((entry) => {
        const target = nodes[entry.GameObject.obj];
        return target === undefined ? [] : [{ threshold: entry.Threshold, target, visible: target.visible }];
      });
      return [
        {
          apply: (value) => {
            let selected = false;
            for (let index = entries.length - 1; index >= 0; index -= 1) {
              const entry = entries[index];
              if (entry === undefined) continue;
              const active = !selected && value >= entry.threshold;
              entry.target.visible = active;
              if (active) selected = true;
            }
          },
          reset: () => {
            entries.forEach((entry) => {
              entry.target.visible = entry.visible;
            });
          },
        },
      ];
    }
    if (reference.component === 'CollectionFx') {
      const fx = componentAt(data, reference.obj, 'CollectionFx', componentIndex);
      if (fx?.enabled !== true) return [];
      return fx.Targets.flatMap((target) => resolveFxTarget(target, new Set(seen)));
    }
    if (reference.component === 'ParametricSliceEndWidthFx') {
      const fx = componentAt(data, reference.obj, 'ParametricSliceEndWidthFx', componentIndex);
      if (fx?.enabled !== true) return [];
      const materials = objectMaterials[fx.SpriteLight.obj] ?? [];
      const targets = materials.flatMap((material) => {
        const alphaWidth = shaderUniformValue(material, '_AlphaWidth');
        return alphaWidth === undefined ? [] : [{ alphaWidth, initial: alphaWidth.w }];
      });
      if (targets.length === 0) return [];
      return [
        {
          apply: (value) => {
            const endWidth = MathUtils.clamp(value * fx.ValueMultiplier, fx.ValueBounds[0], fx.ValueBounds[1]);
            for (const target of targets) target.alphaWidth.w = endWidth;
          },
          reset: () => {
            targets.forEach((target) => {
              target.alphaWidth.w = target.initial;
            });
          },
        },
      ];
    }
    if (reference.component === 'VertexDisplacementFx') {
      const fx = componentAt(data, reference.obj, 'VertexDisplacementFx', componentIndex);
      if (fx?.enabled !== true) return [];
      const materials = objectMaterials[reference.obj] ?? [];
      const initial = new Vector3(
        evaluateAnimationCurve(fx.XCurve, 0) * fx.Ranges[0],
        evaluateAnimationCurve(fx.YCurve, 0) * fx.Ranges[1],
        -evaluateAnimationCurve(fx.ZCurve, 0) * fx.Ranges[2],
      );
      materials.forEach((material) => {
        const displacement = shaderUniformValue(material, '_DisplacementAxisMultiplier');
        if (displacement !== undefined) displacement.copy(initial);
        else material.uniforms._DisplacementAxisMultiplier = { value: initial.clone() };
      });
      return [
        {
          apply: (value) => {
            const displacement = new Vector3(
              evaluateAnimationCurve(fx.XCurve, value) * fx.Ranges[0],
              evaluateAnimationCurve(fx.YCurve, value) * fx.Ranges[1],
              -evaluateAnimationCurve(fx.ZCurve, value) * fx.Ranges[2],
            );
            materials.forEach((material) => {
              const current = shaderUniformValue(material, '_DisplacementAxisMultiplier');
              if (current !== undefined) current.copy(displacement);
              else material.uniforms._DisplacementAxisMultiplier = { value: displacement.clone() };
            });
          },
          reset: () => {
            materials.forEach((material) => {
              const displacement = shaderUniformValue(material, '_DisplacementAxisMultiplier');
              displacement?.copy(initial);
            });
          },
        },
      ];
    }
    return [];
  }

  return groupEffects(data, 'FloatFxGroupEffectManager', 'FloatFxGroupEffect').flatMap(
    ({ groupId, effect }): EnvironmentGlsFxGroup[] =>
      effect.enabled
        ? [
            {
              groupId,
              count: effect.Count,
              trigger: effect.Trigger !== 0,
              entries: effect.fxEntries.map((entry) => ({
                id: entry.ID,
                targets: entry.Targets.flatMap((target) => resolveFxTarget(target)),
              })),
            },
          ]
        : [],
  );
}
