import { useMemo, useState } from "preact/hooks";
import type { TextMarkupConversionMode, TextMarkupConversionResult } from "../../engines/text-markup-conversion";
import { createOutputArtifactDescriptor } from "../../runtime/output-artifact";
import { resolveResultActions } from "../../runtime/result-actions";
import { toolRuntime } from "../../runtime/tool-runtime";
import {
  InlineError,
  ResultActions,
  ResultAssumptions,
  ResultBreakdown,
  ResultExplanation,
  ResultInterpretation,
  ResultPrimaryAnswer,
  ResultProvenance,
  ToolActions,
  ToolOperation,
  ToolResetButton,
  ToolResultPanel,
  ToolSubmitButton,
  useToolOperation,
} from "./shared";
import { CONTROL, it } from "./shared/controlLabels";
import { gutterStateFor } from "./shared/ToolGutter";

const MODE_LABELS: Readonly<Record<TextMarkupConversionMode, string>> = {
  "markdown-to-html": "Markdown → HTML",
  "html-to-markdown": "HTML → Markdown",
  "markdown-to-text": "Markdown → TXT",
  "text-to-html": "TXT → HTML",
  "html-to-text": "HTML → TXT",
};

const SOURCE_LABELS: Readonly<Record<TextMarkupConversionMode, string>> = {
  "markdown-to-html": "Markdown sorgente",
  "html-to-markdown": "HTML sorgente",
  "markdown-to-text": "Markdown sorgente",
  "text-to-html": "Testo sorgente",
  "html-to-text": "HTML sorgente",
};

function asConversionResult(value: unknown): TextMarkupConversionResult | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const candidate = value as Partial<TextMarkupConversionResult>;
  return typeof candidate.output === "string"
    && typeof candidate.previewHtml === "string"
    && typeof candidate.filename === "string"
    && typeof candidate.mime === "string"
    && Array.isArray(candidate.preservedConstructs)
    && Array.isArray(candidate.droppedConstructs)
    ? candidate as TextMarkupConversionResult
    : null;
}

function downloadArtifact(artifact: ReturnType<typeof createOutputArtifactDescriptor>): void {
  if (!artifact.download.ready) return;
  const blob = new Blob([artifact.bytes.slice().buffer], { type: artifact.mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = artifact.download.filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function bounded(value: string, maxLines = 60): { text: string; shown: number; total: number; truncated: boolean } {
  const lines = value.split("\n");
  const shown = Math.min(lines.length, maxLines);
  return { text: lines.slice(0, maxLines).join("\n"), shown, total: lines.length, truncated: lines.length > maxLines };
}

export function TextMarkupConverterTool() {
  const [mode, setMode] = useState<TextMarkupConversionMode>("markdown-to-html");
  const [text, setText] = useState("# Titolo\n\nTesto con **grassetto**, `codice` e [link](https://example.com).\n");
  const [actionStatus, setActionStatus] = useState("");
  const operation = useToolOperation<unknown>(
    (signal) => toolRuntime.run("text-markup-converter", { mode, text }, {}, signal),
  );
  const result = asConversionResult(operation.result);
  const artifact = useMemo(() => result === null ? null : createOutputArtifactDescriptor({
    kind: "text",
    name: result.filename,
    mime: result.mime,
    bytes: new TextEncoder().encode(result.output),
    verification: { state: "verified", verifiedMime: result.mime, method: "UTF-8 serialization of normalized local document conversion" },
    fidelity: "structural",
    fidelityNote: `Conversione strutturale tramite ${result.modelVersion}. Policy di riduzione/scarto dichiarata: ${result.droppedConstructs.join(" ")}`,
  }), [result]);
  const actions = useMemo(() => result === null || artifact === null ? [] : resolveResultActions({
    declaration: { class: "text-code", capabilities: ["copy", "download", "reset", "provenance"] },
    primary: "copy",
    hasCopyPayload: true,
    artifact,
    resetReady: true,
  }), [artifact, result]);

  function submit(event: Event): void {
    event.preventDefault();
    setActionStatus("");
    void operation.run();
  }

  function reset(): void {
    setMode("markdown-to-html");
    setText("");
    setActionStatus("");
    operation.reset();
  }

  async function copyResult(): Promise<void> {
    if (result === null || navigator.clipboard === undefined) {
      setActionStatus("Gli appunti non sono disponibili; seleziona il risultato e copialo manualmente.");
      return;
    }
    try {
      await navigator.clipboard.writeText(result.output);
      setActionStatus("Risultato completo copiato.");
    } catch {
      setActionStatus("L'accesso agli appunti è stato bloccato; seleziona il risultato e copialo manualmente.");
    }
  }

  const sourcePreview = result === null ? null : bounded(result.sourceNormalized);
  const outputPreview = result === null ? null : bounded(result.output);
  const resultState = gutterStateFor(operation.status);

  return (
    <ToolOperation busy={operation.isRunning}>
      <form onSubmit={submit}>
        <label class="field">
          <span>Conversione</span>
          <select value={mode} onChange={(event) => { setMode(event.currentTarget.value as TextMarkupConversionMode); operation.reset(); }}>
            {(Object.keys(MODE_LABELS) as TextMarkupConversionMode[]).map((option) => <option value={option} key={option}>{MODE_LABELS[option]}</option>)}
          </select>
        </label>
        <label class="field">
          <span>{SOURCE_LABELS[mode]}</span>
          <textarea rows={14} value={text} onInput={(event) => setText(event.currentTarget.value)} spellcheck={false} />
          <small>CRLF/CR vengono normalizzati a LF; i code point Unicode non vengono normalizzati.</small>
        </label>
        <InlineError message={operation.error} />
        <ToolActions>
          <ToolSubmitButton busy={operation.isRunning} busyLabel={it(CONTROL.working)}>{it(CONTROL.submit)}</ToolSubmitButton>
          <ToolResetButton onClick={reset} disabled={operation.isRunning}>{it(CONTROL.reset)}</ToolResetButton>
        </ToolActions>
      </form>
      <ToolResultPanel eyebrow="Risultato" placeholder="Il documento convertito apparirà qui." busy={operation.isRunning} state={resultState}>
        {result !== null && (
          <>
            <ResultExplanation
              primary={<ResultPrimaryAnswer label="Conversione">{MODE_LABELS[result.mode]}</ResultPrimaryAnswer>}
              interpretation={<ResultInterpretation state={result.warnings.length > 0 ? "warning" : "success"}>
                {result.warnings.length > 0
                  ? "Conversione completata con avvisi specifici per questo input; la policy di preservazione e riduzione è dichiarata qui sotto."
                  : "Conversione completata; la policy di preservazione e riduzione del subset è dichiarata qui sotto."}
              </ResultInterpretation>}
              breakdown={<ResultBreakdown rows={[
                { label: "Modello", value: result.modelVersion },
                { label: "Formato sorgente", value: result.sourceFormat },
                { label: "Formato risultato", value: result.targetFormat },
                { label: "Avvisi", value: String(result.warnings.length) },
              ]} />}
              assumptions={<>
                <ResultAssumptions label="Costrutti preservati" items={result.preservedConstructs.map((value) => ({ label: "Preservato", value }))} />
                <ResultAssumptions label="Costrutti ridotti o scartati" items={result.droppedConstructs.map((value) => ({ label: "Limite", value }))} />
                <ResultAssumptions label="Policy" items={[
                  { label: "Markdown", value: result.dialectPolicy },
                  { label: "Newline", value: result.newlinePolicy },
                  { label: "Unicode", value: result.unicodePolicy },
                ]} />
              </>}
              provenance={<ResultProvenance>Conversione locale deterministica; preview HTML generata solo dal modello normalizzato e dall'allowlist del serializer.</ResultProvenance>}
            />
            <div class="field-grid">
              {sourcePreview !== null && <section aria-label="Anteprima sorgente normalizzata"><p class="gutter-label">Sorgente normalizzata · {sourcePreview.shown}/{sourcePreview.total} righe</p><pre class="result-code" tabIndex={0}>{sourcePreview.text}</pre></section>}
              {outputPreview !== null && <section aria-label="Anteprima risultato"><p class="gutter-label">Risultato · {outputPreview.shown}/{outputPreview.total} righe</p><pre class="result-code" tabIndex={0}>{outputPreview.text}</pre></section>}
            </div>
            <section aria-label="Anteprima HTML sanitizzata" data-sanitized-preview="true">
              <p class="gutter-label">Anteprima HTML sanitizzata del modello</p>
              <div class="markdown-output" dangerouslySetInnerHTML={{ __html: result.previewHtml }} />
            </section>
            <ResultActions
              actions={actions}
              onAction={{
                copy: copyResult,
                download: () => artifact === null ? undefined : downloadArtifact(artifact),
                reset,
              }}
            />
            {actionStatus !== "" && <p class="success" role="status" aria-live="polite">{actionStatus}</p>}
          </>
        )}
      </ToolResultPanel>
    </ToolOperation>
  );
}
