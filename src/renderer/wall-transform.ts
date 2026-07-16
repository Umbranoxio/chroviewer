import type { WallInstance } from '../core/placement/map-render-data';

const minimumScale = 1e-4;
const degToRad = Math.PI / 180;

export interface WallTransform {
  position: readonly [number, number, number];
  yawDeg: number;
  outlineScale: readonly [number, number, number];
  coreScale: readonly [number, number, number];
}

export function wallTransform(wall: WallInstance, ahead: number, reveal: number): WallTransform {
  const nominalLength = Math.abs(wall.lengthUnits);
  const length = Math.max(nominalLength, minimumScale);
  const width = Math.max(wall.width * 0.98 * reveal, minimumScale);
  const height = Math.max(wall.height * reveal, minimumScale);
  const centerX = wall.x;
  const centerZ = -ahead - Math.min(wall.lengthUnits, 0) - nominalLength / 2;
  const yawDeg = -wall.rotationDeg;
  const yaw = yawDeg * degToRad;
  const cos = Math.cos(yaw);
  const sin = Math.sin(yaw);

  return {
    position: [centerX * cos + centerZ * sin, wall.y + (wall.height * reveal) / 2, -centerX * sin + centerZ * cos],
    yawDeg,
    outlineScale: [width, height, length],
    coreScale: [
      Math.max((wall.width * 0.98 - 0.01) * reveal, minimumScale),
      Math.max((wall.height - 0.01) * reveal, minimumScale),
      Math.max(length - 0.01, minimumScale),
    ],
  };
}
