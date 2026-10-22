import { useState } from "preact/hooks";
import { readBlobText, type CsvTable } from "../../../engines/table/csv";
import {
  EDITOR_387_LIMITS, editCell387, exportEditableCsv387, parseEditable387,
} from "../../../engines/table/spreadsheet-edit-387";
import { type SpreadsheetColumnType } from "../../../engines/table/spreadsheet-interchange";
import { runOfficeLocalJob } from "../../../engines/office-local/client";

type ImportedTable = {
  table: CsvTable;
  source: "csv" | "xlsx";
  filename: string;
  sheetName: string;
  columnTypes: SpreadsheetColumnType[];
};

const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

function saveLocalFile(bytes: BlobPart, name: string, mime: string): void {
  const url = URL.createObjectURL(new Blob([bytes], { type: mime }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  // Delay revocation one task so browser download consumers can take ownership.
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : "Operazione rifiutata: controlla i dati del file.";
}

/**
 * Interactive, bounded companion to the existing CSV preview. A workbook with
 * multiple sheets is refused: re-saving just one sheet would delete the rest.
 */
export function SpreadsheetEditor387() {
  const [opened, setOpened] = useState<ImportedTable | null>(null);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  async function open(file: File | undefined) {
    if (!file || busy) return;
    setOpened(null); setError(""); setStatus(""); setBusy(true);
    try {
      if (file.size > 10 * 1024 * 1024) throw new Error("File oltre il limite locale di 10 MiB.");
      const isExcel = /\.xlsx$/iu.test(file.name);
      if (!isExcel && !/\.csv$/iu.test(file.name)) throw new Error("Scegli un file .csv oppure .xlsx.");
      let text: string;
      let sheetName = "Sheet1";
      let columnTypes: SpreadsheetColumnType[] = [];
      if (isExcel) {
        const result = await runOfficeLocalJob({ kind: "xlsx-to-csv", bytes: await file.arrayBuffer(), refuseFormulaLikeText: true, strictEditing: true });
        if (result.kind !== "spreadsheet-read") throw new Error("Lettura Excel non disponibile.");
        const data = result.result;
        if (data.sheetNames.length !== 1 || data.columnTypes.includes("mixed")) {
          throw new Error("Il file contiene più fogli o colonne con tipi misti; per conservarlo integralmente l'editor ne rifiuta la riscrittura.");
        }
        text = data.csv;
        sheetName = data.selectedSheet;
        columnTypes = [...data.columnTypes] as SpreadsheetColumnType[];
      } else {
        text = await readBlobText(file);
      }
      const table = parseEditable387(text);
      if (columnTypes.length === 0) columnTypes = table.header.map(() => "text");
      setOpened({ table, source: isExcel ? "xlsx" : "csv", filename: file.name, sheetName, columnTypes });
      setStatus("File aperto: tutte le celle modificabili sono visibili. I numeri e le date locali restano testo salvo scelta esplicita del tipo.");
    } catch (caught) {
      setError(message(caught));
    } finally {
      setBusy(false);
    }
  }

  function edit(row: number, column: number, value: string) {
    setOpened((current) => current === null ? null : {
      ...current, table: editCell387(current.table, row, column, value),
    });
    setError(""); setStatus("Modifiche locali non ancora esportate.");
  }

  async function exportFile(format: "csv" | "xlsx") {
    if (opened === null || busy) return;
    setError(""); setStatus(""); setBusy(true);
    try {
      const csv = exportEditableCsv387(opened.table);
      const basename = opened.filename.replace(/\.(?:csv|xlsx)$/iu, "");
      if (format === "csv") {
        saveLocalFile(csv, basename + ".edited.csv", "text/csv;charset=utf-8");
      } else {
        const result = await runOfficeLocalJob({
          kind: "csv-to-xlsx",
          text: csv,
          sheetName: opened.sheetName,
          columnPolicies: opened.columnTypes.map((type, column) => ({ type, column })),
        });
        if (result.kind !== "spreadsheet-write") throw new Error("Esportazione Excel non disponibile.");
        saveLocalFile(result.result.bytes, basename + ".edited.xlsx", XLSX_MIME);
      }
      setStatus("Esportazione completata nel browser: " + basename + ".edited." + format);
    } catch (caught) {
      setError(message(caught) + " Nessun file è stato generato.");
    } finally {
      setBusy(false);
    }
  }

  return <section class="tool-form-card" aria-label="Editor CSV e Excel" data-testid="spreadsheet-editor-387">
    <h2>Modifica e salva CSV / Excel</h2>
    <p class="file-note">Tutto nel browser, senza caricamenti. I file XLSX con più fogli, formule, macro o strutture non supportate vengono rifiutati per evitare perdite. Limite editor: {EDITOR_387_LIMITS.rows} righe e {EDITOR_387_LIMITS.columns} colonne.</p>
    <label class="field"><span>Apri CSV UTF-8 o XLSX</span>
      <input aria-label="Apri CSV UTF-8 o XLSX" type="file" accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        disabled={busy} onChange={(event) => void open(event.currentTarget.files?.[0])} />
    </label>
    {error && <p role="alert" class="error">{error}</p>}
    {status && <p role="status" class="file-note">{status}</p>}
    {opened !== null && <>
      <p class="file-note">{opened.filename} · {opened.table.rows.length} righe · {opened.table.header.length} colonne · {opened.source === "xlsx" ? "foglio " + opened.sheetName : "delimitatore " + (opened.table.delimiter === "\t" ? "TAB" : opened.table.delimiter)}</p>
      <p class="file-note">Il valore di ogni cella è testuale. Per Excel scegli Numero o Data ISO solo se la colonna è uniforme; altrimenti mantieni Testo per conservare zeri iniziali, date locali e decimali esatti.</p>
      <div class="table-preview-scroll">
        <table class="table-preview"><caption>Celle modificabili (incluse intestazioni)</caption>
          <thead><tr><th scope="col">#</th>{opened.table.header.map((heading, column) =>
            <th scope="col" key={column}>
              <label class="field"><span>Intestazione {column + 1}</span>
                <input aria-label={"Intestazione " + (column + 1)} value={heading} disabled={busy} onInput={(event) => edit(-1, column, event.currentTarget.value)} />
              </label>
              <label class="field"><span>Tipo Excel</span>
                <select aria-label={"Tipo Excel colonna " + (column + 1)} disabled={busy} value={opened.columnTypes[column]}
                  onChange={(event) => setOpened((current) => current === null ? null : {
                    ...current, columnTypes: current.columnTypes.map((value, index) =>
                      index === column ? event.currentTarget.value as SpreadsheetColumnType : value),
                  })}>
                  <option value="text">Testo (identico)</option><option value="number">Numero (15 cifre max)</option><option value="date">Data ISO (AAAA-MM-GG)</option>
                </select>
              </label>
            </th>)}</tr></thead>
          <tbody>{opened.table.rows.map((cells, row) =>
            <tr key={row}><th scope="row">{row + 1}</th>{cells.map((cell, column) =>
              <td key={column}><input aria-label={"Riga " + (row + 1) + " colonna " + (column + 1)}
                value={cell} disabled={busy} onInput={(event) => edit(row, column, event.currentTarget.value)} /></td>)}</tr>)}</tbody>
        </table>
      </div>
      <div class="actions">
        <button type="button" disabled={busy} onClick={() => void exportFile("csv")}>Scarica CSV modificato</button>
        <button type="button" disabled={busy} onClick={() => void exportFile("xlsx")}>Scarica Excel modificato</button>
      </div>
    </>}
  </section>;
}
