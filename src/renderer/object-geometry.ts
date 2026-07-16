import { BoxGeometry, BufferAttribute, BufferGeometry } from 'three';

import type { ArcPathPoint, Vec3 } from '../core/placement/arc-spline';
import { arrowMesh, bombMesh, chainLinkMesh, dotMesh, noteBodyMesh, unpackGeometry } from './note-mesh-data';

export function noteBodyGeometry(): BufferGeometry {
  return unpackGeometry(noteBodyMesh).scale(0.01, 0.01, 0.01);
}

export function arrowGeometry(): BufferGeometry {
  return unpackGeometry(arrowMesh).translate(0, 0.11, 0.25);
}

export function dotGeometry(): BufferGeometry {
  return unpackGeometry(dotMesh).translate(0, 0, 0.25);
}

export function bombGeometry(): BufferGeometry {
  return unpackGeometry(bombMesh);
}

export function chainLinkGeometry(): BufferGeometry {
  return unpackGeometry(chainLinkMesh).scale(0.01, 0.01, 0.01);
}

export function wallCoreGeometry(): BufferGeometry {
  const geometry = new BoxGeometry(1, 1, 1);
  geometry.computeTangents();
  return geometry;
}

export function wallFrameGeometry(): BufferGeometry {
  return new BoxGeometry(1, 1, 1);
}

function cross(a: Vec3, b: Vec3): Vec3 {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

export function arcCrossedStripGeometry(points: ArcPathPoint[]): BufferGeometry {
  const positions = new Float32Array(points.length * 12);
  const normals = new Float32Array(points.length * 12);
  const arcData = new Float32Array(points.length * 12);
  for (let i = 0; i < points.length; i++) {
    const point = points[i];
    if (point === undefined) continue;
    const secondNormal = cross(point.normal, point.tangent);
    positions.set([point.x, point.y, 0, point.x, point.y, 0, point.x, point.y, 0, point.x, point.y, 0], i * 12);
    normals.set(
      [
        point.normal.x,
        point.normal.y,
        point.normal.z,
        point.normal.x,
        point.normal.y,
        point.normal.z,
        secondNormal.x,
        secondNormal.y,
        secondNormal.z,
        secondNormal.x,
        secondNormal.y,
        secondNormal.z,
      ],
      i * 12,
    );
    arcData.set(
      [0, point.pathT, point.zT, 1, point.pathT, point.zT, 0, point.pathT, point.zT, 1, point.pathT, point.zT],
      i * 12,
    );
  }
  const indices: number[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const a = i * 4;
    indices.push(a, a + 4, a + 1, a + 1, a + 4, a + 5, a + 2, a + 6, a + 3, a + 3, a + 6, a + 7);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new BufferAttribute(normals, 3));
  geometry.setAttribute('arcData', new BufferAttribute(arcData, 3));
  geometry.setIndex(indices);
  return geometry;
}
