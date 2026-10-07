import { useMemo, useState } from "preact/hooks";
import type { FatturaPaBatchResult, FatturaPaReadResult } from "../../engines/italy";
import type { ResultDeclaration } from "../../catalog/manifest";
import { createOutputArtifactDescriptor } from "../../runtime/output-artifact";
import { resolveResultActions } from "../../runtime/result-actions";
import { toolRuntime } from "../../runtime/tool-runtime";
import { InlineError, ResultActions, ResultAssumptions, ResultBreakdown, ResultExplanation, ResultInterpretation, ResultPrimaryAnswer, ResultProvenance, ToolActions, ToolOperation, ToolResetButton, ToolResultPanel, ToolSubmitButton, gutterStateFor, useToolOperation } from "./shared";

type ReaderUiResult = FatturaPaReadResult & { filename: string; bytes: number };
const READER_DECLARATION: ResultDeclaration = { class: "file", capabilities: ["copy", "reset", "provenance"] };
const BATCH_DECLARATION: ResultDeclaration = { class: "batch", capabilities: ["download", "reset", "batch", "provenance"] };

function fileList(input: HTMLInputElement): File[] { return input.files === null ? [] : [...input.files]; }
function money(value: string | null, currency: string | null): string { return value === null ? "—" : `${currency ?? "EUR"} ${value}`; }

function readerCopy(result: ReaderUiResult): string {
  const lines = [`File: ${result.filename}`, `Schema: ${result.transmissionFormat} · XSD ${result.xsdVersion}`, `Fornitore: ${result.supplier.name ?? result.supplier.vatId ?? "—"}`, `Cliente: ${result.customer.name ?? result.customer.taxCode ?? "—"}`];
  for (const [index, body] of result.bodies.entries()) lines.push(`Documento ${index + 1}: ${body.number ?? "—"} · ${body.date ?? "—"} · totale ${money(body.documentTotal, body.currency)}`);
  if (result.fieldErrors.length > 0) lines.push(`Errori di campo: ${result.fieldErrors.length}`);
  return lines.join("\n");
}

export function FatturaPaReaderTool() {
  const [file, setFile] = useState<File | null>(null);
  const [copyStatus, setCopyStatus] = useState("");
  const operation = useToolOperation<ReaderUiResult>(
    (signal) => toolRuntime.run("fatturapa-reader", { file }, {}, signal),
    { formatError: (run) => /ENTITY|DTD/u.test(run.message) ? "Il file contiene DTD o entità XML: per sicurezza non vengono risolte." : /NAMESPACE|FORMAT|VERSION/u.test(run.message.toUpperCase()) ? "Namespace o versione FatturaPA non supportati dal source pack corrente." : "Il file XML non è leggibile come FatturaPA supportata." },
  );
  function reset() { setFile(null); setCopyStatus(""); operation.reset(); const picker = document.getElementById("fatturapa-reader-file") as HTMLInputElement | null; if (picker !== null) picker.value = ""; }
  const copyText = operation.result === null ? "" : readerCopy(operation.result);
  const actions = useMemo(() => operation.result === null ? [] : resolveResultActions({ declaration: READER_DECLARATION, primary: "copy", hasCopyPayload: true, resetReady: true }), [operation.result]);
  async function copy() { if (navigator.clipboard === undefined) return setCopyStatus("Appunti non disponibili."); try { await navigator.clipboard.writeText(copyText); setCopyStatus("Riepilogo copiato."); } catch { setCopyStatus("Il browser ha bloccato gli appunti."); } }
  return <ToolOperation busy={operation.isRunning}>
    <form onSubmit={(event) => { event.preventDefault(); void operation.run(); }} noValidate>
      <label class="field" for="fatturapa-reader-file"><span>FatturaPA XML</span><input id="fatturapa-reader-file" type="file" accept=".xml,text/xml,application/xml" required onChange={(event) => { setFile(event.currentTarget.files?.item(0) ?? null); operation.reset(); }} /><small>{file === null ? "Un file XML · massimo 5 MiB · elaborazione solo locale" : `${file.name} · ${file.size} byte`}</small></label>
      <InlineError message={operation.error} />
      <ToolActions><ToolSubmitButton busy={operation.isRunning}>Leggi fattura</ToolSubmitButton><ToolResetButton onClick={reset} disabled={operation.isRunning} /></ToolActions>
    </form>
    <ToolResultPanel eyebrow="FatturaPA" placeholder="Il lettore mostra versione, parti, documento, righe e problemi di campo senza caricare il file." busy={operation.isRunning} state={gutterStateFor(operation.status)}>
      {operation.result !== null && <div data-result-class="file" data-oracle-entry="cand-255">
        <ResultExplanation
          primary={<ResultPrimaryAnswer label="Documento">{operation.result.bodies[0]?.number ?? operation.result.filename}</ResultPrimaryAnswer>}
          interpretation={<ResultInterpretation state={operation.result.fieldErrors.length > 0 ? "warning" : "success"}>{operation.result.fieldErrors.length === 0 ? "XML supportato letto in locale." : `${operation.result.fieldErrors.length} campo/i non valido/i: gli altri valori leggibili restano disponibili.`}</ResultInterpretation>}
          breakdown={<>
            <ResultBreakdown rows={[
              { label: "File", value: operation.result.filename },
              { label: "Formato trasmissione", value: operation.result.transmissionFormat },
              { label: "XSD", value: operation.result.xsdVersion },
              { label: "Specifica tecnica", value: operation.result.technicalSpecificationVersion },
              { label: "Fornitore", value: operation.result.supplier.name ?? operation.result.supplier.vatId ?? "—" },
              { label: "Cliente", value: operation.result.customer.name ?? operation.result.customer.taxCode ?? "—" },
            ]} />
            {operation.result.bodies.map((body, index) => <ResultBreakdown key={index} label={`Documento ${index + 1}`} rows={[
              { label: "Numero", value: body.number ?? "—" }, { label: "Data", value: body.date ?? "—" }, { label: "Tipo", value: body.documentType ?? "—" }, { label: "Totale documento", value: money(body.documentTotal, body.currency) }, { label: "Righe", value: String(body.lines.length) }, { label: "Riepiloghi IVA", value: String(body.vatSummaries.length) },
            ]} />)}
          </>}
          assumptions={<ResultAssumptions label="Errori isolati" items={operation.result.fieldErrors.slice(0, 10).map((error) => ({ label: error.path, value: error.message }))} />}
          provenance={<ResultProvenance>FatturaPA / Agenzia delle Entrate · {operation.result.namespace} · rete vietata · DTD/ENTITY disabilitati · {operation.result.provenance.snapshotHash}</ResultProvenance>}
        />
        <ResultActions actions={actions} onAction={{ copy, reset }} />
        {copyStatus !== "" && <p class="success" role="status" aria-live="polite">{copyStatus}</p>}
      </div>}
    </ToolResultPanel>
  </ToolOperation>;
}

export function FatturaPaBatchCsvTool() {
  const [files, setFiles] = useState<File[]>([]);
  const [downloadStatus, setDownloadStatus] = useState("");
  const operation = useToolOperation<FatturaPaBatchResult>(
    (signal) => toolRuntime.run("fatturapa-batch-csv", { files }, {}, signal),
    { formatError: () => "Selezione non valida: usa fino a 50 XML FatturaPA, entro i limiti locali dichiarati." },
  );
  function reset() { setFiles([]); setDownloadStatus(""); operation.reset(); const picker = document.getElementById("fatturapa-batch-files") as HTMLInputElement | null; if (picker !== null) picker.value = ""; }
  const artifact = useMemo(() => operation.result === null ? null : createOutputArtifactDescriptor({
    kind: "structured", name: "fatturapa-batch.csv", mime: "text/csv", bytes: new TextEncoder().encode(operation.result.csv), verification: { state: "verified", verifiedMime: "text/csv", method: "CSV locale completo dalle righe prodotte dal reader FatturaPA" }, fidelity: "lossless", fidelityNote: "Il download contiene tutte le righe del batch; l'anteprima è limitata a 25 righe." }), [operation.result]);
  const actions = useMemo(() => operation.result === null || artifact === null ? [] : resolveResultActions({ declaration: BATCH_DECLARATION, primary: "download", artifact, resetReady: true }), [operation.result, artifact]);
  function download() { if (operation.result === null || artifact === null || !artifact.download.ready) return; const url = URL.createObjectURL(new Blob([operation.result.csv], { type: "text/csv" })); const anchor = document.createElement("a"); anchor.href = url; anchor.download = artifact.download.filename; anchor.click(); URL.revokeObjectURL(url); setDownloadStatus(`CSV completo scaricato: ${operation.result.invoiceRowCount} righe.`); }
  return <ToolOperation busy={operation.isRunning}>
    <form onSubmit={(event) => { event.preventDefault(); void operation.run(); }} noValidate>
      <label class="field" for="fatturapa-batch-files"><span>FatturePA XML</span><input id="fatturapa-batch-files" type="file" multiple accept=".xml,text/xml,application/xml" required onChange={(event) => { setFiles(fileList(event.currentTarget)); operation.reset(); }} /><small>{files.length === 0 ? "Fino a 50 file · 5 MiB ciascuno · 25 MiB totali" : `${files.length} file selezionati`}</small></label>
      <InlineError message={operation.error} />
      <ToolActions><ToolSubmitButton busy={operation.isRunning}>Crea tabella e CSV</ToolSubmitButton><ToolResetButton onClick={reset} disabled={operation.isRunning} /></ToolActions>
    </form>
    <ToolResultPanel eyebrow="Batch FatturaPA" placeholder="Ogni file viene isolato: un XML malformato non interrompe gli altri." busy={operation.isRunning} state={gutterStateFor(operation.status)}>
      {operation.result !== null && <div data-result-class="batch" data-oracle-entry="cand-259">
        <ResultExplanation
          primary={<ResultPrimaryAnswer label="Righe esportate">{operation.result.invoiceRowCount}</ResultPrimaryAnswer>}
          interpretation={<ResultInterpretation state={operation.result.errorFileCount > 0 || operation.result.partialFileCount > 0 ? "warning" : "success"}>{operation.result.errorFileCount} file con errore · {operation.result.partialFileCount} parziali · {operation.result.okFileCount} completi. Il CSV scaricato contiene tutte le righe, non solo l'anteprima.</ResultInterpretation>}
          breakdown={<ResultBreakdown rows={[{ label: "File", value: String(operation.result.fileCount) }, { label: "Righe CSV", value: String(operation.result.invoiceRowCount) }, { label: "Byte CSV", value: String(operation.result.csvBytes) }, { label: "Anteprima", value: `${Math.min(operation.result.previewRows.length, operation.result.previewLimit)} / ${operation.result.invoiceRowCount}` }]} />}
          provenance={<ResultProvenance>Reader FatturaPA locale condiviso · filename e XSD espliciti per riga · nessun upload o rete.</ResultProvenance>}
        />
        <div style={{ overflowX: "auto", maxWidth: "100%" }} data-batch-preview>
          <table><thead><tr><th>File</th><th>Stato</th><th>Schema</th><th>Numero</th><th>Data</th><th>Totale doc.</th><th>Totale rappresentato</th><th>Riconciliazione</th><th>Errore</th></tr></thead><tbody>{operation.result.previewRows.map((row, index) => <tr key={`${row.filename}-${row.bodyIndex ?? "x"}-${index}`}><td>{row.filename}</td><td>{row.fileStatus}</td><td>{row.transmissionFormat === null ? "—" : `${row.transmissionFormat} / XSD ${row.xsdVersion}`}</td><td>{row.invoiceNumber ?? "—"}</td><td>{row.date ?? "—"}</td><td>{row.documentTotal ?? "—"}</td><td>{row.representedGrandTotal ?? "—"}</td><td>{row.totalsReconciliation}</td><td>{row.error ?? "—"}</td></tr>)}</tbody></table>
        </div>
        {operation.result.invoiceRowCount > operation.result.previewRows.length && <p class="file-note">Anteprima limitata a {operation.result.previewRows.length} righe; il download CSV contiene tutte le {operation.result.invoiceRowCount} righe.</p>}
        <ResultActions actions={actions} onAction={{ download, reset }} />
        {downloadStatus !== "" && <p class="success" role="status" aria-live="polite">{downloadStatus}</p>}
      </div>}
    </ToolResultPanel>
  </ToolOperation>;
}
