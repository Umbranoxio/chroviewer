import { Vector3, type Object3D } from 'three';

import type { EnvironmentData, PositionConstraintData } from './types';

interface EnvironmentPositionConstraint {
  target: Object3D;
  data: PositionConstraintData;
  sources: { target: Object3D; weight: number }[];
}

export function createPositionConstraintApplicator(data: EnvironmentData, nodes: readonly Object3D[]) {
  const positionConstraints: EnvironmentPositionConstraint[] = data.objects.flatMap((object, index) =>
    (object.components?.PositionConstraint ?? []).flatMap((constraint) => {
      const target = nodes[index];
      if (!constraint.enabled || constraint.m_Active === 0 || target === undefined) return [];
      const sources = constraint.m_Sources.flatMap((source) => {
        const sourceTarget = nodes[source.sourceTransform.obj];
        return sourceTarget === undefined ? [] : [{ target: sourceTarget, weight: source.weight }];
      });
      return sources.length === 0 ? [] : [{ target, data: constraint, sources }];
    }),
  );
  const constrainedPosition = new Vector3();
  const sourcePosition = new Vector3();
  const currentPosition = new Vector3();
  const localPosition = new Vector3();

  return () => {
    if (positionConstraints.length === 0) return false;
    for (const constraint of positionConstraints) {
      let sourceWeight = 0;
      constrainedPosition.set(0, 0, 0);
      for (const source of constraint.sources) {
        source.target.getWorldPosition(sourcePosition);
        constrainedPosition.addScaledVector(sourcePosition, source.weight);
        sourceWeight += source.weight;
      }
      if (sourceWeight <= 0) continue;
      constrainedPosition.multiplyScalar(1 / sourceWeight);
      constrainedPosition.add(
        sourcePosition.set(
          constraint.data.m_TranslationOffset[0],
          constraint.data.m_TranslationOffset[1],
          -constraint.data.m_TranslationOffset[2],
        ),
      );
      constraint.target.getWorldPosition(currentPosition);
      constrainedPosition.lerpVectors(currentPosition, constrainedPosition, constraint.data.m_Weight);
      if (constraint.data.m_AffectTranslationX === 0) constrainedPosition.x = currentPosition.x;
      if (constraint.data.m_AffectTranslationY === 0) constrainedPosition.y = currentPosition.y;
      if (constraint.data.m_AffectTranslationZ === 0) constrainedPosition.z = currentPosition.z;
      localPosition.copy(constrainedPosition);
      constraint.target.parent?.worldToLocal(localPosition);
      constraint.target.position.copy(localPosition);
    }
    return true;
  };
}
