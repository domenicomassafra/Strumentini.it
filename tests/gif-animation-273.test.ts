import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { inspectGifStructure } from "../src/engines/image/gif-structure";
import { GIF_ANIMATION_273_LIMITS, reencodeAnimatedGif273 } from "../src/engines/image/gif-animation-273";
import { gifFirstFrameToPng212 } from "../src/engines/image/directional-212";

const directory = mkdtempSync(join(tmpdir(), "str273-gif-"));
const python = process.env.PYTHON ?? "python3";
const oracle = new URL("../scripts/acceptance-gif-animation-273.py", import.meta.url).pathname;
const sample = (name: string): Uint8Array<ArrayBuffer> => new Uint8Array(readFileSync(join(directory, name)));

function pillow(...args: string[]) {
  const command = spawnSync(python, [oracle, ...args], { encoding: "utf8", maxBuffer: 128 * 1024 });
  expect(command.status, command.stderr || command.stdout).toBe(0);
  return command.stdout;
}

beforeAll(() => { pillow("make", directory); });
afterAll(() => rmSync(directory, { recursive: true, force: true }));

describe("#273 distinct bounded animation-preserving GIF path", () => {
  it("composes source disposal 0/1/2/3 and nonzero frame offsets, retains loop=2 and every delay, then Pillow independently decodes actual GIF pixels", async () => {
    const input = sample("disposal-offset-loop.gif");
    const structure = inspectGifStructure(input);
    expect(structure.disposalMethods).toEqual([0, 1, 2, 3, 1, 1]);
    expect(structure.frameDelaysCentiseconds).toEqual([10, 20, 30, 40, 50, 20]);
    const result = await reencodeAnimatedGif273(new Blob([input]));
    expect(result.frames).toBe(6);
    expect(result.repeat).toBe(2);
    expect(result.delaysCentiseconds).toEqual(structure.frameDelaysCentiseconds);
    expect(result.alphaPolicy).toBe("flattened-over-white");
    const output = new Uint8Array(await result.blob.arrayBuffer());
    expect(inspectGifStructure(output).frameCount).toBe(6);
    const target = join(directory, "roundtrip.gif");
    writeFileSync(target, output);
    expect(pillow("compare", join(directory, "disposal-offset-loop.gif"), target)).toContain("PILLOW_EXTERNAL_DECODE_PASS");
  });

  it("deinterlaces genuine 8×8 rows; keeps no-loop extension semantics; Pillow independently checks every composited RGB pixel", async () => {
    const input = sample("interlaced-animated.gif");
    const result = await reencodeAnimatedGif273(new Blob([input]));
    expect(result.frames).toBe(2);
    expect(result.repeat).toBeNull();
    expect(result.delaysCentiseconds).toEqual([12, 12]);
    const target = join(directory, "interlace-output.gif");
    writeFileSync(target, new Uint8Array(await result.blob.arrayBuffer()));
    expect(pillow("compare", join(directory, "interlaced-animated.gif"), target)).toContain("PILLOW_EXTERNAL_DECODE_PASS");
  });

  it("rejects truncated, malformed, static, short-delay, over-pixel, over-byte and pre-aborted work without returning fallback frame", async () => {
    const input = sample("disposal-offset-loop.gif");
    await expect(reencodeAnimatedGif273(new Blob([input.subarray(0, input.length - 1)]))).rejects.toThrow(/GIF/);
    await expect(reencodeAnimatedGif273(new Blob([new Uint8Array(40)]))).rejects.toThrow(/GIF/);
    const still = new Uint8Array(readFileSync(new URL("../quality/fixtures/image-format-matrix/source.gif", import.meta.url)));
    await expect(reencodeAnimatedGif273(new Blob([still]))).rejects.toThrow(/GIF_273_UNSUPPORTED/);
    await expect(reencodeAnimatedGif273(new Blob([sample("too-many-frames.gif")]))).rejects.toThrow(/GIF_273_UNSUPPORTED/);
    const zeroDelay = input.slice();
    const gce = zeroDelay.indexOf(0xf9, 13) - 1;
    expect(zeroDelay[gce]).toBe(0x21);
    zeroDelay[gce + 4] = zeroDelay[gce + 5] = 0;
    await expect(reencodeAnimatedGif273(new Blob([zeroDelay]))).rejects.toThrow(/GIF_273_UNSUPPORTED/);
    const overDuration = input.slice();
    for (let i = 0; i < overDuration.length - 7; i++) {
      if (overDuration[i] === 0x21 && overDuration[i + 1] === 0xf9 && overDuration[i + 2] === 4) {
        overDuration[i + 4] = 250;
        overDuration[i + 5] = 0;
      }
    }
    await expect(reencodeAnimatedGif273(new Blob([overDuration]))).rejects.toThrow(/GIF_273_UNSUPPORTED/);
    const overPixels = input.slice();
    overPixels[6] = overPixels[8] = 0xff;
    overPixels[7] = overPixels[9] = 0x01;
    await expect(reencodeAnimatedGif273(new Blob([overPixels]))).rejects.toThrow(/GIF_273_UNSUPPORTED/);
    await expect(reencodeAnimatedGif273(new Blob([new Uint8Array(GIF_ANIMATION_273_LIMITS.inputBytes + 1)]))).rejects.toThrow(/GIF_273_UNSUPPORTED/);
    const controller = new AbortController();
    controller.abort();
    await expect(reencodeAnimatedGif273(new Blob([input]), controller.signal)).rejects.toMatchObject({ name: "AbortError" });
  });

  it("never changes existing explicit GIF first-frame-only conversion semantics", async () => {
    const animated = sample("disposal-offset-loop.gif");
    await expect(gifFirstFrameToPng212(new Blob([animated]))).rejects.toThrow(/ANIMATION_LOSS_NOT_ACKNOWLEDGED/);
    const still = await gifFirstFrameToPng212(new Blob([animated]), { allowAnimationLoss: true });
    expect(still.framePolicy).toBe("first-frame-only");
    expect(still.animationDiscarded).toBe(true);
    expect(still.frameCount).toBe(6);
  });
});
