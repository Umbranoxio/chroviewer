import { Matrix4, Quaternion, Vector3 } from 'three';

import { quaternionFromEuler } from '../../core/animation/point-definition';
import type { NoodleWorldRotation } from '../../core/noodle';
import type { NoodleObjectData } from '../../core/noodle-data';
import type { NoodleTransform } from '../../core/noodle-runtime';
import { setNoodleParentMatrix, setNoodleQuaternion } from './noodle-coordinate-space';

interface ObjectPose {
  matrix: Matrix4;
  position: Vector3;
  quaternion: Quaternion;
  scale: Vector3;
}

const noodleUnit = 0.6;

export class NoodleObjectTransform {
  readonly worldCorrection = new Quaternion();

  private readonly parentMatrix = new Matrix4();
  private readonly rotatedObjectParentMatrix = new Matrix4();
  private readonly rotatedObjectMatrix = new Matrix4();
  private readonly basis = new Matrix4();
  private readonly basisInverse = new Matrix4();
  private readonly basePosition = new Vector3();
  private readonly scratchPosition = new Vector3();
  private readonly scratchScale = new Vector3();
  private readonly baseQuaternion = new Quaternion();
  private readonly staticWorldQuaternion = new Quaternion();
  private readonly movementQuaternion = new Quaternion();
  private readonly parentQuaternion = new Quaternion();
  private readonly rotatedObjectParentQuaternion = new Quaternion();
  private readonly worldQuaternion = new Quaternion();

  applyWorldRotation(pose: ObjectPose, rotation: NoodleWorldRotation | undefined) {
    if (rotation === undefined) return;
    this.setWorldQuaternion(rotation);
    pose.position.applyQuaternion(this.worldQuaternion);
    pose.quaternion.premultiply(this.worldQuaternion);
  }

  apply(
    pose: ObjectPose,
    object: NoodleObjectData | undefined,
    transform: NoodleTransform,
    baseX: number,
    baseY: number,
    leftHanded: boolean,
    worldRotation?: NoodleWorldRotation,
    preJumpPosition?: Vector3,
    baseRotationOnChild = false,
  ) {
    this.basePosition.copy(pose.position);
    this.baseQuaternion.copy(pose.quaternion);
    this.staticWorldQuaternion.identity();
    if (worldRotation !== undefined) {
      this.setWorldQuaternion(worldRotation);
      this.staticWorldQuaternion.copy(this.worldQuaternion);
      this.worldQuaternion.invert();
      this.basePosition.applyQuaternion(this.worldQuaternion);
      this.baseQuaternion.premultiply(this.worldQuaternion);
    }

    this.movementQuaternion.copy(this.staticWorldQuaternion);
    if (transform.rotation !== undefined) {
      setNoodleQuaternion(this.worldQuaternion, transform.rotation, leftHanded);
      this.movementQuaternion.multiply(this.worldQuaternion);
    }
    this.worldCorrection.copy(this.movementQuaternion).invert();

    const definite = transform.definitePosition;
    if (definite !== undefined) {
      pose.position.set(
        baseX + definite[0] * noodleUnit * (leftHanded ? -1 : 1),
        baseY + definite[1] * noodleUnit,
        -definite[2] * noodleUnit,
      );
      if (preJumpPosition === undefined) this.basePosition.copy(pose.position);
      else this.basePosition.add(pose.position.sub(preJumpPosition));
    } else if (transform.position !== undefined) {
      this.basePosition.add(
        this.scratchPosition.set(
          transform.position[0] * noodleUnit * (leftHanded ? -1 : 1),
          transform.position[1] * noodleUnit,
          -transform.position[2] * noodleUnit,
        ),
      );
    }

    pose.position.copy(this.basePosition).applyQuaternion(this.movementQuaternion);
    pose.quaternion.copy(this.movementQuaternion);
    if (object?.localRotation !== undefined) {
      setNoodleQuaternion(this.worldQuaternion, object.localRotation, leftHanded);
      pose.quaternion.multiply(this.worldQuaternion);
    }
    if (transform.localRotation !== undefined) {
      setNoodleQuaternion(this.worldQuaternion, transform.localRotation, leftHanded);
      pose.quaternion.multiply(this.worldQuaternion);
    }
    if (!baseRotationOnChild) pose.quaternion.multiply(this.baseQuaternion);
    this.applyScale(pose.scale, object, transform, leftHanded);
    pose.matrix.compose(pose.position, pose.quaternion, pose.scale);
    if (transform.parentMatrix !== undefined) {
      setNoodleParentMatrix(this.parentMatrix, this.basis, this.basisInverse, transform.parentMatrix, leftHanded);
      this.parentMatrix.decompose(this.scratchPosition, this.parentQuaternion, this.scratchScale);
      this.worldCorrection.multiply(this.parentQuaternion.invert());
      pose.matrix.premultiply(this.parentMatrix);
    }
    if (baseRotationOnChild) {
      this.rotatedObjectParentMatrix.copy(pose.matrix);
      this.rotatedObjectParentMatrix.decompose(pose.position, this.rotatedObjectParentQuaternion, pose.scale);
      this.rotatedObjectMatrix.makeRotationFromQuaternion(this.baseQuaternion);
      pose.matrix.multiply(this.rotatedObjectMatrix);
      pose.quaternion.copy(this.rotatedObjectParentQuaternion).multiply(this.baseQuaternion);
      return;
    }
    if (transform.parentMatrix !== undefined) {
      // keep the sheared parent product in matrix; decompose only feeds TRS consumers
      pose.matrix.decompose(pose.position, pose.quaternion, pose.scale);
    }
  }

  applyChildRotation(pose: ObjectPose, worldRotation: Quaternion) {
    this.worldQuaternion.copy(this.rotatedObjectParentQuaternion).invert().multiply(worldRotation);
    this.rotatedObjectMatrix.makeRotationFromQuaternion(this.worldQuaternion);
    pose.matrix.copy(this.rotatedObjectParentMatrix).multiply(this.rotatedObjectMatrix);
  }

  private setWorldQuaternion(rotation: NoodleWorldRotation) {
    const [x, y, z, w] = quaternionFromEuler(rotation);
    this.worldQuaternion.set(-x, -y, z, w);
  }

  private applyScale(
    scale: Vector3,
    object: NoodleObjectData | undefined,
    transform: NoodleTransform,
    leftHanded: boolean,
  ) {
    if (object?.scale !== undefined) {
      this.scratchScale.set(object.scale[0] ?? 1, object.scale[1] ?? 1, object.scale[2] ?? 1);
      scale.multiply(this.scratchScale);
    }
    if (transform.scale !== undefined) {
      this.scratchScale.fromArray(transform.scale);
      if (leftHanded) this.scratchScale.x *= -1;
      scale.multiply(this.scratchScale);
    }
  }
}
