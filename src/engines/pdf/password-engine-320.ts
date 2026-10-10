import { PDF_LIMITS } from "./types";

export interface UnlockedPdf320 {
  readonly bytes: Uint8Array;
  readonly pageCount: number;
  readonly encryption: string;
}

/** Local, opt-in password-assisted decryption. Never logs, persists, or returns a password. */
export async function unlockPdfBytes320(bytes: Uint8Array, password: string): Promise<UnlockedPdf320> {
  if (!(bytes instanceof Uint8Array) || bytes.length < 8 || bytes.length > PDF_LIMITS.maxBytes ||
      new TextDecoder("latin1").decode(bytes.subarray(0, 5)) !== "%PDF-") {
    throw new Error("INVALID_PDF_SIGNATURE: Il file deve essere un PDF valido entro 25 MiB.");
  }
  if (typeof password !== "string" || password.length < 1 || password.length > 256 || /[\x00-\x1f\x7f]/u.test(password)) {
    throw new Error("PDF_PASSWORD_REQUIRED: Inserisci una password valida (massimo 256 caratteri).");
  }

  // The JS and the 2.1 MiB qpdf WASM binary are packaged on the same origin.
  // The dynamic import runs only when a user explicitly requests unlocking.
  const { createPdfToolkit, PdfPasswordError } = await import("./vendor/pdfstudio/index.js");
  try {
    const pdf = await createPdfToolkit({ wasmUrl: new URL("./vendor/pdfstudio/wasm/qpdf.wasm", import.meta.url) });
    if (!(await pdf.isEncrypted(bytes))) {
      throw new Error("PDF_NOT_ENCRYPTED: Il documento non è cifrato; usa la copia locale senza password.");
    }
    const info = await pdf.getInfo(bytes, { password });
    const unlocked = await pdf.unlock(bytes, { password });
    if (await pdf.isEncrypted(unlocked)) throw new Error("UNSUPPORTED_CAPABILITY: La cifratura rimane nel PDF risultante.");
    const pageCount = await pdf.pageCount(unlocked);
    if (!Number.isInteger(pageCount) || pageCount < 1 || pageCount > PDF_LIMITS.maxPages ||
        unlocked.byteLength > PDF_LIMITS.maxOutputBytes) {
      throw new Error("PDF_LIMIT: Il risultato supera i limiti di pagina o dimensione.");
    }
    const encryption = info.encryption?.method ?? "Cifratura PDF";
    return { bytes: unlocked, pageCount, encryption };
  } catch (error) {
    if (error instanceof PdfPasswordError) throw new Error("PDF_PASSWORD_INCORRECT: Password errata o non autorizzata.");
    if (error instanceof Error && /^(PDF_NOT_ENCRYPTED|PDF_LIMIT|UNSUPPORTED_CAPABILITY):/u.test(error.message)) throw error;
    // qpdf stderr may contain filenames and arguments, including credentials.
    // Never expose the donor exception or its stderr to the caller/telemetry/UI.
    throw new Error("UNSUPPORTED_CAPABILITY: PDF danneggiato o cifratura non supportata dal motore locale.");
  }
}
