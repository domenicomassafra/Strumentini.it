import { PDF_LIMITS } from "./types";

/** Protects an ordinary local PDF with an opening password, via qpdf AES-256. */
export async function protectPdfBytes332(bytes: Uint8Array, password: string): Promise<{ bytes: Uint8Array; pageCount: number }> {
  if (!(bytes instanceof Uint8Array) || bytes.length < 8 || bytes.length > PDF_LIMITS.maxBytes ||
      new TextDecoder("latin1").decode(bytes.subarray(0, 5)) !== "%PDF-") {
    throw new Error("INVALID_PDF_SIGNATURE: Carica un PDF entro 25 MiB.");
  }
  if (typeof password !== "string" || password.length < 8 || password.length > 128 || /[\x00-\x1f\x7f]/u.test(password)) {
    throw new Error("PDF_PROTECTION_PASSWORD_INVALID: Usa almeno 8 e massimo 128 caratteri senza caratteri di controllo.");
  }
  const { createPdfToolkit } = await import("./vendor/pdfstudio/index.js");
  try {
    const toolkit = await createPdfToolkit({ wasmUrl: new URL("./vendor/pdfstudio/wasm/qpdf.wasm", import.meta.url) });
    if (await toolkit.isEncrypted(bytes)) throw new Error("PDF_ALREADY_ENCRYPTED: Sblocca prima il file con la password autorizzata.");
    const pageCount = await toolkit.pageCount(bytes);
    if (pageCount < 1 || pageCount > PDF_LIMITS.maxPages) throw new Error("PDF_LIMIT: Numero di pagine non ammesso.");
    const locked = await toolkit.lock(bytes, { userPassword: password, ownerPassword: password, keyLength: 256 });
    const encryption = (await toolkit.getInfo(locked, { password })).encryption;
    if (locked.length > PDF_LIMITS.maxOutputBytes || !(await toolkit.isEncrypted(locked)) ||
        !(await toolkit.requiresPassword(locked)) ||
        encryption?.bits !== 256 || encryption.method !== "AESv3" ||
        await toolkit.pageCount(locked, { password }) !== pageCount) {
      throw new Error("PDF_PROTECTION_VERIFICATION_FAILED: Il PDF cifrato non supera la verifica indipendente.");
    }
    return { bytes: locked, pageCount };
  } catch (error) {
    if (error instanceof Error && /^(PDF_ALREADY_ENCRYPTED|PDF_LIMIT|PDF_PROTECTION_VERIFICATION_FAILED):/u.test(error.message)) throw error;
    // qpdf diagnostic output can include command-line credentials: never expose it.
    throw new Error("PDF_PROTECTION_FAILED: La protezione locale non è riuscita; nessun PDF pronto da scaricare.");
  }
}
