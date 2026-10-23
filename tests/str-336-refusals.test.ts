import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { detectLocalFile } from "../src/runtime/file-detection";

// Public inspection seam: denial/cancellation never mutates the previously
// recognized File. UI retention and background/return are checked in the browser.
const imageBytes = readFileSync(new URL("../quality/fixtures/image-metadata/synthetic-1x1-rgb.png", import.meta.url));
const photo = () => new File([new Uint8Array(imageBytes)], "ritenta.png", { type: "image/png" });

describe("STR-336 permission denial, cancellation and retry", () => {
  it("refuses denied reads without losing the last valid input or blocking re-selection", async () => {
    const previous = photo();
    expect(await detectLocalFile(previous)).toMatchObject({ status: "supported", format: "png" });
    const denied = {
      name: "negata.png", type: "image/png", size: imageBytes.length,
      slice(): Blob { throw new DOMException("Permission denied", "NotAllowedError"); },
    };
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    try {
      expect(await detectLocalFile(denied)).toMatchObject({ status: "refused", reason: "READ_FAILED" });
      expect(await detectLocalFile(previous)).toMatchObject({ status: "supported", format: "png" });
      expect(await detectLocalFile(photo())).toMatchObject({ status: "supported", format: "png" });
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it("rejects a cancelled read and a forged MIME without changing the source bytes", async () => {
    const previous = photo();
    const before = Buffer.from(await previous.arrayBuffer());
    const controller = new AbortController();
    controller.abort();
    expect(await detectLocalFile(previous, { signal: controller.signal }))
      .toMatchObject({ status: "refused", reason: "CANCELLED" });
    const disguised = new File([new Uint8Array(imageBytes)], "inganno.png", { type: "application/pdf" });
    expect(await detectLocalFile(disguised))
      .toMatchObject({ status: "refused", reason: "MIME_MISMATCH" });
    expect(Buffer.from(await previous.arrayBuffer())).toEqual(before);
    expect(await detectLocalFile(previous)).toMatchObject({ status: "supported", format: "png" });
  });
});
