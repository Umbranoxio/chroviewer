import { Matrix4, Object3D, Quaternion, Vector3 } from 'three';

import type { NoodleTransform } from '../../core/noodle-runtime';
import { setNoodleParentMatrix, setNoodleQuaternion } from './noodle-coordinate-space';

export class NoodlePlayerTransform {
  private readonly position = new Vector3();
  private readonly rotation = new Quaternion();
  private readonly parentRotation = new Quaternion();
  private readonly matrix = new Matrix4();
  private readonly basis = new Matrix4();
  private readonly basisInverse = new Matrix4();

  apply(target: Object3D, transform: NoodleTransform, leftHanded: boolean) {
    if (transform.absolute === true) {
      this.applyAbsolute(target, transform, leftHanded);
      return;
    }

    if (transform.position !== undefined) {
      target.position.add(
        this.position.set(
          transform.position[0] * 0.6 * (leftHanded ? -1 : 1),
          transform.position[1] * 0.6,
          -transform.position[2] * 0.6,
        ),
      );
    }
    if (transform.rotation !== undefined) {
      setNoodleQuaternion(this.rotation, transform.rotation, leftHanded);
      target.position.applyQuaternion(this.rotation);
      target.quaternion.premultiply(this.rotation);
    }
    if (transform.localRotation !== undefined) {
      setNoodleQuaternion(this.rotation, transform.localRotation, leftHanded);
      target.quaternion.multiply(this.rotation);
    }
    if (transform.scale !== undefined) target.scale.multiply(this.position.fromArray(transform.scale));
    this.applyParent(target, transform.parentMatrix, leftHanded);
  }

  private applyAbsolute(target: Object3D, transform: NoodleTransform, leftHanded: boolean) {
    if (transform.localPosition !== undefined) {
      const [x, y, z] = transform.localPosition;
      target.position.set(x * (leftHanded ? -1 : 1), y, -z);
    }
    if (transform.localRotation !== undefined) {
      setNoodleQuaternion(this.rotation, transform.localRotation, leftHanded);
      target.quaternion.copy(this.rotation);
    }
    if (transform.scale !== undefined) target.scale.fromArray(transform.scale);
    this.applyParent(target, transform.parentMatrix, leftHanded);
    if (transform.localPosition === undefined && transform.position !== undefined) {
      const [x, y, z] = transform.position;
      this.position.set(x * (leftHanded ? -1 : 1), y, -z);
      target.parent?.worldToLocal(this.position);
      target.position.copy(this.position);
    }
    if (transform.localRotation === undefined && transform.rotation !== undefined) {
      setNoodleQuaternion(this.rotation, transform.rotation, leftHanded);
      if (target.parent !== null) {
        target.parent.getWorldQuaternion(this.parentRotation).invert();
        this.rotation.premultiply(this.parentRotation);
      }
      target.quaternion.copy(this.rotation);
    }
  }

  private applyParent(target: Object3D, matrix: readonly number[] | undefined, leftHanded: boolean) {
    if (matrix === undefined) return;
    setNoodleParentMatrix(this.matrix, this.basis, this.basisInverse, matrix, leftHanded);
    target.updateMatrix();
    target.matrix.premultiply(this.matrix);
    target.matrix.decompose(target.position, target.quaternion, target.scale);
  }
}
