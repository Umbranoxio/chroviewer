import {
  AddEquation,
  BufferAttribute,
  BufferGeometry,
  ClampToEdgeWrapping,
  Color,
  CustomBlending,
  DataTexture,
  DoubleSide,
  DynamicDrawUsage,
  HalfFloatType,
  LinearFilter,
  Matrix4,
  MaxEquation,
  Mesh,
  OneFactor,
  OrthographicCamera,
  RGBAFormat,
  Scene,
  ShaderMaterial,
  TextureLoader,
  Vector2,
  ZeroFactor,
  type PerspectiveCamera,
  type Texture,
  type WebGLRenderer,
  WebGLRenderTarget,
} from 'three';

import { GAME_FOG_PARAMS, type FogParams } from '../fog-math';
import {
  BLOOMFOG_DOWNSAMPLE_FRAG,
  BLOOMFOG_FINAL_UPSAMPLE_FRAG,
  BLOOMFOG_UPSAMPLE_FRAG,
  CAPTURE_FRAG,
  CAPTURE_VERT,
  FULLSCREEN_VERT,
} from '../shaders/passes';
import {
  BLOOMFOG_CAPTURE_FOV,
  BLOOMFOG_CAPTURE_SIZE,
  BLOOMFOG_LINE_WIDTH,
  bloomfogPyramidLayout,
  bloomfogUpsampleWeights,
} from './blur-math';
import { createLightQuadScratch, writeLightQuad, type LightSegment, type Mat16 } from './light-quads';
import { uint32PrefixEqual } from './output-cache';

export interface FogUniforms {
  _BloomPrePassTexture: { value: Texture };
  _CustomFogTextureToScreenRatio: { value: Vector2 };
  _CustomFogOffset: { value: number };
  _CustomFogAttenuation: { value: number };
  _CustomFogHeightFogStartY: { value: number };
  _CustomFogHeightFogHeight: { value: number };
}

const MASK_X = [
  0, 0, 11, 27, 44, 65, 87, 109, 134, 156, 180, 201, 219, 236, 250, 255, 255, 255, 250, 236, 220, 201, 180, 157, 134,
  110, 87, 64, 44, 27, 11, 0,
];
const maskY = (y: number) => (y === 0 || y === 31 ? 0 : y === 1 ? 134 : y === 30 ? 186 : 255);

function buildAlphaMask() {
  const data = new Uint8Array(32 * 32 * 4);
  for (let y = 0; y < 32; y++) {
    for (let x = 0; x < 32; x++) {
      const index = (y * 32 + x) * 4;
      data[index] = data[index + 1] = data[index + 2] = 255;
      data[index + 3] = Math.round(((MASK_X[x] ?? 0) * maskY(y)) / 255);
    }
  }
  const texture = new DataTexture(data, 32, 32, RGBAFormat);
  texture.minFilter = LinearFilter;
  texture.magFilter = LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

const clamp01 = (value: number) => Math.min(Math.max(value, 0), 1);

function fullscreenTriangle() {
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
  geometry.setAttribute('uv', new BufferAttribute(new Float32Array([0, 0, 2, 0, 0, 2]), 2));
  return geometry;
}

function renderTarget(width: number, height: number) {
  return new WebGLRenderTarget(width, height, {
    type: HalfFloatType,
    format: RGBAFormat,
    minFilter: LinearFilter,
    magFilter: LinearFilter,
    wrapS: ClampToEdgeWrapping,
    wrapT: ClampToEdgeWrapping,
    depthBuffer: false,
  });
}

function passMaterial(fragmentShader: string, uniforms: ShaderMaterial['uniforms']) {
  return new ShaderMaterial({
    vertexShader: FULLSCREEN_VERT,
    fragmentShader,
    uniforms,
    depthTest: false,
    depthWrite: false,
  });
}

const layout = bloomfogPyramidLayout();

export class BloomfogPipeline {
  readonly fogUniforms: FogUniforms;

  private readonly raw = renderTarget(BLOOMFOG_CAPTURE_SIZE, BLOOMFOG_CAPTURE_SIZE);
  private readonly downs = layout.levels.map(({ width, height }) => renderTarget(width, height));
  private readonly ups = layout.levels.map(({ width, height }) => renderTarget(width, height));
  private readonly prepass = renderTarget(BLOOMFOG_CAPTURE_SIZE, BLOOMFOG_CAPTURE_SIZE);

  private readonly captureScene = new Scene();
  private readonly passScene = new Scene();
  private readonly passCamera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private readonly fsMesh: Mesh;
  private readonly captureMesh: Mesh;
  private readonly quadGeometry = new BufferGeometry();
  private alphaMask: Texture = buildAlphaMask();
  private readonly captureUniforms = { _BloomfogAlphaMask: { value: this.alphaMask } };

  private capacity = 0;
  private quadAttributes: BufferAttribute[] = [];
  private positionsArray = new Float32Array(0);
  private viewPosArray = new Float32Array(0);
  private colorsArray = new Float32Array(0);
  private uvsArray = new Float32Array(0);
  private positionsBits = new Uint32Array(0);
  private viewPosBits = new Uint32Array(0);
  private colorsBits = new Uint32Array(0);
  private uvsBits = new Uint32Array(0);
  private nextPositionsArray = new Float32Array(0);
  private nextViewPosArray = new Float32Array(0);
  private nextColorsArray = new Float32Array(0);
  private nextUvsArray = new Float32Array(0);
  private nextPositionsBits = new Uint32Array(0);
  private nextViewPosBits = new Uint32Array(0);
  private nextColorsBits = new Uint32Array(0);
  private nextUvsBits = new Uint32Array(0);

  private readonly addCaptureMaterial: ShaderMaterial;
  private readonly maxCaptureMaterial: ShaderMaterial;
  private readonly downsampleMaterial: ShaderMaterial;
  private readonly upsampleMaterial: ShaderMaterial;
  private readonly finalUpsampleMaterial: ShaderMaterial;
  private readonly downsampleUniforms = {
    _SourceTex: { value: this.raw.texture },
    _SourceTexelSize: { value: new Vector2() },
  };
  private readonly upsampleUniforms = {
    _SourceTex: { value: this.raw.texture },
    _BloomTex: { value: this.raw.texture },
    _SourceTexelSize: { value: new Vector2() },
    _SampleScale: { value: layout.sampleScale },
    _CombineSrc: { value: 1 },
    _CombineDst: { value: 1 },
  };
  private readonly finalUpsampleUniforms = {
    _SourceTex: { value: this.raw.texture },
    _BloomTex: { value: this.raw.texture },
    _SourceTexelSize: { value: new Vector2() },
    _SampleScale: { value: layout.sampleScale },
    _CombineSrc: { value: 1 },
    _CombineDst: { value: 1 },
    _GlobalIntensityTex: { value: this.downs.at(-1)?.texture ?? this.raw.texture },
    _AutoExposureLimit: { value: GAME_FOG_PARAMS.autoExposureLimit },
  };

  private readonly clearColorTmp = new Color();
  private readonly captureProjection = new Matrix4();
  private readonly lightQuadScratch = createLightQuadScratch();
  private cachedRenderer: WebGLRenderer | null = null;
  private cachedQuadCount = -1;
  private cachedAdditiveQuadCount = -1;
  private cachedAutoExposureLimit = Number.NaN;
  private cacheValid = false;
  private disposed = false;

  constructor() {
    new TextureLoader().load(`${import.meta.env.BASE_URL}environments/textures/bloomfog-alpha-mask.png`, (texture) => {
      if (this.disposed) {
        texture.dispose();
        return;
      }
      texture.minFilter = LinearFilter;
      texture.magFilter = LinearFilter;
      const previous = this.alphaMask;
      this.alphaMask = texture;
      this.captureUniforms._BloomfogAlphaMask.value = texture;
      previous.dispose();
      this.invalidate();
    });

    this.fogUniforms = {
      _BloomPrePassTexture: { value: this.prepass.texture },
      _CustomFogTextureToScreenRatio: { value: new Vector2(1, 1) },
      _CustomFogOffset: { value: GAME_FOG_PARAMS.offset },
      _CustomFogAttenuation: { value: GAME_FOG_PARAMS.attenuation },
      _CustomFogHeightFogStartY: { value: GAME_FOG_PARAMS.startY },
      _CustomFogHeightFogHeight: { value: GAME_FOG_PARAMS.height },
    };

    const captureMaterial = (blendEquation: typeof AddEquation | typeof MaxEquation) =>
      new ShaderMaterial({
        vertexShader: CAPTURE_VERT,
        fragmentShader: CAPTURE_FRAG,
        uniforms: this.captureUniforms,
        side: DoubleSide,
        depthTest: false,
        depthWrite: false,
        transparent: true,
        blending: CustomBlending,
        blendEquation,
        blendSrc: OneFactor,
        blendDst: OneFactor,
        blendEquationAlpha: blendEquation,
        blendSrcAlpha: ZeroFactor,
        blendDstAlpha: ZeroFactor,
      });
    this.addCaptureMaterial = captureMaterial(AddEquation);
    this.maxCaptureMaterial = captureMaterial(MaxEquation);
    this.downsampleMaterial = passMaterial(BLOOMFOG_DOWNSAMPLE_FRAG, this.downsampleUniforms);
    this.upsampleMaterial = passMaterial(BLOOMFOG_UPSAMPLE_FRAG, this.upsampleUniforms);
    this.finalUpsampleMaterial = passMaterial(BLOOMFOG_FINAL_UPSAMPLE_FRAG, this.finalUpsampleUniforms);

    this.ensureCapacity(1);
    this.captureMesh = new Mesh(this.quadGeometry, [this.addCaptureMaterial, this.maxCaptureMaterial]);
    this.captureMesh.frustumCulled = false;
    this.captureScene.add(this.captureMesh);

    this.fsMesh = new Mesh(fullscreenTriangle(), this.downsampleMaterial);
    this.fsMesh.frustumCulled = false;
    this.passScene.add(this.fsMesh);
  }

  private ensureCapacity(count: number) {
    let capacity = Math.max(this.capacity, 256);
    while (capacity < count) capacity *= 2;
    if (capacity === this.capacity) return;
    this.quadGeometry.dispose();
    this.capacity = capacity;
    this.positionsArray = new Float32Array(capacity * 12);
    this.viewPosArray = new Float32Array(capacity * 12);
    this.colorsArray = new Float32Array(capacity * 16);
    this.uvsArray = new Float32Array(capacity * 12);
    this.nextPositionsArray = new Float32Array(capacity * 12);
    this.nextViewPosArray = new Float32Array(capacity * 12);
    this.nextColorsArray = new Float32Array(capacity * 16);
    this.nextUvsArray = new Float32Array(capacity * 12);
    this.positionsBits = new Uint32Array(this.positionsArray.buffer);
    this.viewPosBits = new Uint32Array(this.viewPosArray.buffer);
    this.colorsBits = new Uint32Array(this.colorsArray.buffer);
    this.uvsBits = new Uint32Array(this.uvsArray.buffer);
    this.nextPositionsBits = new Uint32Array(this.nextPositionsArray.buffer);
    this.nextViewPosBits = new Uint32Array(this.nextViewPosArray.buffer);
    this.nextColorsBits = new Uint32Array(this.nextColorsArray.buffer);
    this.nextUvsBits = new Uint32Array(this.nextUvsArray.buffer);
    const index = new Uint32Array(capacity * 6);
    for (let i = 0; i < capacity; i++) {
      const vertex = i * 4;
      index.set([vertex, vertex + 1, vertex + 2, vertex + 2, vertex + 3, vertex], i * 6);
    }
    const attributes: [string, Float32Array, number][] = [
      ['position', this.positionsArray, 3],
      ['viewPos', this.viewPosArray, 3],
      ['quadColor', this.colorsArray, 4],
      ['uv3', this.uvsArray, 3],
    ];
    this.quadAttributes = attributes.map(([name, array, itemSize]) => {
      const attribute = new BufferAttribute(array, itemSize);
      attribute.setUsage(DynamicDrawUsage);
      this.quadGeometry.setAttribute(name, attribute);
      return attribute;
    });
    this.quadGeometry.setIndex(new BufferAttribute(index, 1));
    this.quadGeometry.setDrawRange(0, 0);
    this.invalidate();
  }

  private writeQuads(lights: readonly LightSegment[], view: Mat16, projection: Mat16) {
    this.ensureCapacity(lights.length);
    let quadCount = 0;
    let additiveQuadCount = 0;
    for (const blendMode of ['add', 'max'] as const) {
      for (const light of lights) {
        if ((light.blendMode ?? 'max') !== blendMode) continue;
        const written = writeLightQuad(
          light,
          view,
          projection,
          BLOOMFOG_LINE_WIDTH,
          this.nextPositionsArray,
          this.nextViewPosArray,
          this.nextColorsArray,
          this.nextUvsArray,
          quadCount,
          this.lightQuadScratch,
        );
        if (written) quadCount++;
      }
      if (blendMode === 'add') additiveQuadCount = quadCount;
    }
    return { quadCount, additiveQuadCount };
  }

  private outputMatches(quadCount: number, additiveQuadCount: number) {
    if (!this.cacheValid) return false;
    if (quadCount !== this.cachedQuadCount || additiveQuadCount !== this.cachedAdditiveQuadCount) return false;
    if (!Object.is(Math.fround(this.finalUpsampleUniforms._AutoExposureLimit.value), this.cachedAutoExposureLimit)) {
      return false;
    }
    return (
      uint32PrefixEqual(this.positionsBits, this.nextPositionsBits, quadCount * 12) &&
      uint32PrefixEqual(this.viewPosBits, this.nextViewPosBits, quadCount * 12) &&
      uint32PrefixEqual(this.colorsBits, this.nextColorsBits, quadCount * 16) &&
      uint32PrefixEqual(this.uvsBits, this.nextUvsBits, quadCount * 12)
    );
  }

  private uploadQuadOutput(quadCount: number, additiveQuadCount: number) {
    [this.positionsArray, this.nextPositionsArray] = [this.nextPositionsArray, this.positionsArray];
    [this.viewPosArray, this.nextViewPosArray] = [this.nextViewPosArray, this.viewPosArray];
    [this.colorsArray, this.nextColorsArray] = [this.nextColorsArray, this.colorsArray];
    [this.uvsArray, this.nextUvsArray] = [this.nextUvsArray, this.uvsArray];
    [this.positionsBits, this.nextPositionsBits] = [this.nextPositionsBits, this.positionsBits];
    [this.viewPosBits, this.nextViewPosBits] = [this.nextViewPosBits, this.viewPosBits];
    [this.colorsBits, this.nextColorsBits] = [this.nextColorsBits, this.colorsBits];
    [this.uvsBits, this.nextUvsBits] = [this.nextUvsBits, this.uvsBits];
    const arrays = [this.positionsArray, this.viewPosArray, this.colorsArray, this.uvsArray];
    for (const attribute of this.quadAttributes) {
      const array = arrays.shift();
      if (array === undefined) continue;
      attribute.array = array;
      attribute.clearUpdateRanges();
      attribute.addUpdateRange(0, quadCount * 4 * attribute.itemSize);
      attribute.needsUpdate = true;
    }
    this.quadGeometry.setDrawRange(0, quadCount * 6);
    this.quadGeometry.clearGroups();
    if (additiveQuadCount > 0) this.quadGeometry.addGroup(0, additiveQuadCount * 6, 0);
    const maxQuadCount = quadCount - additiveQuadCount;
    if (maxQuadCount > 0) this.quadGeometry.addGroup(additiveQuadCount * 6, maxQuadCount * 6, 1);
  }

  private commitOutput(renderer: WebGLRenderer, quadCount: number, additiveQuadCount: number) {
    this.cachedRenderer = renderer;
    this.cachedQuadCount = quadCount;
    this.cachedAdditiveQuadCount = additiveQuadCount;
    this.cachedAutoExposureLimit = Math.fround(this.finalUpsampleUniforms._AutoExposureLimit.value);
    this.cacheValid = true;
  }

  private clearPrepass(renderer: WebGLRenderer) {
    const previousTarget = renderer.getRenderTarget();
    renderer.getClearColor(this.clearColorTmp);
    const previousClearAlpha = renderer.getClearAlpha();
    renderer.setClearColor(0x000000, 0);
    renderer.setRenderTarget(this.prepass);
    renderer.clear(true, false, false);
    renderer.setRenderTarget(previousTarget);
    renderer.setClearColor(this.clearColorTmp, previousClearAlpha);
  }

  setFogParams(params: FogParams) {
    this.fogUniforms._CustomFogOffset.value = params.offset;
    this.fogUniforms._CustomFogAttenuation.value = params.attenuation;
    this.fogUniforms._CustomFogHeightFogStartY.value = params.startY;
    this.fogUniforms._CustomFogHeightFogHeight.value = params.height;
    this.finalUpsampleUniforms._AutoExposureLimit.value = params.autoExposureLimit;
    this.invalidate();
  }

  invalidate() {
    this.cachedRenderer = null;
    this.cacheValid = false;
  }

  render(renderer: WebGLRenderer, camera: PerspectiveCamera, lights: readonly LightSegment[]) {
    if (renderer !== this.cachedRenderer) this.invalidate();
    camera.updateMatrixWorld();
    const projection = this.captureProjection.copy(camera.projectionMatrix);
    const elements = projection.elements;
    const tanHalf = Math.tan(BLOOMFOG_CAPTURE_FOV * 0.5 * (Math.PI / 180));
    const ratioX = clamp01(1 / (tanHalf * elements[0]));
    const ratioY = clamp01(1 / (tanHalf * elements[5]));
    elements[0] *= ratioX;
    elements[8] *= ratioX;
    elements[5] *= ratioY;
    elements[9] *= ratioY;
    this.fogUniforms._CustomFogTextureToScreenRatio.value.set(ratioX, ratioY);
    const { quadCount, additiveQuadCount } = this.writeQuads(lights, camera.matrixWorldInverse.elements, elements);

    if (this.outputMatches(quadCount, additiveQuadCount)) return;
    if (quadCount === 0) {
      this.clearPrepass(renderer);
      this.commitOutput(renderer, quadCount, additiveQuadCount);
      return;
    }
    this.uploadQuadOutput(quadCount, additiveQuadCount);

    const previousTarget = renderer.getRenderTarget();
    renderer.getClearColor(this.clearColorTmp);
    const previousClearAlpha = renderer.getClearAlpha();
    renderer.setClearColor(0x000000, 0);

    renderer.setRenderTarget(this.raw);
    renderer.render(this.captureScene, this.passCamera);

    this.fsMesh.material = this.downsampleMaterial;
    let source = this.raw;
    for (const target of this.downs) {
      this.downsampleUniforms._SourceTex.value = source.texture;
      this.downsampleUniforms._SourceTexelSize.value.set(1 / source.width, 1 / source.height);
      renderer.setRenderTarget(target);
      renderer.render(this.passScene, this.passCamera);
      source = target;
    }

    const globalIntensity = this.downs.at(-1);
    if (globalIntensity !== undefined) {
      this.finalUpsampleUniforms._GlobalIntensityTex.value = globalIntensity.texture;
    }
    for (let index = this.downs.length - 2; index >= 0; index--) {
      const down = this.downs[index];
      if (down === undefined) continue;
      const target = index === 0 ? this.prepass : this.ups[index];
      if (target === undefined) continue;
      const weights = bloomfogUpsampleWeights(index, this.downs.length);
      const uniforms = index === 0 ? this.finalUpsampleUniforms : this.upsampleUniforms;
      uniforms._SourceTex.value = source.texture;
      uniforms._BloomTex.value = down.texture;
      uniforms._SourceTexelSize.value.set(1 / source.width, 1 / source.height);
      uniforms._CombineSrc.value = weights.currentLevel;
      uniforms._CombineDst.value = weights.upsampled;
      this.fsMesh.material = index === 0 ? this.finalUpsampleMaterial : this.upsampleMaterial;
      renderer.setRenderTarget(target);
      renderer.render(this.passScene, this.passCamera);
      source = target;
    }

    renderer.setRenderTarget(previousTarget);
    renderer.setClearColor(this.clearColorTmp, previousClearAlpha);
    this.commitOutput(renderer, quadCount, additiveQuadCount);
  }

  dispose() {
    this.disposed = true;
    this.raw.dispose();
    for (const target of [...this.downs, ...this.ups]) target.dispose();
    this.prepass.dispose();
    this.addCaptureMaterial.dispose();
    this.maxCaptureMaterial.dispose();
    this.downsampleMaterial.dispose();
    this.upsampleMaterial.dispose();
    this.finalUpsampleMaterial.dispose();
    this.quadGeometry.dispose();
    this.fsMesh.geometry.dispose();
    this.alphaMask.dispose();
  }
}
