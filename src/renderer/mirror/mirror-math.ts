// ported from CM MirrorRendererSO.cs + Unity CalculateObliqueMatrix
import { Matrix4, Vector3, Vector4 } from 'three';

export function planeFromPointNormal(point: Vector3, normal: Vector3, result = new Vector4()) {
  return result.set(normal.x, normal.y, normal.z, -point.dot(normal));
}

export function planeDistanceToPoint(plane: Vector4, point: Vector3) {
  return plane.x * point.x + plane.y * point.y + plane.z * point.z + plane.w;
}

export function reflectionMatrix(plane: Vector4, result = new Matrix4()) {
  const { x, y, z, w } = plane;
  return result.set(
    1 - 2 * x * x,
    -2 * x * y,
    -2 * x * z,
    -2 * w * x,
    -2 * y * x,
    1 - 2 * y * y,
    -2 * y * z,
    -2 * w * y,
    -2 * z * x,
    -2 * z * y,
    1 - 2 * z * z,
    -2 * w * z,
    0,
    0,
    0,
    1,
  );
}

export function cameraSpacePlane(
  worldToCamera: Matrix4,
  point: Vector3,
  normal: Vector3,
  result = new Vector4(),
  pointScratch = new Vector3(),
  normalScratch = new Vector3(),
) {
  pointScratch.copy(point).applyMatrix4(worldToCamera);
  normalScratch.copy(normal).transformDirection(worldToCamera);
  return planeFromPointNormal(pointScratch, normalScratch, result);
}

export function obliqueProjection(
  projection: Matrix4,
  clipPlane: Vector4,
  result = new Matrix4(),
  inverseScratch = new Matrix4(),
  qScratch = new Vector4(),
  cScratch = new Vector4(),
) {
  result.copy(projection);
  const q = qScratch
    .set(Math.sign(clipPlane.x), Math.sign(clipPlane.y), 1, 1)
    .applyMatrix4(inverseScratch.copy(projection).invert());
  const c = cScratch.copy(clipPlane).multiplyScalar(2 / clipPlane.dot(q));
  const e = result.elements;
  e[2] = c.x - e[3];
  e[6] = c.y - e[7];
  e[10] = c.z - e[11];
  e[14] = c.w - e[15];
  return result;
}
