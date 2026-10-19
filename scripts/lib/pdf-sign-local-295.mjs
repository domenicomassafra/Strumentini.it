/**
 * #295 — Optional, entirely local Node signing. Never import this from the web
 * application or Cloudflare worker: P12 keys must remain on the caller's host.
 */
import { SignPdf } from '@signpdf/signpdf';
import { P12Signer } from '@signpdf/signer-p12';
import { pdflibAddPlaceholder } from '@signpdf/placeholder-pdf-lib';
import { PDFDocument } from 'pdf-lib';

const MAX_PDF_BYTES = 24 * 1024 * 1024;
const MAX_P12_BYTES = 2 * 1024 * 1024;
const DEFAULT_SIGNATURE_BYTES = 16_384;

function refuse(code) {
  throw new Error(`PDF295_${code}`);
}

/** Strictly allow only a single, unsigned, unencrypted PDF revision. */
export function preflightUnsignedPdf295(input) {
  if (!(input instanceof Uint8Array) || input.length < 32 || input.length > MAX_PDF_BYTES) refuse('UNSUPPORTED_PDF');
  const text = Buffer.from(input).toString('latin1');
  if (!/^%PDF-1\.[0-7]\b/u.test(text)) refuse('UNSUPPORTED_PDF');
  if ((text.match(/%%EOF\b/gu) || []).length !== 1
    || (text.match(/\bstartxref\b/gu) || []).length !== 1
    || !/%%EOF\s*$/u.test(text)) refuse('AMBIGUOUS_REVISION');
  if (/\/(?:ByteRange|DocMDP|FieldMDP|SigFlags|AcroForm|Perms|DSS|VRI|XFA|FT\s*\/Sig|Type\s*\/Sig)\b/u.test(text)) {
    refuse('ALREADY_SIGNED_OR_FORM');
  }
  if (/\/(?:Encrypt|Prev|XRefStm|Linearized|OpenAction|AA|JavaScript|JS|EmbeddedFiles|Collection)\b/u.test(text)) {
    refuse('UNSUPPORTED_PDF');
  }
  return text;
}

/**
 * Returns a detached PKCS#7 signature embedded in a new PDF. The input arrays
 * are never modified; the caller controls whether/where to persist the result.
 */
export async function signPdfLocal295({ pdf, p12, passphrase, signatureBytes = DEFAULT_SIGNATURE_BYTES, consent = false }) {
  if (consent !== true) refuse('CONSENT_REQUIRED');
  preflightUnsignedPdf295(pdf);
  if (!(p12 instanceof Uint8Array) || p12.length < 32 || p12.length > MAX_P12_BYTES) refuse('INVALID_P12');
  if (typeof passphrase !== 'string' || passphrase.length > 1024) refuse('INVALID_PASSPHRASE');
  if (!Number.isInteger(signatureBytes) || signatureBytes < 1024 || signatureBytes > 65_536) refuse('INVALID_PLACEHOLDER');

  let pdfDoc;
  try {
    pdfDoc = await PDFDocument.load(pdf, { ignoreEncryption: false, throwOnInvalidObject: true });
    if (pdfDoc.getPageCount() < 1 || pdfDoc.getPageCount() > 250) refuse('UNSUPPORTED_PDF');
  } catch {
    refuse('UNSUPPORTED_PDF');
  }
  try {
    pdflibAddPlaceholder({ pdfDoc, reason: 'Firma digitale su richiesta', name: '', location: '', contactInfo: '', signatureLength: signatureBytes });
    // The donor requires uncompressed /ByteRange and /Contents tokens.
    const unsigned = Buffer.from(await pdfDoc.save({ useObjectStreams: false }));
    const signer = new P12Signer(Buffer.from(p12), { passphrase });
    const output = await new SignPdf().sign(unsigned, signer);
    if (!Buffer.isBuffer(output) || output.length < pdf.length || !/\/ByteRange\s*\[0\s+\d+\s+\d+\s+\d+\]/u.test(output.toString('latin1'))) {
      refuse('SIGNATURE_INVALID');
    }
    return output;
  } catch (error) {
    if (error?.message?.startsWith('PDF295_')) throw error;
    if (/placeholder length|exceeds placeholder/iu.test(String(error?.message))) refuse('PLACEHOLDER_TOO_SMALL');
    // Do not expose forge errors, private certificate metadata or passwords.
    refuse('SIGNING_FAILED_OR_BAD_PASSWORD');
  }
}
