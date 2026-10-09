import { useMemo, useState } from "preact/hooks";
import type { SubtitleProcessResult } from "../../engines/text-writing";
import { createBoundedTextPreview } from "../../runtime/bounded-preview";
import { createOutputArtifactDescriptor } from "../../runtime/output-artifact";
import { resolveResultActions } from "../../runtime/result-actions";
import { toolRuntime } from "../../runtime/tool-runtime";
import { subtitleSrtVttTransformManifest } from "../../tools/subtitle-srt-vtt-transform/manifest";
import {
  BoundedTextResultPreview,
  InlineError,
  ResultActions,
  ResultBreakdown,
  ResultInterpretation,
  ResultPrimaryAnswer,
  ResultProvenance,
  ToolActions,
  ToolFormCard,
  ToolOperation,
  ToolResetButton,
  ToolResultPanel,
  ToolSubmitButton,
  gutterStateFor,
  useToolOperation,
} from "./shared";
import { CONTROL, it } from "./shared/controlLabels";

type SourceFormat = "auto" | "srt" | "vtt";
type OutputKind = "srt" | "vtt" | "transcript";
type NegativePolicy = "refuse" | "clamp";

function resultFile(output: OutputKind): { name: string; mime: string } {
  if (output === "srt") return { name: "sottotitoli.srt", mime: "application/x-subrip" };
  if (output === "vtt") return { name: "sottotitoli.vtt", mime: "text/vtt" };
  return { name: "trascrizione-sottotitoli.txt", mime: "text/plain" };
}

function formatSubtitleError(message: string): string {
  const code = message.split("|", 1)[0] ?? "";
  const line = /(?:^|\|)line=(\d+)/u.exec(message)?.[1];
  const cue = /(?:^|\|)cue=(\d+)/u.exec(message)?.[1];
  const location = [cue === undefined ? "" : `cue ${cue}`, line === undefined ? "" : `riga ${line}`].filter(Boolean).join(", ");
  const where = location === "" ? "" : ` (${location})`;
  const detail: Readonly<Record<string, string>> = {
    INVALID_SUBTITLE_INPUT_REQUIRED: "Incolla un file SRT o WebVTT.",
    INVALID_SUBTITLE_INPUT_TOO_LARGE: "L'input supera il limite locale di 2 MiB.",
    INVALID_SUBTITLE_VTT_HEADER: "L'intestazione WebVTT non è valida.",
    INVALID_SUBTITLE_MALFORMED_TIMING: "La riga di timing non rispetta il formato supportato.",
    INVALID_SUBTITLE_NON_POSITIVE_DURATION: "Il cue deve terminare dopo il proprio inizio.",
    INVALID_SUBTITLE_UNSUPPORTED_CUE_SETTINGS: "I cue settings WebVTT non fanno parte del subset supportato.",
    INVALID_SUBTITLE_UNSUPPORTED_BLOCK: "I blocchi NOTE, STYLE e REGION non fanno parte del subset supportato.",
    INVALID_SUBTITLE_MALFORMED_IDENTIFIER: "L'indice SRT deve essere numerico oppure il blocco deve iniziare direttamente dal timing.",
    INVALID_SUBTITLE_EMPTY_CUE: "Il cue non contiene testo.",
    INVALID_SUBTITLE_TOO_MANY_CUES: "Il file supera il limite locale di 50.000 cue.",
    INVALID_SUBTITLE_NEGATIVE_OFFSET: "L'offset produrrebbe un tempo negativo e la policy scelta è 'rifiuta'.",
    INVALID_SUBTITLE_RESCALE_COLLAPSE: "Il fattore di scala riduce un cue a meno di 1 ms.",
    INVALID_SUBTITLE_TIME_RANGE: "La trasformazione supera l'intervallo di millisecondi rappresentabili esattamente.",
    INVALID_SUBTITLE_OFFSET_RANGE: "L'offset deve essere un numero intero di millisecondi tra -24h e +24h.",
    INVALID_SUBTITLE_SCALE_RANGE: "Il fattore di scala deve essere compreso tra 0,01 e 100.",
    INVALID_SUBTITLE_READING_SPEED_RANGE: "La soglia di lettura deve essere compresa tra 1 e 100 caratteri al secondo.",
  };
  return `${detail[code] ?? "Il file non rientra nel subset SRT/WebVTT supportato."}${where}`;
}

function downloadArtifact(name: string, mime: string, bytes: Uint8Array): void {
  const url = URL.createObjectURL(new Blob([bytes.slice().buffer], { type: mime }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
}

const EXAMPLE = `1
00:00:01,000 --> 00:00:03,000
Ciao, mondo 👋

2
00:00:03,500 --> 00:00:05,500
Questa è una seconda battuta.
`;

export function SubtitleSrtVttTransformTool() {
  const [text, setText] = useState(EXAMPLE);
  const [sourceFormat, setSourceFormat] = useState<SourceFormat>("auto");
  const [output, setOutput] = useState<OutputKind>("vtt");
  const [offsetMs, setOffsetMs] = useState("0");
  const [scale, setScale] = useState("1");
  const [negativePolicy, setNegativePolicy] = useState<NegativePolicy>("refuse");
  const [readingSpeedCps, setReadingSpeedCps] = useState("");
  const [actionStatus, setActionStatus] = useState("");

  const operation = useToolOperation<SubtitleProcessResult>(
    (signal) => toolRuntime.run("subtitle-srt-vtt-transform", {
      text,
      sourceFormat,
      output,
      offsetMs,
      scale,
      negativeOffsetPolicy: negativePolicy,
      ...(readingSpeedCps.trim() === "" ? {} : { readingSpeedCps }),
    }, {}, signal),
    { formatError: (result) => formatSubtitleError(result.message) },
  );
  const result = operation.result;
  const file = resultFile(output);
  const artifact = useMemo(() => result === null ? null : createOutputArtifactDescriptor({
    kind: "file",
    name: file.name,
    mime: file.mime,
    bytes: new TextEncoder().encode(result.output),
    verification: {
      state: "verified",
      verifiedMime: file.mime,
      method: "parser-backed local subtitle serializer using the supported SRT/WebVTT subset",
    },
    fidelity: output === "transcript" ? "structural" : "lossless",
    fidelityNote: output === "transcript"
      ? "La trascrizione rimuove indici e timing e unisce le righe interne di ogni cue con un singolo spazio; ordine e testo Unicode dei cue restano locali."
      : "Nel subset supportato il file completo preserva ordine, testo Unicode e timing trasformati dei cue.",
  }), [file.mime, file.name, output, result]);
  const transcriptArtifact = useMemo(() => result === null ? null : createOutputArtifactDescriptor({
    kind: "text",
    name: "trascrizione-sottotitoli.txt",
    mime: "text/plain",
    bytes: new TextEncoder().encode(result.transcript),
    verification: { state: "verified", verifiedMime: "text/plain", method: "cue-order transcript export from parsed subtitle structure" },
    fidelity: "structural",
    fidelityNote: "Timestamp e indici sono rimossi; ogni cue diventa una riga di testo nell'ordine originale.",
  }), [result]);
  const preview = artifact === null ? null : createBoundedTextPreview(artifact, 36, "code");
  const actions = artifact === null ? [] : resolveResultActions({
    declaration: subtitleSrtVttTransformManifest.result,
    primary: "download",
    hasCopyPayload: result !== null && result.output !== "",
    artifact,
    retryReady: operation.canRetry,
    resetReady: true,
  });

  function reset() {
    setText("");
    setSourceFormat("auto");
    setOutput("vtt");
    setOffsetMs("0");
    setScale("1");
    setNegativePolicy("refuse");
    setReadingSpeedCps("");
    setActionStatus("");
    operation.reset();
  }

  async function copyResult() {
    if (result === null || navigator.clipboard === undefined) {
      setActionStatus("Gli appunti non sono disponibili; usa il download oppure seleziona l'anteprima.");
      return;
    }
    try {
      await navigator.clipboard.writeText(result.output);
      setActionStatus("Output completo copiato negli appunti.");
    } catch {
      setActionStatus("Il browser ha bloccato gli appunti; usa il download oppure seleziona l'anteprima.");
    }
  }

  return (
    <ToolOperation className="single-column" busy={operation.isRunning}>
      <form onSubmit={(event) => { event.preventDefault(); setActionStatus(""); void operation.run(); }}>
        <ToolFormCard>
          <label class="field"><span>Sottotitoli SRT o WebVTT</span><textarea rows={14} value={text} onInput={(event) => setText(event.currentTarget.value)} aria-label="Sottotitoli SRT o WebVTT" /></label>
          <div class="field-grid">
            <label class="field"><span>Formato sorgente</span><select value={sourceFormat} onChange={(event) => setSourceFormat(event.currentTarget.value as SourceFormat)}><option value="auto">Rileva automaticamente</option><option value="srt">SRT</option><option value="vtt">WebVTT</option></select></label>
            <label class="field"><span>Output principale</span><select value={output} onChange={(event) => setOutput(event.currentTarget.value as OutputKind)}><option value="vtt">WebVTT</option><option value="srt">SRT</option><option value="transcript">Trascrizione pulita</option></select></label>
            <label class="field"><span>Offset · millisecondi</span><input type="number" step="1" value={offsetMs} onInput={(event) => setOffsetMs(event.currentTarget.value)} /><small>Negativo anticipa; positivo ritarda. Limite ±24 ore.</small></label>
            <label class="field"><span>Scala timing</span><input type="number" min="0.01" max="100" step="0.01" value={scale} onInput={(event) => setScale(event.currentTarget.value)} /><small>Il rescale viene applicato prima dell'offset.</small></label>
            <label class="field"><span>Tempi negativi</span><select value={negativePolicy} onChange={(event) => setNegativePolicy(event.currentTarget.value as NegativePolicy)}><option value="refuse">Rifiuta la trasformazione</option><option value="clamp">Porta l'inizio a 0 preservando la durata</option></select></label>
            <label class="field"><span>Soglia leggibilità · caratteri/sec</span><input type="number" min="1" max="100" step="0.1" value={readingSpeedCps} onInput={(event) => setReadingSpeedCps(event.currentTarget.value)} placeholder="17" /><small>Vuoto = riferimento Netflix italiano adulti 17 CPS. È una soglia configurabile, non una verità universale.</small></label>
          </div>
          <p class="file-note">Subset supportato: cue SRT con indice numerico facoltativo e timing <code>hh:mm:ss,mmm</code>; cue WebVTT con identificatore facoltativo e timing standard. Cue settings e blocchi NOTE/STYLE/REGION vengono rifiutati con riga e cue.</p>
          <InlineError message={operation.error} />
          <ToolActions><ToolSubmitButton busy={operation.isRunning} busyLabel={it(CONTROL.working)}>Elabora sottotitoli</ToolSubmitButton><ToolResetButton onClick={reset} disabled={operation.isRunning} /></ToolActions>
        </ToolFormCard>
      </form>
      <ToolResultPanel eyebrow="Sottotitoli elaborati" placeholder="Qui appariranno anteprima, diagnostica e download completo." busy={operation.isRunning} state={gutterStateFor(operation.status)}>
        {result !== null && artifact !== null && preview !== null && transcriptArtifact !== null && (
          <div data-result-class="text-code">
            <ResultPrimaryAnswer label="Risultato">{result.cueCount} cue · {result.diagnostics.length} segnalazioni</ResultPrimaryAnswer>
            <ResultInterpretation state={result.diagnostics.length === 0 ? "success" : "warning"}>{result.diagnostics.length === 0 ? "Nessuna sovrapposizione o soglia di lettura superata con la configurazione scelta." : "Controlla le segnalazioni: sono diagnostiche configurabili, non una certificazione assoluta di leggibilità."}</ResultInterpretation>
            <ResultBreakdown label="Trasformazione" rows={[
              { label: "Formato sorgente", value: result.sourceFormat.toUpperCase() },
              { label: "Scala", value: String(result.scale) },
              { label: "Offset", value: `${result.offsetMs} ms` },
              { label: "Policy tempi negativi", value: result.negativeOffsetPolicy === "refuse" ? "rifiuta" : "clamp + preserva durata" },
              { label: "Cue clampati", value: String(result.clampedCueCount) },
              { label: "Overlap", value: String(result.overlapCount) },
              { label: "Cue sopra soglia CPS", value: String(result.readingSpeedIssueCount) },
            ]} />
            <ResultProvenance>{result.readingSpeedThresholdSource}</ResultProvenance>
            <ResultProvenance>{result.supportedSubset}</ResultProvenance>
            {result.diagnostics.length > 0 && <div class="table-output" role="region" aria-label="Diagnostica sottotitoli" tabIndex={0}><table><thead><tr><th scope="col">Cue</th><th scope="col">Tipo</th><th scope="col">Dettaglio</th></tr></thead><tbody>{result.diagnostics.slice(0, 20).map((diagnostic, index) => <tr key={`${diagnostic.kind}-${diagnostic.cue}-${index}`}><td>{diagnostic.cue}</td><td>{diagnostic.kind}</td><td>{diagnostic.message}</td></tr>)}</tbody></table></div>}
            <div data-result-slot="selectable-output"><BoundedTextResultPreview preview={preview} /></div>
            <ResultActions actions={actions} onAction={{ copy: copyResult, download: () => downloadArtifact(artifact.download.filename, artifact.download.mime, artifact.bytes), retry: operation.retry, reset }} />
            {output !== "transcript" && <ToolActions><button type="button" onClick={() => downloadArtifact(transcriptArtifact.download.filename, transcriptArtifact.download.mime, transcriptArtifact.bytes)}>Scarica trascrizione completa</button></ToolActions>}
            {actionStatus !== "" && <p class="success" role="status" aria-live="polite">{actionStatus}</p>}
          </div>
        )}
      </ToolResultPanel>
    </ToolOperation>
  );
}
