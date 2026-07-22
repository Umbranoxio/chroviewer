import {
  BufferAttribute,
  BufferGeometry,
  ClampToEdgeWrapping,
  Color,
  DataTexture,
  HalfFloatType,
  LinearFilter,
  Mesh,
  NearestFilter,
  OrthographicCamera,
  RepeatWrapping,
  RGBAFormat,
  Scene,
  ShaderMaterial,
  Vector2,
  WebGLRenderTarget,
  type Camera,
  type WebGLRenderer,
} from 'three';

import { AFTER_SCREEN_DISPLACEMENT_LAYER, SCREEN_DISPLACEMENT_LAYER } from '../mirror/planar-mirror';
import { MULTISAMPLE_DEPTH_STENCIL_RESOLVE_OPTIONS } from '../platform';
import { blueNoiseData } from './blue-noise';
import {
  POST_BLOOM_ALPHA_WEIGHTS,
  POST_BLOOM_BASE_COLOR_BOOST,
  POST_BLOOM_BASE_COLOR_BOOST_THRESHOLD,
  POST_BLOOM_INTENSITY,
  POST_BLOOM_SCENE_SAMPLES,
  postBloomLayout,
  postBloomUpsampleWeights,
} from './math';
import {
  POST_BLOOM_COMPOSITE_FRAG,
  POST_BLOOM_DOWNSAMPLE_13_FRAG,
  POST_BLOOM_PREFILTER_13_FRAG,
  POST_BLOOM_UPSAMPLE_TENT_FRAG,
  POST_BLOOM_VERT,
} from './shaders';

function fullscreenTriangle() {
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
  geometry.setAttribute('uv', new BufferAttribute(new Float32Array([0, 0, 2, 0, 0, 2]), 2));
  return geometry;
}

function renderTarget(width: number, height: number, depthBuffer = false) {
  return new WebGLRenderTarget(width, height, {
    type: HalfFloatType,
    format: RGBAFormat,
    minFilter: LinearFilter,
    magFilter: LinearFilter,
    wrapS: ClampToEdgeWrapping,
    wrapT: ClampToEdgeWrapping,
    depthBuffer,
    stencilBuffer: depthBuffer,
    ...MULTISAMPLE_DEPTH_STENCIL_RESOLVE_OPTIONS,
  });
}

function passMaterial(fragmentShader: string, uniforms: ShaderMaterial['uniforms']) {
  return new ShaderMaterial({
    vertexShader: POST_BLOOM_VERT,
    fragmentShader,
    uniforms,
    depthTest: false,
    depthWrite: false,
  });
}

function blueNoiseTexture() {
  const size = 64;
  const texture = new DataTexture(blueNoiseData(size), size, size, RGBAFormat);
  texture.minFilter = NearestFilter;
  texture.magFilter = NearestFilter;
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.needsUpdate = true;
  return texture;
}

export class PostBloomPipeline {
  private readonly sceneTarget = renderTarget(1, 1, true);
  private readonly screenDisplacementTarget = renderTarget(1, 1, true);
  private readonly downs = Array.from({ length: 16 }, () => renderTarget(1, 1));
  private readonly ups = Array.from({ length: 16 }, () => renderTarget(1, 1));
  private readonly noiseTexture = blueNoiseTexture();

  private readonly passScene = new Scene();
  private readonly passCamera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private readonly passMesh: Mesh;
  private readonly drawingBufferSize = new Vector2();
  private readonly clearColor = new Color();
  private layout = postBloomLayout(1, 1);
  private noiseFrame = 0;
  private screenDisplacementEnabled = true;

  readonly screenDisplacementTexture = { value: this.screenDisplacementTarget.texture };

  private readonly prefilterUniforms = {
    _SourceTex: { value: this.sceneTarget.texture },
    _SourceTexelSize: { value: new Vector2() },
    _AlphaWeights: { value: POST_BLOOM_ALPHA_WEIGHTS },
  };
  private readonly downsampleUniforms = {
    _SourceTex: { value: this.sceneTarget.texture },
    _SourceTexelSize: { value: new Vector2() },
  };
  private readonly upsampleUniforms = {
    _SourceTex: { value: this.sceneTarget.texture },
    _BloomTex: { value: this.sceneTarget.texture },
    _SourceTexelSize: { value: new Vector2() },
    _SampleScale: { value: this.layout.sampleScale },
    _CombineSrc: { value: 1 },
    _CombineDst: { value: 1 },
  };
  private readonly compositeUniforms = {
    _SourceTex: { value: this.sceneTarget.texture },
    _BloomTex: { value: this.ups[0]?.texture ?? this.downs[0]?.texture },
    _BlueNoiseTex: { value: this.noiseTexture },
    _SourceTexelSize: { value: new Vector2(1, 1) },
    _BlueNoiseScale: { value: new Vector2(1, 1) },
    _RandomValue: { value: 0 },
    _BloomIntensity: { value: POST_BLOOM_INTENSITY },
    _BaseColorBoost: { value: POST_BLOOM_BASE_COLOR_BOOST },
    _BaseColorBoostThreshold: { value: POST_BLOOM_BASE_COLOR_BOOST_THRESHOLD },
    _Fade: { value: 1 },
  };

  private readonly prefilterMaterial = passMaterial(POST_BLOOM_PREFILTER_13_FRAG, this.prefilterUniforms);
  private readonly downsampleMaterial = passMaterial(POST_BLOOM_DOWNSAMPLE_13_FRAG, this.downsampleUniforms);
  private readonly upsampleMaterial = passMaterial(POST_BLOOM_UPSAMPLE_TENT_FRAG, this.upsampleUniforms);
  private readonly compositeMaterial = passMaterial(POST_BLOOM_COMPOSITE_FRAG, this.compositeUniforms);

  constructor() {
    this.sceneTarget.samples = POST_BLOOM_SCENE_SAMPLES;
    this.passMesh = new Mesh(fullscreenTriangle(), this.prefilterMaterial);
    this.passMesh.frustumCulled = false;
    this.passScene.add(this.passMesh);
    this.setSize(1, 1);
  }

  setSize(width: number, height: number) {
    this.screenDisplacementTarget.setSize(width, height);
    this.layout = postBloomLayout(width, height);
    this.upsampleUniforms._SampleScale.value = this.layout.sampleScale;
    this.layout.levels.forEach((level, index) => {
      this.downs[index]?.setSize(level.width, level.height);
      this.ups[index]?.setSize(level.width, level.height);
    });
  }

  setScreenDisplacementEnabled(enabled: boolean) {
    this.screenDisplacementEnabled = enabled;
  }

  render(renderer: WebGLRenderer, scene: Scene, camera: Camera, displacementActive = true) {
    renderer.getDrawingBufferSize(this.drawingBufferSize);
    const width = Math.max(1, Math.floor(this.drawingBufferSize.x));
    const height = Math.max(1, Math.floor(this.drawingBufferSize.y));
    if (this.sceneTarget.width !== width || this.sceneTarget.height !== height) {
      this.sceneTarget.setSize(width, height);
      this.setSize(width, height);
    }

    const previousTarget = renderer.getRenderTarget();
    const previousAutoClear = renderer.autoClear;
    renderer.getClearColor(this.clearColor);
    const previousClearAlpha = renderer.getClearAlpha();
    renderer.autoClear = false;
    renderer.setClearColor(0x000000, 0);
    if (this.screenDisplacementEnabled && displacementActive) {
      const layerMask = camera.layers.mask;
      camera.layers.disable(SCREEN_DISPLACEMENT_LAYER);
      camera.layers.disable(AFTER_SCREEN_DISPLACEMENT_LAYER);
      renderer.setRenderTarget(this.screenDisplacementTarget);
      renderer.clear(true, true, true);
      renderer.render(scene, camera);
      camera.layers.mask = layerMask;
    }
    renderer.setRenderTarget(this.sceneTarget);
    renderer.clear(true, true, true);
    renderer.render(scene, camera);

    let source = this.sceneTarget;
    for (const [index] of this.layout.levels.entries()) {
      const target = this.downs[index];
      if (target === undefined) continue;
      const uniforms = index === 0 ? this.prefilterUniforms : this.downsampleUniforms;
      uniforms._SourceTex.value = source.texture;
      uniforms._SourceTexelSize.value.set(1 / source.width, 1 / source.height);
      this.passMesh.material = index === 0 ? this.prefilterMaterial : this.downsampleMaterial;
      renderer.setRenderTarget(target);
      renderer.render(this.passScene, this.passCamera);
      source = target;
    }

    let bloomTarget = source;
    for (let index = this.layout.levels.length - 2; index >= 0; index--) {
      const current = this.downs[index];
      const target = this.ups[index];
      if (current === undefined || target === undefined) continue;
      const weights = postBloomUpsampleWeights(index, this.layout.levels.length);
      this.upsampleUniforms._SourceTex.value = source.texture;
      this.upsampleUniforms._BloomTex.value = current.texture;
      this.upsampleUniforms._SourceTexelSize.value.set(1 / source.width, 1 / source.height);
      this.upsampleUniforms._CombineSrc.value = weights.currentLevel;
      this.upsampleUniforms._CombineDst.value = weights.upsampled;
      this.passMesh.material = this.upsampleMaterial;
      renderer.setRenderTarget(target);
      renderer.render(this.passScene, this.passCamera);
      source = target;
      bloomTarget = target;
    }

    this.noiseFrame++;
    this.compositeUniforms._BloomTex.value = bloomTarget.texture;
    this.compositeUniforms._SourceTexelSize.value.set(1 / width, 1 / height);
    this.compositeUniforms._BlueNoiseScale.value.set(width / 64, height / 64);
    this.compositeUniforms._RandomValue.value = (this.noiseFrame * 0.61803398875) % 1;
    this.passMesh.material = this.compositeMaterial;
    renderer.setRenderTarget(previousTarget);
    renderer.setClearColor(this.clearColor, previousClearAlpha);
    renderer.render(this.passScene, this.passCamera);
    renderer.autoClear = previousAutoClear;
  }

  dispose() {
    this.sceneTarget.dispose();
    this.screenDisplacementTarget.dispose();
    for (const target of [...this.downs, ...this.ups]) target.dispose();
    this.noiseTexture.dispose();
    this.prefilterMaterial.dispose();
    this.downsampleMaterial.dispose();
    this.upsampleMaterial.dispose();
    this.compositeMaterial.dispose();
    this.passMesh.geometry.dispose();
  }
}
