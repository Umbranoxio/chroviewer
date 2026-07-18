import {
  AddEquation,
  ConstantAlphaFactor,
  CustomBlending,
  Mesh,
  MeshBasicMaterial,
  OneFactor,
  OneMinusSrcAlphaFactor,
  PlaneGeometry,
  RingGeometry,
  SrcAlphaFactor,
  ZeroFactor,
  type ColorRepresentation,
} from 'three';
import { Text } from 'troika-three-text';

import { getBrowserLocale } from '../../../i18n/config';
import { formatDuration, getFormatter } from '../../../i18n/formats';
import { MAIN_ONLY_LAYER } from '../../mirror/planar-mirror';

const tekoFontUrl = `${import.meta.env.BASE_URL}fonts/teko-medium.ttf`;
const hudTextMaterials = new WeakMap<Text, MeshBasicMaterial>();
export const flyingScoreBloomAlpha = 0.55;

export function fixedHudMaterial(opacity = 1, color: ColorRepresentation = 0xffffff) {
  const material = new MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
    depthTest: true,
    depthWrite: false,
  });
  material.blending = CustomBlending;
  material.blendEquation = AddEquation;
  material.blendSrc = SrcAlphaFactor;
  material.blendDst = OneMinusSrcAlphaFactor;
  material.blendEquationAlpha = AddEquation;
  material.blendSrcAlpha = ZeroFactor;
  material.blendDstAlpha = OneFactor;
  return material;
}

export function flyingScoreMaterial(color: ColorRepresentation = 0xffffff, bloomAlpha = flyingScoreBloomAlpha) {
  const material = fixedHudMaterial(1, color);
  if (bloomAlpha === 0) return material;
  material.blendSrcAlpha = ConstantAlphaFactor;
  material.blendDstAlpha = OneMinusSrcAlphaFactor;
  material.blendAlpha = bloomAlpha;
  return material;
}

export function formatScore(score: number) {
  return getFormatter(getBrowserLocale()).number(score, 'integer');
}

export function formatAccuracy(accuracy: number) {
  return getFormatter(getBrowserLocale()).number(accuracy, 'precisePercent');
}

export function rankFor(accuracy: number) {
  if (accuracy >= 0.9) return 'SS';
  if (accuracy >= 0.8) return 'S';
  if (accuracy >= 0.65) return 'A';
  if (accuracy >= 0.5) return 'B';
  if (accuracy >= 0.35) return 'C';
  if (accuracy >= 0.2) return 'D';
  return 'E';
}

export function hudText(
  text: string,
  fontSize: number,
  position: [number, number, number],
  anchorY: 'middle' | 'top' | 'bottom-baseline' = 'middle',
  anchorX: 'center' | 'left' = 'center',
  glow = false,
  bloomAlpha = flyingScoreBloomAlpha,
  sync = true,
) {
  const mesh = new Text();
  const material = glow ? flyingScoreMaterial(0xffffff, bloomAlpha) : fixedHudMaterial();
  mesh.material = material;
  hudTextMaterials.set(mesh, material);
  mesh.text = text;
  mesh.font = tekoFontUrl;
  mesh.fontSize = fontSize;
  mesh.color = 0xffffff;
  mesh.fillOpacity = 1;
  mesh.anchorX = anchorX;
  mesh.anchorY = anchorY;
  mesh.textAlign = 'center';
  mesh.depthOffset = 0;
  mesh.position.set(...position);
  mesh.renderOrder = 1000;
  mesh.frustumCulled = false;
  mesh.layers.set(MAIN_ONLY_LAYER);
  if (sync) mesh.sync();
  return mesh;
}

export function disposeHudText(text: Text) {
  text.dispose();
  hudTextMaterials.get(text)?.dispose();
}

export function italicizeHudText(mesh: Text) {
  const { x, y, z } = mesh.position;
  mesh.matrix.set(1, 0.2, 0, x, 0, 1, 0, y, 0, 0, 1, z, 0, 0, 0, 1);
  mesh.matrixAutoUpdate = false;
}

export function hudShape(
  geometry: PlaneGeometry,
  opacity?: number,
  color?: number,
): Mesh<PlaneGeometry, MeshBasicMaterial>;
export function hudShape(
  geometry: RingGeometry,
  opacity?: number,
  color?: number,
): Mesh<RingGeometry, MeshBasicMaterial>;
export function hudShape(geometry: PlaneGeometry | RingGeometry, opacity = 1, color = 0xffffff) {
  const mesh = new Mesh(geometry, fixedHudMaterial(opacity, color));
  mesh.renderOrder = 1000;
  mesh.layers.set(MAIN_ONLY_LAYER);
  return mesh;
}

export function formatTime(time: number) {
  return formatDuration(time, getBrowserLocale());
}

interface ReplayDurationSource {
  poses: { time: number }[];
  notes: { time: number }[];
  scores: { time: number }[];
  walls: { exitTime: number }[];
}

export function replayDuration(replay: ReplayDurationSource, songDuration: number | null = null) {
  if (songDuration !== null) return songDuration;
  return Math.max(
    replay.poses.at(-1)?.time ?? 0,
    replay.notes.at(-1)?.time ?? 0,
    replay.scores.at(-1)?.time ?? 0,
    replay.walls.at(-1)?.exitTime ?? 0,
  );
}
