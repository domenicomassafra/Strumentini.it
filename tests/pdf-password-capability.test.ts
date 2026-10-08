import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { checkPdfPassword, createSimplePdf, inspectPdfBytes } from "../src/engines/pdf";
import passwordModule from "../src/tools/pdf-password-check-remove/module";
import type { PdfPasswordCheckOutput } from "../src/tools/pdf-password-check-remove/types";

function asBlob(bytes: Uint8Array): Blob {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return new Blob([copy.buffer], { type: "application/pdf" });
}

const markerOnly = readFileSync(new URL("../quality/fixtures/pdf-gold/encrypted-mark.pdf", import.meta.url));

describe("ticket 320: no approved password-supplied PDF decrypt capability", () => {
  it("reports the repository's encrypted-marker fixture as encrypted without claiming password validation", async () => {
    const blob = asBlob(markerOnly);
    const result = await passwordModule.run({ file: blob, mode: "check", password: "claimed-known-password" }, { defaults: {} });
    expect(result).toMatchObject({ mode: "check", encrypted: true });
    expect(result).not.toHaveProperty("artifact");
    expect((await checkPdfPassword(blob)).encrypted).toBe(true);
  });

  it.each(["", "incorrect", "claimed-known-password"])("refuses encrypted-marker export even if a password was supplied (%s)", async (supplied) => {
    const blob = asBlob(markerOnly);
    const original = new Uint8Array(await blob.arrayBuffer());
    await expect(passwordModule.run({ file: blob, mode: "remove", password: supplied }, { defaults: {} }))
      .rejects.toMatchObject({ code: "UNSUPPORTED_CAPABILITY" });
    expect(new Uint8Array(await blob.arrayBuffer())).toEqual(original);
  });

  it("allows only a correctly described copy of an already unencrypted PDF", async () => {
    const bytes = createSimplePdf(["public copy"]);
    const result = await passwordModule.run({ file: asBlob(bytes), mode: "remove" }, { defaults: {} }) as PdfPasswordCheckOutput;
    expect(result).toMatchObject({ mode: "remove", encrypted: false });
    expect(result).toHaveProperty("artifact");
    if (result.mode !== "remove") throw new Error("Expected unencrypted-copy output");
    expect(result.policy).toMatch(/No encryption bypass/u);
    expect(result.artifact.artifactCount).toBe(1);
    expect(result.artifact.artifacts).toHaveLength(1);
    expect(inspectPdfBytes(result.artifact.artifacts[0]!.bytes).encrypted).toBe(false);
    expect(inspectPdfBytes(bytes).encrypted).toBe(false);
  });
});
