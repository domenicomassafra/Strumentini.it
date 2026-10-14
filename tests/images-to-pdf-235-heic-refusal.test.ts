import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import imagesToPdf from "../src/tools/images-to-pdf/module";
import { IMAGES_TO_PDF_HEIC_REFUSAL, isDeclaredHeicPdfInput } from "../src/tools/images-to-pdf/format-policy";
import { inspectPdfBytes } from "../src/engines/pdf";
import { imagesToPdfManifest } from "../src/tools/images-to-pdf/manifest";
import type { ImagesToPdfOutput } from "../src/tools/images-to-pdf/types";

const source = (filename: string, type: string, bytes: Uint8Array) =>
  Object.assign(new Blob([Uint8Array.from(bytes)], { type }), { name: filename });
const fixture = (filename: string) =>
  new Uint8Array(readFileSync(new URL(`../quality/fixtures/image-format-matrix/${filename}`, import.meta.url)));
const run = async (files: Blob[]): Promise<ImagesToPdfOutput> =>
  await imagesToPdf.run({ files }, { defaults: {} }) as ImagesToPdfOutput;

describe("#235 Images to PDF HEIC promotion refusal", () => {
  it("keeps unapproved HEIC/HEIF out of public manifest", () => {
    expect(imagesToPdfManifest.inputTypes).not.toEqual(expect.arrayContaining(["image/heic", "image/heif"]));
    expect(imagesToPdfManifest.summary).toMatch(/HEIC\/HEIF not approved/u);
    expect(isDeclaredHeicPdfInput("iPhone.heic", "application/octet-stream")).toBe(true);
    expect(isDeclaredHeicPdfInput("capture.jpg", "image/heif")).toBe(true);
    expect(isDeclaredHeicPdfInput("scan.png", "image/png")).toBe(false);
  });

  it.each([
    ["HEIC declaration", "iphone.heic", "image/heic", fixture("source.heic")],
    ["HEIF extension with generic MIME", "iphone.heif", "application/octet-stream", fixture("source.heic")],
    ["forged PNG extension and MIME with HEIF ftyp signature", "renamed.png", "image/png", fixture("source.heic")],
  ])("refuses %s before producing any PDF", async (_case, filename, type, bytes) => {
    const jpeg = source("source.jpg", "image/jpeg", fixture("source.jpg"));
    await expect(run([jpeg, source(filename, type, bytes)])).rejects.toThrow(IMAGES_TO_PDF_HEIC_REFUSAL);
    await expect(run([source(filename, type, bytes), jpeg])).rejects.toThrow(IMAGES_TO_PDF_HEIC_REFUSAL);
  });

  it("still embeds genuine JPEG without invoking HEIC decoder", async () => {
    const result = await run([source("source.jpg", "image/jpeg", fixture("source.jpg"))]);
    const bytes = result.artifacts[0]?.bytes;
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(inspectPdfBytes(bytes as Uint8Array).pageCount).toBe(1);
    expect(result.conversions).toMatchObject([{ inputMime: "image/jpeg", embeddedAs: "original-jpeg", decoder: "browser" }]);
  });
});
