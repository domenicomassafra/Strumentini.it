import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { detectLocalFile } from "../src/runtime/file-detection";
import { createOutputArtifactDescriptor } from "../src/runtime/output-artifact";
import { planVerifiedDownload339 } from "../src/runtime/download-policy-339";

const bytes = readFileSync(new URL("../quality/fixtures/image-metadata/synthetic-1x1-rgb.png", import.meta.url));
const original = () => new File([new Uint8Array(bytes)], "originale.png", { type: "image/png" });

describe("STR-362 permission, cancellation and share refusal boundaries", () => {
  it("refuses denied picker reads and aborted work; original input remains usable on retry", async () => {
    const preserved = original();
    const before = new Uint8Array(await preserved.arrayBuffer());
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    try {
      const denied = { name: "negato.png", type: "image/png", size: bytes.length,
        slice(): Blob { throw new DOMException("Read denied", "NotAllowedError"); } };
      expect(await detectLocalFile(denied)).toMatchObject({ status: "refused", reason: "READ_FAILED" });
      const abort = new AbortController();
      abort.abort();
      expect(await detectLocalFile(preserved, { signal: abort.signal }))
        .toMatchObject({ status: "refused", reason: "CANCELLED" });
      expect(new Uint8Array(await preserved.arrayBuffer())).toEqual(before);
      expect(await detectLocalFile(original())).toMatchObject({ status: "supported", format: "png" });
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally { fetchSpy.mockRestore(); }
  });

  it("never exposes unverified, renamed or empty output as share/download-ready", () => {
    const valid = createOutputArtifactDescriptor({
      kind: "image", name: "originale.png", mime: "image/png", bytes: new Uint8Array(bytes),
      verification: { state: "verified", verifiedMime: "image/png", method: "parser readback" },
      fidelity: "lossless", fidelityNote: "Validated PNG.",
    });
    expect(valid.download.ready).toBe(true);
    expect(planVerifiedDownload339({ ...valid, verification: { state: "warning", message: "not reopened" } }).allowed).toBe(false);
    expect(planVerifiedDownload339({ ...valid, name: "../originale.png" }).allowed).toBe(false);
    expect(planVerifiedDownload339({ ...valid, bytes: new Uint8Array(), byteLength: 0 }).allowed).toBe(false);
    expect(planVerifiedDownload339(valid).allowed).toBe(true);
  });
});
