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

import {
  DEFAULT_REPLAY_SABER_SETTINGS,
  DEFAULT_REPLAY_TRAIL_SETTINGS,
  type ReplaySaberSettings,
  type ReplayTrailSettings,
} from '../../core/viewer-settings';

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
  blade: Mesh;
  core: Mesh;
  guard: Mesh;
  grip: Mesh;
  collars: Mesh[];
  rings: Mesh[];
  pommel: Mesh;
}

export interface ReplaySaberTrail {
  mesh: Mesh<BufferGeometry, ShaderMaterial>;
  material: ShaderMaterial;
  samples: { base: Vector3; tip: Vector3 }[];
  settings: ReplayTrailSettings;
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
    return mesh;
  }

  const defaults = DEFAULT_REPLAY_SABER_SETTINGS;
  const blade = add(cone(defaults.saberBladeThickness, defaults.saberBladeLength), materials.blade, 0);
  const core = add(
    cone(defaults.saberCoreThickness, defaults.saberBladeLength - defaults.saberCoreInset),
    materials.core,
    0,
  );
  const guard = add(
    new TorusGeometry(defaults.saberGuardSize, defaults.saberGuardThickness, 6, 32),
    materials.blade,
    0,
  );
  const grip = add(cylinder(defaults.saberGripThickness, defaults.saberGripLength, 16), materials.grip, 0);
  const collars = [
    add(new TorusGeometry(defaults.saberCollarSize, defaults.saberCollarThickness, 6, 24), materials.blade, 0),
    add(new TorusGeometry(defaults.saberCollarSize, defaults.saberCollarThickness, 6, 24), materials.blade, 0),
  ];
  const rings: Mesh[] = [];
  for (let index = 0; index < 5; index++) {
    rings.push(add(cylinder(defaults.saberRingSize, defaults.saberRingThickness, 16), materials.metal, 0));
  }
  const pommel = add(cylinder(defaults.saberPommelThickness, defaults.saberPommelLength), materials.metal, 0);

  const trailBase = new Object3D();
  const tip = new Object3D();
  root.add(trailBase, tip);
  const saber = { root, trailBase, tip, geometries, blade, core, guard, grip, collars, rings, pommel };
  setReplaySaberSettings(saber, defaults);
  return saber;
}

export function setReplaySaberSettings(saber: ReplaySaberModel, settings: ReplaySaberSettings) {
  const bladeBase = 0;
  const bladeLength = settings.saberBladeLength;
  const bladeCenter = bladeBase - bladeLength / 2;
  const coreLength = Math.max(bladeLength - settings.saberCoreInset, 0.01);
  const gripStart = 0.0032;
  const hiltEnd = gripStart + settings.saberGripLength + settings.saberPommelLength;
  saber.root.visible = settings.showSabers;
  saber.root.scale.setScalar(settings.saberScale);

  saber.blade.position.z = bladeCenter;
  saber.blade.scale.set(
    settings.saberBladeThickness / DEFAULT_REPLAY_SABER_SETTINGS.saberBladeThickness,
    settings.saberBladeThickness / DEFAULT_REPLAY_SABER_SETTINGS.saberBladeThickness,
    bladeLength / DEFAULT_REPLAY_SABER_SETTINGS.saberBladeLength,
  );
  saber.core.position.z = bladeCenter;
  saber.core.scale.set(
    settings.saberCoreThickness / DEFAULT_REPLAY_SABER_SETTINGS.saberCoreThickness,
    settings.saberCoreThickness / DEFAULT_REPLAY_SABER_SETTINGS.saberCoreThickness,
    coreLength / (DEFAULT_REPLAY_SABER_SETTINGS.saberBladeLength - DEFAULT_REPLAY_SABER_SETTINGS.saberCoreInset),
  );

  saber.guard.position.z = bladeBase + settings.saberGuardThickness;
  saber.guard.scale.set(
    settings.saberGuardSize / DEFAULT_REPLAY_SABER_SETTINGS.saberGuardSize,
    settings.saberGuardSize / DEFAULT_REPLAY_SABER_SETTINGS.saberGuardSize,
    settings.saberGuardThickness / DEFAULT_REPLAY_SABER_SETTINGS.saberGuardThickness,
  );
  saber.grip.position.z = bladeBase + gripStart + settings.saberGripLength / 2;
  saber.grip.scale.set(
    settings.saberGripThickness / DEFAULT_REPLAY_SABER_SETTINGS.saberGripThickness,
    settings.saberGripThickness / DEFAULT_REPLAY_SABER_SETTINGS.saberGripThickness,
    settings.saberGripLength / DEFAULT_REPLAY_SABER_SETTINGS.saberGripLength,
  );

  saber.collars.forEach((collar, index) => {
    collar.position.z = bladeBase + hiltEnd / 2 + 0.008 + (index === 0 ? -0.5 : 0.5) * settings.saberCollarSpacing;
    collar.scale.set(
      settings.saberCollarSize / DEFAULT_REPLAY_SABER_SETTINGS.saberCollarSize,
      settings.saberCollarSize / DEFAULT_REPLAY_SABER_SETTINGS.saberCollarSize,
      settings.saberCollarThickness / DEFAULT_REPLAY_SABER_SETTINGS.saberCollarThickness,
    );
  });

  saber.rings.forEach((ring, index) => {
    ring.visible = index < settings.saberRingCount;
    ring.position.z =
      bladeBase + hiltEnd * 0.53 + (index - (settings.saberRingCount - 1) / 2) * settings.saberRingSpacing;
    ring.scale.set(
      settings.saberRingSize / DEFAULT_REPLAY_SABER_SETTINGS.saberRingSize,
      settings.saberRingSize / DEFAULT_REPLAY_SABER_SETTINGS.saberRingSize,
      settings.saberRingThickness / DEFAULT_REPLAY_SABER_SETTINGS.saberRingThickness,
    );
  });

  saber.pommel.position.z = bladeBase + gripStart + settings.saberGripLength + settings.saberPommelLength / 2;
  saber.pommel.scale.set(
    settings.saberPommelThickness / DEFAULT_REPLAY_SABER_SETTINGS.saberPommelThickness,
    settings.saberPommelThickness / DEFAULT_REPLAY_SABER_SETTINGS.saberPommelThickness,
    settings.saberPommelLength / DEFAULT_REPLAY_SABER_SETTINGS.saberPommelLength,
  );
  saber.tip.position.z = bladeBase - bladeLength;
  saber.trailBase.position.z = saber.tip.position.z + settings.replayTrailLength;
}

function configureTrailGeometry(trail: ReplaySaberTrail) {
  const trailSamples = trail.settings.replayTrailSamples;
  const geometry = trail.mesh.geometry;
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(trailSamples * 6), 3));
  geometry.setAttribute('trailAlpha', new BufferAttribute(new Float32Array(trailSamples * 2), 1));
  const indices = new Uint16Array((trailSamples - 1) * 6);
  for (let index = 0; index < trailSamples - 1; index++) {
    const offset = index * 6;
    const vertex = index * 2;
    indices.set([vertex, vertex + 1, vertex + 2, vertex + 2, vertex + 1, vertex + 3], offset);
  }
  geometry.setIndex(new BufferAttribute(indices, 1));
}

function writeReplaySaberTrail(trail: ReplaySaberTrail) {
  const position = trail.mesh.geometry.getAttribute('position');
  const alpha = trail.mesh.geometry.getAttribute('trailAlpha');
  const denominator = Math.max(trail.samples.length - 1, 1);
  trail.samples.forEach((sample, index) => {
    const span = index / denominator;
    const shapeCollapse = trail.settings.replayTrailShape === 'flag' ? (1 - span) * 0.5 : 0;
    const collapse = shapeCollapse + (0.5 - shapeCollapse) * trail.settings.replayTrailThinness;
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
    const opacity = span ** trail.settings.replayTrailFade * trail.settings.replayTrailOpacity;
    alpha.setX(index * 2, opacity);
    alpha.setX(index * 2 + 1, opacity);
  });
  position.needsUpdate = true;
  alpha.needsUpdate = true;
  trail.mesh.geometry.setDrawRange(0, Math.max(trail.samples.length - 1, 0) * 6);
}

export function createReplaySaberTrail(
  material: ShaderMaterial,
  settings = DEFAULT_REPLAY_TRAIL_SETTINGS,
): ReplaySaberTrail {
  const geometry = new BufferGeometry();
  geometry.setDrawRange(0, 0);
  const mesh = new Mesh(geometry, material);
  mesh.frustumCulled = false;
  mesh.visible = settings.showSaberTrails;
  const trail = { mesh, material, samples: [], settings: { ...settings } };
  configureTrailGeometry(trail);
  return trail;
}

export function setReplaySaberTrailSettings(trail: ReplaySaberTrail, settings: ReplayTrailSettings) {
  const samplesChanged = settings.replayTrailSamples !== trail.settings.replayTrailSamples;
  trail.settings = { ...settings };
  trail.mesh.visible = settings.showSaberTrails;
  if (trail.samples.length > settings.replayTrailSamples) {
    trail.samples.splice(0, trail.samples.length - settings.replayTrailSamples);
  }
  if (samplesChanged) configureTrailGeometry(trail);
  writeReplaySaberTrail(trail);
}

export function clearReplaySaberTrail(trail: ReplaySaberTrail) {
  trail.samples.length = 0;
  trail.mesh.geometry.setDrawRange(0, 0);
}

export function updateReplaySaberTrail(trail: ReplaySaberTrail, base: Vector3, tip: Vector3) {
  const previous = trail.samples.at(-1);
  const threshold = trail.settings.replayTrailMotionThreshold;
  if (previous !== undefined && previous.tip.distanceToSquared(tip) < threshold * threshold) return;
  trail.samples.push({ base: base.clone(), tip: tip.clone() });
  if (trail.samples.length > trail.settings.replayTrailSamples) trail.samples.shift();
  writeReplaySaberTrail(trail);
}
