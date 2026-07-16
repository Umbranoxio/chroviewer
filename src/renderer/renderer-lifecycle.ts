import { Color, PerspectiveCamera, Scene, WebGLRenderer } from 'three';

import { effectivePixelRatio } from './render-scale';

export interface RenderView {
  render(renderer: WebGLRenderer): void;
  setSize(width: number, height: number): void;
}

export class RendererLifecycle {
  private renderer: WebGLRenderer | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private view: RenderView | null = null;
  private readonly fallbackScene = new Scene();
  private readonly fallbackCamera = new PerspectiveCamera(60, 1, 0.1, 1000);
  private resizeObserver: ResizeObserver | null = null;
  private frameHandle = 0;
  private contextLost = false;
  private renderScale = 1;

  onContextLost?: () => void;
  onContextRestored?: () => void;

  attach(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.fallbackScene.background = new Color(0x000000);

    canvas.addEventListener('webglcontextlost', this.handleContextLost);
    canvas.addEventListener('webglcontextrestored', this.handleContextRestored);

    // scene AA comes from the post pipeline's msaa target; the canvas only receives fullscreen passes
    this.renderer = new WebGLRenderer({
      canvas,
      alpha: false,
      antialias: false,
      premultipliedAlpha: false,
      powerPreference: 'high-performance',
    });
    this.applyPixelRatio();

    this.resizeObserver = new ResizeObserver(() => {
      this.resize();
    });
    this.resizeObserver.observe(canvas.parentElement ?? canvas);
    this.resize();
    this.startLoop();
  }

  setView(view: RenderView | null) {
    this.view = view;
    this.resize();
  }

  setRenderScale(scale: number) {
    this.renderScale = scale;
    this.applyPixelRatio();
    this.resize();
  }

  private applyPixelRatio() {
    this.renderer?.setPixelRatio(effectivePixelRatio(devicePixelRatio, this.renderScale));
  }

  private readonly handleContextLost = (event: Event) => {
    event.preventDefault();
    this.contextLost = true;
    cancelAnimationFrame(this.frameHandle);
    this.onContextLost?.();
  };

  private readonly handleContextRestored = () => {
    this.contextLost = false;
    this.startLoop();
    this.onContextRestored?.();
  };

  private resize() {
    if (!this.renderer || !this.canvas) return;
    const parent = this.canvas.parentElement;
    const width = parent?.clientWidth ?? innerWidth;
    const height = parent?.clientHeight ?? innerHeight;
    this.renderer.setSize(width, height, false);
    this.view?.setSize(width, height);
    this.fallbackCamera.aspect = width / Math.max(height, 1);
    this.fallbackCamera.updateProjectionMatrix();
  }

  private readonly frame = () => {
    if (this.contextLost) return;
    this.frameHandle = requestAnimationFrame(this.frame);
    if (!this.renderer) return;
    if (this.view) this.view.render(this.renderer);
    else this.renderer.render(this.fallbackScene, this.fallbackCamera);
  };

  private startLoop() {
    this.frameHandle = requestAnimationFrame(this.frame);
  }

  dispose() {
    cancelAnimationFrame(this.frameHandle);
    this.resizeObserver?.disconnect();
    this.canvas?.removeEventListener('webglcontextlost', this.handleContextLost);
    this.canvas?.removeEventListener('webglcontextrestored', this.handleContextRestored);
    this.renderer?.dispose();
    this.renderer = null;
    this.canvas = null;
    this.view = null;
  }
}
