import { useEffect, useMemo, useState } from "preact/hooks";
import { readBlobText } from "../../../engines/table/csv";
import { runOfficeLocalJob } from "../../../engines/office-local/client";
import { toolRuntime } from "../../../runtime/tool-runtime";
import { receiveHandoffFromOpener } from "../../../runtime/handoff";
import type { ToolSummary } from "../../../catalog/manifest";
import type { FactoryToolManifest } from "../../../tool-factory/manifest";
import {
  BoundedTableResultPreview, InlineError, ResultInterpretation, ResultPrimaryAnswer,
  ToolActions, ToolCancelButton, ToolFormCard, ToolOperation, ToolResetButton,
  ToolResultPanel, ToolSubmitButton, gutterStateFor, useToolOperation,
} from "../shared";
import { buildTableResultV2Model } from "../table/table-result-v2";

type RelationKind = "compare" | "join";
type Result390 = { output: string; table: { header: string[]; rows: string[][]; delimiter: string; warnings: { code: string; message: string }[] };
  ambiguousKeyCount?: number; ambiguousKeys?: { key: string[]; leftRows: number[]; rightRows: number[] }[];
  addedRows?: number; removedRows?: number; changedRows?: number; duplicateLeft?: unknown[]; duplicateRight?: unknown[];
  partCounts?: number[]; policySummary?: string };

const ACCEPT_TABLES = ".csv,.tsv,.txt,.xlsx,text/csv,text/tab-separated-values,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

function positions(text: string): number[] {
  if (!/^\s*\d+(?:\s*,\s*\d+)*\s*$/u.test(text)) throw new Error("Le posizioni devono essere interi non negativi separati da virgole.");
  const values = text.split(",").map(Number);
  if (new Set(values).size !== values.length) throw new Error("Ogni colonna può comparire una sola volta.");
  return values;
}

async function localCsv(file: File, sheet: string, signal: AbortSignal): Promise<string> {
  if (signal.aborted) throw new DOMException("Operazione annullata", "AbortError");
  if (!file.name.toLowerCase().endsWith(".xlsx")) return readBlobText(file);
  const sheetNumber = sheet.trim() === "" ? undefined : Number(sheet);
  if (sheetNumber !== undefined && (!Number.isSafeInteger(sheetNumber) || sheetNumber < 1)) {
    throw new Error("Seleziona un foglio XLSX con indice intero da 1.");
  }
  const result = await runOfficeLocalJob({ kind: "xlsx-to-csv", bytes: await file.arrayBuffer(),
    ...(sheetNumber === undefined ? {} : { sheet: sheetNumber }),
    refuseFormulaLikeText: true }, { signal });
  if (result.kind !== "spreadsheet-read") throw new Error("Importazione XLSX non disponibile.");
  return result.result.csv;
}

export function TableRelations390({ kind, manifest }: { readonly kind: RelationKind; readonly manifest: ToolSummary | FactoryToolManifest }) {
  const [leftText, setLeftText] = useState("");
  const [rightText, setRightText] = useState("");
  const [partTexts, setPartTexts] = useState<string[]>([]);
  const [partNames, setPartNames] = useState<string[]>([]);
  const [operationKind, setOperationKind] = useState<"join" | "merge-parts">("join");
  const [leftKeyColumns, setLeftKeyColumns] = useState("0");
  const [rightKeyColumns, setRightKeyColumns] = useState("0");
  const [leftCompareColumns, setLeftCompareColumns] = useState("1");
  const [rightCompareColumns, setRightCompareColumns] = useState("1");
  const [joinType, setJoinType] = useState("inner");
  const [keyPrecision, setKeyPrecision] = useState("text");
  const [decimalPlaces, setDecimalPlaces] = useState("2");
  const [nullTokens, setNullTokens] = useState("NULL");
  const [emptyAsNull, setEmptyAsNull] = useState(true);
  const [caseSensitive, setCaseSensitive] = useState(true);
  const [nullKeyPolicy, setNullKeyPolicy] = useState("never-match");
  const [duplicatePolicy, setDuplicatePolicy] = useState("reject");
  const [sheet, setSheet] = useState("");
  const [fileError, setFileError] = useState("");
  const [actionStatus, setActionStatus] = useState("");
  const mergeMode = kind === "join" && operationKind === "merge-parts";

  const operation = useToolOperation<Result390>((signal) => {
    if (mergeMode) {
      const chunks = partTexts.length >= 2 ? partTexts : [leftText, rightText];
      return toolRuntime.run(manifest.id, { operation: "merge-parts", partsTexts: chunks }, {}, signal);
    }
    return toolRuntime.run(manifest.id, {
      operation: kind, leftText, rightText, leftKeyColumns: positions(leftKeyColumns),
      rightKeyColumns: positions(rightKeyColumns), ...(kind === "compare"
        ? { leftCompareColumns: positions(leftCompareColumns), rightCompareColumns: positions(rightCompareColumns) }
        : { joinType, duplicatePolicy }),
      keyPrecision, ...(keyPrecision === "decimal-scale" ? { decimalPlaces: Number(decimalPlaces) } : {}),
      nullTokens: nullTokens.split(",").map((token) => token.trim()),
      emptyAsNull, caseSensitive,
      nullKeyPolicy: kind === "join" ? nullKeyPolicy : (nullKeyPolicy === "match" ? "match" : "reject"),
    }, {}, signal);
  }, { formatError: (failure) => failure.message, formatThrownError: (error) => error instanceof Error ? error.message : "Operazione non riuscita." });

  function invalidate() { operation.reset(); setActionStatus(""); }

  useEffect(() => receiveHandoffFromOpener(manifest as ToolSummary, (envelope) => {
    setLeftText(envelope.payload);
    setRightText("");
    setPartTexts([]);
    setPartNames([]);
    invalidate();
  }), [manifest]);

  async function addFile(file: File | undefined, side: "left" | "right") {
    if (file === undefined) return;
    setFileError("");
    invalidate();
    const controller = new AbortController();
    try {
      const csv = await localCsv(file, sheet, controller.signal);
      if (side === "left") setLeftText(csv);
      else setRightText(csv);
    } catch (error) {
      setFileError(error instanceof Error ? error.message : "Lettura file non riuscita.");
    }
  }

  async function addParts(files: FileList | null) {
    if (files === null || files.length === 0) return;
    setFileError("");
    invalidate();
    try {
      const selected = Array.from(files);
      if (selected.length > 500) throw new Error("Unisci al massimo 500 parti.");
      const converted: string[] = [];
      for (const file of selected) converted.push(await localCsv(file, sheet, new AbortController().signal));
      setPartTexts(converted);
      setPartNames(selected.map((file) => file.name));
    } catch (error) {
      setPartTexts([]);
      setPartNames([]);
      setFileError(error instanceof Error ? error.message : "Importazione non riuscita.");
    }
  }

  function reset() {
    setLeftText(""); setRightText(""); setPartTexts([]); setPartNames([]);
    setFileError(""); setActionStatus(""); operation.reset();
  }

  const model = useMemo(() => operation.result === null ? null
    : buildTableResultV2Model(manifest.id, kind, operation.result, leftText),
  [operation.result, manifest.id, kind, leftText]);
  const result = operation.result;
  const summary = result === null ? "" : result.partCounts !== undefined
    ? `${result.partCounts.length} parti · ${result.partCounts.join(" + ")} righe; nessun duplicato rimosso`
    : kind === "compare"
      ? `${result.addedRows ?? 0} aggiunte · ${result.removedRows ?? 0} rimosse · ${result.changedRows ?? 0} cambiate · ${result.ambiguousKeyCount ?? 0} chiavi ambigue`
      : `Join ${joinType} · gruppi duplicati: ${result.duplicateLeft?.length ?? 0} a sinistra, ${result.duplicateRight?.length ?? 0} a destra`;

  function download() {
    if (model === null) return;
    const url = URL.createObjectURL(new Blob([model.exportPayload], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url; anchor.download = mergeMode ? "tabelle-riunite.csv" : kind === "join" ? "tabelle-unite.csv" : "differenze-tabella.csv";
    anchor.click(); URL.revokeObjectURL(url);
    setActionStatus("CSV completo scaricato.");
  }
  async function copy() {
    if (model === null) return;
    try {
      await navigator.clipboard.writeText(model.exportPayload);
      setActionStatus("CSV completo copiato.");
    } catch {
      setActionStatus("Gli appunti non sono disponibili. Usa il download.");
    }
  }

  return <ToolOperation className="table-workbench" busy={operation.isRunning}>
    <ToolFormCard>
      <form onSubmit={(event) => { event.preventDefault(); void operation.run(); }}>
        <p class="file-note">Le tabelle restano in questo browser. Chiavi, valori NULL e precisione sono scelte esplicite; le ambiguità non vengono abbinate automaticamente.</p>
        {kind === "join" && <label class="field"><span>Operazione</span><select value={operationKind} onChange={(event) => { setOperationKind(event.currentTarget.value as "join" | "merge-parts"); invalidate(); }}><option value="join">Unisci per chiave (join)</option><option value="merge-parts">Ricomponi / accoda parti (stesse intestazioni)</option></select></label>}
        {mergeMode && <label class="field"><span>Seleziona le parti CSV/XLSX in ordine di concatenazione (2–500)</span><input type="file" multiple accept={ACCEPT_TABLES} onChange={(event) => void addParts(event.currentTarget.files)} /></label>}
        {mergeMode && partNames.length > 0 && <p class="file-note" role="status">Parti in ordine: {partNames.join(" → ")}</p>}
        {(!mergeMode || partTexts.length === 0) && <div>
          <label class="field"><span>Prima tabella CSV</span><textarea rows={6} value={leftText} onInput={(event) => { setLeftText(event.currentTarget.value); invalidate(); }} /></label>
          <label class="field"><span>File sinistro · facoltativo</span><input type="file" accept={ACCEPT_TABLES} onChange={(event) => void addFile(event.currentTarget.files?.[0], "left")} /></label>
          <label class="field"><span>Seconda tabella CSV</span><textarea rows={6} value={rightText} onInput={(event) => { setRightText(event.currentTarget.value); invalidate(); }} /></label>
          <label class="field"><span>File destro · facoltativo</span><input type="file" accept={ACCEPT_TABLES} onChange={(event) => void addFile(event.currentTarget.files?.[0], "right")} /></label>
        </div>}
        <label class="field"><span>Foglio XLSX (1, 2, …; lascia vuoto per un file con un solo foglio)</span><input type="number" min="1" step="1" value={sheet} onInput={(event) => setSheet(event.currentTarget.value)} placeholder="Automatico se unico" /></label>
        {!mergeMode && <div class="table-control-grid">
          <label class="field"><span>Colonne chiave sinistra (indici da zero)</span><input value={leftKeyColumns} onInput={(event) => { setLeftKeyColumns(event.currentTarget.value); invalidate(); }} /></label>
          <label class="field"><span>Colonne chiave destra</span><input value={rightKeyColumns} onInput={(event) => { setRightKeyColumns(event.currentTarget.value); invalidate(); }} /></label>
          {kind === "compare" && <label class="field"><span>Colonne confronto sinistra</span><input value={leftCompareColumns} onInput={(event) => { setLeftCompareColumns(event.currentTarget.value); invalidate(); }} /></label>}
          {kind === "compare" && <label class="field"><span>Colonne confronto destra</span><input value={rightCompareColumns} onInput={(event) => { setRightCompareColumns(event.currentTarget.value); invalidate(); }} /></label>}
          {kind === "join" && <label class="field"><span>Tipo di join</span><select value={joinType} onChange={(event) => { setJoinType(event.currentTarget.value); invalidate(); }}><option value="inner">Solo corrispondenze</option><option value="left">Tutte le righe sinistre</option><option value="right">Tutte le righe destre</option><option value="full">Tutte le righe</option></select></label>}
          <label class="field"><span>Interpretazione delle chiavi</span><select value={keyPrecision} onChange={(event) => { setKeyPrecision(event.currentTarget.value); invalidate(); }}><option value="text">Testo esatto (01 diverso da 1)</option><option value="decimal-exact">Numero decimale esatto (01 uguale a 1)</option><option value="decimal-scale">Numero decimale, massimo N cifre frazionarie</option></select></label>
          {keyPrecision === "decimal-scale" && <label class="field"><span>Massimo decimali senza arrotondamento (0–12)</span><input type="number" min="0" max="12" step="1" value={decimalPlaces} onInput={(event) => { setDecimalPlaces(event.currentTarget.value); invalidate(); }} /></label>}
          <label class="field"><span>Token di NULL separati da virgola</span><input value={nullTokens} onInput={(event) => { setNullTokens(event.currentTarget.value); invalidate(); }} /></label>
          <label class="field"><span>Chiavi NULL</span><select value={nullKeyPolicy} onChange={(event) => { setNullKeyPolicy(event.currentTarget.value); invalidate(); }}>{kind === "join" ? <option value="never-match">Mai corrispondenti</option> : <option value="never-match">Rifiuta: identità sconosciuta</option>}<option value="match">Considera NULL uguali esplicitamente</option></select></label>
          {kind === "join" && <label class="field"><span>Chiavi duplicate</span><select value={duplicatePolicy} onChange={(event) => { setDuplicatePolicy(event.currentTarget.value); invalidate(); }}><option value="reject">Rifiuta join ambiguo</option><option value="expand">Espandi tutte le combinazioni (prodotto cartesiano)</option></select></label>}
          <label class="choice-line"><input type="checkbox" checked={emptyAsNull} onChange={(event) => { setEmptyAsNull(event.currentTarget.checked); invalidate(); }} /> Anche cella vuota è NULL</label>
          <label class="choice-line"><input type="checkbox" checked={caseSensitive} onChange={(event) => { setCaseSensitive(event.currentTarget.checked); invalidate(); }} /> Distingui maiuscole/minuscole</label>
        </div>}
        <p class="file-note">{mergeMode ? "Le intestazioni devono essere identiche e ordinate. Tutte le righe, inclusi i duplicati, restano invariate." : "Le chiavi decimali accettano soltanto numeri in base 10 (punto decimale, niente esponenti). La scala massima non arrotonda. Il confronto segnala le chiavi duplicate; il join le rifiuta finché non autorizzi l'espansione."}</p>
        <InlineError message={fileError || operation.error} />
        <ToolActions><ToolSubmitButton busy={operation.isRunning}>{mergeMode ? "Ricomponi parti" : kind === "join" ? "Unisci tabelle" : "Confronta tabelle"}</ToolSubmitButton>{operation.isRunning && <ToolCancelButton onCancel={operation.cancel} />}<ToolResetButton onClick={reset} disabled={operation.isRunning} /></ToolActions>
      </form>
    </ToolFormCard>
    <ToolResultPanel eyebrow="Risultato" placeholder="Avvia l'operazione per vedere il risultato locale." busy={operation.isRunning} state={gutterStateFor(operation.status)}>
      {result !== null && model !== null && <div data-result-class="table">
        <div data-result-slot="summary"><ResultPrimaryAnswer label="Tabella">{model.rows} righe · {model.columns} colonne</ResultPrimaryAnswer><ResultInterpretation state={result.ambiguousKeyCount ? "warning" : "info"}>{summary}</ResultInterpretation></div>
        {result.ambiguousKeys && result.ambiguousKeys.length > 0 && <p class="file-note" role="status">Chiavi ambigue (prime 8): {result.ambiguousKeys.slice(0, 8).map((item) => `${item.key.join(" / ")}: righe sinistra ${item.leftRows.join(",") || "—"}, destra ${item.rightRows.join(",") || "—"}`).join("; ")}</p>}
        <div data-result-slot="table-preview"><BoundedTableResultPreview preview={model.preview} /></div>
        <div class="actions"><button type="button" onClick={download}>Scarica CSV completo</button><button type="button" onClick={() => void copy()}>Copia risultato</button><button type="button" onClick={() => { setLeftText(model.reusePayload ?? model.exportPayload); setRightText(""); invalidate(); }}>Riusa come prima tabella</button></div>
        {actionStatus && <p role="status" class="success">{actionStatus}</p>}
      </div>}
    </ToolResultPanel>
  </ToolOperation>;
}
