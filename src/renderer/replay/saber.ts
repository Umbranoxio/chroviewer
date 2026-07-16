import {
  BufferAttribute,
  BufferGeometry,
  ConeGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  Object3D,
  TorusGeometry,
  Vector3,
  type Material,
  type ShaderMaterial,
} from 'three';

const trailSamples = 18;

interface SaberMaterials {
  blade: Material;
  core: Material;
  metal: Material;
  grip: Material;
}

export interface ReplaySaberModel {
  root: Group;
  trailBase: Object3D;
  tip: Object3D;
  geometries: BufferGeometry[];
}

export interface ReplaySaberTrail {
  mesh: Mesh<BufferGeometry, ShaderMaterial>;
  material: ShaderMaterial;
  samples: { base: Vector3; tip: Vector3 }[];
}

function cylinder(radius: number, length: number, segments = 12) {
  const geometry = new CylinderGeometry(radius, radius, length, segments);
  geometry.rotateX(-Math.PI / 2);
  return geometry;
}

function cone(radius: number, length: number) {
  const geometry = new ConeGeometry(radius, length, 12);
  geometry.rotateX(-Math.PI / 2);
  return geometry;
}

export function createReplaySaber(materials: SaberMaterials): ReplaySaberModel {
  const root = new Group();
  const geometries: BufferGeometry[] = [];
  function add(geometry: BufferGeometry, material: Material, z: number) {
    const mesh = new Mesh(geometry, material);
    mesh.position.z = z;
    root.add(mesh);
    geometries.push(geometry);
  }

  add(cone(0.0045, 0.982), materials.blade, -0.54);
  add(cone(0.0018, 0.978), materials.core, -0.54);
  add(new TorusGeometry(0.02, 0.001, 6, 32), materials.blade, -0.048);
  add(cylinder(0.005, 0.089, 16), materials.grip, -0.0025);
  add(new TorusGeometry(0.006, 0.001, 6, 24), materials.blade, -0.038);
  add(new TorusGeometry(0.006, 0.001, 6, 24), materials.blade, 0.05);
  for (const z of [-0.024, -0.01, 0.004, 0.018, 0.032]) {
    add(cylinder(0.0054, 0.0025, 16), materials.metal, z);
  }
  add(cylinder(0.0055, 0.009), materials.metal, 0.0465);

  const trailBase = new Object3D();
  const tip = new Object3D();
  trailBase.position.z = -0.7;
  tip.position.z = -1.031;
  root.add(trailBase, tip);
  return { root, trailBase, tip, geometries };
}

export function createReplaySaberTrail(material: ShaderMaterial): ReplaySaberTrail {
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(trailSamples * 6), 3));
  geometry.setAttribute('trailAlpha', new BufferAttribute(new Float32Array(trailSamples * 2), 1));
  const indices = new Uint16Array((trailSamples - 1) * 6);
  for (let index = 0; index < trailSamples - 1; index++) {
    const offset = index * 6;
    const vertex = index * 2;
    indices.set([vertex, vertex + 1, vertex + 2, vertex + 2, vertex + 1, vertex + 3], offset);
  }
  geometry.setIndex(new BufferAttribute(indices, 1));
  geometry.setDrawRange(0, 0);
  const mesh = new Mesh(geometry, material);
  mesh.frustumCulled = false;
  return { mesh, material, samples: [] };
}

export function clearReplaySaberTrail(trail: ReplaySaberTrail) {
  trail.samples.length = 0;
  trail.mesh.geometry.setDrawRange(0, 0);
}

export function updateReplaySaberTrail(trail: ReplaySaberTrail, base: Vector3, tip: Vector3) {
  const previous = trail.samples.at(-1);
  if (previous !== undefined && previous.tip.distanceToSquared(tip) < 0.000004) return;
  trail.samples.push({ base: base.clone(), tip: tip.clone() });
  if (trail.samples.length > trailSamples) trail.samples.shift();

  const position = trail.mesh.geometry.getAttribute('position');
  const alpha = trail.mesh.geometry.getAttribute('trailAlpha');
  const denominator = Math.max(trail.samples.length - 1, 1);
  trail.samples.forEach((sample, index) => {
    const span = index / denominator;
    const collapse = (1 - span) * 0.5;
    position.setXYZ(
      index * 2,
      sample.base.x + (sample.tip.x - sample.base.x) * collapse,
      sample.base.y + (sample.tip.y - sample.base.y) * collapse,
      sample.base.z + (sample.tip.z - sample.base.z) * collapse,
    );
    position.setXYZ(
      index * 2 + 1,
      sample.tip.x + (sample.base.x - sample.tip.x) * collapse,
      sample.tip.y + (sample.base.y - sample.tip.y) * collapse,
      sample.tip.z + (sample.base.z - sample.tip.z) * collapse,
    );
    const opacity = span ** 1.6;
    alpha.setX(index * 2, opacity);
    alpha.setX(index * 2 + 1, opacity);
  });
  position.needsUpdate = true;
  alpha.needsUpdate = true;
  trail.mesh.geometry.setDrawRange(0, Math.max(trail.samples.length - 1, 0) * 6);
}
