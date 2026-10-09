/** #047 isolated PNG proof: Pillow writes + reopens independent RGB/RGBA corpus.
 * Run with ./node_modules/.bin/tsx scripts/acceptance-image-compression-47.ts
 * NOT an acceptance of JPEG/WebP advanced codecs, SVG optimizers, browser UI or mobile.
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { compressPngLossless47, probeImageCompression47 } from "../src/engines/image/png-lossless-47";

const pythonMake = String.raw`
from PIL import Image, PngImagePlugin
import sys
for mode, path in [('RGBA', sys.argv[1]), ('RGB', sys.argv[2])]:
    w, h = 320, 256
    image = Image.new(mode, (w, h))
    px = image.load()
    for y in range(h):
        for x in range(w):
            if mode == 'RGBA':
                px[x, y] = ((x*3)%256, (y*5)%256, (x+y)%256, (x+y*2)%256)
            else:
                px[x, y] = ((x*3)%256, (y*5)%256, (x+y)%256)
    metadata = PngImagePlugin.PngInfo()
    metadata.add_text('Comment', 'Lossless roundtrip #047 — métadonnées preserve')
    image.save(path, format='PNG', pnginfo=metadata, compress_level=0)
print('PILLOW_SOURCE_PNG_CREATED rgb=320x256 rgba=320x256')
`;
const pythonVerify = String.raw`
from PIL import Image
import sys, zlib, struct
for i in (0, 2):
    original, result = sys.argv[1+i:3+i]
    with Image.open(original) as a, Image.open(result) as b:
        a.load(); b.load()
        assert a.format == b.format == 'PNG'
        assert a.mode == b.mode and a.size == b.size == (320,256)
        assert a.tobytes() == b.tobytes(), 'Decoded pixel mismatch'
        assert a.info.get('Comment') == b.info.get('Comment'), 'PNG metadata mismatch'
        assert a.info['Comment'] == 'Lossless roundtrip #047 — métadonnées preserve'
        print('PILLOW_INDEPENDENT_PIXEL_ROUNDTRIP_PASS', a.mode, len(a.tobytes()), 'pixel channel bytes',
            'source', __import__('os').path.getsize(original), 'output', __import__('os').path.getsize(result))
`;

const directory = mkdtempSync(join(tmpdir(), "image-47-"));
try {
  const files = ["rgba-input.png", "rgb-input.png", "rgba-compressed.png", "rgb-compressed.png"]
    .map((name) => join(directory, name));
  process.stdout.write(execFileSync("python3", ["-c", pythonMake, files[0]!, files[1]!], { encoding: "utf8" }));
  for (let n = 0; n < 2; n++) {
    const source = readFileSync(files[n]!);
    const result = await compressPngLossless47(new Blob([new Uint8Array(source)]));
    if (result.originalBytes !== source.length || result.outputBytes !== result.blob.size ||
        result.savedBytes !== source.length - result.outputBytes || result.savedBytes <= 0) {
      throw new Error("PNG_47_ACCEPTANCE_BYTE_RECONCILIATION_FAILED");
    }
    writeFileSync(files[n + 2]!, new Uint8Array(await result.blob.arrayBuffer()));
  }
  process.stdout.write(execFileSync("python3", ["-c", pythonVerify, files[0]!, files[2]!, files[1]!, files[3]!], { encoding: "utf8" }));
  const capability = probeImageCompression47();
  if (!capability["image/png"].supported || capability["image/jpeg"].supported ||
      capability["image/webp"].supported || capability["image/svg+xml"].supported) {
    throw new Error("PNG_47_REFUSAL_GATE_BROKEN");
  }
  process.stdout.write("IMAGE_47_CAPABILITY_REFUSAL_PASS PNG=verified JPEG=refused WebP=refused SVG=refused\n");
} finally {
  rmSync(directory, { recursive: true, force: true });
}
