export interface WorkbenchSummary388 {
  [key: string]: unknown;
  chunks?: readonly unknown[];
}

export function resultSummary(result: WorkbenchSummary388 | null): string {
  if (result === null) return "";
  const parts: string[] = [];
  const add = (label: string, value: unknown) => { if (value !== undefined && value !== null) parts.push(`${label}: ${String(value)}`); };
  add("righe", result.rowCount);
  add("righe input", result.inputRows);
  add("righe output", result.outputRows);
  add("righe sinistra", result.leftRows);
  add("righe destra", result.rightRows);
  if (typeof result.inputRows === "number" && typeof result.outputRows === "number") add("variazione righe", result.outputRows - result.inputRows);
  add("colonne", result.columnCount);
  add("gruppi", result.groups);
  add("righe corrispondenti", result.matchedRows);
  add("righe escluse", result.rejectedRows);
  add("righe duplicate", result.duplicateRows);
  add("valori mancanti", result.totalMissing);
  add("parti", Array.isArray(result.chunks) ? result.chunks.length : undefined);
  add("righe aggiunte", result.addedRows);
  add("righe rimosse", result.removedRows);
  add("righe cambiate", result.changedRows);
  add("righe interessate", result.affectedRows);
  add("celle interessate", result.affectedCells);
  if (typeof result.textChanges === "object" && result.textChanges !== null) {
    const changes = result.textChanges as Record<string, unknown>;
    add("BOM rimosso", changes.bomRemoved === true ? "sì" : changes.bomRemoved === false ? "no" : undefined);
    add("interruzioni riga normalizzate", changes.normalizedLineEndings);
    add("caratteri sostitutivi", changes.replacementCharacters);
  }
  add("chiavi ambigue", result.ambiguousKeyCount);
  if (Array.isArray(result.selectedColumnDisclosure)) add("colonne scelte", result.selectedColumnDisclosure.map((column) => typeof column === "object" && column !== null && "name" in column ? String((column as { name: unknown }).name) : "").filter(Boolean).join(", "));
  if (typeof result.selectedColumn === "object" && result.selectedColumn !== null && "name" in result.selectedColumn) add("colonna", (result.selectedColumn as { name: unknown }).name);
  if (Array.isArray(result.groupColumnDisclosure)) add("chiavi gruppo", result.groupColumnDisclosure.map((column) => typeof column === "object" && column !== null && "name" in column ? String((column as { name: unknown }).name) : "").filter(Boolean).join(", "));
  if (Array.isArray(result.leftKeyDisclosure)) add("chiavi sinistra", result.leftKeyDisclosure.map((column) => typeof column === "object" && column !== null && "name" in column ? String((column as { name: unknown }).name) : "").filter(Boolean).join(", "));
  if (Array.isArray(result.rightKeyDisclosure)) add("chiavi destra", result.rightKeyDisclosure.map((column) => typeof column === "object" && column !== null && "name" in column ? String((column as { name: unknown }).name) : "").filter(Boolean).join(", "));
  add("stima join", typeof result.estimate === "object" && result.estimate !== null && "estimatedOutputRows" in result.estimate ? (result.estimate as { estimatedOutputRows: unknown }).estimatedOutputRows : undefined);
  add("policy", result.policySummary);
  add("delimitatore", result.delimiter);
  add("codifica rilevata", result.detectedEncoding);
  add("affidabilità", result.confidence);
  return parts.join(" · ");
}

