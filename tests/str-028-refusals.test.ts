import { describe, expect, it } from "vitest";
import { createOutputArtifactDescriptor } from "../src/runtime/output-artifact";
import { canOfferImageCompressionHandoff028, startImageCompressionHandoff028 } from "../src/runtime/ephemeral-file-handoff-337";
import { compressImageLocal } from "../src/engines/image/visual-tools";

const png = Uint8Array.from(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9oSWp0sAAAAASUVORK5CYII=", "base64"));
const valid = createOutputArtifactDescriptor({ kind: "image", name: "valid.png", mime: "image/png", bytes: png,
  verification: { state: "verified", verifiedMime: "image/png", method: "decoded" },
  fidelity: "lossless", fidelityNote: "fixture" });

describe("STR-028: no unsafe transfer, no original mutation", () => {
  it("refuses unsupported formats, spoofed MIME, mismatched signatures and unverified results before opening", () => {
    const cases = [
      { ...valid, name: "fake.jpg" },
      { ...valid, mime: "image/jpeg", name: "fake.jpg", verification: { ...valid.verification, verifiedMime: "image/jpeg" } },
      { ...valid, mime: "image/avif", name: "fake.avif", verification: { ...valid.verification, verifiedMime: "image/avif" } },
      { ...valid, bytes: new Uint8Array([1, 2, 3]), byteLength: 3 },
      { ...valid, verification: { state: "unverified" } },
      { ...valid, download: { ...valid.download, ready: false } },
      { ...valid, kind: "file" },
    ];
    for (const candidate of cases) {
      expect(canOfferImageCompressionHandoff028(candidate as typeof valid)).toBe(false);
      expect(startImageCompressionHandoff028(candidate as typeof valid, undefined, { window: { open: () => { throw new Error("opened popup"); } } as unknown as Window }).opened).toBe(false);
    }
    expect(canOfferImageCompressionHandoff028(valid)).toBe(true);
  });

  it("refuses corrupt input without ever writing into the File object", async () => {
    const broken = new File([Uint8Array.from(png.subarray(0, 28))], "broken.png", { type: "image/png" });
    const bytesBefore = Buffer.from(await broken.arrayBuffer());
    await expect(compressImageLocal({ file: broken, mime: "image/png", pngLossless: true })).rejects.toThrow();
    expect(Buffer.from(await broken.arrayBuffer())).toEqual(bytesBefore);
  });
});
