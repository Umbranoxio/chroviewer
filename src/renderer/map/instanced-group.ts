import {
  Color,
  DynamicDrawUsage,
  InstancedBufferAttribute,
  InstancedMesh,
  type BufferGeometry,
  type Material,
  type Matrix4,
} from 'three';

import type { Rgb } from '../../core/colors';

type InstanceColor = readonly [number, number, number, number?];
const unitScale: Rgb = [1, 1, 1];
const unitObstacleEdgeScale: readonly [number, number] = [1, 1];

export class InstancedGroup {
  readonly mesh: InstancedMesh;

  private readonly capacity: number;
  private readonly color = new Color();
  private readonly instanceColors: InstancedBufferAttribute;
  private readonly instanceDissolves: InstancedBufferAttribute;
  private readonly instanceCutoutSeeds: InstancedBufferAttribute;
  private readonly instanceColorAlphas: InstancedBufferAttribute;
  private readonly instanceUvScales: InstancedBufferAttribute;
  private readonly instanceObstacleEdgeScales?: InstancedBufferAttribute;
  private cursor = 0;
  private lastRed = Number.NaN;
  private lastGreen = Number.NaN;
  private lastBlue = Number.NaN;
  // converted color rounded to f32 so it compares exactly against the attribute array
  private readonly linear = new Float32Array(3);
  private colorsDirty = false;
  private colorAlphasDirty = false;
  private uvScalesDirty = false;

  constructor(geometry: BufferGeometry, material: Material, capacity: number, hasObstacleFrameData = false) {
    this.capacity = Math.max(capacity, 1);
    this.mesh = new InstancedMesh(geometry, material, this.capacity);
    this.mesh.instanceMatrix.setUsage(DynamicDrawUsage);
    this.instanceColors = new InstancedBufferAttribute(new Float32Array(this.capacity * 3), 3);
    this.instanceColors.setUsage(DynamicDrawUsage);
    this.mesh.instanceColor = this.instanceColors;
    this.instanceDissolves = new InstancedBufferAttribute(new Float32Array(this.capacity).fill(1), 1);
    this.instanceDissolves.setUsage(DynamicDrawUsage);
    this.mesh.geometry.setAttribute('instanceDissolve', this.instanceDissolves);
    this.instanceCutoutSeeds = new InstancedBufferAttribute(new Float32Array(this.capacity), 1);
    this.instanceCutoutSeeds.setUsage(DynamicDrawUsage);
    this.mesh.geometry.setAttribute('instanceCutoutSeed', this.instanceCutoutSeeds);
    this.instanceColorAlphas = new InstancedBufferAttribute(new Float32Array(this.capacity).fill(1), 1);
    this.instanceColorAlphas.setUsage(DynamicDrawUsage);
    this.mesh.geometry.setAttribute('instanceColorAlpha', this.instanceColorAlphas);
    this.instanceUvScales = new InstancedBufferAttribute(new Float32Array(this.capacity * 3).fill(1), 3);
    this.instanceUvScales.setUsage(DynamicDrawUsage);
    this.mesh.geometry.setAttribute('instanceUvScale', this.instanceUvScales);
    if (hasObstacleFrameData) {
      this.instanceObstacleEdgeScales = new InstancedBufferAttribute(new Float32Array(this.capacity * 2).fill(1), 2);
      this.instanceObstacleEdgeScales.setUsage(DynamicDrawUsage);
      this.mesh.geometry.setAttribute('instanceObstacleEdgeScale', this.instanceObstacleEdgeScales);
    }
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
  }

  begin() {
    this.cursor = 0;
  }

  push(
    matrix: Matrix4,
    color: InstanceColor,
    dissolve = 1,
    cutoutSeed = 1,
    uvScale: Rgb = unitScale,
    obstacleEdgeScale: readonly [number, number] = unitObstacleEdgeScale,
  ) {
    if (this.cursor >= this.capacity) return;
    this.mesh.setMatrixAt(this.cursor, matrix);
    if (color[0] !== this.lastRed || color[1] !== this.lastGreen || color[2] !== this.lastBlue) {
      this.color.setRGB(color[0], color[1], color[2]).convertSRGBToLinear();
      this.linear[0] = this.color.r;
      this.linear[1] = this.color.g;
      this.linear[2] = this.color.b;
      this.lastRed = color[0];
      this.lastGreen = color[1];
      this.lastBlue = color[2];
    }
    const colors = this.instanceColors.array;
    const offset = this.cursor * 3;
    if (
      colors[offset] !== this.linear[0] ||
      colors[offset + 1] !== this.linear[1] ||
      colors[offset + 2] !== this.linear[2]
    ) {
      this.mesh.setColorAt(this.cursor, this.color);
      this.colorsDirty = true;
    }
    this.instanceDissolves.setX(this.cursor, dissolve);
    this.instanceCutoutSeeds.setX(this.cursor, cutoutSeed);
    const colorAlpha = Math.fround(color[3] ?? 1);
    if (this.instanceColorAlphas.getX(this.cursor) !== colorAlpha) {
      this.instanceColorAlphas.setX(this.cursor, colorAlpha);
      this.colorAlphasDirty = true;
    }
    const uvScaleX = Math.fround(uvScale[0]);
    const uvScaleY = Math.fround(uvScale[1]);
    const uvScaleZ = Math.fround(uvScale[2]);
    if (
      this.instanceUvScales.getX(this.cursor) !== uvScaleX ||
      this.instanceUvScales.getY(this.cursor) !== uvScaleY ||
      this.instanceUvScales.getZ(this.cursor) !== uvScaleZ
    ) {
      this.instanceUvScales.setXYZ(this.cursor, uvScaleX, uvScaleY, uvScaleZ);
      this.uvScalesDirty = true;
    }
    this.instanceObstacleEdgeScales?.setXY(this.cursor, obstacleEdgeScale[0], obstacleEdgeScale[1]);
    this.cursor++;
  }

  end() {
    this.mesh.count = this.cursor;
    const attribute = this.mesh.instanceMatrix;
    attribute.clearUpdateRanges();
    if (this.cursor > 0) {
      attribute.addUpdateRange(0, this.cursor * 16);
      attribute.needsUpdate = true;
      if (this.colorsDirty) {
        this.instanceColors.clearUpdateRanges();
        this.instanceColors.addUpdateRange(0, this.cursor * 3);
        this.instanceColors.needsUpdate = true;
        this.colorsDirty = false;
      }
      this.instanceDissolves.clearUpdateRanges();
      this.instanceDissolves.addUpdateRange(0, this.cursor);
      this.instanceDissolves.needsUpdate = true;
      this.instanceCutoutSeeds.clearUpdateRanges();
      this.instanceCutoutSeeds.addUpdateRange(0, this.cursor);
      this.instanceCutoutSeeds.needsUpdate = true;
      if (this.instanceObstacleEdgeScales !== undefined) {
        this.instanceObstacleEdgeScales.clearUpdateRanges();
        this.instanceObstacleEdgeScales.addUpdateRange(0, this.cursor * 2);
        this.instanceObstacleEdgeScales.needsUpdate = true;
      }
      if (this.colorAlphasDirty) {
        this.instanceColorAlphas.clearUpdateRanges();
        this.instanceColorAlphas.addUpdateRange(0, this.cursor);
        this.instanceColorAlphas.needsUpdate = true;
        this.colorAlphasDirty = false;
      }
      if (this.uvScalesDirty) {
        this.instanceUvScales.clearUpdateRanges();
        this.instanceUvScales.addUpdateRange(0, this.cursor * 3);
        this.instanceUvScales.needsUpdate = true;
        this.uvScalesDirty = false;
      }
    }
  }

  dispose() {
    this.mesh.geometry.dispose();
    this.mesh.dispose();
  }
}
