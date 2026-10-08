import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { inspectGifStructure } from "../src/engines/image/gif-structure";

const still = () => new Uint8Array(readFileSync(new URL("../quality/fixtures/image-format-matrix/source.gif", import.meta.url)));
const animated = () => new Uint8Array(readFileSync(new URL("../spikes/heavy-local-feasibility/public/corpus/sample-animated.gif", import.meta.url)));

describe("#212 GIF inspection for explicit first-frame conversion", () => {
  it("distinguishes a transparent still GIF from an animated GIF with actual centisecond delays", () => {
    expect(inspectGifStructure(still())).toEqual({
      width: 2, height: 2, frameCount: 1, animated: false,
      frameDelaysCentiseconds: [0], totalDelayCentiseconds: 0,
      transparentFrameCount: 1, disposalMethods: [2],
    });
    expect(inspectGifStructure(animated())).toEqual({
      width: 64, height: 64, frameCount: 4, animated: true,
      frameDelaysCentiseconds: [25, 25, 25, 25], totalDelayCentiseconds: 100,
      transparentFrameCount: 3, disposalMethods: [1, 1, 1, 1],
    });
  });

  it("rejects corrupted input rather than misreporting frames or timing", () => {
    const gif = animated();
    expect(() => inspectGifStructure(gif.subarray(0, gif.length - 1))).toThrow(/missing trailer/);
    const broken = gif.slice();
    broken[0] = 0;
    expect(() => inspectGifStructure(broken)).toThrow(/missing header/);
    const invalidPalette = still();
    invalidPalette[10] = 0xff;
    expect(() => inspectGifStructure(invalidPalette)).toThrow(/palette/);
  });

  it("caps a crafted large frame chain before it can be reported as a normal animation", () => {
    const original = still();
    const imageMarker = original.indexOf(0x2c, 40);
    expect(imageMarker).toBeGreaterThan(0);
    const image = original.subarray(imageMarker, original.length - 1);
    const repeated = new Uint8Array(original.subarray(0, imageMarker).length + image.length * 257 + 1);
    repeated.set(original.subarray(0, imageMarker));
    for (let index = 0; index < 257; index++) repeated.set(image, imageMarker + image.length * index);
    repeated[repeated.length - 1] = 0x3b;
    expect(() => inspectGifStructure(repeated)).toThrow(/more than 256 frames/);
  });
});
