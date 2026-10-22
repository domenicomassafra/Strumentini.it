import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { IMAGE_FAMILY_CAPABILITIES_028 } from "../src/engines/image/family-capabilities-028";
import { image_compressionManifest } from "../src/tools/image-compression/manifest";
import { image_format_conversionManifest } from "../src/tools/image-format-conversion/manifest";
import { compressImageLocal } from "../src/engines/image/visual-tools";
import { prepareImageResult } from "../src/components/tools/image-visual/ImageResultV2";
import { canOfferImageCompressionHandoff028 } from "../src/runtime/ephemeral-file-handoff-337";
import { startImageCompressionHandoff028, receiveImageCompressionHandoff028 } from "../src/runtime/ephemeral-file-handoff-337";
import { createOutputArtifactDescriptor } from "../src/runtime/output-artifact";

const token = "12345678-1234-4234-8234-123456789abc";
class LocalWindow028 {
  readonly location = { origin: "https://strumentini.it", pathname: "/tools/image-format-conversion/", search: "", hash: "" };
  readonly history = { replaceState: () => { this.location.hash = ""; } };
  opener: LocalWindow028 | null = null;
  peer: LocalWindow028 | null = null;
  private readonly listeners = new Set<(event: MessageEvent) => void>();
  open(path: string) {
    if (!this.peer) return null;
    this.peer.location.pathname = new URL(path, this.location.origin).pathname;
    this.peer.location.hash = new URL(path, this.location.origin).hash;
    this.peer.opener = this;
    return this.peer as unknown as Window;
  }
  addEventListener(_: string, fn: (event: MessageEvent) => void) { this.listeners.add(fn); }
  removeEventListener(_: string, fn: (event: MessageEvent) => void) { this.listeners.delete(fn); }
  setTimeout() { return 1; }
  clearTimeout() {}
  postMessage(data: unknown, origin: string) { if (this.peer) this.emit(data, this.peer, origin); }
  emit(data: unknown, source: LocalWindow028, origin: string) {
    for (const fn of [...this.listeners]) fn({ data, source: source as unknown as Window, origin } as MessageEvent);
  }
}

describe("STR-028: one image family and one verified file workspace", () => {
  it("advertises format aliases on the existing public routes and explicit refused capabilities", () => {
    expect(image_compressionManifest.route).toBe("/tools/image-compression");
    expect(image_format_conversionManifest.route).toBe("/tools/image-format-conversion");
    for (const term of ["jpeg compressor", "png compressor", "webp compressor", "reduce image to target size", "compress svg"]) {
      expect(image_compressionManifest.aliases).toContain(term);
    }
    for (const term of ["heic to jpg", "avif to png", "gif to png"]) {
      expect(image_format_conversionManifest.aliases).toContain(term);
    }
    expect(IMAGE_FAMILY_CAPABILITIES_028.map((row) => row.input)).toEqual([
      "JPEG", "PNG", "WebP", "SVG", "AVIF", "HEIC/HEIF", "GIF",
    ]);
    expect(IMAGE_FAMILY_CAPABILITIES_028.find((row) => row.input === "WebP")?.compression).toMatch(/niente WebP lossless/u);
    expect(IMAGE_FAMILY_CAPABILITIES_028.find((row) => row.input === "GIF")?.conversion).toMatch(/Solo primo frame/u);
  });

  it("uses the public PNG compressor and independent decoder to verify the handoff artifact", async () => {
    const rgba = Buffer.alloc(64 * 48 * 4);
    for (let i = 0; i < 64 * 48; i++) {
      rgba[4 * i] = i % 3 ? 24 : 255;
      rgba[4 * i + 1] = i % 3 ? 120 : 0;
      rgba[4 * i + 3] = i % 7 ? 255 : 0;
    }
    const source = await sharp(rgba, { raw: { width: 64, height: 48, channels: 4 } }).png({ compressionLevel: 0 }).toBuffer();
    const file = new File([Uint8Array.from(source)], "original.png", { type: "image/png" });
    const result = await compressImageLocal({ file, mime: "image/png", pngLossless: true });
    const prepared = await prepareImageResult(result);
    const artifact = prepared.artifacts[0]?.artifact;
    expect(artifact).toBeDefined();
    expect(canOfferImageCompressionHandoff028(artifact)).toBe(true);
    expect(result.compressionMode).toBe("png-idat-lossless");
    expect(await sharp(Buffer.from(await result.blob.arrayBuffer())).ensureAlpha().raw().toBuffer()).toEqual(rgba);
    expect(Buffer.from(await file.arrayBuffer())).toEqual(source);
  });

  it.each(["jpeg", "png", "webp"] as const)("transfers verified %s bytes through the existing one-time browser channel", async (format) => {
    const source = await sharp({ create: { width: 24, height: 20, channels: 3, background: "#2a61b0" } })
      .toFormat(format).toBuffer();
    const mime = format === "jpeg" ? "image/jpeg" : `image/${format}`;
    const result = createOutputArtifactDescriptor({ kind: "image", name: `photo.${format}`, mime,
      bytes: Uint8Array.from(source), verification: { state: "verified", verifiedMime: mime, method: "independent sharp decode" },
      fidelity: "unknown", fidelityNote: "local conversion" });
    expect(canOfferImageCompressionHandoff028(result)).toBe(true);
    const sender = new LocalWindow028(), receiver = new LocalWindow028();
    sender.peer = receiver; receiver.peer = sender;
    const statuses: string[] = [], delivered: File[] = [];
    expect(startImageCompressionHandoff028(result, (status) => statuses.push(status),
      { window: sender as unknown as Window, createToken: () => token }).opened).toBe(true);
    const stop = receiveImageCompressionHandoff028((file) => { delivered.push(file); return true; },
      { window: receiver as unknown as Window });
    expect(statuses).toEqual(["received"]);
    expect(receiver.location.hash).toBe("");
    expect(delivered).toHaveLength(1);
    expect(delivered[0]!.type).toBe(mime);
    expect(delivered[0]!.name).toBe(`photo.${format}`);
    expect(Buffer.from(await delivered[0]!.arrayBuffer())).toEqual(source);
    stop();
  });
});
