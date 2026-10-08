import { useEffect, useMemo, useState } from "preact/hooks";
import { toolRuntime } from "../../../runtime/tool-runtime";
import type { OutputArtifactDescriptor } from "../../../runtime/output-artifact";
import { OOXML_COMPRESSION_PROFILE_DEFAULT_JPEG_QUALITY, type OoxmlCompressionProfile, type OoxmlMediaCompressionResult } from "../../../engines/ooxml/media-compress";
import { analyzeOoxmlPackage, OOXML_PACKAGE_LIMITS } from "../../../engines/ooxml/package";
import { OOXML_ZIP_GROUPS, summarizeOoxmlZipGroups, type OoxmlZipGroupBreakdown } from "../../../engines/ooxml/compression-groups";
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
  "webp-approval-required": "WebP invariato: manca autorizzazione",
  "pixel-limit": "Dimensioni o limiti superati", "not-smaller": "La ricodifica non avrebbe risparmiato byte",
  "package-not-smaller": "Nessun risparmio netto nel documento", "max-media-budget": "Budget massimo media raggiunto",
};
const GROUP_LABELS = { media: "Immagini e media", xml: "XML e relazioni", font: "Font incorporati", other: "Altri componenti" } as const;
const percentage = (savings: number, original: number) => original > 0 ? `${(100 * savings / original).toFixed(1).replace(".", ",")}%` : "0%";

export function OoxmlMediaCompressionTool() {
  const [file, setFile] = useState<File | null>(null);
  const [preflight, setPreflight] = useState<OoxmlZipGroupBreakdown | null>(null);
  const [preflightError, setPreflightError] = useState<string | null>(null);
  const [profile, setProfile] = useState<OoxmlCompressionProfile>("balanced");
  const [approveJpeg, setApproveJpeg] = useState(false);
  const [approveWebp, setApproveWebp] = useState(false);
  const [jpegQuality, setJpegQuality] = useState("0.72");
  const [approveResize, setApproveResize] = useState(false);
  const [maxDimension, setMaxDimension] = useState("1600");
  useEffect(() => {
    let cancelled = false;
    setPreflight(null);
    setPreflightError(null);
    if (file !== null) {
      void (async () => {
        try {
          if (file.size > OOXML_PACKAGE_LIMITS.maxInputBytes) throw new Error("Pacchetto oltre 20 MiB.");
          const analysis = analyzeOoxmlPackage(await file.arrayBuffer());
          const groups = summarizeOoxmlZipGroups(analysis, file.size);
          if (!cancelled) setPreflight(groups);
        } catch (error) {
          if (!cancelled) setPreflightError(error instanceof Error ? error.message : "Analisi ZIP Office non riuscita.");
        }
      })();
    }
    return () => { cancelled = true; };
  }, [file]);
  const job = useToolOperation<OfficeResult>(async (signal) => {
    const run = await toolRuntime.run("ooxml-media-compression", {
      file, profile, approveLossyJpeg: approveJpeg, approveLossyWebp: approveWebp, jpegQuality: Number(jpegQuality),
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
    setProfile("balanced");
    setApproveJpeg(false);
    setApproveWebp(false);
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
        {preflightError !== null && <p role="alert">{preflightError}</p>}
        {preflight !== null && <section data-ooxml-preflight aria-label="Analisi preventiva ZIP Office">
          <h3>Dimensioni ZIP prima della modifica</h3>
          <p>Pacchetto: <strong>{fmt(preflight.fileBytes)}</strong>. Suddivisione basata sui byte compressi reali dei singoli componenti, non su stime del testo.</p>
          <table><thead><tr><th>Gruppo</th><th>Parti</th><th>Byte ZIP</th><th>Non compressi</th></tr></thead>
            <tbody>{OOXML_ZIP_GROUPS.map((group) => <tr key={group}><th scope="row">{GROUP_LABELS[group]}</th>
              <td>{preflight.groups[group].members}</td><td>{fmt(preflight.groups[group].packedBytes)}</td><td>{fmt(preflight.groups[group].expandedBytes)}</td></tr>)}
            </tbody></table>
          <p>Intestazioni e directory ZIP: {fmt(preflight.containerOverheadBytes)}</p>
        </section>}
        <label class="field">
          <span>Profilo di compressione</span>
          <select data-ooxml-profile value={profile} disabled={job.isRunning} onChange={(event) => {
            const next = event.currentTarget.value as OoxmlCompressionProfile;
            setProfile(next);
            setJpegQuality(String(OOXML_COMPRESSION_PROFILE_DEFAULT_JPEG_QUALITY[next]));
            job.reset();
          }}>
            <option value="conservative">Conservativo — PNG senza perdita, JPEG 0,85 solo con consenso</option>
            <option value="balanced">Bilanciato — PNG senza perdita, JPEG 0,72 solo con consenso</option>
            <option value="compact">Compatto — PNG senza perdita, JPEG 0,55 solo con consenso</option>
          </select>
          <small>Nessun profilo abilita automaticamente JPEG/WebP con perdita o ridimensionamento: servono le relative autorizzazioni.</small>
        </label>
        <label class="field">
          <input data-ooxml-jpeg type="checkbox" checked={approveJpeg} disabled={job.isRunning}
            onChange={(event) => { setApproveJpeg(event.currentTarget.checked); job.reset(); }} />
          <span>Autorizzo ricodifica JPEG con possibile perdita di qualità (disattivato per impostazione predefinita)</span>
        </label>
        <label class="field">
          <input data-ooxml-webp type="checkbox" checked={approveWebp} disabled={job.isRunning}
            onChange={(event) => { setApproveWebp(event.currentTarget.checked); job.reset(); }} />
          <span>Autorizzo la ricodifica WebP con possibile perdita, solo per media WebP validi già incorporati nel pacchetto</span>
          <small>Il formato WebP resta WebP e il browser deve produrre veri byte WebP; altrimenti viene ignorato. Nessuna conversione forzata né modifica ai tipi MIME Office.</small>
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
        <p class="file-note">PNG senza resize: pixel RGBA decodificati confrontati; eventuali profili colore e metadati non sono conservati. JPEG/WebP: consenso separato. Grafica vettoriale, GIF e media non riconosciuti non vengono ricodificati. File Office originali mai sovrascritti.</p>
        <InlineError message={job.error} />
        <ToolActions>
          <ToolSubmitButton busy={job.isRunning} disabled={file === null || preflight === null} busyLabel="Ottimizzazione locale in corso…">Comprimi media Office</ToolSubmitButton>
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
            { label: "Risparmio netto", value: percentage(result.savedBytes, result.inputByteLength) },
            { label: "Profilo", value: profile },
            { label: "Risparmio media interni", value: fmt(result.mediaSavedBytes) },
            { label: "Relazioni e Content Types", value: "Identici byte per byte" },
          ]} />
          <section data-ooxml-zip-comparison aria-label="Confronto ZIP OOXML per gruppo">
            <h3>Gruppi ZIP prima e dopo</h3>
            <table><thead><tr><th>Gruppo</th><th>Prima ZIP</th><th>Dopo ZIP</th><th>Delta</th></tr></thead>
              <tbody>{result.zipGroupsDifference.map((group) => <tr key={group.group}>
                <th scope="row">{GROUP_LABELS[group.group]}</th><td>{fmt(group.beforePackedBytes)}</td>
                <td>{fmt(group.afterPackedBytes)}</td><td>{group.savedPackedBytes >= 0 ? "−" : "+"}{fmt(Math.abs(group.savedPackedBytes))}</td>
              </tr>)}</tbody></table>
            <p>Overhead ZIP: {fmt(result.zipGroupsBefore.containerOverheadBytes)} → {fmt(result.zipGroupsAfter.containerOverheadBytes)}. I byte complessivi includono anche intestazioni e directory.</p>
          </section>
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
