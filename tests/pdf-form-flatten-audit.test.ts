import { describe, expect, it } from "vitest";
import { createSimplePdf, extractPdfText, flattenPdfVerified, inspectPdfFormAnnotations, inspectPdfBytes } from "../src/engines/pdf";
import inspector from "../src/tools/pdf-form-inspector/module";
import flatten from "../src/tools/pdf-flatten/module";

import { formAnnotationFixture } from "./fixtures/pdf-form-annotation-fixture";

function file(bytes: Uint8Array): File {
  return new File([bytes.slice().buffer as ArrayBuffer], "form.pdf", { type: "application/pdf" });
}

describe("319 — PDF form and annotation inspection and safe flatten", () => {
  it("inventories widget/page/object and field provenance without mutating the source", async () => {
    const source = file(formAnnotationFixture(2));
    const result = await inspector.run({ file: source }, { defaults: {} }) as {
      forms: readonly unknown[];
      audit: { fieldCount: number; annotationCount: number; hiddenAnnotationCount: number; widgetCount: number; appearanceStreamCount: number; fields: { name: string; objectId: number | null; pages: readonly number[]; widgetObjectIds: readonly number[] }[]; annotations: { objectId: number | null; page: number; hidden: boolean }[] };
    };
    expect(result.audit).toMatchObject({
      fieldCount: 1, annotationCount: 1, hiddenAnnotationCount: 1, widgetCount: 1, appearanceStreamCount: 1,
      fields: [{ name: "client", objectId: 7, pages: [1], widgetObjectIds: [5] }],
      annotations: [{ objectId: 5, page: 1, hidden: true }],
    });
    expect(result.forms).toEqual([expect.objectContaining({ name: "client", value: "Alice", fieldType: "Tx" })]);
    expect(result.audit.fields[0]?.name).toBe("client");
  });

  it("removes only hidden widgets in the supported subset with post-output identity checks", async () => {
    const original = formAnnotationFixture(2);
    const result = await flatten.run({ file: file(original) }, { defaults: {} }) as {
      artifacts: { bytes: Uint8Array }[];
      verification: { before: { annotationCount: number; fieldCount: number }; after: { annotationCount: number; fieldCount: number }; allPageHooksRemoved: boolean; contentTextStable: boolean; geometryStable: boolean; imageCountStable: boolean; visualSafety: string; capabilities: { before: { capability: string; available: boolean }[]; after: { capability: string; available: boolean }[] } };
    };
    expect(result.verification).toMatchObject({
      before: { annotationCount: 1, fieldCount: 1 },
      after: { annotationCount: 0, fieldCount: 0 },
      allPageHooksRemoved: true, contentTextStable: true, geometryStable: true, imageCountStable: true,
      visualSafety: "no-visible-annotation-to-paint",
    });
    expect(inspectPdfBytes(result.artifacts[0]!.bytes).pages[0]?.annotationCount).toBe(0);
    expect(result.verification.capabilities.before.find((item) => item.capability === "flatten")?.available).toBe(true);
    expect(result.verification.capabilities.after.find((item) => item.capability === "flatten")?.available).toBe(true);
    expect((await extractPdfText(original)).map((p) => p.text))
      .toEqual((await extractPdfText(result.artifacts[0]!.bytes)).map((p) => p.text));
  });

  it("rejects visible widgets and link annotations rather than dropping appearance streams", async () => {
    for (const subtype of ["Widget", "Link"] as const) {
      const pdf = formAnnotationFixture(0, subtype);
      const inspection = await inspectPdfFormAnnotations(pdf);
      expect(inspection.audit.unsafeAppearance).toBe(true);
      expect(inspection.audit.visibleAnnotationCount).toBe(1);
      expect(inspection.inspection.capabilities.find((item) => item.capability === "flatten")?.available).toBe(false);
      await expect(flattenPdfVerified(pdf)).rejects.toThrow(/UNSUPPORTED_CAPABILITY|Non è possibile conservare/u);
      await expect(flatten.run({ file: file(pdf) }, { defaults: {} })).rejects.toThrow(/Non è possibile conservare/u);
    }
  });

  it("reopens no-annotation documents without falsely claiming pixel verification", async () => {
    const clean = createSimplePdf(["alpha", "beta"]);
    const result = await flattenPdfVerified(clean);
    expect(result.verification).toMatchObject({
      before: { annotationCount: 0, fieldCount: 0 },
      after: { annotationCount: 0, fieldCount: 0 },
      renderComparison: "not-performed-in-module",
    });
  });

  it("rejects viewer-generated form appearances even when page annotations are hidden", async () => {
    const dynamic = new TextEncoder().encode(
      new TextDecoder().decode(formAnnotationFixture(2)).replace(
        "/AcroForm << /Fields [7 0 R] >>",
        "/AcroForm << /Fields [7 0 R] /NeedAppearances true >>",
      ),
    );
    const inspected = await inspectPdfFormAnnotations(dynamic);
    expect(inspected.audit.unsafeAppearance).toBe(true);
    expect(inspected.audit.blockers).toEqual(expect.arrayContaining([expect.stringContaining("dinamicamente")]));
    expect(inspected.inspection.capabilities.find((item) => item.capability === "flatten")?.available).toBe(false);
    await expect(flattenPdfVerified(dynamic)).rejects.toThrow(/Non è possibile conservare/u);
  });

  it("fails closed on malformed annotation arrays or cancellation", async () => {
    const malformed = new TextEncoder().encode(
      new TextDecoder().decode(formAnnotationFixture(2)).replace("/Annots [5 0 R]", "/Annots << /Broken true >>"),
    );
    expect(() => inspectPdfBytes(malformed).capabilities.find((entry) => entry.capability === "flatten"))
      .not.toThrow();
    const inspected = inspectPdfBytes(malformed);
    expect(inspected.capabilities.find((entry) => entry.capability === "flatten")?.available).toBe(false);
    await expect(flattenPdfVerified(malformed)).rejects.toThrow();
    const controller = new AbortController();
    controller.abort();
    await expect(flattenPdfVerified(formAnnotationFixture(2), "cancelled.pdf", controller.signal)).rejects.toThrow();
  });
});
