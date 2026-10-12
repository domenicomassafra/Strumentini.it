import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { inspectGifBlob, inspectGifStructure } from "../src/engines/image/gif-structure";
import { gifFirstFrameToPng212 } from "../src/engines/image/directional-212";

// Original checked-in four-frame GIF, kept unmodified. Tests generate byte
// fixtures in memory, while Python/Pillow independently decodes real GIF pixels.
const animated = () => new Uint8Array(readFileSync(new URL("../spikes/heavy-local-feasibility/public/corpus/sample-animated.gif", import.meta.url)));
const hasPillow = spawnSync("python3", ["-c", "from PIL import Image"], { encoding: "utf8" }).status === 0;

function secondControlOffset(gif: Uint8Array): number {
  const controls: number[] = [];
  for (let i = 0; i < gif.length - 7; i++) {
    if (gif[i] === 0x21 && gif[i + 1] === 0xf9 && gif[i + 2] === 4 && gif[i + 7] === 0) controls.push(i);
  }
  expect(controls.length).toBe(4);
  return controls[1]!;
}

function combine(...arrays: readonly Uint8Array[]): Uint8Array {
  const result = new Uint8Array(arrays.reduce((sum, bytes) => sum + bytes.length, 0));
  let offset = 0;
  for (const bytes of arrays) { result.set(bytes, offset); offset += bytes.length; }
  return result;
}

function pillow(bytes: Uint8Array): { frames?: { pixelsSha256: string; durationMs: number | null }[]; error?: string } {
  const code = `
import sys, json, hashlib
from io import BytesIO
from PIL import Image
try:
    with Image.open(BytesIO(sys.stdin.buffer.read())) as gif:
        frames = []
        for n in range(gif.n_frames):
            gif.seek(n)
            rgba = gif.convert('RGBA').tobytes()
            frames.append({'pixelsSha256': hashlib.sha256(rgba).hexdigest(), 'durationMs': gif.info.get('duration')})
        print(json.dumps({'frames': frames}))
except (OSError, ValueError, EOFError) as exc:
    print(json.dumps({'error': type(exc).__name__ + ': ' + str(exc)}))
`;
  const result = spawnSync("python3", ["-c", code], { input: Buffer.from(bytes), encoding: "utf8", maxBuffer: 64 * 1024 });
  expect(result.status, result.stderr).toBe(0);
  return JSON.parse(result.stdout) as { frames?: { pixelsSha256: string; durationMs: number | null }[]; error?: string };
}

describe("#212 wave22 GIF block semantics and fail-closed animated input", () => {
  it("consumes GCE metadata at a valid plain-text rendering block rather than assigning its timing to the next image", async () => {
    const original = animated();
    const gceAt = secondControlOffset(original);
    // Valid GIF89a plain-text graphic-rendering block: 12-byte grid, ASCII A,
    // bounded by the actual palette of the animated source.
    const textGraphic = Uint8Array.from([
      0x21, 0x01, 0x0c, 0, 0, 0, 0, 2, 0, 2, 0, 1, 1, 1, 0,
      1, 0x41, 0,
    ]);
    const textControl = Uint8Array.from([0x21, 0xf9, 4, 0x09, 73, 0, 0, 0]);
    const gif = combine(original.subarray(0, gceAt), textControl, textGraphic, original.subarray(gceAt + 8));
    if (hasPillow) {
      const decoded = pillow(gif);
      const baseline = pillow(original);
      expect(decoded.error).toBeUndefined();
      expect(decoded.frames).toHaveLength(4);
      // Image bytes and frame-zero pixels stay exactly decodable; the text
      // block may render differently in independent players and is not exported.
      expect(decoded.frames?.[0]?.pixelsSha256).toBe(baseline.frames?.[0]?.pixelsSha256);
    }

    const facts = inspectGifStructure(gif);
    expect(facts.frameCount).toBe(4);
    // GIF89a §12/23/25: Graphic Control is scoped to the next graphic-
    // rendering block, which includes plain text, not the next image only.
    expect(facts.frameDelaysCentiseconds).toEqual([25, 0, 25, 25]);
    expect(facts.disposalMethods).toEqual([1, 0, 1, 1]);
    expect(facts.transparentFrameCount).toBe(2);
    const still = await gifFirstFrameToPng212(new Blob([new Uint8Array(gif)]), { allowAnimationLoss: true });
    expect(still.frameDelaysCentiseconds).toEqual([25, 0, 25, 25]);
    expect(still.animationDiscarded).toBe(true);
    expect([...still.png.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
    if (hasPillow) {
      const output = pillow(still.png);
      expect(output.error).toBeUndefined();
      expect(output.frames?.[0]?.pixelsSha256).toBe(pillow(original).frames?.[0]?.pixelsSha256);
    }
  });

  it("retains a pending graphic control across a comment extension, unlike a plain-text extension", () => {
    const original = animated();
    const afterGce = secondControlOffset(original) + 8;
    const comment = Uint8Array.from([0x21, 0xfe, 3, 65, 66, 67, 0]);
    const gif = combine(original.subarray(0, afterGce), comment, original.subarray(afterGce));
    if (hasPillow) {
      const decoded = pillow(gif);
      expect(decoded.error).toBeUndefined();
      expect(decoded.frames?.map((frame) => frame.durationMs)).toEqual([250, 250, 250, 250]);
    }
    expect(inspectGifStructure(gif).frameDelaysCentiseconds).toEqual([25, 25, 25, 25]);
  });

  it("refuses a later animation frame with zero compressed pixel bytes before reporting a supported animated source", async () => {
    const original = animated();
    const imageAt = secondControlOffset(original) + 8;
    expect(original[imageAt]).toBe(0x2c);
    expect(original[imageAt + 9]).toBe(0); // No local palette; this is a simple full frame.
    const lzwAt = imageAt + 10;
    expect(original[lzwAt]).toBe(8); // GIF LZW minimum code size.
    let blockAt = lzwAt + 1;
    while (original[blockAt] !== 0) blockAt += 1 + original[blockAt]!;
    const gif = combine(original.subarray(0, lzwAt + 1), Uint8Array.of(0), original.subarray(blockAt + 1));
    // Header, frame descriptors and trailer are present, but the second image
    // has no possible LZW clear/end codes; Pillow refuses to decode frame 2.
    if (hasPillow) expect(pillow(gif).error).toMatch(/broken data stream|truncated/i);
    expect(() => inspectGifStructure(gif)).toThrow(/INVALID_GIF/);
    await expect(gifFirstFrameToPng212(new Blob([new Uint8Array(gif)]), { allowAnimationLoss: true }))
      .rejects.toThrow(/INVALID_GIF/);
  });

  it("does not claim defined disposal semantics for reserved GIF89a values 4–7", () => {
    const original = animated();
    for (let reserved = 4; reserved <= 7; reserved++) {
      const gif = original.slice();
      const gceAt = secondControlOffset(gif);
      gif[gceAt + 3] = (gif[gceAt + 3]! & ~0x1c) | (reserved << 2);
      // Pillow accepts this as an image, although GIF89a reserves the method.
      if (hasPillow) expect(pillow(gif).frames).toHaveLength(4);
      expect(() => inspectGifStructure(gif)).toThrow(/INVALID_GIF/);
    }
  });

  it("does not read aborted blobs or reject ordinary local GIF frames", async () => {
    const original = animated();
    expect(inspectGifStructure(original).frameCount).toBe(4);
    const aborter = new AbortController();
    aborter.abort();
    await expect(inspectGifBlob(new Blob([new Uint8Array(original)]), aborter.signal))
      .rejects.toMatchObject({ name: "AbortError" });
  });
});
