import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { identifyPortableImage } from "../src/engines/image/portable-decode";
import conversionManifest from "../src/tools/image-format-conversion/manifest";
import imagesToPdfManifest from "../src/tools/images-to-pdf/manifest";
import pdfToImagesManifest from "../src/tools/pdf-to-images/manifest";

function bytes(name: string): Uint8Array {
  return new Uint8Array(readFileSync(new URL(`../quality/fixtures/image-format-matrix/${name}`, import.meta.url)));
}

describe("high-value image/PDF conversion matrix", () => {
  it("signature-identifies PNG, AVIF, HEIC and GIF with truthful decoder/frame policy", () => {
    expect(identifyPortableImage(bytes("source.png"), { name: "source.png", type: "image/png" })).toMatchObject({ kind: "png", mime: "image/png", decoder: "browser", framePolicy: "single-image" });
    expect(identifyPortableImage(bytes("source.avif"), { name: "source.avif", type: "image/avif" })).toMatchObject({ kind: "avif", mime: "image/avif", decoder: "browser", framePolicy: "single-image" });
    expect(identifyPortableImage(bytes("source.heic"), { name: "source.heic", type: "image/heic" })).toMatchObject({ kind: "heic", mime: "image/heic", decoder: "libheif-wasm", framePolicy: "single-image" });
    expect(identifyPortableImage(bytes("source.gif"), { name: "source.gif", type: "image/gif" })).toMatchObject({ kind: "gif", mime: "image/gif", decoder: "browser", framePolicy: "first-frame-only" });
  });

  it("advertises the concrete directional intents instead of hiding them behind a generic label", () => {
    expect(conversionManifest.aliases).toEqual(expect.arrayContaining(["jpg to png", "png to jpg", "heic to jpg", "avif to png", "gif to png"]));
    expect(conversionManifest.inputTypes).toEqual(expect.arrayContaining(["image/jpeg", "image/png", "image/webp", "image/avif", "image/heic", "image/heif", "image/gif"]));
    expect(imagesToPdfManifest.aliases).toEqual(expect.arrayContaining(["jpg to pdf", "png to pdf", "webp to pdf", "heic to pdf"]));
    expect(pdfToImagesManifest.aliases).toEqual(expect.arrayContaining(["pdf to jpg", "pdf to png", "pdf to webp"]));
  });
});
