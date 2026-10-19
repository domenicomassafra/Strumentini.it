/** Generic scalar result formatting shared by image calculators and viewers. */
import type { ImageResultValue } from "./ImageResultV2";

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1).replace(".", ",")} KiB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} MiB`;
}

export function displayValue(value: unknown): string {
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.map((item) => displayValue(item)).join(", ");
  if (typeof value === "object" && value !== null) return JSON.stringify(value);
  return "—";
}

export function detailRows(raw: ImageResultValue): readonly { label: string; value: string }[] {
  const ignored = new Set(["blob", "items", "palette", "dominant", "metadataGroups", "fidelity", "zipBlob", "gps"]);
  return Object.entries(raw)
    .filter(([key]) => !ignored.has(key))
    .slice(0, 10)
    .map(([key, value]) => ({ label: key, value: displayValue(value) }));
}

export function metadataGroupsLabel(value: unknown): string {
  if (!Array.isArray(value) || value.length === 0) return "nessuno";
  return value.map((entry) => {
    const group = asRecord(entry);
    const carrier = stringField(group?.carrier) ?? "metadata";
    const count = numberField(group?.count) ?? 0;
    const bytes = numberField(group?.bytes) ?? 0;
    return `${carrier} ×${count} · ${formatBytes(bytes)}`;
  }).join("; ");
}

export function collectionRows(raw: ImageResultValue): readonly { label: string; value: string }[] {
  const rows: Array<{ label: string; value: string }> = [];
  if (Array.isArray(raw.items)) {
    raw.items.slice(0, 20).forEach((item, index) => rows.push({ label: `Elemento ${index + 1}`, value: displayValue(item) }));
  }
  if (Array.isArray(raw.palette)) {
    raw.palette.slice(0, 12).forEach((item, index) => rows.push({ label: `Colore ${index + 1}`, value: displayValue(item) }));
  }
  if (raw.dominant !== undefined && raw.dominant !== null) {
    rows.push({ label: "Colore dominante", value: displayValue(raw.dominant) });
  }
  return rows;
}

export function copyPayload(raw: ImageResultValue): string {
  const serializable = Object.fromEntries(Object.entries(raw).filter(([key]) => key !== "blob" && key !== "gps"));
  return JSON.stringify(serializable, (_key, value) => value instanceof Blob ? `[file ${value.type || "binario"} · ${value.size} byte]` : value, 2);
}
