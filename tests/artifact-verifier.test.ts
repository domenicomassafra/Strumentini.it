import { describe, expect, it } from "vitest";
import { inspectArtifactSignature, verifyGeneratedArtifact } from "../src/runtime/artifact-verifier";

const png = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
  0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
]);

describe("generated artifact signature and fidelity verifier", () => {
  it("measures common binary types from bytes rather than the requested extension", () => {
    expect(inspectArtifactSignature(png)).toMatchObject({
      mime: "image/png",
      signature: "89504E470D0A1A0A",
      completeEnough: true,
    });
    expect(inspectArtifactSignature(new Uint8Array([0xff, 0xd8, 0xff, 0x00, 0xff, 0xd9]))).toMatchObject({
      mime: "image/jpeg",
      completeEnough: true,
    });
  });

  it("rejects a wrong extension/MIME even when the underlying bytes are otherwise recognizable", async () => {
    const result = await verifyGeneratedArtifact({
      kind: "image",
      name: "fake.jpg",
      declaredMime: "image/jpeg",
      bytes: png,
      fidelity: { fidelity: "lossless", statement: "Fixture pixels were preserved." },
    });
    expect(result.success).toBe(false);
    expect(result.measured.mime).toBe("image/png");
    expect(result.reasons.join(" ")).toMatch(/does not match measured MIME/u);
    expect(result.artifact.download.ready).toBe(false);
  });

  it("rejects truncated containers before a success/download claim", async () => {
    const truncatedPdf = new TextEncoder().encode("%PDF-1.7\n1 0 obj\n<<>>");
    const result = await verifyGeneratedArtifact({
      kind: "pdf",
      name: "broken.pdf",
      declaredMime: "application/pdf",
      bytes: truncatedPdf,
      fidelity: { fidelity: "structural", statement: "PDF structure should reopen." },
    });
    expect(result.success).toBe(false);
    expect(result.measured).toMatchObject({ mime: "application/pdf", completeEnough: false });
    expect(result.artifact.verification.state).toBe("invalid");
  });

  it("lets a format adapter attach independent reopen facts and blocks failed proof", async () => {
    const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0x00, 0xff, 0xd9]);
    const result = await verifyGeneratedArtifact({
      kind: "image",
      name: "photo.jpg",
      declaredMime: "image/jpeg",
      bytes,
      fidelity: {
        fidelity: "lossy",
        statement: "Image was re-encoded.",
        limitations: ["EXIF metadata is not preserved."],
      },
      reopen: () => ({
        ok: false,
        method: "independent image decoder",
        facts: { width: 1, height: 1 },
        message: "Decoder rejected the synthetic JPEG body.",
      }),
    });
    expect(result.reopen?.facts).toEqual({ width: 1, height: 1 });
    expect(result.success).toBe(false);
    expect(result.artifact.fidelityNote).toMatch(/EXIF metadata/u);
  });

  it("marks a measured artifact successful only when signature and independent proof agree", async () => {
    const result = await verifyGeneratedArtifact({
      kind: "image",
      name: "pixel.png",
      declaredMime: "image/png",
      bytes: png,
      fidelity: { fidelity: "lossless", statement: "Pixel values preserved." },
      reopen: () => ({
        ok: true,
        method: "independent PNG parser",
        facts: { width: 1, height: 1 },
      }),
    });
    expect(result.reasons).toEqual([]);
    expect(result.success).toBe(true);
    expect(result.artifact.verification).toMatchObject({
      state: "verified",
      verifiedMime: "image/png",
    });
    expect(result.artifact.download.ready).toBe(true);
  });
});
