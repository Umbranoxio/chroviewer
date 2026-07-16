declare module 'troika-three-text' {
  import { Mesh, type ColorRepresentation } from 'three';

  export class Text extends Mesh {
    text: string;
    font: string | null;
    fontSize: number;
    color: ColorRepresentation;
    fillOpacity: number;
    outlineWidth: number | string;
    outlineColor: ColorRepresentation;
    outlineOpacity: number;
    anchorX: number | string;
    anchorY: number | string;
    textAlign: string;
    maxWidth: number;
    depthOffset: number;
    readonly textRenderInfo: { blockBounds: [number, number, number, number] } | null;
    sync(callback?: () => void): void;
    dispose(): void;
  }
}
