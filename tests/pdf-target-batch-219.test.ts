import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { unzipSync } from "fflate";
import { inspectPdfBytes } from "../src/engines/pdf";
import { runPdfTargetBatch219, solvePdfTarget219 } from "../src/engines/pdf/target-batch-219";

const fixture = (path: string) => new Uint8Array(readFileSync(new URL(path, import.meta.url)));
const pdf = fixture("../quality/fixtures/pdf-gold/simple-3page.pdf");

describe("#219 real measured target and isolated PDF batch", () => {
  it("only says met when the FINAL byte count meets the exact target; never guesses a saving", async () => {
    const result = await solvePdfTarget219(pdf, pdf.byteLength + 10);
    expect(result).toMatchObject({ status: "met", sourceBytes: pdf.length, finalBytes: pdf.length, attempts: [] });
    expect(result.artifact!.bytes).toEqual(pdf);
    expect(result.nextActions).toEqual([]);
  });

  it("truthfully labels a structurally limited PDF as unmet rather than promising under-target", async () => {
    const result = await solvePdfTarget219(pdf, 1024);
    expect(result.status).toBe(result.finalBytes! <= 1024 ? "met" : "unmet");
    expect(result.finalBytes).toBe(result.artifact!.bytes.length);
    if (result.status === "unmet") {
      expect(result.nextActions).toEqual(["pdf-split", "pdf-page-delete-extract"]);
      expect(result.artifact!.filename).toContain("best-effort");
      expect(result.limitingContent).toMatch(/profili|flussi|contenuto/iu);
    }
    expect(inspectPdfBytes(result.artifact!.bytes).pageCount).toBe(3);
  });

  it("isolates a truly corrupt file and independently reopens only passed ZIP PDF entries", async () => {
    const correct = new File([Uint8Array.from(pdf)], "valid.pdf", { type: "application/pdf" });
    const corrupt = new File(["not-a-pdf-and-longer-than-eight"], "broken.pdf", { type: "application/pdf" });
    const another = new File([Uint8Array.from(pdf)], "second.pdf", { type: "application/pdf" });
    const output = await runPdfTargetBatch219([correct, corrupt, another], 1024 * 512);
    expect(output).toMatchObject({ attemptedFiles: 3, metTargetFiles: 2, notMetFiles: 0, refusedFiles: 1, allMet: false });
    expect(output.reports.map((report) => report.status)).toEqual(["met", "refused", "met"]);
    expect(output.zipIncludes).toHaveLength(2);
    const zip = output.artifacts.find((artifact) => artifact.mime === "application/zip")!;
    expect(zip.filename).toBe("pdf-entro-limite-verificati.zip");
    const reopened = unzipSync(zip.bytes);
    expect(Object.keys(reopened).sort()).toEqual([...output.zipIncludes].sort());
    for (const file of Object.values(reopened)) expect(inspectPdfBytes(file).pageCount).toBe(3);
  });

  it("validates exact byte targets, source memory caps and cancellation before returning a batch", async () => {
    await expect(solvePdfTarget219(pdf, 100)).rejects.toThrow(/INVALID_INPUT/u);
    await expect(solvePdfTarget219(pdf, 1.5)).rejects.toThrow(/INVALID_INPUT/u);
    await expect(runPdfTargetBatch219([], 1024)).rejects.toThrow(/INVALID_INPUT/u);
    await expect(runPdfTargetBatch219([new File([new Uint8Array(8 * 1024 * 1024 + 1)], "oversized.pdf")], 1024))
      .rejects.toThrow(/PDF_LIMIT/u);
    const aborted = new AbortController(); aborted.abort();
    await expect(runPdfTargetBatch219([new File([Uint8Array.from(pdf)], "valid.pdf")], 1024 * 512, aborted.signal))
      .rejects.toMatchObject({ name: "AbortError" });
  });
});
