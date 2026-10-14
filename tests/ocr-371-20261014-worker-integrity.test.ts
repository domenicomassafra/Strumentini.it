/** #371: a pinned Italian traineddata is not proof of the unverified
 * executable worker shipped alongside it. Test a private temporary mirror of
 * genuine installed donor files; never alter installed vendor/model assets.
 */
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, rm, rename, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { OCR_371_SOURCE, auditOcrLanguages371, type OcrLanguage371 } from "../scripts/ocr-language-audit-371";

const root = resolve(import.meta.dirname, "..");
const installed = resolve(root, "spikes/heavy-local-feasibility");
const workerRelative = "node_modules/tesseract.js/src/worker-script/node/index.js";
const workerDigest = "a973c23ce067bc752c0bf602297eac843098e531ac03f3ea34cdf694326a6d02";
const expectedText = OCR_371_SOURCE.annotatedExpectedText;
const sha256 = (value: Uint8Array) => createHash("sha256").update(value).digest("hex");
const donorFiles = [
  OCR_371_SOURCE.modelRelativePath,
  "node_modules/tesseract.js/package.json",
  "node_modules/tesseract.js-core/package.json",
  "node_modules/@tesseract.js-data/ita/package.json",
  workerRelative,
] as const;

let temp = "";
beforeAll(async () => {
  temp = await mkdtemp(join(tmpdir(), "ocr371-local-worker-integrity-"));
  for (const item of donorFiles) {
    const path = resolve(temp, item);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, await readFile(resolve(installed, item)));
  }
}, 20_000);
afterAll(async () => { if (temp) await rm(temp, { recursive: true, force: true }); });

const matchingWorker = () => {
  const terminate = vi.fn(async () => {});
  const createWorker = vi.fn(async (_language: OcrLanguage371, _workerOptions: Record<string, unknown>) => ({
    recognize: vi.fn(async () => ({ data: { text: expectedText, confidence: 94 } })),
    terminate,
  }));
  return { createWorker, terminate };
};

describe("#371 installed executable worker provenance before any OCR quality receipt", () => {
  it("checks an intact mirror of genuine installed Tesseract.js Italian model and Node worker script", async () => {
    const actual = await readFile(resolve(installed, workerRelative));
    expect(actual.length).toBe(771);
    expect(sha256(actual)).toBe(workerDigest);
    expect(OCR_371_SOURCE.workerBytes).toBe(771);
    expect(OCR_371_SOURCE.workerSha256).toBe(workerDigest);
    expect(OCR_371_SOURCE.workerRelativePath).toBe(workerRelative);
    const { createWorker, terminate } = matchingWorker();
    const audit = await auditOcrLanguages371({ root, spike: temp, languages: ["ita"], createWorker });
    expect(audit.languages.ita).toMatchObject({
      state: "MEASURED_DESKTOP_ONLY", measured: true, caseCount: 3,
      modelSha256: OCR_371_SOURCE.modelSha256,
    });
    expect(audit.languages.ita.reasons).toEqual([]);
    expect(createWorker).toHaveBeenCalledOnce();
    const [language, runtimeOptions] = createWorker.mock.calls[0]!;
    expect(language).toBe("ita");
    expect(runtimeOptions).toMatchObject({
      workerPath: resolve(temp, workerRelative),
      langPath: dirname(resolve(temp, OCR_371_SOURCE.modelRelativePath)),
      cacheMethod: "none", gzip: true, workerBlobURL: false,
    });
    expect(terminate).toHaveBeenCalledOnce();
    expect(audit.decision).toBe("NO_GO");
    expect(audit.qualityComparableItEn).toBe(false);
  }, 20_000);

  it("refuses an equal-sized substituted executable even when package license, model SHA and OCR text are unchanged", async () => {
    const path = resolve(temp, workerRelative);
    const intact = await readFile(path);
    const spoofed = Buffer.from(intact);
    spoofed[100] = spoofed[100]! ^ 0x01;
    expect(spoofed.length).toBe(intact.length);
    expect(sha256(spoofed)).not.toBe(workerDigest);
    await writeFile(path, spoofed);
    try {
      const { createWorker } = matchingWorker();
      const audit = await auditOcrLanguages371({ root, spike: temp, languages: ["ita"], createWorker });
      expect(audit.languages.ita).toMatchObject({
        state: "NO_GO", measured: false, caseCount: 0,
        modelSha256: null, cases: [], memory: null,
      });
      expect(audit.languages.ita.reasons).toContain("IT_LOCAL_WORKER_SHA256_CHANGED");
      expect(createWorker).not.toHaveBeenCalled();
      expect(audit.decision).toBe("NO_GO");
    } finally {
      await writeFile(path, intact);
    }
  }, 20_000);

  it("refuses a symlinked executable rather than attributing an unverified worker to the pinned donor", async () => {
    const path = resolve(temp, workerRelative);
    const backup = path + ".original";
    await rename(path, backup);
    try {
      await symlink(resolve(installed, workerRelative), path);
      const { createWorker } = matchingWorker();
      const audit = await auditOcrLanguages371({ root, spike: temp, languages: ["ita"], createWorker });
      expect(audit.languages.ita).toMatchObject({ state: "NO_GO", measured: false, caseCount: 0 });
      expect(audit.languages.ita.reasons).toContain("IT_LOCAL_WORKER_SHA256_CHANGED");
      expect(createWorker).not.toHaveBeenCalled();
    } finally {
      await rm(path, { force: true });
      await rename(backup, path);
    }
  }, 20_000);
});
