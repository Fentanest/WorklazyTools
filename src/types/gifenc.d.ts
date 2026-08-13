declare module "gifenc" {
  export type GifPalette = number[][];
  export interface GifFrameOptions {
    palette?: GifPalette;
    delay?: number;
    repeat?: number;
    transparent?: boolean;
    transparentIndex?: number;
  }
  export interface GifEncoderInstance {
    writeFrame(index: Uint8Array, width: number, height: number, options?: GifFrameOptions): void;
    finish(): void;
    bytes(): Uint8Array;
  }
  export function GIFEncoder(options?: { auto?: boolean; initialCapacity?: number }): GifEncoderInstance;
  export function quantize(data: Uint8Array | Uint8ClampedArray, maxColors: number, options?: object): GifPalette;
  export function applyPalette(data: Uint8Array | Uint8ClampedArray, palette: GifPalette, format?: string): Uint8Array;
}

