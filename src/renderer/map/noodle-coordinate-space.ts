import type { Matrix4, Quaternion } from 'three';

import type { QuaternionTuple } from '../../core/animation/point-definition';

export function setNoodleQuaternion(target: Quaternion, [x, y, z, w]: QuaternionTuple, leftHanded: boolean) {
  return target.set(-x, leftHanded ? y : -y, leftHanded ? -z : z, w);
}

export function setNoodleParentMatrix(
  target: Matrix4,
  basis: Matrix4,
  basisInverse: Matrix4,
  values: readonly number[],
  leftHanded: boolean,
) {
  basis.makeScale(leftHanded ? -1 : 1, 1, -1);
  basisInverse.copy(basis).invert();
  return target.fromArray(values).premultiply(basis).multiply(basisInverse);
}
