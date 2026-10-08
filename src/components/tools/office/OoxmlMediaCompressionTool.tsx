import { useMemo, useState } from "preact/hooks";
import { toolRuntime } from "../../../runtime/tool-runtime";
import type { OutputArtifactDescriptor } from "../../../runtime/output-artifact";
import type { OoxmlMediaCompressionResult } from "../../../engines/ooxml/media-compress";
import { createFileResultItem, createFileResultWorkspace } from "../../../runtime/file-result";
import { DownloadLink } from "../marketing-media/DownloadLink";
import {
  FileResultWorkspace, gutterStateFor, InlineError, ResultBreakdown,
  ResultInterpretation, ResultPrimaryAnswer, ResultProvenance, ToolActions,
  ToolCancelButton, ToolOperation, ToolResetButton, ToolResultPanel,
  ToolSubmitButton, useToolOperation,
} from "../shared";

type OfficeResult = OoxmlMediaCompressionResult & { readonly artifact: OutputArtifactDescriptor };
const FILE_TYPES = ".docx,.pptx,.xlsx,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const fmt = (bytes: number) => bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1).replace(".", ",")} KiB`;
const ERROR_LABELS: Record<string, string> = {
  "unsupported-media": "Formato media non supportato", "unrecognized-content-type": "Tipo Office/immagine ambiguo",
  "codec-unavailable": "Codec del browser non disponibile", "lossy-approval-required": "JPEG invariato: manca autorizzazione",
  "pixel-limit": "Dimensioni o limiti superati", "not-smaller": "La ricodifica non avrebbe risparmiato byte",
  "package-not-smaller": "Nessun risparmio netto nel documento", "max-media-budget": "Budget massimo media raggiunto",
};

export function OoxmlMediaCompressionTool() {
  const [file, setFile] = useState<File | null>(null);
  const [approveJpeg, setApproveJpeg] = useState(false);
  const [jpegQuality, setJpegQuality] = useState("0.72");
  const [approveResize, setApproveResize] = useState(false);
  const [maxDimension, setMaxDimension] = useState("1600");
  const job = useToolOperation<OfficeResult>(async (signal) => {
    const run = await toolRuntime.run("ooxml-media-compression", {
      file, approveLossyJpeg: approveJpeg, jpegQuality: Number(jpegQuality),
      approveResize, ...(approveResize ? { maxDimension: Number(maxDimension) } : {}),
    }, {}, signal);
    if (!run.ok) return run;
    return { ok: true, tool: run.tool, value: run.value as OfficeResult, defaults: run.defaults };
  }, { formatThrownError: (e) => e instanceof Error ? e.message : "Il documento non può essere elaborato." });
  const result = job.result;
  const resultBlob = useMemo(() => result === null ? null : new Blob([result.bytes], { type: result.artifact.mime }), [result]);
  const workspace = useMemo(() => {
    if (file === null || result === null) return null;
    return createFileResultWorkspace([createFileResultItem({
      id: "ooxml-media-compression-file",
      source: { name: file.name, byteLength: file.size, ...(file.type ? { detectedMime: file.type } : {}) },
      artifact: result.artifact, status: result.artifact.download.ready ? "success" : "error",
      beforeBytes: result.inputByteLength, afterBytes: result.byteLength, retryable: true, cancellable: false,
    })], { location: "LOCAL", network: "forbidden" });
  }, [file, result]);

  function reset() {
    job.reset();
    setFile(null);
    setApproveJpeg(false);
    setApproveResize(false);
    setMaxDimension("1600");
    setJpegQuality("0.72");
  }
  return (
    <ToolOperation busy={job.isRunning}>
      <form onSubmit={(event) => { event.preventDefault(); void job.run(); }} noValidate>
        <label class="field">
          <span>Documento Office (DOCX, PPTX o XLSX; massimo 20 MiB)</span>
          <input data-ooxml-source type="file" accept={FILE_TYPES} disabled={job.isRunning}
            onChange={(event) => { setFile(event.currentTarget.files?.[0] ?? null); job.reset(); }} />
          <small>Il documento rimane nel browser. Parti XML, relazioni, nomi e struttura modificabile vengono conservati.</small>
        </label>
        <label class="field">
          <input data-ooxml-jpeg type="checkbox" checked={approveJpeg} disabled={job.isRunning}
            onChange={(event) => { setApproveJpeg(event.currentTarget.checked); job.reset(); }} />
          <span>Autorizzo ricodifica JPEG con possibile perdita di qualità (disattivato per impostazione predefinita)</span>
        </label>
        {approveJpeg && <label class="field">
          <span>Qualità JPEG autorizzata (0,35–0,90)</span>
          <input data-ooxml-quality type="number" min="0.35" max="0.9" step="0.01" value={jpegQuality}
            onInput={(event) => { setJpegQuality(event.currentTarget.value); job.reset(); }} disabled={job.isRunning} />
          <small>I JPEG vengono modificati solo se i byte del file interno diminuiscono; la fedeltà visiva non è garantita.</small>
        </label>}
        <label class="field">
          <input data-ooxml-resize type="checkbox" checked={approveResize} disabled={job.isRunning}
            onChange={(event) => { setApproveResize(event.currentTarget.checked); job.reset(); }} />
          <span>Autorizzo anche il ridimensionamento delle immagini (cambia i pixel)</span>
        </label>
        {approveResize && <label class="field">
          <span>Lato maggiore massimo in pixel (32–4096)</span>
          <input data-ooxml-max-dimension type="number" min="32" max="4096" step="1" value={maxDimension}
            onInput={(event) => { setMaxDimension(event.currentTarget.value); job.reset(); }} disabled={job.isRunning} />
        </label>}
        <p class="file-note">PNG senza resize: pixel RGBA decodificati confrontati; eventuali profili colore e metadati non sono conservati. JPEG: solo con consenso esplicito. Grafica vettoriale, GIF e media non riconosciuti non vengono ricodificati. File Office originali mai sovrascritti.</p>
        <InlineError message={job.error} />
        <ToolActions>
          <ToolSubmitButton busy={job.isRunning} disabled={file === null} busyLabel="Ottimizzazione locale in corso…">Comprimi media Office</ToolSubmitButton>
          {job.isRunning ? <ToolCancelButton onCancel={job.cancel} /> : <ToolResetButton onClick={reset} />}
        </ToolActions>
      </form>
      <ToolResultPanel eyebrow="Documento verificato" placeholder="Qui appariranno i media modificati, i risparmi e il download Office." busy={job.isRunning} state={gutterStateFor(job.status)}>
        {result !== null && <div data-result-class="file" data-ooxml-result>
          <ResultPrimaryAnswer label={result.outcome === "optimized" ? "Risparmio sul documento" : "Nessuna modifica utile"}>
            {result.outcome === "optimized" ? fmt(result.savedBytes) : "0 B"}
          </ResultPrimaryAnswer>
          <ResultInterpretation state={result.outcome === "optimized" ? "success" : "warning"}>
            {result.outcome === "optimized" ? "Documento Office ricostruito e verificato, senza modificare le relazioni o le parti XML." : "Non è stato ottenuto un file più piccolo; il risultato contiene i byte originali e nessun media alterato."}
          </ResultInterpretation>
          <ResultBreakdown rows={[
            { label: "Media modificati", value: String(result.changedCount) },
            { label: "Media non modificati", value: String(result.skippedCount) },
            { label: "File originale", value: fmt(result.inputByteLength) },
            { label: "File risultante", value: fmt(result.byteLength) },
            { label: "Risparmio media interni", value: fmt(result.mediaSavedBytes) },
            { label: "Relazioni e Content Types", value: "Identici byte per byte" },
          ]} />
          <ResultInterpretation state={result.parts.some((part) => part.fidelity === "approved-lossy-recode-or-resize") ? "warning" : "info"}>{result.fidelityWarning}</ResultInterpretation>
          <div class="table-output" role="region" aria-label="Resoconto media Office" tabIndex={0}>
            <table>
              <thead><tr><th>Parte incorporata</th><th>Esito</th><th>Prima</th><th>Dopo</th><th>Risparmio</th></tr></thead>
              <tbody>{result.parts.map((part) => <tr key={part.path}>
                <th scope="row">{part.path}</th>
                <td>{part.status === "changed" ? (part.fidelity === "decoded-rgba-identical" ? "PNG: RGBA verificato" : "Modificato con consenso") : ERROR_LABELS[part.skipReason ?? ""] ?? "Non modificato"}</td>
                <td>{fmt(part.beforeBytes)}</td><td>{fmt(part.afterBytes)}</td><td>{fmt(part.savedBytes)}</td>
              </tr>)}</tbody>
            </table>
          </div>
          {workspace !== null && <FileResultWorkspace workspace={workspace} actionsFor={() => resultBlob !== null && result.artifact.download.ready
            ? <DownloadLink blob={resultBlob} filename={result.artifact.download.filename}>Scarica DOCX/PPTX/XLSX verificato</DownloadLink>
            : null} />}
          <ResultProvenance>Elaborazione locale, ZIP OOXML ricontrollato e riaperto; nessun caricamento o accesso a risorse esterne. I documenti restano modificabili. Certificazione Gold del nuovo tool non dichiarata.</ResultProvenance>
        </div>}
      </ToolResultPanel>
    </ToolOperation>
  );
}
