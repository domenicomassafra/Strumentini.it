// #268 refuses HEIC/HEIF production promotion until genuine iPhone and
// physical-mobile evidence exists. Keep the public picker and module aligned.
export const IMAGES_TO_PDF_HEIC_REFUSAL =
  "HEIC/HEIF non sono ancora disponibili per Immagini in PDF: mancano verifiche su foto iPhone reali e dispositivi mobili. Scegli JPG, PNG, WebP, AVIF o GIF.";

export function isDeclaredHeicPdfInput(name: string, mime: string): boolean {
  return /\.(?:heic|heif)$/iu.test(name) || /^image\/hei[cf]$/iu.test(mime);
}
