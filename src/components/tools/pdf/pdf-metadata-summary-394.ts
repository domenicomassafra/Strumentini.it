/** Bounded before/after facts and explicit residual scope for PDF metadata removal. */
type ResultData = Record<string, unknown>;

function record(value: unknown): ResultData {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as ResultData : {};
}

export function pdfMetadataBeforeAfterRows(raw: ResultData): readonly { label: string; value: string }[] {
  const from = record(record(raw.before).metadata);
  const to = record(record(raw.after).metadata);
  const infoCount = (entry: ResultData): number => Object.keys(record(entry.recognizedInfo)).length + Object.keys(record(entry.unknownInfo)).length;
  const xmpCount = (entry: ResultData): number => Array.isArray(entry.xmpObjectIds) ? entry.xmpObjectIds.length : 0;
  const audit = record(record(raw.verification).embeddedImageAudit);
  const unverified = Array.isArray(audit.unsupported) ? audit.unsupported.filter((entry): entry is string => typeof entry === "string") : [];
  const checked = typeof audit.jpegChecked === "number" && Number.isSafeInteger(audit.jpegChecked) ? audit.jpegChecked : 0;
  const residualSummary = unverified.length > 0
    ? `${unverified.slice(0, 8).join(" · ")}${unverified.length > 8 ? ` · altri ${unverified.length - 8} residui` : ""}`
    : checked > 0 ? "Nessuno nei JPEG DCT verificati; altri contenuti non certificati" : "Nessun JPEG verificato; contenuti non certificati";
  return [
    { label: "Campi PDF /Info (prima → dopo)", value: `${infoCount(from)} → ${infoCount(to)}` },
    { label: "Stream XMP /Metadata (prima → dopo)", value: `${xmpCount(from)} → ${xmpCount(to)}` },
    { label: "JPEG incorporati riparsati nell'output", value: String(checked) },
    { label: `Residui non verificati (${unverified.length})`, value: residualSummary },
    { label: "Limite della verifica", value: typeof audit.limitation === "string" ? audit.limitation : "Inventario dei metadati del documento non completo." },
  ];
}
