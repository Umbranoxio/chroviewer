import { Color, PerspectiveCamera, Scene, WebGLRenderer } from 'three';

import { nextRenderDeadline } from './render-frame-pacing';
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
  private frameHandle: number | null = null;
  private nextFrameAt = 0;
  private width = -1;
  private height = -1;
  private contextLost = false;
  private renderScale = 1;

  onContextLost?: () => void;
  onContextRestored?: () => void;

  attach(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.fallbackScene.background = new Color(0x000000);

    canvas.addEventListener('webglcontextlost', this.handleContextLost);
    canvas.addEventListener('webglcontextrestored', this.handleContextRestored);
    document.addEventListener('visibilitychange', this.handleVisibilityChange);

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
    if (view === null) return;
    if (this.width >= 0 && this.height >= 0) view.setSize(this.width, this.height);
    else this.resize();
  }

  setRenderScale(scale: number) {
    this.renderScale = scale;
    this.applyPixelRatio();
    this.resize();
  }

  private applyPixelRatio() {
    const renderer = this.renderer;
    if (renderer === null) return;
    const pixelRatio = effectivePixelRatio(devicePixelRatio, this.renderScale);
    if (renderer.getPixelRatio() !== pixelRatio) renderer.setPixelRatio(pixelRatio);
  }

  private readonly handleContextLost = (event: Event) => {
    event.preventDefault();
    this.contextLost = true;
    this.stopLoop();
    this.onContextLost?.();
  };

  private readonly handleContextRestored = () => {
    this.contextLost = false;
    this.startLoop();
    this.onContextRestored?.();
  };

  private readonly handleVisibilityChange = () => {
    if (document.hidden) {
      this.stopLoop();
      return;
    }
    this.applyPixelRatio();
    this.resize();
    this.startLoop();
  };

  private resize() {
    if (!this.renderer || !this.canvas) return;
    const parent = this.canvas.parentElement;
    const width = parent?.clientWidth ?? innerWidth;
    const height = parent?.clientHeight ?? innerHeight;
    if (width === this.width && height === this.height) return;
    this.width = width;
    this.height = height;
    this.renderer.setSize(width, height, false);
    this.view?.setSize(width, height);
    this.fallbackCamera.aspect = width / Math.max(height, 1);
    this.fallbackCamera.updateProjectionMatrix();
  }

  private readonly frame = (timestamp: number) => {
    this.frameHandle = null;
    if (this.contextLost || document.hidden) return;
    this.scheduleFrame();
    if (!this.renderer) return;
    const nextFrameAt = nextRenderDeadline(timestamp, this.nextFrameAt);
    if (nextFrameAt === null) return;
    this.nextFrameAt = nextFrameAt;
    if (this.view) this.view.render(this.renderer);
    else this.renderer.render(this.fallbackScene, this.fallbackCamera);
  };

  private startLoop() {
    this.nextFrameAt = 0;
    this.scheduleFrame();
  }

  private scheduleFrame() {
    if (this.frameHandle !== null || this.contextLost || document.hidden) return;
    this.frameHandle = requestAnimationFrame(this.frame);
  }

  private stopLoop() {
    if (this.frameHandle !== null) cancelAnimationFrame(this.frameHandle);
    this.frameHandle = null;
    this.nextFrameAt = 0;
  }

  dispose() {
    this.stopLoop();
    this.resizeObserver?.disconnect();
    this.canvas?.removeEventListener('webglcontextlost', this.handleContextLost);
    this.canvas?.removeEventListener('webglcontextrestored', this.handleContextRestored);
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    this.renderer?.dispose();
    this.renderer = null;
    this.canvas = null;
    this.view = null;
    this.width = -1;
    this.height = -1;
  }
}
