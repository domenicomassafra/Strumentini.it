import { describe, expect, it } from "vitest";
import { buildPdfFromPages, createSimplePdf } from "../src/engines/pdf/writer";
import { nameValue, parsePdf, pdfName } from "../src/engines/pdf/parser";
import { editPdfOriginalText133 } from "../src/engines/pdf/edit-original-text-133";

function courierFixture(): Uint8Array {
  const source = parsePdf(createSimplePdf(["ALFA"]));
  const objects = new Map(source.objects);
  for (const object of objects.values()) {
    if (object.value.kind === "dict" && nameValue(object.value.entries.get("Subtype")) === "Type1") {
      objects.set(object.id, { ...object, value: {
        kind: "dict", entries: new Map([...object.value.entries, ["BaseFont", pdfName("Courier")]]),
      } });
    }
  }
  const changed = { ...source, objects };
  return buildPdfFromPages(changed.pages.map((page) => ({ document: changed, page })), { flatten: false, compress: false });
}

describe("STR-373 transparent refusal at the semantic editing boundary", () => {
  it("rejects unencodable glyphs and unequal advances while preserving source bytes", () => {
    const source = courierFixture();
    const initial = source.slice();
    expect(() => editPdfOriginalText133(source, { page: 1, before: "ALFA", after: "CAFÉ" }))
      .toThrow(/UNSUPPORTED_CAPABILITY: GLYPH/);
    expect(() => editPdfOriginalText133(source, { page: 1, before: "ALFA", after: "LONGER" }))
      .toThrow(/UNSUPPORTED_CAPABILITY: LAYOUT/);
    expect(() => editPdfOriginalText133(source, { page: 1, before: "ALFA", after: "BETA" }))
      .not.toThrow();
    expect(source).toEqual(initial);
  });

  it("refuses non-Courier fonts and ambiguous text rather than exporting a false-fidelity result", () => {
    const source = courierFixture();
    const wrongFont = createSimplePdf(["ALFA"]);
    expect(() => editPdfOriginalText133(wrongFont, { page: 1, before: "ALFA", after: "BETA" }))
      .toThrow(/UNSUPPORTED_CAPABILITY: FONT/);
    expect(() => editPdfOriginalText133(source, { page: 1, before: "DIFFERENT", after: "SOMETHING" }))
      .toThrow(/UNSUPPORTED_CAPABILITY: AMBIGUOUS_TEXT/);
  });
});
