import { readFileSync } from "node:fs";
import { h } from "preact";
import render from "preact-render-to-string";
import { describe, expect, it } from "vitest";
import { resultV2Inventory } from "../src/catalog/result-v2-inventory.generated";
import { createSimplePdf } from "../src/engines/pdf";
import { PdfResultV2, preparePdfResult } from "../src/components/tools/pdf/PdfResultV2";
import { PDF_RESULT_DECLARATIONS } from "../src/tools/pdf-result-declarations";

const ticket98 = "legacy-expansion:98";

function owned(bytes: Uint8Array): Uint8Array {
  return Uint8Array.from(bytes);
}

function pdfArtifact(bytes: Uint8Array, filename = "result.pdf", pageCount = 2) {
  const copy = owned(bytes);
  return {
    bytes: copy,
    blob: new Blob([copy.buffer as ArrayBuffer], { type: "application/pdf" }),
    filename,
    mime: "application/pdf" as const,
    pageCount,
  };
}

describe("ticket 98 PDF/document Result v2 migration", () => {
  it("declares 21 PDF/document tools and preserves original ticket 98 ownership", () => {
    const declarations = Object.values(PDF_RESULT_DECLARATIONS);
    expect(declarations).toHaveLength(21);
    expect(declarations.filter(({ class: resultClass }) => resultClass === "pdf")).toHaveLength(10);
    expect(declarations.filter(({ class: resultClass }) => resultClass === "file")).toHaveLength(2);
    expect(declarations.filter(({ class: resultClass }) => resultClass === "text-code")).toHaveLength(3);
    expect(declarations.filter(({ class: resultClass }) => resultClass === "validator")).toHaveLength(6);
    expect(Object.values(PDF_RESULT_DECLARATIONS).some(({ capabilities }) => new Set<string>(capabilities).has("share"))).toBe(false);
    expect(Object.values(PDF_RESULT_DECLARATIONS).some(({ capabilities }) => new Set<string>(capabilities).has("reuse"))).toBe(false);

    const originalIds = new Set(Object.keys(PDF_RESULT_DECLARATIONS).filter((id) => id !== "pdf-repair"));
    const owned = resultV2Inventory.filter(({ migrationOwner, toolId }) => migrationOwner === ticket98 && originalIds.has(toolId));
    expect(owned).toHaveLength(20);
    expect(owned.map(({ toolId }) => toolId).toSorted()).toEqual([...originalIds].toSorted());
    for (const entry of owned) {
      const declaration = PDF_RESULT_DECLARATIONS[entry.toolId as keyof typeof PDF_RESULT_DECLARATIONS];
      expect(entry.resultDeclaration).toEqual({ state: "declared", ...declaration });
    }
  });

  it("verifies generated PDF bytes and independently reopens page facts before download", async () => {
    const bytes = createSimplePdf(["uno", "due"]);
    const prepared = await preparePdfResult("pdf-merge", {
      artifacts: [pdfArtifact(bytes)],
      artifactCount: 1,
      totalBytes: bytes.byteLength,
      pageCount: 2,
    });
    expect(prepared.artifacts).toHaveLength(1);
    expect(prepared.artifacts[0]?.artifact).toMatchObject({
      kind: "pdf",
      mime: "application/pdf",
      verification: {
        state: "verified",
        verifiedMime: "application/pdf",
      },
      download: { ready: true },
    });
    expect(prepared.artifacts[0]?.artifact.verification.method).toMatch(/parser PDF locale/u);

    const broken = new TextEncoder().encode("%PDF-1.7\n1 0 obj\n<<>>\nendobj\n");
    const invalid = await preparePdfResult("pdf-merge", {
      artifacts: [pdfArtifact(broken, "broken.pdf", 1)],
      artifactCount: 1,
      totalBytes: broken.byteLength,
      pageCount: 1,
    });
    expect(invalid.artifacts[0]?.artifact.download.ready).toBe(false);
    expect(invalid.artifacts[0]?.artifact.verification.state).toBe("invalid");
  });

  it("renders PDF results with structural page controls, page/byte facts and verified file workspace", async () => {
    const bytes = createSimplePdf(["uno", "due", "tre"]);
    const result = await preparePdfResult("pdf-merge", {
      artifacts: [pdfArtifact(bytes, "merged.pdf", 3)],
      artifactCount: 1,
      totalBytes: bytes.byteLength,
      pageCount: 3,
    });
    const html = render(h(PdfResultV2, {
      toolId: "pdf-merge",
      result,
      sourceFiles: [new File([owned(bytes).buffer as ArrayBuffer], "source.pdf", { type: "application/pdf" })],
      onReset: () => undefined,
      onRetry: () => undefined,
    }));
    expect(html).toContain('data-result-class="pdf"');
    expect(html).toContain('data-result-slot="page-preview"');
    expect(html).toContain('data-page-preview-control="true"');
    expect(html).toContain('data-result-slot="operation-summary"');
    expect(html).toContain('data-result-slot="file-workspace"');
    expect(html).toContain("Pagine prodotte");
    expect(html).toContain("Firma/contenitore coerenti");
    expect(html).toContain("Le miniature non sono disponibili");
    expect(html).not.toContain("<img");
    expect(html).toContain('data-result-action="download"');
    expect(html).toContain('data-result-action="retry"');
    expect(html).toContain('data-result-action="reset"');
  });

  it("uses file semantics for extracted JPEG artifacts without inventing a PDF preview", async () => {
    const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x00, 0xff, 0xd9]);
    const result = await preparePdfResult("pdf-to-images", {
      artifacts: [{
        bytes: jpeg,
        blob: new Blob([jpeg], { type: "image/jpeg" }),
        filename: "image-1.jpg",
        mime: "image/jpeg",
      }],
      artifactCount: 1,
      totalBytes: jpeg.byteLength,
    });
    const html = render(h(PdfResultV2, {
      toolId: "pdf-to-images",
      result,
      sourceFiles: [],
      onReset: () => undefined,
      onRetry: () => undefined,
    }));
    expect(html).toContain('data-result-class="file"');
    expect(html).toContain('data-result-slot="file-workspace"');
    expect(html).not.toContain('data-result-slot="page-preview"');
    expect(html).toContain('data-result-action="download"');
  });

  it("keeps long extracted text bounded while exposing the complete result to copy", () => {
    const text = Array.from({ length: 80 }, (_, index) => `riga ${index + 1}`).join("\n");
    const html = render(h(PdfResultV2, {
      toolId: "pdf-text-extraction",
      result: { raw: { text, pages: [{ page: 1, text, truncated: false }], truncated: false }, artifacts: [] },
      sourceFiles: [],
      onReset: () => undefined,
    }));
    expect(html).toContain('data-result-class="text-code"');
    expect(html).toContain('data-result-slot="counts"');
    expect(html).toContain('data-result-slot="selectable-output"');
    expect(html).toContain("Anteprima: 36 di 80 righe");
    expect(html).toContain('data-result-action="copy"');
    expect(html).not.toContain('data-result-action="download"');
    expect(html).toContain("Dati tecnici strutturati (anteprima)");
  });

  it("renders inspector results as validators with facts before bounded raw structure", () => {
    const html = render(h(PdfResultV2, {
      toolId: "pdf-page-count-verifier",
      result: {
        raw: { pageCount: 4, declaredPageCount: 4, objectCount: 12, encrypted: false, validSignature: true },
        artifacts: [],
      },
      sourceFiles: [],
      onReset: () => undefined,
      onRetry: () => undefined,
    }));
    expect(html).toContain('data-result-class="validator"');
    expect(html).toContain('data-result-slot="primary"');
    expect(html).toContain("Conteggio verificato: 4 pagine");
    expect(html).toContain('data-result-slot="checks"');
    expect(html).toContain('data-result-slot="provenance"');
    expect(html).toContain('data-result-action="copy"');
    expect(html).toContain('data-result-action="retry"');
    expect(html).toContain('data-result-secondary-raw="true"');
  });

  it("removes PdfTool's legacy manual result panel", () => {
    const source = readFileSync(new URL("../src/components/tools/pdf/PdfTool.tsx", import.meta.url), "utf8");
    expect(source).not.toContain('class="result-panel gutter"');
    expect(source).toContain("ToolResultPanel");
    expect(source).toContain("PdfResultV2");
  });
});
