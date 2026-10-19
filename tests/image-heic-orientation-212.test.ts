import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { additionalHeicOrientation } from "../src/engines/image/heic-orientation-212";

const ascii = (value: string): number[] => [...value].map(character => character.charCodeAt(0));
const u32 = (n: number): number[] => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
function box(type: string, ...parts: number[][]): number[] {
  const data = parts.flat();
  return [...u32(8 + data.length), ...ascii(type), ...data];
}
function metadataFixture(exifOrientation: number, primaryIrot: boolean): Blob {
  // A bounded HEIF metadata-only fixture: primary image #1, Exif #2 with
  // cdsc reference, iloc construction-method 1 (idat), optional primary irot.
  const exif = [
    0, 0, 0, 0, // TIFF offset follows immediately
    0x49, 0x49, 42, 0, 8, 0, 0, 0,
    1, 0, // one IFD0 entry
    0x12, 0x01, 3, 0, 1, 0, 0, 0, exifOrientation, 0, 0, 0,
    0, 0, 0, 0,
  ];
  const pitm = box("pitm", [0, 0, 0, 0, 0, 1]);
  const infe = box("infe", [2, 0, 0, 0, 0, 2, 0, 0, ...ascii("Exif"), 0]);
  const iinf = box("iinf", [0, 0, 0, 0, 0, 1], infe);
  const iref = box("iref", [0, 0, 0, 0], box("cdsc", [0, 2, 0, 1, 0, 1]));
  const iloc = box("iloc", [
    1, 0, 0, 0, 0x44, 0x40, // version 1; four-byte offsets, lengths and base
    0, 1, 0, 2, // item count=1, Exif item #2
    0, 1, 0, 0, // construction=1 (idat), data_reference_index=0
    ...u32(0), 0, 1, ...u32(0), ...u32(exif.length), // base, 1 extent, offset, length
  ]);
  const iprp = primaryIrot ? box("iprp",
    box("ipco", box("irot", [3])),
    box("ipma", [0, 0, 0, 0, ...u32(1), 0, 1, 1, 0x81]),
  ) : [];
  const meta = box("meta", [0, 0, 0, 0], pitm, iinf, iref, iprp, iloc, box("idat", exif));
  const ftyp = box("ftyp", [...ascii("heic"), 0, 0, 0, 0, ...ascii("mif1")]);
  return new Blob([new Uint8Array([...ftyp, ...meta])], { type: "image/heic" });
}

describe("#212 HEIC orientation metadata precedence", () => {
  it("uses EXIF-only orientation for the primary image when libheif has no HEIF rotation", async () => {
    expect(await additionalHeicOrientation(metadataFixture(6, false))).toBe(6);
    expect(await additionalHeicOrientation(metadataFixture(1, false))).toBe(1);
  });
  it("does not double-rotate when the primary image already carries HEIF irot", async () => {
    expect(await additionalHeicOrientation(metadataFixture(6, true))).toBe(1);
  });
  it("keeps the existing macOS-generated HEIC fixture upright and refuses malformed EXIF", async () => {
    const source = readFileSync(new URL("../quality/fixtures/image-format-matrix/source.heic", import.meta.url));
    expect(await additionalHeicOrientation(new Blob([new Uint8Array(source)]))).toBe(1);
    await expect(additionalHeicOrientation(metadataFixture(12, false))).rejects.toThrow(/UNSUPPORTED_HEIC_ORIENTATION/);
  });
});
