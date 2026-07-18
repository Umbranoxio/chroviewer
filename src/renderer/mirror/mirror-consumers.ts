import { Mesh, type Camera, type Material, type Object3D } from 'three';

import { environmentMaterialFamily } from '../environment/materials/create-environment-material';

function materialsFor(mesh: Mesh): Material[] {
  return Array.isArray(mesh.material) ? mesh.material : [mesh.material];
}

function visibleInHierarchy(object: Object3D) {
  let current: Object3D | null = object;
  while (current !== null) {
    if (!current.visible) return false;
    current = current.parent;
  }
  return true;
}

function hasMirrorMaterial(mesh: Mesh) {
  return materialsFor(mesh).some((material) => environmentMaterialFamily(material) === 'mirror');
}

function hasVisibleMirrorMaterial(mesh: Mesh) {
  return materialsFor(mesh).some((material) => material.visible && environmentMaterialFamily(material) === 'mirror');
}

export function collectMirrorConsumers(root: Object3D) {
  const consumers: Mesh[] = [];
  root.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    const mesh = object as Mesh;
    if (hasMirrorMaterial(mesh)) consumers.push(mesh);
  });
  return consumers;
}

export function hasVisibleMirrorConsumer(consumers: readonly Mesh[], camera: Camera) {
  return consumers.some(
    (mesh) => camera.layers.test(mesh.layers) && visibleInHierarchy(mesh) && hasVisibleMirrorMaterial(mesh),
  );
}
