/**
 * #273 — bounded, independent animated GIF→GIF operation.
 * gifuct-js supplies decoded frame indices, NOT a composited animation.
 * gifenc supplies the encoder, NOT disposal or transparent-pixel handling.
 * Never use this path for silent still-frame conversion (#212).
 */
import { decompressFrames, parseGIF } from "gifuct-js";
import { GIFEncoder, applyPalette, quantize } from "../video/vendor/gifenc-mit-1.0.3/index.mjs";
import { inspectGifStructure } from "./gif-structure";

export const GIF_ANIMATION_273_LIMITS = {
  inputBytes: 4 * 1024 * 1024,
  outputBytes: 6 * 1024 * 1024,
  frames: 30,
  pixelsPerFrame: 256 * 256,
  totalPixels: 30 * 256 * 256,
  totalCentiseconds: 1000,
} as const;

function refuse(reason: string): never {
  throw new Error(`GIF_273_UNSUPPORTED: ${reason}`);
}

function abort(signal?: AbortSignal): void {
  if (signal?.aborted) throw new DOMException("GIF conversion cancelled", "AbortError");
}

export interface Animation273 {
  readonly blob: Blob;
  readonly width: number;
  readonly height: number;
  readonly frames: number;
  readonly delaysCentiseconds: readonly number[];
  readonly repeat: number | null;
  /** GIF has a single transparent color index; this explicit policy avoids pretending to preserve RGBA. */
  readonly alphaPolicy: "flattened-over-white";
  readonly geometryPolicy: "full-canvas-frames";
  readonly colorPolicy: "exact-if-at-most-128-colors-otherwise-quantized";
}

/** The application extension contains the loop count; null means no loop extension. */
function repeatOf(parsed: ReturnType<typeof parseGIF>): number | null {
  for (const frame of parsed.frames) {
    if (!("application" in frame)) continue;
    const application = frame.application;
    if (application?.id === "NETSCAPE2.0" || application?.id === "ANIMEXTS1.0") {
      const data = application.blocks;
      if (data?.[0] === 1 && data.length === 3) return data[1]! | data[2]! << 8;
      refuse("invalid Netscape loop extension");
    }
  }
  return null;
}

function clearRect(canvas: Uint8ClampedArray, width: number, left: number, top: number, frameWidth: number, frameHeight: number) {
  for (let row = top; row < top + frameHeight; row++) {
    canvas.fill(0, (row * width + left) * 4, (row * width + left + frameWidth) * 4);
  }
}

function initialCanvas(parsed: ReturnType<typeof parseGIF>, transparentIndex: number | undefined): Uint8ClampedArray {
  const { width, height, backgroundColorIndex } = parsed.lsd;
  const canvas = new Uint8ClampedArray(width * height * 4);
  // A transparent background color index means transparent logical-screen pixels;
  // otherwise GIF89a restore-to-background refers to the global palette.
  const color = backgroundColorIndex === transparentIndex ? undefined : parsed.gct?.[backgroundColorIndex];
  if (color) {
    for (let offset = 0; offset < canvas.length; offset += 4) {
      canvas[offset] = color[0];
      canvas[offset + 1] = color[1];
      canvas[offset + 2] = color[2];
      canvas[offset + 3] = 255;
    }
  }
  return canvas;
}

function encodeColors(rgba: Uint8Array): { palette: number[][]; indexed: Uint8Array } {
  const colors = new Map<number, number>();
  const palette: number[][] = [];
  const indexed = new Uint8Array(rgba.length / 4);
  for (let pixel = 0; pixel < indexed.length; pixel++) {
    const offset = pixel * 4;
    const red = rgba[offset]!, green = rgba[offset + 1]!, blue = rgba[offset + 2]!;
    const rgb = (red << 16) | (green << 8) | blue;
    let index = colors.get(rgb);
    if (index === undefined) {
      if (palette.length === 128) {
        const approximate = quantize(rgba, 128);
        return { palette: approximate, indexed: applyPalette(rgba, approximate) };
      }
      index = palette.length;
      colors.set(rgb, index);
      palette.push([red, green, blue]);
    }
    indexed[pixel] = index;
  }
  return { palette, indexed };
}

export async function reencodeAnimatedGif273(source: Blob, signal?: AbortSignal): Promise<Animation273> {
  abort(signal);
  if (!(source instanceof Blob) || source.size < 35 || source.size > GIF_ANIMATION_273_LIMITS.inputBytes) refuse("input byte limit");
  const bytes = new Uint8Array(await source.arrayBuffer());
  abort(signal);
  const facts = inspectGifStructure(bytes);
  const pixels = facts.width * facts.height;
  if (!facts.animated || facts.frameCount < 2 || facts.frameCount > GIF_ANIMATION_273_LIMITS.frames
    || pixels > GIF_ANIMATION_273_LIMITS.pixelsPerFrame
    || pixels * facts.frameCount > GIF_ANIMATION_273_LIMITS.totalPixels
    || facts.totalDelayCentiseconds > GIF_ANIMATION_273_LIMITS.totalCentiseconds
    || facts.frameDelaysCentiseconds.some((delay) => delay < 2)) {
    refuse("requires 2–30 animated frames, 20ms–10s total, ≤256×256 pixels per frame");
  }
  // gifuct-js cannot be trusted to enforce GIF trailer, geometry or delays.
  // The independently bounded structural inspector runs *before* donor decode.
  const parsed = parseGIF(bytes.buffer);
  const repeat = repeatOf(parsed);
  const decoded = decompressFrames(parsed, false);
  if (parsed.lsd.width !== facts.width || parsed.lsd.height !== facts.height || decoded.length !== facts.frameCount) {
    refuse("decoded frame count or canvas differs from verified GIF structure");
  }
  const background = initialCanvas(parsed, decoded[0]?.transparentIndex);
  const composed = background.slice();
  const encoder = GIFEncoder();
  let previous: typeof decoded[number] | undefined;
  let beforePrevious: Uint8ClampedArray | undefined;
  for (let i = 0; i < decoded.length; i++) {
    abort(signal);
    if (previous) {
      if (previous.disposalType === 2) {
        clearRect(composed, facts.width, previous.dims.left, previous.dims.top, previous.dims.width, previous.dims.height);
        for (let row = previous.dims.top; row < previous.dims.top + previous.dims.height; row++) {
          const from = (row * facts.width + previous.dims.left) * 4;
          const to = (row * facts.width + previous.dims.left + previous.dims.width) * 4;
          composed.set(background.subarray(from, to), from);
        }
      } else if (previous.disposalType === 3) {
        if (!beforePrevious) refuse("restore-previous snapshot missing");
        composed.set(beforePrevious);
      }
    }
    const frame = decoded[i]!;
    const { left, top, width, height } = frame.dims;
    if (left < 0 || top < 0 || width < 1 || height < 1 || left + width > facts.width || top + height > facts.height
      || frame.pixels.length !== width * height || !Array.isArray(frame.colorTable)
      || (frame.disposalType ?? 0) !== facts.disposalMethods[i]) refuse("decoded frame geometry, palette or disposal invalid");
    beforePrevious = frame.disposalType === 3 ? composed.slice() : undefined;
    for (let y = 0; y < height; y++) {
      if ((y & 63) === 0) abort(signal);
      for (let x = 0; x < width; x++) {
        const index = frame.pixels[y * width + x]!;
        if (index === frame.transparentIndex) continue;
        const color = frame.colorTable[index];
        if (!color || color.length !== 3) refuse("palette index out of range");
        const destination = ((top + y) * facts.width + left + x) * 4;
        composed[destination] = color[0];
        composed[destination + 1] = color[1];
        composed[destination + 2] = color[2];
        composed[destination + 3] = 255;
      }
    }
    // GIF transparency is index-based. Make loss explicit: matte the whole frame
    // to white, encode an opaque full-canvas frame and keep raw centisecond delays.
    const flattened = new Uint8Array(composed);
    for (let offset = 0; offset < flattened.length; offset += 4) {
      if (flattened[offset + 3] !== 255) {
        flattened[offset] = flattened[offset + 1] = flattened[offset + 2] = 255;
        flattened[offset + 3] = 255;
      }
    }
    const { palette, indexed } = encodeColors(flattened);
    encoder.writeFrame(indexed, facts.width, facts.height, {
      palette, delay: facts.frameDelaysCentiseconds[i]! * 10,
      repeat: repeat ?? -1, dispose: 2,
    });
    previous = frame;
  }
  abort(signal);
  encoder.finish();
  const output = Uint8Array.from(encoder.bytes());
  if (output.length < 35 || output.length > GIF_ANIMATION_273_LIMITS.outputBytes) refuse("output byte limit");
  const proof = inspectGifStructure(output);
  if (proof.frameCount !== facts.frameCount || proof.width !== facts.width || proof.height !== facts.height ||
    proof.frameDelaysCentiseconds.some((delay, i) => delay !== facts.frameDelaysCentiseconds[i])) {
    refuse("output GIF trailer, frame count, geometry or delays differ");
  }
  abort(signal);
  return { blob: new Blob([output], { type: "image/gif" }), width: facts.width, height: facts.height,
    frames: facts.frameCount, delaysCentiseconds: [...facts.frameDelaysCentiseconds],
    repeat, alphaPolicy: "flattened-over-white", geometryPolicy: "full-canvas-frames",
    colorPolicy: "exact-if-at-most-128-colors-otherwise-quantized" };
}
