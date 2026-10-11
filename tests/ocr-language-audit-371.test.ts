import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OCR_371_SOURCE, auditOcrLanguages371, characterErrorRate371 } from "../scripts/ocr-language-audit-371";

const repo = resolve(import.meta.dirname, "..");
const spike = resolve(repo, "spikes/heavy-local-feasibility");
const temporary: string[] = [];

afterEach(async () => {
  await Promise.all(temporary.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

describe("#371 source-bound OCR language/quality desktop feasibility", () => {
  it("does not claim comparable EN quality when neither pinned model nor annotated English corpus exists", async () => {
    const createWorker = vi.fn();
    const result = await auditOcrLanguages371({ root: repo, spike, languages: ["eng"], createWorker });
    expect(result.decision).toBe("NO_GO");
    expect(result.languages.eng).toMatchObject({ state: "NO_GO", measured: false, caseCount: 0 });
    expect(result.languages.eng.reasons).toEqual(expect.arrayContaining(["EN_MODEL_UNPINNED", "EN_CORPUS_UNANNOTATED"]));
    expect(result.languages.eng.cases).toEqual([]);
    expect(createWorker).not.toHaveBeenCalled();
  });

  it("measures actual labeled Italian bytes and reports rotated failures without promoting production", async () => {
    const terminate = vi.fn(async () => undefined);
    let recognizedCases = 0;
    const createWorker = vi.fn(async () => ({
      recognize: vi.fn(async (_bytes: Buffer) => {
        recognizedCases += 1;
        return { data: recognizedCases === 3
          ? { text: "unreadable rotated document", confidence: 51 }
          : { text: "Fattura numero 12345 - Totale euro 678,90\n", confidence: 94 } };
      }),
      terminate,
    }));
    const result = await auditOcrLanguages371({ root: repo, spike, languages: ["ita", "eng"], createWorker });
    expect(result.decision).toBe("NO_GO");
    expect(result.languages.ita).toMatchObject({ state: "MEASURED_DESKTOP_ONLY", measured: true, caseCount: 3 });
    expect(result.languages.ita.cases.map((item) => item.variant)).toEqual(["upright", "grayscale", "rotated-90-uncorrected"]);
    expect(result.languages.ita.cases[0]).toMatchObject({ exact: true, characterErrorRate: 0, wordErrorRate: 0, sourceSha256: OCR_371_SOURCE.fixtureSha256 });
    expect(result.languages.ita.cases[2]).toMatchObject({
      exact: false, confidence: 51, confidenceMeaning: "UNCALIBRATED_TESSERACT_SCORE",
    });
    expect(result.languages.ita.cases[2]!.characterErrorRate).toBeGreaterThan(0);
    expect(result.languages.ita.cases.every((item) => item.elapsedMs >= 0 && item.sampledRssMaxBytes > 0)).toBe(true);
    expect(result.languages.eng.state).toBe("NO_GO");
    expect(result.qualityComparableItEn).toBe(false);
    expect(result.physicalIosAndroid).toBe("NOT_RUN");
    expect(createWorker).toHaveBeenCalledOnce();
    expect(terminate).toHaveBeenCalledOnce();
  });

  it("refuses nonfinite confidence instead of reporting a fake quality measurement, and terminates", async () => {
    const terminate = vi.fn(async () => undefined);
    const createWorker = vi.fn(async () => ({
      recognize: async () => ({ data: { text: "Fattura", confidence: Number.NaN } }),
      terminate,
    }));
    const result = await auditOcrLanguages371({ root: repo, spike, languages: ["ita"], createWorker });
    expect(result.languages.ita.state).toBe("NO_GO");
    expect(result.languages.ita.cases).toHaveLength(0);
    expect(result.languages.ita.reasons).toContain("IT_OCR_RESULT_UNTRUSTED");
    expect(terminate).toHaveBeenCalledOnce();
  });

  it("fails closed before any worker on a changed hash-bound Italian source", async () => {
    const root = await mkdtemp(join(tmpdir(), "ocr-371-tampered-"));
    temporary.push(root);
    const path = resolve(root, OCR_371_SOURCE.fixtureRelativePath);
    await mkdir(dirname(path), { recursive: true });
    const original = await readFile(resolve(repo, OCR_371_SOURCE.fixtureRelativePath));
    const tampered = Buffer.from(original);
    const lastIndex = tampered.length - 1;
    tampered[lastIndex] = tampered[lastIndex]! ^ 0xff;
    await writeFile(path, tampered);
    const createWorker = vi.fn();
    const result = await auditOcrLanguages371({ root, spike, languages: ["ita"], createWorker });
    expect(result.languages.ita).toMatchObject({ state: "NO_GO", measured: false, caseCount: 0 });
    expect(result.languages.ita.reasons).toContain("IT_FIXTURE_SHA256_CHANGED");
    expect(createWorker).not.toHaveBeenCalled();
  });

  it("fails closed for a missing local language model and never attempts CDN fallback", async () => {
    const spikeMissing = await mkdtemp(join(tmpdir(), "ocr-371-no-model-"));
    temporary.push(spikeMissing);
    const createWorker = vi.fn();
    const result = await auditOcrLanguages371({ root: repo, spike: spikeMissing, languages: ["ita"], createWorker });
    expect(result.languages.ita.state).toBe("NO_GO");
    expect(result.languages.ita.reasons).toContain("IT_LOCAL_MODEL_MISSING");
    expect(createWorker).not.toHaveBeenCalled();
  });

  it("rejects a substituted local traineddata before worker initialization", async () => {
    const fakeSpike = await mkdtemp(join(tmpdir(), "ocr-371-tampered-model-"));
    temporary.push(fakeSpike);
    const path = resolve(fakeSpike, OCR_371_SOURCE.modelRelativePath);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, Buffer.from("not a model"));
    const createWorker = vi.fn();
    const result = await auditOcrLanguages371({ root: repo, spike: fakeSpike, languages: ["ita"], createWorker });
    expect(result.languages.ita.reasons).toContain("IT_LOCAL_MODEL_SHA256_CHANGED");
    expect(createWorker).not.toHaveBeenCalled();
  });

  it("rejects tampered license evidence even if package and traineddata are intact", async () => {
    const fakeRoot = await mkdtemp(join(tmpdir(), "ocr-371-tampered-rights-"));
    temporary.push(fakeRoot);
    for (const relative of [
      OCR_371_SOURCE.fixtureRelativePath,
      "spikes/heavy-local-feasibility/public/corpus/manifest.json",
      "quality/reference-data/ocr/246-local-assets-evidence.json",
    ]) {
      const path = resolve(fakeRoot, relative);
      await mkdir(dirname(path), { recursive: true });
      const bytes = await readFile(resolve(repo, relative));
      await writeFile(path, relative.endsWith("246-local-assets-evidence.json")
        ? Buffer.from(bytes.toString("utf8").replace('"Apache-2.0"', '"UNKNOWN_LICENSE"'))
        : bytes);
    }
    const createWorker = vi.fn();
    const result = await auditOcrLanguages371({ root: fakeRoot, spike, languages: ["ita"], createWorker });
    expect(result.languages.ita.reasons).toContain("IT_MODEL_LICENSE_UNVERIFIED");
    expect(createWorker).not.toHaveBeenCalled();
  });

  it("refuses an invalid upstream license even when the fixture and engine are present", async () => {
    const createWorker = vi.fn();
    const result = await auditOcrLanguages371({ root: repo, spike, languages: ["ita"], createWorker,
      requiredUpstreamLicense: "UNVERIFIED_PROPRIETARY" });
    expect(result.languages.ita.state).toBe("NO_GO");
    expect(result.languages.ita.reasons).toContain("IT_MODEL_LICENSE_UNVERIFIED");
    expect(createWorker).not.toHaveBeenCalled();
  });

  it("uses edit distance rather than an uncalibrated engine confidence for quality", () => {
    expect(characterErrorRate371("ABC", "AXC")).toBeCloseTo(1 / 3);
    expect(characterErrorRate371("", "X")).toBe(1);
    expect(characterErrorRate371("", "")).toBe(0);
    expect(characterErrorRate371("a è", "a e")).toBeCloseTo(1 / 3);
  });
});
