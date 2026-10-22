import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { checkPdfPassword, createSimplePdf, inspectPdfBytes } from "../src/engines/pdf";
import passwordModule from "../src/tools/pdf-password-check-remove/module";
import type { PdfPasswordCheckOutput } from "../src/tools/pdf-password-check-remove/types";

const markerOnly = new Uint8Array(readFileSync(new URL("../quality/fixtures/pdf-gold/encrypted-mark.pdf", import.meta.url)));
const plain = createSimplePdf(["public copy"]);
const asBlob = (bytes: Uint8Array) => new Blob([Uint8Array.from(bytes).buffer], { type: "application/pdf" });

describe("#126 historical refusal and #417 legitimate password scope", () => {
  it("still detects encryption without attempting decryption", async () => {
    expect((await checkPdfPassword(asBlob(markerOnly))).encrypted).toBe(true);
    const checked = await passwordModule.run({ file: asBlob(markerOnly), mode: "check" }, { defaults: {} });
    expect(checked).toMatchObject({ mode: "check", encrypted: true });
    expect(checked).not.toHaveProperty("artifact");
  });

  it("rejects absent passwords and malformed encrypted marker inputs", async () => {
    await expect(passwordModule.run({ file: asBlob(plain), mode: "protect" }, { defaults: {} }))
      .rejects.toThrow(/PDF_PASSWORD_REQUIRED/u);
    await expect(passwordModule.run({ file: asBlob(markerOnly), mode: "remove", password: "example-passphrase" }, { defaults: {} }))
      .rejects.toThrow(/PDF_NOT_ENCRYPTED/u);
    await expect(passwordModule.run({ file: asBlob(markerOnly), mode: "remove" }, { defaults: {} }))
      .rejects.toMatchObject({ code: "UNSUPPORTED_CAPABILITY" });
  });

  it("copies an already unencrypted PDF without changing encryption status", async () => {
    const result = await passwordModule.run({ file: asBlob(plain), mode: "remove" }, { defaults: {} }) as PdfPasswordCheckOutput;
    expect(result).toMatchObject({ mode: "remove", encrypted: false });
    if (result.mode !== "remove") throw new Error("Expected plain PDF copy");
    expect(result.artifact.artifacts).toHaveLength(1);
    expect(inspectPdfBytes(result.artifact.artifacts[0]!.bytes).encrypted).toBe(false);
  });
});
