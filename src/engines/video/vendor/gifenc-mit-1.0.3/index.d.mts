export type GifPalette306 = number[][];
export declare function quantize(rgba: Uint8Array | Uint8ClampedArray, maxColors: number): GifPalette306;
export declare function applyPalette(rgba: Uint8Array | Uint8ClampedArray, palette: GifPalette306): Uint8Array;
export declare function GIFEncoder(): {
  writeFrame(indices: Uint8Array, width: number, height: number, options: {
    palette: GifPalette306; delay: number; repeat: number; dispose: number;
  }): void;
  finish(): void;
  bytes(): Uint8Array;
};
