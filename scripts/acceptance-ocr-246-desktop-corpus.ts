/** #246 DESKTOP SPIKE ONLY — not a production OCR capability or mobile receipt.
 * Uses only the SHA-pinned local Italian model and one worker with guaranteed
 * termination. Intentionally reports failed orientations, never auto-promotes.
 */
import { createHash } from "node:crypto";
import { existsSync, realpathSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import sharp from "sharp";
import { IMAGE_OCR_FEASIBILITY } from "../src/engines/ocr/image-feasibility";

const root = resolve(import.meta.dirname, "..");
const repoRoot = dirname(realpathSync(resolve(root, "node_modules")));
const spike = existsSync(resolve(root, "spikes/heavy-local-feasibility/node_modules/tesseract.js"))
  ? resolve(root, "spikes/heavy-local-feasibility")
  : resolve(repoRoot, "spikes/heavy-local-feasibility");
const fixture = await readFile(resolve(root, IMAGE_OCR_FEASIBILITY.verifiedFixture));
if (createHash("sha256").update(fixture).digest("hex") !== IMAGE_OCR_FEASIBILITY.verifiedFixtureSha256) {
  throw new Error("OCR246_DESKTOP_CORPUS_SOURCE_HASH_CHANGED");
}
const localModel = resolve(spike, "node_modules/@tesseract.js-data/ita/4.0.0/ita.traineddata.gz");
const requireInstalled = createRequire(resolve(spike, "package.json"));
const tesseract = requireInstalled("tesseract.js") as {
  createWorker(language: string, oem: number, options: Record<string, unknown>): Promise<{
    recognize(bytes: Buffer): Promise<{ data: { text: string; confidence: number } }>;
    terminate(): Promise<void>;
  }>;
};
const worker = await tesseract.createWorker("ita", 1, {
  workerPath: resolve(spike, "node_modules/tesseract.js/src/worker-script/node/index.js"),
  langPath: dirname(localModel), cacheMethod: "none",
});
const expected = "Fattura numero 12345 - Totale euro 678,90";
const rotated90 = await sharp(fixture).rotate(90).png().toBuffer();
const rotated180 = await sharp(fixture).rotate(180).png().toBuffer();
const corpus = [
  { label: "source-printed", bytes: Buffer.from(fixture) },
  { label: "grayscale", bytes: await sharp(fixture).greyscale().png().toBuffer() },
  { label: "rotate-90-uncorrected", bytes: rotated90 },
  { label: "rotate-180-uncorrected", bytes: rotated180 },
  { label: "rotate-90-explicitly-corrected", bytes: await sharp(rotated90).rotate(270).png().toBuffer() },
  { label: "rotate-180-explicitly-corrected", bytes: await sharp(rotated180).rotate(180).png().toBuffer() },
];
const results: { case: string; size: number; confidence: number; exact: boolean; text: string }[] = [];
try {
  for (const item of corpus) {
    const { data } = await worker.recognize(item.bytes);
    const normalized = data.text.replace(/\s+/gu, " ").trim();
    if (!Number.isFinite(data.confidence) || data.confidence < 0 || data.confidence > 100) {
      throw new Error(`OCR246_INVALID_ENGINE_CONFIDENCE ${item.label}`);
    }
    results.push({ case: item.label, size: item.bytes.length, confidence: data.confidence,
      exact: normalized === expected, text: normalized });
  }
} finally {
  await worker.terminate();
}
if (!results[0]?.exact) throw new Error("OCR246_PINNED_SOURCE_BASELINE_FAILED");
if (!results[4]?.exact || !results[5]?.exact) throw new Error("OCR246_EXPLICIT_ROTATION_CORRECTION_FAILED");
console.log(JSON.stringify({ status: "DESKTOP_SPIKE_PASS_SOURCE_ONLY", productionPromotion: IMAGE_OCR_FEASIBILITY.productionPromotion,
  model: IMAGE_OCR_FEASIBILITY.acceptedSpikeModel, testedCases: results.length,
  exactCases: results.filter((result) => result.exact).length,
  browser: "NOT_RUN", physicalIosSafari: "NOT_RUN", physicalAndroidChrome: "NOT_RUN",
  inFlightCancellation: "NOT_RUN", results }, null, 2));
