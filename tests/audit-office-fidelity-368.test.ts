import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import {
  OFFICE_368_FIXTURES,
  auditOfficeFidelity368,
  inspectOoxml368,
} from "../scripts/audit-office-fidelity-368";

const root = resolve(import.meta.dirname, "..");
const spike = resolve(root, "spikes/heavy-local-feasibility");
const installed = createRequire(resolve(spike, "package.json"));

describe("#368 installed Office donors: independently reopened real output and explicit fidelity loss", () => {
  it("produces DOCX→HTML, XLSX→XLSX and PPTX→PPTX from 3 SHA-bound rich fixtures", async () => {
    const candidates: Partial<Record<"docx" | "xlsx" | "pptx", Buffer>> = {};
    const result = await auditOfficeFidelity368({
      root, spike, onCandidate: (format, bytes) => { candidates[format] = bytes; },
    });
    expect(result.decision).toBe("NO_GO");
    expect(result.productionPromotion).toBe(false);
    expect(result.externalVendorStatus).toMatchObject({
      libreConvert: "NOT_INSTALLED_NOT_RUN",
      zetaOffice: "NOT_INSTALLED_NOT_RUN",
    });
    for (const kind of ["docx", "xlsx", "pptx"] as const) {
      const item = result.formats[kind];
      expect(item.state, kind).toBe("MEASURED_WITH_FIDELITY_LOSS");
      expect(item.sourceSha256).toBe(OFFICE_368_FIXTURES[kind].sha256);
      expect(item.candidateSha256).toMatch(/^[a-f0-9]{64}$/u);
      expect(item.candidateBytes).toBeGreaterThan(300);
      expect(item.sourceMediaCount).toBeGreaterThan(0);
      expect(item.visualPageFidelity).toBe("NOT_VERIFIED");
      expect(item.noNetwork).toBe("NO_URL_FETCH_REQUESTED");
      expect(item.unsupported.length).toBeGreaterThan(0);
    }
    expect(result.formats.docx).toMatchObject({
      outputType: "html",
      textMissingCount: 0,
      sourceMediaCount: 2,
      candidateMediaCount: 2,
      exactMediaPreservedCount: 2,
      sourceTableCount: 1,
      state: "MEASURED_WITH_FIDELITY_LOSS",
    });
    expect(result.formats.xlsx).toMatchObject({
      outputType: "xlsx",
      textMissingCount: 0,
      sourceMediaCount: 2,
      candidateMediaCount: 0,
      exactMediaPreservedCount: 0,
      sourceChartCount: 1,
      candidateChartCount: 0,
      sourceFormulaCount: 0,
      candidateFormulaCount: 0,
    });
    expect(result.formats.pptx).toMatchObject({
      outputType: "pptx",
      textMissingCount: 0,
      sourceMediaCount: 2,
      candidateMediaCount: 0,
      sourceChartCount: 1,
      candidateChartCount: 0,
    });
    const originalDoc = await inspectOoxml368(await readFile(resolve(root, OFFICE_368_FIXTURES.docx.relativePath)), "docx", spike);
    const html = candidates.docx!.toString("utf8");
    expect(html).toContain("<table>");
    expect(html).toContain("Ticket 264 - editable DOCX with raster media");
    const actualImages = [...html.matchAll(/<img\b[^>]*\bsrc="data:[^;"]+;base64,([a-z0-9+/=]+)"/giu)]
      .map((match) => createHash("sha256").update(Buffer.from(match[1]!, "base64")).digest("hex"));
    expect([...actualImages].sort()).toEqual([...originalDoc.mediaSha256].sort());
    const originalSheet = await inspectOoxml368(await readFile(resolve(root, OFFICE_368_FIXTURES.xlsx.relativePath)), "xlsx", spike);
    const outputSheet = await inspectOoxml368(candidates.xlsx!, "xlsx", spike);
    expect(outputSheet.cells).toEqual(originalSheet.cells);
    expect(outputSheet.mediaSha256).toHaveLength(0);
    const originalSlides = await inspectOoxml368(await readFile(resolve(root, OFFICE_368_FIXTURES.pptx.relativePath)), "pptx", spike);
    const outputSlides = await inspectOoxml368(candidates.pptx!, "pptx", spike);
    expect(outputSlides.text).toEqual(originalSlides.text);
    expect(outputSlides.slideCount).toBe(originalSlides.slideCount);
    expect(outputSlides.pageGeometry).toEqual(originalSlides.pageGeometry);
    expect(outputSlides.mediaSha256).toHaveLength(0);
    expect(result.licensing.mammoth).toMatchObject({ version: "1.13.0", license: "BSD-2-Clause", verified: true });
    expect(result.licensing.xlsx).toMatchObject({ version: "0.18.5", license: "Apache-2.0", verified: true });
    expect(result.licensing.pptxgenjs).toMatchObject({ version: "4.0.1", license: "MIT", verified: true });
  }, 30_000);

  it("refuses any tampered source before a donor can produce a candidate", async () => {
    const source = Buffer.from(await readFile(resolve(root, OFFICE_368_FIXTURES.docx.relativePath)));
    source[source.length - 1] = source[source.length - 1]! ^ 1;
    const before = Buffer.from(source);
    const result = await auditOfficeFidelity368({
      root, spike, formats: ["docx"], fixtureOverrides: { docx: source },
    });
    expect(result.formats.docx).toMatchObject({
      state: "NO_GO", candidateSha256: null, sourceSha256: null,
    });
    expect(result.formats.docx.reasons).toContain("SOURCE_SHA256_CHANGED");
    expect(source).toEqual(before);
  });

  it("rejects fake ZIP, an expansion bomb and macro content without running them", async () => {
    await expect(inspectOoxml368(Buffer.from("PK\u0003\u0004"), "docx")).rejects.toThrow(/INVALID_ZIP/u);
    const Zip = installed("jszip") as { new (): {
      file: (name: string, data: string) => void;
      generateAsync: (args: { type: "nodebuffer"; compression: "DEFLATE" }) => Promise<Buffer>;
    } };
    const zip = new Zip();
    zip.file("[Content_Types].xml", "<Types/>");
    zip.file("word/document.xml", "a".repeat(17 * 1024 * 1024));
    await expect(inspectOoxml368(await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" }), "docx"))
      .rejects.toThrow(/ZIP_EXPANSION_LIMIT/u);
    const macro = new Zip();
    macro.file("[Content_Types].xml", "<Types/>");
    macro.file("word/document.xml", "<w:document/>");
    macro.file("word/vbaProject.bin", "SYNTHETIC_MACRO_MARKER_DO_NOT_RUN");
    await expect(inspectOoxml368(await macro.generateAsync({ type: "nodebuffer", compression: "DEFLATE" }), "docx"))
      .rejects.toThrow(/ACTIVE_CONTENT_REFUSED/u);
    const traversal = new Zip();
    traversal.file("[Content_Types].xml", "<Types/>");
    traversal.file("word/document.xml", "<w:document/>");
    traversal.file("../escape.txt", "not allowed");
    await expect(inspectOoxml368(await traversal.generateAsync({ type: "nodebuffer", compression: "DEFLATE" }), "docx"))
      .rejects.toThrow(/ACTIVE_CONTENT_REFUSED/u);
  });

  it("blocks use of a donor whose pinned installed license metadata differs", async () => {
    const result = await auditOfficeFidelity368({
      root, spike, formats: ["pptx"],
      requiredDonorLicenses: { pptxgenjs: "UNKNOWN_VENDOR_LICENSE" },
    });
    expect(result.formats.pptx.state).toBe("NO_GO");
    expect(result.formats.pptx.candidateSha256).toBeNull();
    expect(result.formats.pptx.reasons).toContain("DONOR_LICENSE_MISMATCH");
  });

  it("keeps original bytes untouched and cancels an already aborted audit", async () => {
    const controller = new AbortController();
    controller.abort();
    const source = await readFile(resolve(root, OFFICE_368_FIXTURES.xlsx.relativePath));
    const original = createHash("sha256").update(source).digest("hex");
    const result = await auditOfficeFidelity368({
      root, spike, formats: ["xlsx"], fixtureOverrides: { xlsx: source }, signal: controller.signal,
    });
    expect(result.formats.xlsx).toMatchObject({ state: "NO_GO", candidateBytes: 0, candidateSha256: null });
    expect(result.formats.xlsx.reasons).toContain("ABORTED");
    expect(createHash("sha256").update(source).digest("hex")).toBe(original);
  });
});
