import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import sharp from "sharp";
import { generateQr, rasterPlan, renderQrSvg } from "../src/engines/qr/encode.ts";

// jsQR is already pinned under the existing #278 heavy-browser spike.
const spikeRequire = createRequire(new URL("../spikes/heavy-browser/package.json", import.meta.url));
const jsQR = spikeRequire("jsqr");
assert.equal(spikeRequire("jsqr/package.json").version, "1.4.0");

const canonical = JSON.parse(readFileSync(new URL("../quality/fixtures/qr-contract/vectors.json", import.meta.url), "utf8"));
const corpus = [
  "https://strumentini.it", "https://strumentini.it/tools/qr-generator",
  "WIFI:T:WPA;S:Caffè;P:locale;;", "Città però più così — perché",
  "QR ✅ locale 🚀", "12345678901234567890", "HELLO WORLD 123",
  ...[17, 18, 32, 33, 53, 54, 78].map((length) => "x".repeat(length)),
  ...canonical.vectors.filter((vector) => !vector.expected_rejection).map((vector) => vector.payload),
  "qr",
];
assert.equal(corpus.length, 21);
let oldBytes = 0;
let newBytes = 0;
let decoded = 0;
for (const payload of corpus) {
  const generated = generateQr(payload);
  const rows = generated.matrixRows;
  const plan = rasterPlan(rows, 8);
  const originalPath = plan.dark.map(({ x, y }) =>
    `M${(x + 4) * 8} ${(y + 4) * 8}h8v8h-8z`).join("");
  const oldSvg = generated.svg.replace(
    /<path fill="none" stroke="#000000" stroke-width="\d+" stroke-linecap="butt" d="[^"]+"\/>/u,
    () => `<path fill="#000000" d="${originalPath}"/>`,
  );
  oldBytes += Buffer.byteLength(oldSvg);
  newBytes += Buffer.byteLength(generated.svg);

  // Sharp/libvips independently rasterises the exact exported SVG; jsQR sees
  // only RGBA pixels and receives no embedded data-matrix or local decoder.
  const { data, info } = await sharp(Buffer.from(generated.svg), {
    limitInputPixels: 1_000_000, failOn: "error",
  }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  assert.equal(info.channels, 4);
  assert.equal(info.width, plan.width);
  assert.equal(info.height, plan.height);
  const result = jsQR(new Uint8ClampedArray(data), info.width, info.height, {
    inversionAttempts: "dontInvert",
  });
  assert.equal(result?.data, payload, `jsQR mismatch for ${JSON.stringify(payload)}`);

  // Paint authority is raster pixels, sampled at the center of every module,
  // including the untouched four-module white quiet zone.
  for (let y = 0; y < rows.length + 8; y += 1) {
    for (let x = 0; x < rows.length + 8; x += 1) {
      const expectedDark = rows[y - 4]?.[x - 4] === "1";
      const pixelIndex = (((y * 8 + 4) * info.width) + x * 8 + 4) * 4;
      const actualDark = data[pixelIndex] < 128;
      assert.equal(actualDark, expectedDark, `paint mismatch at ${x},${y}`);
    }
  }
  decoded += 1;
}
assert.ok(newBytes <= oldBytes / 2, `compression insufficient: ${oldBytes} -> ${newBytes}`);
console.log(JSON.stringify({
  corpus: corpus.length, oldSvgBytes: oldBytes, newSvgBytes: newBytes,
  reductionPercent: Number(((1 - newBytes / oldBytes) * 100).toFixed(2)),
  independentDecoder: "jsQR 1.4.0", rasterizer: "sharp/libvips",
  decoded, painted: decoded, result: "PASS",
}));
