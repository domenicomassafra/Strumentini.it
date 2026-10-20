import type { OcrResult246 } from "./local-italian-246";

/** Keep a manual transcription distinct from the unverified engine result. */
export function prepareOcrTextExport395(
  recognized: Pick<OcrResult246, "text" | "confidence">,
  editedText: string,
) {
  if (typeof editedText !== "string" || editedText.length > 100_000 || !editedText.trim()) {
    throw new Error("OCR395_INVALID_CORRECTION");
  }
  return {
    text: editedText,
    manuallyCorrected: editedText !== recognized.text,
    engineConfidence: typeof recognized.confidence === "number" && Number.isFinite(recognized.confidence)
      && recognized.confidence >= 0 && recognized.confidence <= 100 ? recognized.confidence : null,
    authoritative: false as const,
  };
}
