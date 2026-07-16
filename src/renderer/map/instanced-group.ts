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

export class InstancedGroup {
  readonly mesh: InstancedMesh;

  private readonly capacity: number;
  private readonly color = new Color();
  private readonly instanceColors: InstancedBufferAttribute;
  private cursor = 0;
  private lastRed = Number.NaN;
  private lastGreen = Number.NaN;
  private lastBlue = Number.NaN;
  // converted color rounded to f32 so it compares exactly against the attribute array
  private readonly linear = new Float32Array(3);
  private colorsDirty = false;

  constructor(geometry: BufferGeometry, material: Material, capacity: number) {
    this.capacity = Math.max(capacity, 1);
    this.mesh = new InstancedMesh(geometry, material, this.capacity);
    this.mesh.instanceMatrix.setUsage(DynamicDrawUsage);
    this.instanceColors = new InstancedBufferAttribute(new Float32Array(this.capacity * 3), 3);
    this.instanceColors.setUsage(DynamicDrawUsage);
    this.mesh.instanceColor = this.instanceColors;
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
  }

  begin() {
    this.cursor = 0;
  }

  push(matrix: Matrix4, color: Rgb) {
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
    }
  }

  dispose() {
    this.mesh.geometry.dispose();
    this.mesh.dispose();
  }
}
