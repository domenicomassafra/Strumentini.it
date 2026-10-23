/** #99: directional conversion is accepted only for a proven codec signature.
 * The checked-in HEIC sample is macOS-generated, not an iPhone-origin receipt.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { decodePortableImage, identifyPortableImage } from "../src/engines/image/portable-decode";

const fixture = (name: string): Uint8Array =>
  new Uint8Array(readFileSync(new URL(`../quality/fixtures/image-format-matrix/${name}`, import.meta.url)));
const spoof = (source: Uint8Array, name: string, type: string) => ({
  name, type, size: source.length, blob: new Blob([new Uint8Array(source)], { type }),
});

describe("#99 signed HEIC/AVIF directional input boundary", () => {
  it("identifies independently stored HEIC and AVIF from their real ftyp brands, even if mislabeled", () => {
    expect(identifyPortableImage(fixture("source.heic"), { name: "spoof.avif", type: "image/avif" }))
      .toMatchObject({ kind: "heic", mime: "image/heic", framePolicy: "single-image" });
    expect(identifyPortableImage(fixture("source.avif"), { name: "spoof.heic", type: "image/heic" }))
      .toMatchObject({ kind: "avif", mime: "image/avif", framePolicy: "single-image" });
  });

  it("rejects MIME- or filename-only AVIF and HEIC, before any native decoder is used", async () => {
    const arbitrary = Uint8Array.of(0x42, 0x4d, 0, 0, 0, 0, 0, 0); // BMP magic, no approved image signature
    for (const [name, type] of [["fake.avif", "image/avif"], ["fake.heic", "image/heic"], ["fake.heif", "image/heif"]]) {
      expect(() => identifyPortableImage(arbitrary, { name: name!, type: type! })).toThrow(/UNSUPPORTED_TYPE/);
    }
    const native = vi.fn(async () => ({ width: 1, height: 1, close() {} }));
    vi.stubGlobal("createImageBitmap", native);
    try {
      await expect(decodePortableImage(spoof(arbitrary, "fake.avif", "image/avif"))).rejects.toThrow(/UNSUPPORTED_TYPE/);
      expect(native).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("refuses generic HEIF with mif1 only and contradictory HEVC/AV1 brands", () => {
    const generic = Uint8Array.of(
      0, 0, 0, 20, 0x66, 0x74, 0x79, 0x70, // ftyp
      0x6d, 0x69, 0x66, 0x31, 0, 0, 0, 0, // major mif1
      0x6d, 0x69, 0x66, 0x31, // compatible mif1
    );
    expect(() => identifyPortableImage(generic, { name: "fake.heic", type: "image/heic" }))
      .toThrow(/UNSUPPORTED_TYPE/);

    const conflicting = fixture("source.heic").slice();
    conflicting.set([0x61, 0x76, 0x69, 0x66], 16); // compatible-brand AVIF + major HEIC
    expect(() => identifyPortableImage(conflicting)).toThrow(/AMBIGUOUS_HEIF_BRANDS/);
  });

  it("refuses AVIF sequences even when the compatible brand indicates animation", () => {
    const sequence = fixture("source.avif").slice();
    sequence.set([0x61, 0x76, 0x69, 0x73], 20); // compatible avis
    expect(() => identifyPortableImage(sequence)).toThrow(/UNSUPPORTED_AVIF_SEQUENCE/);
  });

  it("refuses timed HEIC sequence brands, including compatible msf1 on a still-looking HEIC", () => {
    const source = fixture("source.heic");
    for (const [offset, brand] of [[8, "hevc"], [8, "hevx"], [20, "msf1"], [20, "hevm"], [20, "hevs"]] as const) {
      const sequence = source.slice();
      sequence.set(new TextEncoder().encode(brand), offset);
      expect(() => identifyPortableImage(sequence, { name: "timed.heic", type: "image/heic" }))
        .toThrow(/UNSUPPORTED_HEIC_SEQUENCE/);
    }
  });
});
