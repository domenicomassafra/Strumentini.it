import { createHash } from "node:crypto";
import { existsSync, realpathSync } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { IMAGE_OCR_FEASIBILITY } from "../src/engines/ocr/image-feasibility";

const sourceRoot = resolve(import.meta.dirname, "..");
// Works in the isolated worker worktree: its preserved node_modules symlink
// targets main. Does not write to either repository or install new packages.
const dependencyRepo = dirname(realpathSync(resolve(sourceRoot, "node_modules")));
const spike = process.env.OCR_246_SPIKE_ROOT ?? (existsSync(resolve(sourceRoot, "spikes/heavy-local-feasibility/node_modules/tesseract.js"))
  ? resolve(sourceRoot, "spikes/heavy-local-feasibility")
  : resolve(dependencyRepo, "spikes/heavy-local-feasibility"));

describe("#246 independently reproducible desktop-only Italian OCR spike", () => {
  it("recognizes known printed Italian invoice using precisely pinned local installed language/model assets", async () => {
    const fixture = await readFile(resolve(sourceRoot, IMAGE_OCR_FEASIBILITY.verifiedFixture));
    expect(createHash("sha256").update(fixture).digest("hex")).toBe(IMAGE_OCR_FEASIBILITY.verifiedFixtureSha256);
    expect(fixture.length).toBe(14305);
    const installedRequire = createRequire(resolve(spike, "package.json"));
    // A missing optional spike installation fails loudly. It cannot turn into
    // a fabricated OCR PASS or auto-fetch engine/model from a CDN.
    const tesseract = installedRequire("tesseract.js") as {
      createWorker: (language: string, oem: number, options: Record<string, unknown>) => Promise<{
        recognize(image: Buffer): Promise<{ data: { text: string; confidence: number } }>;
        terminate(): Promise<void>;
      }>;
    };
    expect((installedRequire("tesseract.js/package.json") as { version: string; license: string }))
      .toMatchObject({ version: "7.0.0", license: "Apache-2.0" });
    const languagePackage = installedRequire("@tesseract.js-data/ita/package.json") as { version: string; license: string };
    expect(languagePackage).toMatchObject({ version: "1.0.0", license: "MIT" });
    const localModel = resolve(spike, "node_modules/@tesseract.js-data/ita/4.0.0/ita.traineddata.gz");
    expect((await stat(localModel)).size).toBe(6933830);
    const worker = await tesseract.createWorker("ita", 1, {
      workerPath: resolve(spike, "node_modules/tesseract.js/src/worker-script/node/index.js"),
      langPath: dirname(localModel),
      cacheMethod: "none",
    });
    try {
      const { data } = await worker.recognize(fixture);
      const recognized = data.text.replace(/\s+/gu, " ").trim();
      const expected = "Fattura numero 12345 - Totale euro 678,90";
      expect(recognized).toBe(expected);
      // Score is Tesseract's engine-defined indicator, NOT a calibrated
      // probability or guarantee that arbitrary scans are accurate.
      expect(Number.isFinite(data.confidence)).toBe(true);
      expect(data.confidence).toBeGreaterThan(0);
      expect(data.confidence).toBeLessThanOrEqual(100);
    } finally {
      await worker.terminate();
    }
  }, 30_000);
});
