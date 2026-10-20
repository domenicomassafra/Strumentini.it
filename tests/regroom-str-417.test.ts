import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { runPasswordJob417 } from "../src/engines/pdf/password-client-417";
import passwordModule from "../src/tools/pdf-password-check-remove/module";
import type { PdfPasswordCheckOutput } from "../src/tools/pdf-password-check-remove/types";

const original = new Uint8Array(readFileSync(new URL("../quality/fixtures/pdf-gold/simple-2page.pdf", import.meta.url)));
const asBlob = (bytes: Uint8Array) => new Blob([Uint8Array.from(bytes).buffer], { type: "application/pdf" });
const context = { defaults: {} };
const credential = "s3greto-STR-417";

function artifact(result: PdfPasswordCheckOutput, mode: "protect" | "remove"): Uint8Array {
  if (result.mode !== mode) throw new Error("Unexpected password mode");
  const first = result.artifact.artifacts[0];
  if (!first) throw new Error("No PDF artifact");
  return first.bytes;
}

async function readIndependently(bytes: Uint8Array, password?: string) {
  const task = getDocument({ data: Uint8Array.from(bytes), ...(password ? { password } : {}), useSystemFonts: true });
  try {
    const doc = await task.promise;
    const text = [];
    for (let page = 1; page <= doc.numPages; page++) {
      const content = await (await doc.getPage(page)).getTextContent();
      text.push(content.items.flatMap((entry) => "str" in entry ? [entry.str] : []).join(" "));
    }
    return { pages: doc.numPages, text };
  } finally {
    await task.destroy();
  }
}

describe("STR-417 legitimate PDF encryption and unlock", () => {
  it("encrypts AES-256 with a supplied password, independently readable via PDF.js, then decrypts", async () => {
    const locked = artifact(await passwordModule.run({ file: asBlob(original), mode: "protect", password: credential }, context) as PdfPasswordCheckOutput, "protect");
    const header = new TextDecoder("latin1").decode(locked);
    expect(header).toMatch(/\/Encrypt\s/u);
    expect(header).toMatch(/\/R\s+6\b/u);
    expect(header).toMatch(/\/V\s+5\b/u);
    await expect(readIndependently(locked, "sbagliata")).rejects.toThrow();
    await expect(readIndependently(locked)).rejects.toThrow();
    expect(await readIndependently(locked, credential)).toMatchObject({ pages: 2, text: [expect.stringContaining("alpha"), expect.stringContaining("beta")] });
    await expect(passwordModule.run({ file: asBlob(locked), mode: "remove", password: "sbagliata" }, context))
      .rejects.toThrow(/PDF_PASSWORD_INCORRECT/u);
    const unlocked = artifact(await passwordModule.run({ file: asBlob(locked), mode: "remove", password: credential }, context) as PdfPasswordCheckOutput, "remove");
    expect(new TextDecoder("latin1").decode(unlocked)).not.toMatch(/\/Encrypt\s/u);
    expect(await readIndependently(unlocked)).toMatchObject({ pages: 2, text: [expect.stringContaining("alpha"), expect.stringContaining("beta")] });
  }, 45_000);

  it("rejects empty, very long, malformed, oversized inputs, and cancellations", async () => {
    await expect(passwordModule.run({ file: asBlob(original), mode: "protect", password: "" }, context)).rejects.toThrow(/PDF_PASSWORD_REQUIRED/u);
    await expect(passwordModule.run({ file: asBlob(original), mode: "protect", password: "ù".repeat(70) }, context)).rejects.toThrow(/PDF_PASSWORD_REQUIRED/u);
    await expect(passwordModule.run({ file: asBlob(new TextEncoder().encode("%PDF-broken")), mode: "protect", password: credential }, context)).rejects.toThrow(/PDF_PASSWORD_UNSUPPORTED_417/u);
    const hostile = new Uint8Array(8 * 1024 * 1024 + 1);
    hostile.set(new TextEncoder().encode("%PDF-"));
    await expect(passwordModule.run({ file: asBlob(hostile), mode: "protect", password: credential }, context)).rejects.toThrow(/PDF_LIMIT/u);
    const controller = new AbortController();
    controller.abort();
    await expect(passwordModule.run({ file: asBlob(original), mode: "protect", password: credential }, context, controller.signal)).rejects.toMatchObject({ name: "AbortError" });
  }, 20_000);

  it("terminates a stuck browser worker on an in-flight abort", async () => {
    const controller = new AbortController();
    let terminated = 0;
    class StuckWorker {
      onmessage = null;
      onerror = null;
      postMessage() { controller.abort(); }
      terminate() { terminated++; }
    }
    vi.stubGlobal("window", {});
    vi.stubGlobal("Worker", StuckWorker);
    try {
      await expect(runPasswordJob417(asBlob(original), "protect", credential, controller.signal))
        .rejects.toMatchObject({ name: "AbortError" });
      expect(terminated).toBe(1);
    } finally { vi.unstubAllGlobals(); }
  });
});
