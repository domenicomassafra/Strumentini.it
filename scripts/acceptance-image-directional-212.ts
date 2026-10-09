/** Independent Pillow GIF-frame0 -> generated PNG pixel comparison on real fixtures.
 * No browser or physical-device acceptance is implied.
 * Run: ./node_modules/.bin/tsx scripts/acceptance-image-directional-212.ts
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gifFirstFrameToPng212, probeHeicDecode212, probeAvifDecode212 } from "../src/engines/image/directional-212";

const independentPillow = String.raw`
from PIL import Image
import os, sys, json
animated, animated_png, still, still_png, interlaced, interlaced_png = sys.argv[1:7]
for original_path, png_path, count, durations in (
    (animated, animated_png, 4, [250, 250, 250, 250]),
    (still, still_png, 1, [0]),
    (interlaced, interlaced_png, 1, [120]),
):
    with Image.open(original_path) as gif:
        assert gif.format == "GIF" and gif.n_frames == count
        observed = []
        for frame in range(gif.n_frames):
            gif.seek(frame)
            observed.append(gif.info.get("duration", 0))
        assert observed == durations, (original_path, observed, durations)
        gif.seek(0)
        pixels = gif.convert("RGBA").tobytes()
        dimensions = gif.size
    with Image.open(png_path) as png:
        assert png.format == "PNG" and png.mode == "RGBA"
        assert png.size == dimensions
        actual = png.tobytes()
        assert len(pixels) == len(actual)
        for i in range(0, len(pixels), 4):
            assert pixels[i + 3] == actual[i + 3], ("alpha", i)
            if pixels[i + 3] != 0:
                assert pixels[i:i+3] == actual[i:i+3], ("RGB", i, pixels[i:i+3], actual[i:i+3])
            else:
                assert actual[i:i+3] == bytes((0, 0, 0)), ("canonical transparent RGB", i)
        print("PILLOW_INDEPENDENT_GIF_TO_PNG_PASS", "frames", count,
              "raw_delays_centiseconds", [n // 10 for n in observed], "size", dimensions,
              "rgba_bytes", len(actual), "png_bytes", os.stat(png_path).st_size)
`;

const root = new URL("../", import.meta.url);
const originals = [
  new URL("spikes/heavy-local-feasibility/public/corpus/sample-animated.gif", root),
  new URL("quality/fixtures/image-format-matrix/source.gif", root),
  new URL("quality/fixtures/image-format-matrix/interlaced-8x8.gif", root),
];
const temp = mkdtempSync(join(tmpdir(), "image-212-"));
try {
  const sourcePaths: string[] = [];
  const outputPaths: string[] = [];
  for (const [index, uri] of originals.entries()) {
    const source = new Uint8Array(readFileSync(uri));
    const inputPath = join(temp, "source-" + index + ".gif");
    const outputPath = join(temp, "frame0-" + index + ".png");
    writeFileSync(inputPath, source);
    const output = await gifFirstFrameToPng212(new Blob([source]), { allowAnimationLoss: index === 0 });
    if (output.frameCount !== (index === 0 ? 4 : 1) || output.outputBytes !== output.png.length ||
        output.framePolicy !== "first-frame-only" || output.animationDiscarded !== (index === 0)) {
      throw new Error("IMAGE_212_GIF_POLICY_MISMATCH");
    }
    writeFileSync(outputPath, output.png);
    sourcePaths.push(inputPath);
    outputPaths.push(outputPath);
  }
  process.stdout.write(execFileSync("python3", ["-c", independentPillow,
    sourcePaths[0]!, outputPaths[0]!, sourcePaths[1]!, outputPaths[1]!,
    sourcePaths[2]!, outputPaths[2]!], { encoding: "utf8" }));
  const avif = new Uint8Array(readFileSync(new URL("quality/fixtures/image-format-matrix/source.avif", root)));
  // Independent desktop decoder verifies the stored AVIF corpus item. This
  // deliberately does NOT stand in for a browser or physical mobile proof.
  process.stdout.write(execFileSync("python3", ["-c", String.raw`
from PIL import Image
import sys
with Image.open(sys.argv[1]) as frame:
    frame.load()
    assert frame.format == "AVIF" and frame.size == (2, 2)
    assert len(frame.convert("RGBA").tobytes()) == 16
    print("PILLOW_AVIF_FIXTURE_DECODE_PASS 2x2 browser=NOT_RUN production=REFUSED")
`, new URL("quality/fixtures/image-format-matrix/source.avif", root).pathname], { encoding: "utf8" }));
  const probe = await probeAvifDecode212(new Blob([avif]));
  if (probe.productionApproved || probe.runtimeDecodeSupported || probe.format !== "avif") {
    throw new Error("IMAGE_212_BROWSER_NATIVE_NOT_CONFIRMED_IN_NODE");
  }
  const heic = probeHeicDecode212();
  if (heic.productionApproved || heic.runtimeDecodeSupported) throw new Error("IMAGE_212_HEIC_REFUSAL_FAILED");
  process.stdout.write("IMAGE_212_CAPABILITY_FAIL_CLOSED_PASS AVIF=runtime-not-available HEIC=refused real-iPhone=NOT_RUN\n");
} finally {
  rmSync(temp, { recursive: true, force: true });
}
