/** STR-028: public claims about the engines already wired into the image routes.
 * This is a routing/capability inventory; it must never act as an encoder.
 */
export const IMAGE_FAMILY_CAPABILITIES_028 = [
  { input: "JPEG", compression: "Canvas JPEG lossy: qualità indicativa e target in byte", conversion: "PNG, JPEG, WebP (WebP solo se codificato realmente)", evidence: "conditional" },
  { input: "PNG", compression: "IDAT senza perdita, palette esatta/approssimata; Canvas e target", conversion: "PNG, JPEG con sfondo esplicito per alpha, WebP", evidence: "conditional" },
  { input: "WebP", compression: "Canvas WebP lossy con verifica MIME; niente WebP lossless", conversion: "PNG, JPEG con sfondo esplicito per alpha, WebP", evidence: "conditional" },
  { input: "SVG", compression: "SVGO su vettori statici sicuri, anteprima separata", conversion: "Raster PNG/JPEG/WebP e PDF raster; restrizioni SVG", evidence: "restricted" },
  { input: "AVIF", compression: "Nessun encoder AVIF approvato", conversion: "PNG/JPEG/WebP solo con decoder disponibile e verifica struttura", evidence: "restricted" },
  { input: "HEIC/HEIF", compression: "Nessun encoder HEIC/HEIF approvato", conversion: "PNG/JPEG/WebP solo se il decoder locale è disponibile", evidence: "restricted" },
  { input: "GIF", compression: "Nessuna compressione GIF animata", conversion: "Solo primo frame verso PNG/JPEG/WebP; animazione persa", evidence: "restricted" },
] as const;

export const IMAGE_FAMILY_NOTES_028 = [
  "Il target misura i byte effettivi: se impossibile, il risultato dichiara che non è stato raggiunto.",
  "La qualità Canvas è un suggerimento al browser, non un valore garantito dal codec.",
  "Supporto di decodifica e codifica varia per browser: nessuna direzione non provata viene certificata.",
  "I file originali rimangono intatti; i risultati sono nuovi artefatti locali verificati.",
] as const;
