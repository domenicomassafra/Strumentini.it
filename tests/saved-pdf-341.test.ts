import { describe, expect, it } from "vitest";
import { createSimplePdf } from "../src/engines/pdf/writer";
import { createOutputArtifactDescriptor } from "../src/runtime/output-artifact";
import { maySavePdf341, savePdf341, SAVED_PDF_MAX_COUNT_341, SAVED_PDF_MAX_FILE_341, SAVED_PDF_MAX_TOTAL_341 } from "../src/workbench/saved-pdf-341";

const valid = (bytes = new Uint8Array(createSimplePdf(["SAVED_PDF_341"]))) => createOutputArtifactDescriptor({
  kind: "pdf", name: "saved341.pdf", mime: "application/pdf", bytes,
  verification: { state: "verified", verifiedMime: "application/pdf", method: "local PDF structure readback" },
  fidelity: "structural", fidelityNote: "Only verified generated PDF bytes",
});

describe("#341 user opt-in saved PDF store guardrails", () => {
  it("allows only coherent, verified PDF output; no implicit saving or hidden uploads", () => {
    const artifact = valid();
    expect(maySavePdf341(artifact)).toBe(true);
    expect(maySavePdf341({ ...artifact, download: { ...artifact.download, ready: false } })).toBe(false);
    expect(maySavePdf341({ ...artifact, verification: { state: "warning" } })).toBe(false);
    expect(maySavePdf341({ ...artifact, name: "../../private.pdf" })).toBe(false);
    expect(maySavePdf341({ ...artifact, name: "saved341.png" })).toBe(false);
    expect(maySavePdf341({ ...artifact, byteLength: SAVED_PDF_MAX_FILE_341 + 1 })).toBe(false);
    expect(maySavePdf341({ ...artifact, bytes: new Uint8Array(0), byteLength: 0 })).toBe(false);
  });

  it("refuses header-only/truncated PDF before opening storage, and keeps file limits explicit", () => {
    const a = valid();
    expect(maySavePdf341({ ...a, bytes: a.bytes.slice(0, 10), byteLength: 10 })).toBe(false);
    expect(maySavePdf341({ ...a, bytes: a.bytes.slice(0, -8), byteLength: a.byteLength - 8 })).toBe(false);
    expect(SAVED_PDF_MAX_COUNT_341).toBe(5);
    expect(SAVED_PDF_MAX_TOTAL_341).toBe(24 * 1024 * 1024);
    expect(SAVED_PDF_MAX_FILE_341).toBe(8 * 1024 * 1024);
  });

  it("denied IndexedDB cannot claim to have persisted and leaves output intact", async () => {
    const artifact = valid();
    await expect(savePdf341(artifact)).rejects.toThrow(/SAVED_PDF_341_/u);
    expect(artifact.bytes.byteLength).toBeGreaterThan(100);
    expect(artifact.download.ready).toBe(true);
  });
});
