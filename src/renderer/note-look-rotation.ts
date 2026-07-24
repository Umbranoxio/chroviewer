import { Matrix4, Quaternion, Vector3 } from 'three';

const clamp01 = (value: number) => Math.min(Math.max(value, 0), 1);
const degToRad = Math.PI / 180;
const xAxis = new Vector3(1, 0, 0);
const yAxis = new Vector3(0, 1, 0);
const zAxis = new Vector3(0, 0, 1);
const defaultRandomRotation: [number, number, number] = [-0.9543871, -0.1183784, 0.2741019];
const randomRotations: [number, number, number][] = [
  defaultRandomRotation,
  [0.7680854, -0.08805521, 0.6342642],
  [-0.6780157, 0.306681, -0.6680131],
  [0.1255014, 0.9398643, 0.3176546],
  [0.365105, -0.3664974, -0.8557909],
  [-0.8790653, -0.06244748, -0.4725934],
  [0.01886305, -0.8065798, 0.5908241],
  [-0.1455435, 0.8901445, 0.4318099],
  [0.07651193, 0.9474725, -0.3105508],
  [0.1306983, -0.2508438, -0.9591639],
];

function roundToInt(value: number) {
  const lower = Math.floor(value);
  const fraction = value - lower;
  if (fraction !== 0.5) return Math.round(value);
  return lower % 2 === 0 ? lower : lower + 1;
}

export class NoteLookRotation {
  private readonly up = new Vector3();
  private readonly forward = new Vector3();
  private readonly right = new Vector3();
  private readonly localZ = new Vector3();
  private readonly adjustedHead = new Vector3();
  private readonly correctedPosition = new Vector3();
  private readonly correctedHead = new Vector3();
  private readonly correctionUp = new Vector3();
  private readonly matrix = new Matrix4();
  private readonly look = new Quaternion();
  private readonly base = new Quaternion();
  private readonly jump = new Quaternion();
  private readonly inverseCorrection = new Quaternion();
  private readonly identity = new Quaternion();
  private readonly middle = new Quaternion();
  private readonly end = new Quaternion();
  private readonly axisRotation = new Quaternion();

  private setUnityEuler(target: Quaternion, x: number, y: number, z: number) {
    target.setFromAxisAngle(yAxis, -y * degToRad);
    target.multiply(this.axisRotation.setFromAxisAngle(xAxis, -x * degToRad));
    target.multiply(this.axisRotation.setFromAxisAngle(zAxis, z * degToRad));
  }

  private setJumpRotation(
    rotation: Quaternion,
    endRotationDeg: number,
    noteTime: number,
    noteEndX: number,
    noteEndY: number,
    jumpProgress: number,
  ) {
    if (jumpProgress <= 0) {
      rotation.identity();
      return;
    }
    const endZ = ((endRotationDeg % 360) + 360) % 360;
    this.setUnityEuler(this.end, 0, 0, endZ);
    const randomIndex = Math.abs(roundToInt(noteTime * 10 + noteEndX * 2 + noteEndY * 2) % randomRotations.length);
    const random = randomRotations[randomIndex] ?? defaultRandomRotation;
    this.setUnityEuler(this.middle, random[0] * 20, random[1] * 20, endZ + random[2] * 20);
    if (jumpProgress < 0.125) {
      rotation.slerpQuaternions(this.identity, this.middle, Math.sin(jumpProgress * Math.PI * 4));
      return;
    }
    rotation.slerpQuaternions(this.middle, this.end, Math.sin((jumpProgress - 0.125) * Math.PI * 2));
  }

  apply(
    rotation: Quaternion,
    previousRotation: Quaternion,
    baseRotation: Quaternion,
    endRotationDeg: number,
    noteTime: number,
    noteEndX: number,
    notePosition: Vector3,
    noteEndY: number,
    headPosition: Vector3,
    worldCorrection: Quaternion,
    jumpProgress: number,
  ) {
    if (jumpProgress >= 0.5) {
      rotation.copy(previousRotation);
      return;
    }

    this.up.set(0, 1, 0).applyQuaternion(previousRotation);
    this.base.copy(baseRotation);
    this.setJumpRotation(this.jump, endRotationDeg, noteTime, noteEndX, noteEndY, jumpProgress);
    rotation.copy(this.base).multiply(this.jump);
    const blend = clamp01(jumpProgress * 2);
    if (blend === 0) return;

    this.correctedPosition.copy(notePosition).applyQuaternion(worldCorrection);
    this.correctedHead.copy(headPosition).applyQuaternion(worldCorrection);
    const verticalOffset = (this.correctedPosition.y - this.correctedHead.y) * 0.8;
    this.correctionUp.set(0, 1, 0).applyQuaternion(this.inverseCorrection.copy(worldCorrection).invert());
    this.adjustedHead.copy(headPosition).addScaledVector(this.correctionUp, verticalOffset);
    this.forward
      .copy(notePosition)
      .sub(this.adjustedHead)
      .normalize()
      .applyQuaternion(worldCorrection)
      .applyQuaternion(this.base);
    this.localZ.copy(this.forward).negate();
    this.right.crossVectors(this.up, this.localZ);
    if (this.right.lengthSq() < 1e-8) return;
    this.right.normalize();
    this.up.crossVectors(this.localZ, this.right).normalize();
    this.look.setFromRotationMatrix(this.matrix.makeBasis(this.right, this.up, this.localZ));

    const sign = rotation.dot(this.look) < 0 ? -1 : 1;
    rotation
      .set(
        rotation.x + (this.look.x * sign - rotation.x) * blend,
        rotation.y + (this.look.y * sign - rotation.y) * blend,
        rotation.z + (this.look.z * sign - rotation.z) * blend,
        rotation.w + (this.look.w * sign - rotation.w) * blend,
      )
      .normalize();
  }
}
