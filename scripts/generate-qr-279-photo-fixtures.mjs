/**
 * STR-REUSE-55.5 / #279 — deterministic photo-like QR fixtures for the mobile
 * WebKit acceptance lane. The symbol comes from the independent `qrcode@1.5.4`
 * encoder (MIT), never from Strumentini's own generator, so a decoder that only
 * imitates our encoder cannot pass. Degradations are applied with `sharp`.
 *
 * Run: node scripts/generate-qr-279-photo-fixtures.mjs
 * Output: quality/fixtures/qr-contract/photo-*-279.jpg + qr-279-photo-manifest.json
 */
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import QRCode from "qrcode";
import sharp from "sharp";

const outDir = resolve(import.meta.dirname, "../quality/fixtures/qr-contract");
const manifestPath = resolve(outDir, "qr-279-photo-manifest.json");
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

const cases = [
  {
    file: "photo-ecm-279.jpg",
    payload: "https://esempio.it/zxing-279-mobile",
    level: "M",
    scale: 10,
    rotate: 6.5,
    blur: 0.9,
    contrast: 0.84,
    quality: 78,
  },
  {
    file: "photo-lowcontrast-279.jpg",
    payload: "STR-279 basso contrasto",
    level: "Q",
    scale: 9,
    rotate: -11,
    blur: 1.2,
    contrast: 0.52,
    quality: 70,
  },
];

/** Independent module matrix rendered to a raw RGB raster with a 4-module quiet zone. */
function renderModules({ payload, level, scale }) {
  const created = QRCode.create(payload, { errorCorrectionLevel: level });
  const size = created.modules.size;
  const quiet = 4;
  const width = (size + quiet * 2) * scale;
  const raw = Buffer.alloc(width * width * 3, 255);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      if (!created.modules.get(x, y)) continue;
      for (let dy = 0; dy < scale; dy += 1) {
        for (let dx = 0; dx < scale; dx += 1) {
          const pixel = ((y + quiet) * scale + dy) * width + ((x + quiet) * scale + dx);
          raw[pixel * 3] = 0;
          raw[pixel * 3 + 1] = 0;
          raw[pixel * 3 + 2] = 0;
        }
      }
    }
  }
  return { raw, width, size, version: created.version, maskPattern: created.maskPattern };
}

/** Uneven paper lighting, as in a handheld photograph. */
function lighting(width, height) {
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">` +
      `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">` +
      `<stop offset="0" stop-color="#ffffff"/><stop offset="0.45" stop-color="#f2eee5"/>` +
      `<stop offset="1" stop-color="#c6bfb1"/></linearGradient></defs>` +
      `<rect width="${width}" height="${height}" fill="url(#g)"/></svg>`,
  );
}

const qrcodeVersion = JSON.parse(await readFile(resolve(import.meta.dirname, "../node_modules/qrcode/package.json"), "utf8")).version;
const sharpVersion = JSON.parse(await readFile(resolve(import.meta.dirname, "../node_modules/sharp/package.json"), "utf8")).version;
await mkdir(outDir, { recursive: true });

const fixtures = [];
for (const item of cases) {
  const { raw, width, size, version, maskPattern } = renderModules(item);
  const pad = Math.round(width * 0.17);
  const full = width + pad * 2;
  const bytes = await sharp(raw, { raw: { width, height: width, channels: 3 } })
    .extend({ top: pad, bottom: pad, left: pad, right: pad, background: "#f6f2e9" })
    .composite([{ input: lighting(full, full), blend: "multiply" }])
    .rotate(item.rotate, { background: "#efe9dd" })
    .blur(item.blur)
    .linear(item.contrast, 128 * (1 - item.contrast))
    .jpeg({ quality: item.quality })
    .toBuffer();
  await writeFile(resolve(outDir, item.file), bytes);
  const metadata = await sharp(bytes).metadata();
  fixtures.push({
    file: item.file,
    payload: item.payload,
    errorCorrectionLevel: item.level,
    matrixSize: size,
    version,
    maskPattern,
    width: metadata.width,
    height: metadata.height,
    bytes: bytes.length,
    sha256: sha256(bytes),
    degradations: {
      rotateDegrees: item.rotate,
      blurSigma: item.blur,
      contrast: item.contrast,
      jpegQuality: item.quality,
      lightingGradient: true,
    },
  });
}

const manifest = {
  schemaVersion: 1,
  ticket: 279,
  generator: "scripts/generate-qr-279-photo-fixtures.mjs",
  encoder: { package: "qrcode", version: qrcodeVersion, license: "MIT", independentOfProductEncoder: true },
  raster: { package: "sharp", version: sharpVersion, license: "Apache-2.0" },
  regeneration: "node scripts/generate-qr-279-photo-fixtures.mjs",
  fixtures,
};
await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ manifestPath, fixtures: fixtures.map(({ file, payload, sha256: digest, width, height }) => ({ file, payload, sha256: digest, width, height })) }, null, 2));
