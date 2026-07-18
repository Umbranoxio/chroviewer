import {
  BackSide,
  Color,
  DataTexture,
  FrontSide,
  LinearFilter,
  Matrix4,
  Mesh,
  PerspectiveCamera,
  PlaneGeometry,
  RGBAFormat,
  type Material,
  type Scene,
  type Texture,
  Vector3,
  Vector4,
  type WebGLRenderer,
  WebGLRenderTarget,
} from 'three';

import { MULTISAMPLE_DEPTH_STENCIL_RESOLVE_OPTIONS } from '../platform';
import { mirrorTextureSize, type QualitySettings } from '../quality';
import {
  cameraSpacePlane,
  planeDistanceToPoint,
  planeFromPointNormal,
  obliqueProjection,
  reflectionMatrix,
} from './mirror-math';

export const MAIN_ONLY_LAYER = 1;
export const SCREEN_DISPLACEMENT_LAYER = 2;

function blackTexture() {
  const texture = new DataTexture(new Uint8Array([0, 0, 0, 0]), 1, 1, RGBAFormat);
  texture.minFilter = LinearFilter;
  texture.magFilter = LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

export class PlanarMirror {
  readonly mesh: Mesh;
  readonly reflectionTexture: { value: Texture };

  private readonly target: WebGLRenderTarget | null;
  private readonly black = blackTexture();
  private readonly mirrorCamera = new PerspectiveCamera();
  private readonly clearColorTmp = new Color();
  private readonly normal = new Vector3();
  private readonly planePos = new Vector3();
  private readonly camPos = new Vector3();
  private readonly reflection = new Matrix4();
  private readonly plane = new Vector4();
  private readonly clipPlane = new Vector4();
  private readonly pointScratch = new Vector3();
  private readonly normalScratch = new Vector3();
  private readonly inverseProjectionScratch = new Matrix4();
  private readonly qScratch = new Vector4();
  private readonly cScratch = new Vector4();
  private readonly flippedMaterials = new Set<Material>();

  constructor(quality: QualitySettings, width: number, length: number) {
    const size = mirrorTextureSize(quality.mirrorQuality);
    this.target =
      quality.mirrorQuality === 'none'
        ? null
        : new WebGLRenderTarget(size, size, {
            format: RGBAFormat,
            depthBuffer: true,
            stencilBuffer: true,
            samples: quality.mirrorQuality === 'high' ? 2 : 0,
            ...MULTISAMPLE_DEPTH_STENCIL_RESOLVE_OPTIONS,
          });
    this.reflectionTexture = { value: this.target?.texture ?? this.black };
    this.mesh = new Mesh(new PlaneGeometry(width, length));
    this.mesh.rotateX(-Math.PI / 2);
    this.mesh.layers.set(MAIN_ONLY_LAYER);
    this.mirrorCamera.matrixAutoUpdate = false;
    this.mirrorCamera.matrixWorldAutoUpdate = false;
  }

  updateMaterials(scene: Scene) {
    this.flippedMaterials.clear();
    scene.traverse((object) => {
      if (!(object instanceof Mesh)) return;
      const mesh = object as Mesh;
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const entry of materials) {
        if (entry.side === FrontSide || entry.side === BackSide) this.flippedMaterials.add(entry);
      }
    });
  }

  render(renderer: WebGLRenderer, scene: Scene, camera: PerspectiveCamera) {
    if (this.target === null) return;

    this.mesh.updateMatrixWorld();
    this.normal.set(0, 0, 1).transformDirection(this.mesh.matrixWorld);
    this.mesh.getWorldPosition(this.planePos);
    this.planePos.addScaledVector(this.normal, -0.001);
    const plane = planeFromPointNormal(this.planePos, this.normal, this.plane);
    camera.getWorldPosition(this.camPos);
    if (planeDistanceToPoint(plane, this.camPos) <= 0.0001) {
      this.reflectionTexture.value = this.black;
      return;
    }
    this.reflectionTexture.value = this.target.texture;

    const mirror = this.mirrorCamera;
    reflectionMatrix(plane, this.reflection);
    mirror.matrixWorldInverse.multiplyMatrices(camera.matrixWorldInverse, this.reflection);
    mirror.matrixWorld.copy(mirror.matrixWorldInverse).invert();
    const clipPlane = cameraSpacePlane(
      mirror.matrixWorldInverse,
      this.planePos,
      this.normal,
      this.clipPlane,
      this.pointScratch,
      this.normalScratch,
    );
    obliqueProjection(
      camera.projectionMatrix,
      clipPlane,
      mirror.projectionMatrix,
      this.inverseProjectionScratch,
      this.qScratch,
      this.cScratch,
    );
    mirror.projectionMatrixInverse.copy(mirror.projectionMatrix).invert();
    mirror.layers.mask = camera.layers.mask;
    mirror.layers.disable(MAIN_ONLY_LAYER);
    mirror.layers.disable(SCREEN_DISPLACEMENT_LAYER);

    for (const material of this.flippedMaterials) {
      material.side = material.side === FrontSide ? BackSide : FrontSide;
    }

    const prevTarget = renderer.getRenderTarget();
    renderer.getClearColor(this.clearColorTmp);
    const prevClearAlpha = renderer.getClearAlpha();
    renderer.setClearColor(0x000000, 0);
    renderer.setRenderTarget(this.target);
    renderer.render(scene, mirror);
    renderer.setRenderTarget(prevTarget);
    renderer.setClearColor(this.clearColorTmp, prevClearAlpha);

    for (const material of this.flippedMaterials) {
      material.side = material.side === FrontSide ? BackSide : FrontSide;
    }
  }

  dispose() {
    this.target?.dispose();
    this.black.dispose();
    this.mesh.geometry.dispose();
  }
}
