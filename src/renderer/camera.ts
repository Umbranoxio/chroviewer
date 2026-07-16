import { Z_OFFSET } from '../core/placement/grid';

export function fixedCameraPosition(distanceFromHitPlane: number): [number, number, number] {
  return [0, 1.7, distanceFromHitPlane - Z_OFFSET];
}
