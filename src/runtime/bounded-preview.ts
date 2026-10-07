import type { OutputArtifactDescriptor } from "./output-artifact";

export interface BoundedTextPreview {
  readonly kind: "text" | "code";
  readonly text: string;
  readonly shown: number;
  readonly total: number;
  readonly unit: "lines";
  readonly truncated: boolean;
  readonly artifact: OutputArtifactDescriptor;
}

export interface BoundedTablePreview {
  readonly kind: "table";
  readonly headers: readonly string[];
  readonly rows: readonly (readonly string[])[];
  readonly shown: number;
  readonly total: number;
  readonly unit: "rows";
  readonly truncated: boolean;
  readonly artifact: OutputArtifactDescriptor;
}

function positiveLimit(value: number, label: string): number {
  if (!Number.isInteger(value) || value <= 0) throw new RangeError(`${label} must be a positive integer`);
  return value;
}

export function createBoundedTextPreview(
  artifact: OutputArtifactDescriptor,
  maxLines: number,
  kind: "text" | "code" = "text",
): BoundedTextPreview {
  positiveLimit(maxLines, "maxLines");
  const decoded = new TextDecoder("utf-8", { fatal: false }).decode(artifact.bytes);
  const lines = decoded === "" ? [] : decoded.split(/\r\n|\n|\r/u);
  const shownLines = lines.slice(0, maxLines);
  return {
    kind,
    text: shownLines.join("\n"),
    shown: shownLines.length,
    total: lines.length,
    unit: "lines",
    truncated: shownLines.length < lines.length,
    artifact,
  };
}

export function createBoundedTablePreview(
  artifact: OutputArtifactDescriptor,
  headers: readonly string[],
  rows: readonly (readonly string[])[],
  maxRows: number,
): BoundedTablePreview {
  positiveLimit(maxRows, "maxRows");
  return {
    kind: "table",
    headers: [...headers],
    rows: rows.slice(0, maxRows).map((row) => [...row]),
    shown: Math.min(rows.length, maxRows),
    total: rows.length,
    unit: "rows",
    truncated: rows.length > maxRows,
    artifact,
  };
}
