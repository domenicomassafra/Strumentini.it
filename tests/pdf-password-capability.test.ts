import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { checkPdfPassword, createSimplePdf, inspectPdfBytes } from "../src/engines/pdf";
import { unlockPdfBytes320 } from "../src/engines/pdf/password-engine-320";
import { unlockPdfWithPassword320 } from "../src/engines/pdf/password-local-320";
import { createPdfToolkit } from "../src/engines/pdf/vendor/pdfstudio/index.js";
import passwordModule from "../src/tools/pdf-password-check-remove/module";
import type { PdfPasswordCheckOutput } from "../src/tools/pdf-password-check-remove/types";

function asBlob(bytes: Uint8Array): Blob {
  const copy = Uint8Array.from(bytes);
  return new Blob([copy.buffer], { type: "application/pdf" });
}

function digest(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

const markerOnly = readFileSync(new URL("../quality/fixtures/pdf-gold/encrypted-mark.pdf", import.meta.url));
const realPlain = new Uint8Array(readFileSync(new URL("../quality/fixtures/pdf-gold/simple-2page.pdf", import.meta.url)));

// qpdf's current Emscripten glue may set process.exitCode on deliberately rejected
// CLI calls in Node. Restore the test process status after negative fixtures.
const originalNodeExitCode = process.exitCode;
afterAll(() => { process.exitCode = originalNodeExitCode; });

describe("ticket 320: actual local password-supplied AES PDF decryption", () => {
  it("STR-032 creates a password-required AES-256 PDF that reopens with the user password", async () => {
    const donor = await createPdfToolkit();
    const before = digest(realPlain);
    const result = await passwordModule.run({ file: asBlob(realPlain), mode: "protect", password: "correct-horse-2026" }, { defaults: {} }) as PdfPasswordCheckOutput;
    expect(result).toMatchObject({ mode: "protect", encrypted: true });
    if (result.mode !== "protect") throw new Error("Expected protected output");
    const artifact = result.artifact.artifacts[0]!;
    expect(artifact.filename).toBe("pdf-protetto-aes256.pdf");
    expect(artifact.pageCount).toBe(2);
    expect(await donor.isEncrypted(artifact.bytes)).toBe(true);
    expect(await donor.requiresPassword(artifact.bytes)).toBe(true);
    expect(inspectPdfBytes(artifact.bytes).encrypted).toBe(true);
    expect((await donor.getInfo(artifact.bytes, { password: "correct-horse-2026" })).encryption).toMatchObject({ bits: 256, method: "AESv3" });
    const reopened = getDocument({ data: Uint8Array.from(artifact.bytes), password: "correct-horse-2026", useSystemFonts: true });
    try {
      const pdf = await reopened.promise;
      expect(pdf.numPages).toBe(2);
      const page = await pdf.getPage(1);
      expect((await page.getTextContent()).items.length).toBeGreaterThan(0);
    } finally { await reopened.destroy(); }
    expect(digest(realPlain)).toBe(before);
  });

  it("STR-032 refuses existing encryption, unsafe passwords and already aborted requests", async () => {
    const donor = await createPdfToolkit();
    const locked = await donor.lock(realPlain, { userPassword: "already-locked", keyLength: 256 });
    await expect(passwordModule.run({ file: asBlob(locked), mode: "protect", password: "safe-password-2026" }, { defaults: {} }))
      .rejects.toThrow(/PDF_ALREADY_ENCRYPTED/u);
    for (const password of ["short", "unsafe\npassword", "x".repeat(129)]) {
      await expect(passwordModule.run({ file: asBlob(realPlain), mode: "protect", password }, { defaults: {} }))
        .rejects.toThrow(/PDF_PROTECTION_PASSWORD_INVALID/u);
    }
    const abort = new AbortController();
    abort.abort();
    await expect(passwordModule.run({ file: asBlob(realPlain), mode: "protect", password: "safe-password-2026" }, { defaults: {} }, abort.signal))
      .rejects.toMatchObject({ name: "AbortError" });
  });
  it("preserves marker-only inspection but refuses to treat it as proof of decryption", async () => {
    const blob = asBlob(markerOnly);
    expect((await checkPdfPassword(blob)).encrypted).toBe(true);
    const result = await passwordModule.run({ file: blob, mode: "check", password: "irrelevant" }, { defaults: {} });
    expect(result).toMatchObject({ mode: "check", encrypted: true });
    expect(result).not.toHaveProperty("artifact");
    await expect(passwordModule.run({ file: blob, mode: "remove" }, { defaults: {} }))
      .rejects.toMatchObject({ code: "UNSUPPORTED_CAPABILITY" });
    await expect(passwordModule.run({ file: blob, mode: "remove", password: "guess" }, { defaults: {} }))
      .rejects.toThrow(/PDF_NOT_ENCRYPTED/u);
  });

  it.each([128, 256] as const)("valid user and owner passwords actually unlock independently reopened AES-%i PDFs", async (bits) => {
    const donor = await createPdfToolkit();
    const locked = await donor.lock(realPlain, { userPassword: "known-unit-password", ownerPassword: "owner-unit-password", keyLength: bits });
    expect(await donor.isEncrypted(locked)).toBe(true);
    const originalHash = digest(locked);
    const localBlob = asBlob(locked);
    const checked = await passwordModule.run({ file: localBlob, mode: "check" }, { defaults: {} });
    expect(checked).toMatchObject({ mode: "check", encrypted: true });
    for (const password of ["known-unit-password", "owner-unit-password"]) {
      const result = await passwordModule.run({ file: localBlob, mode: "remove", password }, { defaults: {} }) as PdfPasswordCheckOutput;
      expect(result).toMatchObject({ mode: "remove", encrypted: false });
      if (result.mode !== "remove") throw new Error("Expected unlocked result");
      const artifact = result.artifact.artifacts[0]!;
      expect(artifact.mime).toBe("application/pdf");
      expect(artifact.pageCount).toBe(2);
      expect(await donor.isEncrypted(artifact.bytes)).toBe(false);
      expect(inspectPdfBytes(artifact.bytes).encrypted).toBe(false);
      const open = getDocument({ data: Uint8Array.from(artifact.bytes), useSystemFonts: true, disableFontFace: true });
      try {
        const doc = await open.promise;
        expect(doc.numPages).toBe(2);
        const first = await doc.getPage(1);
        const text = await first.getTextContent();
        expect(text.items.length).toBeGreaterThan(0);
      } finally { await open.destroy(); }
    }
    expect(digest(new Uint8Array(await localBlob.arrayBuffer()))).toBe(originalHash);
    expect(digest(locked)).toBe(originalHash);
  });

  it("rejects wrong password without exposing the supplied secret or generating output", async () => {
    const donor = await createPdfToolkit();
    const locked = await donor.lock(realPlain, { userPassword: "correct-fixture", keyLength: 256 });
    const before = digest(locked);
    try {
      await expect(passwordModule.run({ file: asBlob(locked), mode: "remove", password: "wrong-private-phrase" }, { defaults: {} }))
        .rejects.toThrow(/^PDF_PASSWORD_INCORRECT: Password errata/u);
    } finally { process.exitCode = originalNodeExitCode; }
    expect(digest(locked)).toBe(before);
  });

  it("refuses malformed PDF, missing/unsafe passwords, excessive bytes, and aborted requests", async () => {
    await expect(unlockPdfBytes320(Uint8Array.from([1,2,3]), "some-password")).rejects.toThrow(/INVALID_PDF_SIGNATURE/u);
    await expect(unlockPdfBytes320(realPlain, "")).rejects.toThrow(/PDF_PASSWORD_REQUIRED/u);
    await expect(unlockPdfBytes320(realPlain, "bad\nsecret")).rejects.toThrow(/PDF_PASSWORD_REQUIRED/u);
    await expect(unlockPdfBytes320(realPlain, "a".repeat(257))).rejects.toThrow(/PDF_PASSWORD_REQUIRED/u);
    const abort = new AbortController();
    abort.abort();
    await expect(unlockPdfWithPassword320(asBlob(realPlain), "some-password", abort.signal)).rejects.toMatchObject({ name: "AbortError" });
    await expect(unlockPdfWithPassword320(new Blob([new Uint8Array(26 * 1024 * 1024)]), "some-password"))
      .rejects.toThrow(/PDF_LIMIT/u);
  });

  it("continues to copy an already non-encrypted file only when no password is supplied", async () => {
    const bytes = createSimplePdf(["public copy"]);
    const result = await passwordModule.run({ file: asBlob(bytes), mode: "remove" }, { defaults: {} }) as PdfPasswordCheckOutput;
    expect(result).toMatchObject({ mode: "remove", encrypted: false });
    if (result.mode !== "remove") throw new Error("Expected copy output");
    expect(result.artifact.artifacts).toHaveLength(1);
    expect(inspectPdfBytes(result.artifact.artifacts[0]!.bytes).encrypted).toBe(false);
  });
});
