import { BufferAttribute, BufferGeometry, Group } from 'three';

import type { EnvironmentMeshData, EnvironmentObjectData } from './types';

export function createGeometry(data: EnvironmentMeshData) {
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(data.positions), 3));
  if (data.normals !== undefined) {
    geometry.setAttribute('normal', new BufferAttribute(new Float32Array(data.normals), 3));
  } else {
    geometry.computeVertexNormals();
  }
  if (data.uvs !== undefined) {
    geometry.setAttribute('uv', new BufferAttribute(new Float32Array(data.uvs), 2));
  }
  if (data.secondaryUvs !== undefined) {
    geometry.setAttribute('uv1', new BufferAttribute(new Float32Array(data.secondaryUvs), 2));
  }
  if (data.colors !== undefined) {
    const itemSize = data.colors.length / (data.positions.length / 3);
    geometry.setAttribute('color', new BufferAttribute(new Float32Array(data.colors), itemSize));
  }
  geometry.setIndex(data.indices);
  for (const group of data.groups ?? []) {
    geometry.addGroup(group.start, group.count, group.materialIndex);
  }
  geometry.computeBoundingSphere();
  return geometry;
}

export function fullscreenTriangleGeometry() {
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
  return geometry;
}

export function nodeFor(data: EnvironmentObjectData) {
  const node = new Group();
  node.name = data.name;
  node.position.fromArray(data.position);
  node.quaternion.fromArray(data.rotation);
  node.scale.fromArray(data.scale);
  node.visible = data.active;
  return node;
}
