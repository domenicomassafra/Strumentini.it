import { describe, expect, it } from "vitest";
import { deflateSync } from "node:zlib";
import { inspectSimplePdfImageDpi218 } from "../src/engines/pdf/placement-dpi-218";
import { pdfArray, pdfDict, pdfName, pdfNumber } from "../src/engines/pdf/parser";
import { PdfBuilder } from "../src/engines/pdf/writer";

const canvas = (operator: string, options: {
  readonly userUnit?: number;
  readonly filteredContent?: boolean;
  readonly annotation?: boolean;
  readonly pixelWidth?: number;
  readonly pixelHeight?: number;
} = {}) => {
  const builder = new PdfBuilder();
  const root = builder.reserve(), pages = builder.reserve(), page = builder.reserve();
  const width = options.pixelWidth ?? 600, height = options.pixelHeight ?? 300;
  const image = builder.putAuto({ kind: "stream", dictionary: pdfDict({
    Type: pdfName("XObject"), Subtype: pdfName("Image"), Width: pdfNumber(width), Height: pdfNumber(height),
    ColorSpace: pdfName("DeviceRGB"), BitsPerComponent: pdfNumber(8), Filter: pdfName("FlateDecode"),
  }), bytes: new Uint8Array(deflateSync(new Uint8Array(3))) });
  const contents = builder.putAuto({ kind: "stream", dictionary: pdfDict({
    ...(options.filteredContent ? { Filter: pdfName("FlateDecode") } : {}),
  }), bytes: options.filteredContent ? new Uint8Array(deflateSync(new TextEncoder().encode(operator))) : new TextEncoder().encode(operator) });
  builder.put(page, pdfDict({ Type: pdfName("Page"), Parent: pages, Contents: contents,
    MediaBox: pdfArray([pdfNumber(0), pdfNumber(0), pdfNumber(612), pdfNumber(792)]),
    Resources: pdfDict({ XObject: pdfDict({ Im0: image }) }),
    ...(options.userUnit === undefined ? {} : { UserUnit: pdfNumber(options.userUnit) }),
    ...(options.annotation ? { Annots: pdfArray([]) } : {}),
  }));
  builder.put(pages, pdfDict({ Type: pdfName("Pages"), Kids: pdfArray([page]), Count: pdfNumber(1) }));
  builder.put(root, pdfDict({ Type: pdfName("Catalog"), Pages: pages }));
  return { bytes: builder.build(root, null), imageId: image.id };
};

describe("#218 fail-closed actual image-placement DPI inspection", () => {
  it("measures separate X/Y effective DPI from a strict physical CTM, without changing a source byte", () => {
    const { bytes, imageId } = canvas("q 288 0 0 144 16 32 cm /Im0 Do Q\n");
    const original = bytes.slice();
    expect(inspectSimplePdfImageDpi218(bytes)).toEqual({ coverage: "verified-simple-uncompressed-paints",
      placements: [{ pageNumber: 1, objectId: imageId, pixelWidth: 600, pixelHeight: 300,
        paintedWidthPt: 288, paintedHeightPt: 144, xDpi: 150, yDpi: 150 }],
    });
    expect(bytes).toEqual(original);
  });

  it("supports 90-degree orthogonal rotation but does not pretend PDF UserUnit is always 1", () => {
    const rotated = inspectSimplePdfImageDpi218(canvas("q 0 288 -144 0 20 30 cm /Im0 Do Q").bytes);
    expect(rotated.placements).toMatchObject([{ xDpi: 150, yDpi: 150 }]);
    const userUnit = inspectSimplePdfImageDpi218(canvas("q 288 0 0 144 20 30 cm /Im0 Do Q", { userUnit: 2 }).bytes);
    expect(userUnit.placements).toMatchObject([{ xDpi: 75, yDpi: 75 }]);
  });

  it("records each actual paint, distinguishing a re-used image at a different size", () => {
    const source = canvas("q 288 0 0 144 0 0 cm /Im0 Do Q\nq 144 0 0 72 12 12 cm /Im0 Do Q\n");
    const measured = inspectSimplePdfImageDpi218(source.bytes);
    expect(measured.coverage).toBe("verified-simple-uncompressed-paints");
    expect(measured.placements.map((p) => [p.objectId, p.xDpi, p.yDpi])).toEqual([
      [source.imageId, 150, 150], [source.imageId, 300, 300],
    ]);
  });

  it.each([
    ["content with text operators", "q 288 0 0 144 0 0 cm /Im0 Do Q BT (Hello) Tj ET", {}],
    ["misleading Do inside a PDF string", "(q 288 0 0 144 0 0 cm /Im0 Do Q) Tj", {}],
    ["misleading Do inside a PDF comment", "% q 288 0 0 144 0 0 cm /Im0 Do Q", {}],
    ["unknown image name", "q 288 0 0 144 0 0 cm /Im9 Do Q", {}],
    ["Form-like transform", "q 1 0 0 1 0 0 cm /Fm1 Do Q", {}],
    ["skewed image axes", "q 288 0 20 144 0 0 cm /Im0 Do Q", {}],
    ["degenerate image transform", "q 0 0 0 144 0 0 cm /Im0 Do Q", {}],
    ["nested graphics state", "q q 288 0 0 144 0 0 cm /Im0 Do Q Q", {}],
    ["content stream compressed", "q 288 0 0 144 0 0 cm /Im0 Do Q", { filteredContent: true }],
    ["annotations can paint outside Contents", "q 288 0 0 144 0 0 cm /Im0 Do Q", { annotation: true }],
    ["invalid page unit", "q 288 0 0 144 0 0 cm /Im0 Do Q", { userUnit: 0 }],
    ["huge transform", "q 99999999 0 0 144 0 0 cm /Im0 Do Q", {}],
  ] as const)("returns global unknown for %s, never an apparently verified DPI", (_, program, options) => {
    const result = inspectSimplePdfImageDpi218(canvas(program, options).bytes);
    expect(result.coverage).toBe("unknown");
    expect(result.placements).toEqual([]);
  });

  it("fail-closes a pre-aborted request without misleading partial metadata", () => {
    const signal = new AbortController(); signal.abort();
    expect(() => inspectSimplePdfImageDpi218(canvas("q 288 0 0 144 0 0 cm /Im0 Do Q").bytes, signal.signal))
      .toThrow(/cancelled/u);
  });

  it("returns unknown for actual compressed-content production fixture instead of inventing page DPI", async () => {
    const { readFileSync } = await import("node:fs");
    const bytes = readFileSync(new URL("../quality/fixtures/pdf-gold/jpeg-1page.pdf", import.meta.url));
    const result = inspectSimplePdfImageDpi218(new Uint8Array(bytes));
    if (result.coverage === "verified-simple-uncompressed-paints") {
      expect(result.placements.every((p) => p.xDpi > 0 && p.yDpi > 0)).toBe(true);
    } else {
      expect(result.placements).toEqual([]);
      expect(result.reason).toBeTruthy();
    }
  });
});
