// STR-417: a narrow, fail-closed adapter for MIT PDFSmaller AES-256 codecs.
// Their R6 implementation uses browser Web Crypto; never enable legacy RC4 output.
export type PasswordOperation417 = "protect" | "remove";

export const PASSWORD_417_MAX_INPUT = 8 * 1024 * 1024;
export const PASSWORD_417_MAX_OUTPUT = 24 * 1024 * 1024;

export function validatePassword417(bytes: Uint8Array, password: string): void {
  if (bytes.length < 8 || bytes.length > PASSWORD_417_MAX_INPUT) {
    throw new Error("PDF_LIMIT: Dimensione PDF fuori dal limite locale di 8 MiB.");
  }
  if (new TextDecoder("latin1").decode(bytes.subarray(0, 5)) !== "%PDF-") {
    throw new Error("INVALID_PDF_SIGNATURE: Il file non è un PDF.");
  }
  if (password.length === 0 || new TextEncoder().encode(password).length > 127) {
    throw new Error("PDF_PASSWORD_REQUIRED: Inserisci una password di massimo 127 byte UTF-8.");
  }
}

export async function runPasswordCodec417(bytes: Uint8Array, operation: PasswordOperation417, password: string): Promise<Uint8Array> {
  validatePassword417(bytes, password);
  try {
    let output: Uint8Array;
    if (operation === "protect") {
      const { encryptPDF } = await import("@pdfsmaller/pdf-encrypt");
      output = await encryptPDF(bytes, password, { algorithm: "AES-256" });
    } else {
      const { decryptPDF } = await import("@pdfsmaller/pdf-decrypt");
      output = await decryptPDF(bytes, password);
    }
    if (output.length < 8 || output.length > PASSWORD_417_MAX_OUTPUT ||
        new TextDecoder("latin1").decode(output.subarray(0, 5)) !== "%PDF-") {
      throw new Error("PDF_LIMIT: Risultato non valido o superiore a 24 MiB.");
    }
    return output;
  } catch (error) {
    if (error instanceof Error && /^(PDF_LIMIT|PDF_PASSWORD_REQUIRED|INVALID_PDF_SIGNATURE)/u.test(error.message)) throw error;
    const message = error instanceof Error ? error.message : "";
    if (/incorrect password|wrong password|password does not match/iu.test(message)) throw new Error("PDF_PASSWORD_INCORRECT");
    if (/already encrypted/iu.test(message)) throw new Error("PDF_ALREADY_ENCRYPTED: Usa un PDF senza protezione.");
    if (/not encrypted/iu.test(message)) throw new Error("PDF_NOT_ENCRYPTED");
    throw new Error("PDF_PASSWORD_UNSUPPORTED_417: Formato PDF non compatibile o corrotto.");
  }
}
