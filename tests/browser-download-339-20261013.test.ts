import { Buffer } from "node:buffer";
import { afterEach, describe, expect, it, vi } from "vitest";
import { requestBrowserDownload339 } from "../src/runtime/browser-download-339";
import { createOutputArtifactDescriptor } from "../src/runtime/output-artifact";

const expected = new Uint8Array([0, 127, 128, 255, 42]);

// Native slice species may allocate a view into a larger, already-used buffer.
class PaddedCopy extends Uint8Array {
  constructor(length: number) {
    super(new ArrayBuffer(length + 32), 16, length);
    new Uint8Array(this.buffer).fill(0xd7);
  }
}
class PaddedBytes extends Uint8Array {}
class WideBytes extends Uint8Array {}
Object.defineProperty(PaddedBytes, Symbol.species, { value: PaddedCopy });
Object.defineProperty(WideBytes, Symbol.species, { value: Uint16Array });

afterEach(() => vi.restoreAllMocks());

describe("#339 copies only verified Uint8Array bytes into the download Blob", () => {
  it.each([
    ["plain nonzero-offset view", new Uint8Array([215, ...expected, 215]).subarray(1, 6)],
    ["native padded species", new PaddedBytes(expected)],
    ["native wider species", new WideBytes(expected)],
    ["Buffer view", Buffer.from([215, ...expected, 215]).subarray(1, 6)],
  ])("preserves exact bytes for %s", async (_label, bytes) => {
    const artifact = createOutputArtifactDescriptor({
      kind: "file", name: "verified.bin", mime: "application/octet-stream", bytes,
      verification: { state: "verified", verifiedMime: "application/octet-stream", method: "byte-readback" },
      fidelity: "lossless", fidelityNote: "Exact verified bytes",
    });
    const blobs: Blob[] = [];
    // Capture the actual native Blob at the browser boundary, then deny the
    // API: no fake DOM is needed to inspect the bytes the runtime would expose.
    vi.spyOn(URL, "createObjectURL").mockImplementation(blob => {
      if (!(blob instanceof Blob)) throw new TypeError("Expected download Blob");
      blobs.push(blob);
      throw new DOMException("Fixture denies URL creation", "SecurityError");
    });
    expect(requestBrowserDownload339(artifact)).toBe(false);
    expect(blobs).toHaveLength(1);
    expect(blobs[0]!.size).toBe(artifact.byteLength);
    expect(new Uint8Array(await blobs[0]!.arrayBuffer())).toEqual(expected);
  });
});
