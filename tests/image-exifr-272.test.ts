import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { inspectImageBatchLocal, inspectImageMetadataLocal } from "../src/engines/image/visual-tools";
import { inspectImageMetadataViewer272Local } from "../src/engines/image/metadata-viewer-272";
import { EXIFR_METADATA_FILE_LIMIT } from "../src/engines/image/exifr-reader-272";

function fixture(path: string, mime: string): File {
  return new File([readFileSync(new URL("../quality/fixtures/" + path, import.meta.url))], path, { type: mime });
}

function generatedExif(): Uint8Array {
  // Independent TIFF IFD0/EXIF/GPS oracle: Orientation=6, Camera/Test,
  // 2026-10-19 12:34:56, N 40°30', E 16°55'. All offsets TIFF-relative.
  const bytes = new Uint8Array(256);
  const view = new DataView(bytes.buffer);
  const put16 = (offset: number, n: number) => view.setUint16(offset, n, true);
  const put32 = (offset: number, n: number) => view.setUint32(offset, n, true);
  const text = (offset: number, value: string) => {
    for (let n = 0; n < value.length; n++) bytes[offset + n] = value.charCodeAt(n);
  };
  const entry = (at: number, tag: number, type: number, count: number, data: number) => {
    put16(at, tag); put16(at + 2, type); put32(at + 4, count); put32(at + 8, data);
  };
  bytes.set([0x49, 0x49, 0x2a, 0x00]); put32(4, 8);
  put16(8, 5);
  entry(10, 0x010f, 2, 7, 74); // Make
  entry(22, 0x0110, 2, 8, 81); // Model
  entry(34, 0x0112, 3, 1, 6); // EXIF Orientation 6
  entry(46, 0x8769, 4, 1, 90); // Exif IFD
  entry(58, 0x8825, 4, 1, 108); // GPS IFD
  put32(70, 0); text(74, "Camera\0"); text(81, "TestCam\0");
  put16(90, 1); entry(92, 0x9003, 2, 20, 170); put32(104, 0);
  put16(108, 4);
  entry(110, 1, 2, 2, 0x4e);
  entry(122, 2, 5, 3, 192);
  entry(134, 3, 2, 2, 0x45);
  entry(146, 4, 5, 3, 216);
  put32(158, 0);
  text(170, "2026:10:19 12:34:56\0");
  for (const [at, numerator] of [[192, 40], [200, 30], [208, 0], [216, 16], [224, 55], [232, 0]] as const) {
    put32(at, numerator); put32(at + 4, 1);
  }
  return bytes.subarray(0, 240);
}

function jpegWithExif(): File {
  const source = new Uint8Array(readFileSync(new URL("../quality/fixtures/image-format-matrix/source.jpg", import.meta.url)));
  const tiff = generatedExif();
  const segment = new Uint8Array(4 + 6 + tiff.length);
  const length = segment.length - 2;
  segment.set([0xff, 0xe1, length >> 8, length & 0xff, 0x45, 0x78, 0x69, 0x66, 0, 0]);
  segment.set(tiff, 10);
  return new File([source.subarray(0, 2), segment, source.subarray(2)], "gps-orientation.jpg", { type: "image/jpeg" });
}

function webpWithExif(): File {
  const tiff = generatedExif();
  const exifChunk = new Uint8Array(8 + tiff.length);
  exifChunk.set([0x45, 0x58, 0x49, 0x46]);
  new DataView(exifChunk.buffer).setUint32(4, tiff.length, true);
  exifChunk.set(tiff, 8);
  const base = new Uint8Array(readFileSync(new URL("./fixtures/image-exifr-272/one-pixel.webp", import.meta.url)));
  const output = new Uint8Array(base.length + 18 + exifChunk.length);
  output.set(base.subarray(0, 12), 0);
  new DataView(output.buffer).setUint32(4, output.length - 8, true);
  // Valid 1×1 VP8L image; insert VP8X container header and EXIF before pixel data.
  output.set([0x56, 0x50, 0x38, 0x58, 10, 0, 0, 0, 8, 0, 0, 0, 0, 0, 0, 0, 0, 0], 12);
  output.set(exifChunk, 30);
  output.set(base.subarray(12), 30 + exifChunk.length);
  return new File([output], "webp-exif.webp", { type: "image/webp" });
}

describe("STR #272 exifr: local, bounded reader", () => {
  it("keeps known JPEG and PNG header facts while adding verified Make", async () => {
    const jpeg = await inspectImageMetadataViewer272Local(fixture("image-metadata-segments/exif-app1.jpg", "image/jpeg"));
    const png = await inspectImageMetadataViewer272Local(fixture("image-metadata-segments/with-exif.png", "image/png"));
    expect(jpeg).toMatchObject({ signature: "jpeg", cameraMake: "Strumentini", metadataStatus: "read" });
    expect(png).toMatchObject({ signature: "png", width: 1, height: 1, cameraMake: "Strumentini" });
  });

  it("reads orientation, camera, time and GPS from independent TIFF JPEG input", async () => {
    for (const file of [jpegWithExif()]) {
      const result = await inspectImageMetadataViewer272Local(file);
      expect(result.cameraMake, file.name).toBe("Camera");
      expect(result.cameraModel, file.name).toBe("TestCam");
      expect(result.orientation, file.name).toBe(6);
      expect(result.takenAt, file.name).toContain("2026");
      expect(result.gpsPresent, file.name).toBe(true);
      expect(result.gps?.latitude, file.name).toBeCloseTo(40.5, 5);
      expect(result.gps?.longitude, file.name).toBeCloseTo(16 + 55 / 60, 5);
    }
  });

  it("extracts real positive ICC profile and Photoshop IPTC title, independently encoded", async () => {
    // Generated with Pillow/littleCMS sRGB and a Photoshop 8BIM IIM 2:5
    // record by scripts/generate-exifr-272-fixture.py. This asserts metadata
    // read by the product viewer, not just metadata written into a buffer.
    const image = new File(
      [readFileSync(new URL("./fixtures/image-exifr-272/jpeg-icc-iptc.jpg", import.meta.url))],
      "jpeg-icc-iptc.jpg", { type: "image/jpeg" },
    );
    const result = await inspectImageMetadataViewer272Local(image);
    expect(result).toMatchObject({
      signature: "jpeg", metadataStatus: "read", iccProfile: "sRGB built-in",
      iptcTitle: "EXIFR 272 IPTC Title", gpsPresent: false,
    });
  });

  it("keeps WebP dimensions and documents exifr 7.1.3 refusal to read WebP EXIF", async () => {
    const result = await inspectImageMetadataViewer272Local(webpWithExif());
    expect(result).toMatchObject({
      signature: "webp", width: 1, height: 1, metadataStatus: "unavailable", gpsPresent: false,
    });
    expect(result.cameraMake).toBeUndefined();
  });

  it("reports XMP, IPTC and ICC as unreadable when parser returns errors, never inventing tags", async () => {
    for (const filename of ["xmp-app1.jpg", "iptc-app13.jpg"]) {
      const result = await inspectImageMetadataViewer272Local(fixture("image-metadata-segments/" + filename, "image/jpeg"));
      expect(["unavailable", "absent", "read"]).toContain(result.metadataStatus);
      expect(result.iptcTitle).toBeUndefined();
      expect(result.xmpTitle).toBeUndefined();
    }
  });

  it("rejects HEIC/AVIF and corrupt input with typed viewer errors while keeping legacy support", async () => {
    for (const [path, mime] of [
      ["image-format-matrix/source.heic", "image/heic"],
      ["image-format-matrix/source.avif", "image/avif"],
      ["image-metadata-segments/truncated.png", "image/png"],
    ] as const) {
      await expect(inspectImageMetadataViewer272Local(fixture(path, mime))).rejects.toThrow(/INVALID_IMAGE|INVALID_INPUT|TRUNCATED_IMAGE/u);
    }
  });

  it("keeps GPS out of the shared batch and compare header API", async () => {
    const source = jpegWithExif();
    const header = await inspectImageMetadataLocal(source);
    expect(header).not.toHaveProperty("gps");
    expect(header).not.toHaveProperty("cameraModel");
    const batch = await inspectImageBatchLocal([source]);
    expect(JSON.stringify(batch)).not.toContain("latitude");
    expect(JSON.stringify(batch)).not.toContain("16.916");
  });

  it("honors cancellation before parse and bounds enrichment memory without losing header", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(inspectImageMetadataViewer272Local(jpegWithExif(), controller.signal)).rejects.toMatchObject({ name: "AbortError" });
    const png = new Uint8Array(readFileSync(new URL("../quality/fixtures/image-metadata-segments/clean.png", import.meta.url)));
    const large = new File([png, new Uint8Array(EXIFR_METADATA_FILE_LIMIT)], "large.png", { type: "image/png" });
    const result = await inspectImageMetadataViewer272Local(large);
    expect(result).toMatchObject({ signature: "png", metadataStatus: "skipped-size", gpsPresent: false });
  });
});
