import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  IMAGE_OCR_FEASIBILITY, evaluateImageOcrPreflight, inspectLocalImageOcr,
} from "../src/engines/ocr/image-feasibility";
import type { HeavyJobCapabilitySnapshot } from "../src/runtime/heavy-preflight";

const root = resolve(import.meta.dirname, "..");
const fixture = resolve(root, IMAGE_OCR_FEASIBILITY.verifiedFixture);
const capabilities: HeavyJobCapabilitySnapshot = { worker: true, wasm: true, "image-decode": true };

describe("#246 real-image OCR feasibility gate (production explicitly refused)", () => {
  it("preflights actual Italian invoice PNG by signature and geometry without loading a model", async () => {
    const bytes = new Uint8Array(await readFile(fixture));
    const input = new File([bytes], "ocr-it.png", { type: "image/png" });
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(() => { throw new Error("Unexpected network request"); });
    try {
      const result = await inspectLocalImageOcr(input, "ita", undefined, capabilities);
      expect(result).toMatchObject({
        state: "refused", canRunOcr: false, reasonCode: "OCR_PRODUCTION_REFUSED_271",
        language: "ita", detectedType: "image/png", width: 1280, height: 240,
        inputBytes: bytes.byteLength, errors: [], networkPolicy: "no-requests",
        preflight: { state: "supported", resourceState: "within-limits" },
        confidence: null, recognizedText: null,
      });
      expect(result.estimatedWorkingSetBytes).toBeGreaterThan(IMAGE_OCR_FEASIBILITY.estimatedBaseBytes);
      expect(result.missingPromotionEvidence.join(" ")).toMatch(/iOS Safari fisico.*Android Chrome fisico/s);
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally { fetchSpy.mockRestore(); }
  });

  it("refuses other languages, unsupported signatures and MIME spoofing", async () => {
    const image = new Uint8Array(await readFile(fixture));
    expect(evaluateImageOcrPreflight(image.subarray(0, 33), image.length, "eng", "image/png", capabilities))
      .toMatchObject({ language: null, canRunOcr: false, state: "refused" });
    expect(evaluateImageOcrPreflight(image.subarray(0, 33), image.length, "eng", "image/png", capabilities).errors.join(" "))
      .toMatch(/OCR_LANGUAGE_NOT_ACCEPTED/);
    expect(evaluateImageOcrPreflight(image.subarray(0, 33), image.length, "ita", "image/jpeg", capabilities).errors.join(" "))
      .toMatch(/OCR_IMAGE_UNSUPPORTED/);
    expect(evaluateImageOcrPreflight(Uint8Array.of(0xff, 0xd8, 0xff), 100, "ita", "image/png", capabilities).errors.join(" "))
      .toMatch(/OCR_IMAGE_UNSUPPORTED/);
    expect(evaluateImageOcrPreflight(image.subarray(0, 16), image.length, "ita", "image/png", capabilities).errors.join(" "))
      .toMatch(/OCR_IMAGE_UNSUPPORTED/);
  });

  it("rejects forged dimension bombs and files too large before model/runtime initialization", async () => {
    const bytes = new Uint8Array(await readFile(fixture));
    const huge = bytes.subarray(0, 33).slice();
    new DataView(huge.buffer).setUint32(16, 4000, false);
    new DataView(huge.buffer).setUint32(20, 4000, false);
    // Deliberately recompute IHDR CRC so the bomb passes the header integrity
    // gate before the geometric/resource ceiling refuses it.
    let crc = 0xffffffff;
    for (const byte of huge.subarray(12, 29)) {
      crc ^= byte;
      for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
    new DataView(huge.buffer).setUint32(29, (crc ^ 0xffffffff) >>> 0, false);
    expect(evaluateImageOcrPreflight(huge, 200, "ita", "image/png", capabilities).errors.join(" "))
      .toMatch(/OCR_PIXEL_LIMIT/);
    const tampered = bytes.subarray(0, 33).slice();
    tampered[20] = (tampered[20] ?? 0) ^ 1;
    expect(evaluateImageOcrPreflight(tampered, bytes.length, "ita", "image/png", capabilities).errors.join(" "))
      .toMatch(/OCR_IMAGE_UNSUPPORTED/);
    const oversized = evaluateImageOcrPreflight(bytes.subarray(0, 33), 15 * 1024 * 1024, "ita", "image/png", capabilities);
    expect(oversized.errors.join(" ")).toMatch(/OCR_FILE_LIMIT/);
    expect(oversized.preflight.state).toBe("unsupported");
    const dangerous = new File([new Uint8Array(IMAGE_OCR_FEASIBILITY.fileHardLimitBytes + 1)], "large.png", { type: "image/png" });
    const result = await inspectLocalImageOcr(dangerous, "ita", undefined, capabilities);
    expect(result.errors.join(" ")).toMatch(/OCR_FILE_LIMIT/);
    expect(result.detectedType).toBeNull();
  });

  it("fails closed when worker, WASM or decoder is missing, and respects cancellation", async () => {
    const bytes = new Uint8Array(await readFile(fixture));
    const withoutWorker = evaluateImageOcrPreflight(bytes.subarray(0, 33), bytes.length, "ita", "image/png",
      { worker: false, wasm: true, "image-decode": true });
    expect(withoutWorker.preflight).toMatchObject({ state: "unsupported", missingRequired: ["worker"] });
    const withoutWasm = evaluateImageOcrPreflight(bytes.subarray(0, 33), bytes.length, "ita", "image/png",
      { worker: true, wasm: false, "image-decode": false });
    expect(withoutWasm.preflight.missingRequired).toEqual(["wasm", "image-decode"]);
    const ctrl = new AbortController();
    ctrl.abort();
    await expect(inspectLocalImageOcr(new File([bytes], "ocr-it.png", { type: "image/png" }), "ita", ctrl.signal))
      .rejects.toMatchObject({ name: "AbortError" });
    expect(() => evaluateImageOcrPreflight(bytes.subarray(0, 33), Number.MAX_SAFE_INTEGER + 1, "ita", "image/png", capabilities))
      .toThrow(RangeError);
  });

  it("requires the recorded package licenses and refuses promotion from desktop-only evidence", async () => {
    const metadata = JSON.parse(await readFile(resolve(root, "quality/benchmarks/heavy-local-feasibility/package-metadata.json"), "utf8"));
    const candidates = metadata.packages as Array<{ id: string; version: string; license: string }>;
    expect(candidates.find((entry) => entry.id === "tesseract-js")).toMatchObject({
      version: "7.0.0", license: IMAGE_OCR_FEASIBILITY.engineLicense,
    });
    expect(candidates.find((entry) => entry.id === "tesseract-ita")).toMatchObject({
      version: "1.0.0", license: IMAGE_OCR_FEASIBILITY.languageDataLicense,
    });
    const matrix = JSON.parse(await readFile(resolve(root, "quality/benchmarks/heavy-local-feasibility/ticket-decisions-267-275.json"), "utf8"));
    const decision = (matrix.tickets as Array<{ ticket: number; decision: string; remainingEvidence: string[] }>).find((entry) => entry.ticket === 271);
    expect(decision?.decision).toBe("REFUSE");
    expect(decision?.remainingEvidence.join(" ")).toMatch(/mobile/i);
  });
});
