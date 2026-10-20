import { useState } from "preact/hooks";
import {
  type Workbook389, type WorkbookCellKind389, WORKBOOK_389_LIMITS,
  cellAddress389, editWorkbookCell389, expandWorkbook389,
} from "../../../engines/table/workbook-formulas-389";
import { runOfficeLocalJob } from "../../../engines/office-local/client";

const MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

function message(caught: unknown): string {
  return caught instanceof Error ? caught.message : "Il workbook non è modificabile in modo sicuro.";
}

/** Independent XLSX worksheet editing surface; CSV retains its own value-only editor. */
export function WorkbookEditor389() {
  const [workbook, setWorkbook] = useState<Workbook389 | null>(null);
  const [source, setSource] = useState<ArrayBuffer | null>(null);
  const [filename, setFilename] = useState("");
  const [selected, setSelected] = useState<readonly [number, number]>([0, 0]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  async function open(file: File | undefined) {
    if (!file || busy) return;
    setWorkbook(null); setSource(null); setFilename(""); setDrafts({}); setError(""); setStatus(""); setBusy(true);
    try {
      if (!/\.xlsx$/iu.test(file.name)) throw new Error("Scegli un file .xlsx; i file .xls e .xlsm sono esclusi.");
      if (file.size > WORKBOOK_389_LIMITS.bytes) throw new Error("Workbook oltre il limite di 10 MiB.");
      const bytes = await file.arrayBuffer();
      const result = await runOfficeLocalJob({ kind: "xlsx-workbook-open", bytes });
      if (result.kind !== "xlsx-workbook-open") throw new Error("Importazione workbook non disponibile.");
      setWorkbook(result.result); setSource(bytes); setFilename(file.name); setSelected([0, 0]);
      setStatus(`Foglio ${result.result.sheetName} aperto localmente. I risultati delle formule supportate sono ricalcolati.`);
    } catch (caught) { setError(message(caught)); }
    finally { setBusy(false); }
  }

  function edit(row: number, column: number, input: string, kind?: WorkbookCellKind389) {
    if (!workbook) return;
    const address = cellAddress389(row, column);
    try {
      const updated = editWorkbookCell389(workbook, row, column, input, kind);
      setWorkbook(updated);
      setDrafts((previous) => { const next = { ...previous }; delete next[address]; return next; });
      setError(""); setStatus("Modifiche locali: esporta il workbook per salvarle.");
    } catch (caught) {
      setDrafts((previous) => ({ ...previous, [address]: input }));
      setError(message(caught) + " Correggi la cella per abilitare il download.");
    }
  }

  function expand(axis: "row" | "column") {
    if (!workbook || busy) return;
    try {
      setWorkbook(expandWorkbook389(workbook, axis)); setError("");
      setStatus(`Aggiunta una ${axis === "row" ? "riga" : "colonna"} al foglio locale.`);
    } catch (caught) { setError(message(caught)); }
  }

  async function save() {
    if (!source || !workbook || busy || Object.keys(drafts).length > 0) return;
    setBusy(true); setError("");
    try {
      const result = await runOfficeLocalJob({ kind: "xlsx-workbook-export", bytes: source, workbook });
      if (result.kind !== "xlsx-workbook-export") throw new Error("Esportazione workbook non disponibile.");
      const blob = new Blob([result.bytes], { type: MIME });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url; link.download = filename.replace(/\.xlsx$/iu, "") + ".formule.xlsx";
      link.click(); window.setTimeout(() => URL.revokeObjectURL(url), 0);
      setStatus("Workbook XLSX esportato con formule reali e cache ricalcolate.");
    } catch (caught) { setError(message(caught) + " Nessun workbook esportato."); }
    finally { setBusy(false); }
  }

  const active = workbook?.cells[selected[0]]?.[selected[1]];
  return <section class="tool-form-card" aria-label="Editor formule Excel XLSX" data-testid="workbook-editor-389">
    <h2>Modifica celle e formule XLSX</h2>
    <p class="file-note">Editor locale di un solo foglio. Supporta testo, numeri a precisione controllata, riferimenti A1, aritmetica e SUM(A1:B3). Rifiuta cicli, funzioni Excel diverse, macro, link esterni, stili e strutture non compatibili. Non esegue script o richieste remote. Limite {WORKBOOK_389_LIMITS.rows} righe × {WORKBOOK_389_LIMITS.columns} colonne.</p>
    <label class="field"><span>Apri workbook .xlsx</span>
      <input type="file" aria-label="Apri workbook .xlsx" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        disabled={busy} onChange={(event) => void open(event.currentTarget.files?.[0])} />
    </label>
    {error && <p role="alert" class="error">{error}</p>}
    {status && <p role="status" class="file-note">{status}</p>}
    {workbook && <>
      <p class="file-note">{filename} · foglio {workbook.sheetName} · {workbook.cells.length} righe · {workbook.cells[0]?.length ?? 0} colonne. Seleziona una cella per cambiarne il tipo.</p>
      <label class="field"><span>Tipo cella selezionata {cellAddress389(...selected)}</span>
        <select aria-label="Tipo cella selezionata" value={active?.kind === "blank" ? "text" : active?.kind}
          disabled={busy} onChange={(event) => {
            if (!active) return;
            const type = event.currentTarget.value as WorkbookCellKind389;
            const raw = type === "formula" && !active.input.startsWith("=") ? "=" + active.input : active.input;
            edit(selected[0], selected[1], raw, type);
          }}>
          <option value="text">Testo (zeri iniziali conservati)</option>
          <option value="number">Numero (massimo 15 cifre)</option>
          <option value="formula">Formula locale (=...)</option>
        </select>
      </label>
      <div class="table-preview-scroll"><table class="table-preview">
        <caption>Celle Excel editabili; per le formule è mostrato il risultato ricalcolato</caption>
        <thead><tr><th scope="col">#</th>{workbook.cells[0]?.map((_cell, index) =>
          <th scope="col" key={index}>{cellAddress389(0, index).replace(/\d+$/u, "")}</th>)}</tr></thead>
        <tbody>{workbook.cells.map((cells, row) => <tr key={row}>
          <th scope="row">{row + 1}</th>{cells.map((cell, column) => {
            const address = cellAddress389(row, column);
            return <td key={column}>
              <input aria-label={`Cella ${address}`} value={drafts[address] ?? cell.input}
                disabled={busy} onFocus={() => setSelected([row, column])}
                onInput={(event) => edit(row, column, event.currentTarget.value)} />
              {cell.kind === "formula" && <output aria-label={`Risultato ${address}`}>{cell.value}</output>}
            </td>;
          })}</tr>)}</tbody>
      </table></div>
      <div class="actions">
        <button type="button" disabled={busy} onClick={() => expand("row")}>Aggiungi riga</button>
        <button type="button" disabled={busy} onClick={() => expand("column")}>Aggiungi colonna</button>
        <button type="button" disabled={busy || Object.keys(drafts).length > 0} onClick={() => void save()}>Scarica XLSX con formule</button>
      </div>
    </>}
  </section>;
}
