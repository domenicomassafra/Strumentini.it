import { useEffect, useRef, useState } from "preact/hooks";
import { inspectMp4Local, type Mp4Inspection } from "../../../engines/video/mp4-inspection";
import { planVideoTargetSize, type VideoSizeUnit, type VideoTargetSizePlan } from "../../../engines/video/target-size";
import {
  ToolActions, ToolCancelButton, ToolFormCard, ToolOperation,
  ToolResetButton, ToolResultPanel, ToolSubmitButton,
} from "../shared";
import {
  UNKNOWN_VIDEO_VALUE, formatContainerRate, formatFrameRate, formatPlanRate,
  formatTrackResolution, formatVideoDuration, formatVideoNumber, formatVideoRotation,
  planDescription,
} from "./video-presentation";
import "./video-inspector.css";

type InspectionStatus = "idle" | "running" | "success" | "error" | "cancelled";
type AudioChoice = "unknown" | "zero" | "estimate";

function inspectionError(error: unknown): string {
  if (error instanceof Error && error.message.startsWith("UNSUPPORTED_VIDEO_CONTAINER:")) {
    return `Il file non è un MP4 con metadati leggibili da questo strumento. ${error.message.slice("UNSUPPORTED_VIDEO_CONTAINER:".length).trim()}`;
  }
  return "Impossibile leggere i metadati di questo file MP4.";
}

function positiveNumber(raw: string, label: string): number {
  if (raw.trim() === "") throw new Error(`Inserisci ${label}.`);
  const result = Number(raw);
  if (!Number.isFinite(result) || result <= 0) throw new Error(`${label}: usa un numero maggiore di zero.`);
  return result;
}

function nonnegativeNumber(raw: string, label: string): number {
  if (raw.trim() === "") throw new Error(`Inserisci ${label} oppure 0.`);
  const result = Number(raw);
  if (!Number.isFinite(result) || result < 0) throw new Error(`${label}: usa un numero maggiore o uguale a zero.`);
  return result;
}

export function VideoInspectorTool() {
  const [file, setFile] = useState<File | null>(null);
  const [inspection, setInspection] = useState<Mp4Inspection | null>(null);
  const [inspectionStatus, setInspectionStatus] = useState<InspectionStatus>("idle");
  const [inspectionMessage, setInspectionMessage] = useState("");
  const [durationInput, setDurationInput] = useState("");
  const [targetInput, setTargetInput] = useState("10");
  const [unit, setUnit] = useState<VideoSizeUnit>("MB");
  const [audioChoice, setAudioChoice] = useState<AudioChoice>("unknown");
  const [audioKbps, setAudioKbps] = useState("128");
  const [overheadMB, setOverheadMB] = useState("0");
  const [plan, setPlan] = useState<VideoTargetSizePlan | null>(null);
  const [planError, setPlanError] = useState("");
  const controller = useRef<AbortController | null>(null);
  const generation = useRef(0);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => () => {
    generation.current += 1;
    controller.current?.abort();
  }, []);

  function clearPlan() {
    setPlan(null);
    setPlanError("");
  }

  function changeFile(next: File | null) {
    generation.current += 1;
    controller.current?.abort();
    controller.current = null;
    setFile(next);
    setInspection(null);
    setInspectionStatus("idle");
    setInspectionMessage("");
    setDurationInput("");
    clearPlan();
  }

  async function inspect(event: Event) {
    event.preventDefault();
    if (!file || controller.current !== null) return;
    const currentGeneration = ++generation.current;
    const pending = new AbortController();
    controller.current = pending;
    setInspection(null);
    setInspectionStatus("running");
    setInspectionMessage("");
    setDurationInput("");
    clearPlan();
    try {
      const result = await inspectMp4Local(file, pending.signal);
      if (generation.current !== currentGeneration || pending.signal.aborted) return;
      setInspection(result);
      setInspectionStatus("success");
      if (result.durationSeconds !== null) setDurationInput(String(result.durationSeconds));
    } catch (error) {
      if (generation.current !== currentGeneration || pending.signal.aborted) return;
      setInspectionStatus("error");
      setInspectionMessage(inspectionError(error));
    } finally {
      if (controller.current === pending) controller.current = null;
    }
  }

  function cancelInspection() {
    generation.current += 1;
    controller.current?.abort();
    controller.current = null;
    setInspectionStatus("cancelled");
    setInspectionMessage("Lettura annullata. Nessun risultato prodotto.");
  }

  function reset() {
    changeFile(null);
    if (fileInput.current) fileInput.current.value = "";
    setTargetInput("10");
    setUnit("MB");
    setAudioChoice("unknown");
    setAudioKbps("128");
    setOverheadMB("0");
  }

  function calculate(event: Event) {
    event.preventDefault();
    clearPlan();
    try {
      const durationSeconds = positiveNumber(durationInput, "la durata in secondi");
      const targetSize = positiveNumber(targetInput, "la dimensione obiettivo");
      const requestedOverheadBytes = Math.round(nonnegativeNumber(overheadMB, "la riserva MB") * 1_000_000);
      const audioBitrateBps = audioChoice === "unknown"
        ? null
        : audioChoice === "zero" ? 0 : Math.round(nonnegativeNumber(audioKbps, "la stima audio in kbit/s") * 1_000);
      const next = planVideoTargetSize({
        durationSeconds, targetSize, unit, audioBitrateBps, reservedOverheadBytes: requestedOverheadBytes,
      });
      setPlan(next);
    } catch (error) {
      setPlanError(error instanceof Error ? error.message : "Impossibile calcolare il budget.");
    }
  }

  return (
    <div class="video-tool">
      <ToolOperation busy={inspectionStatus === "running"}>
        <div class="video-tool-input">
          <ToolFormCard>
            <form onSubmit={inspect} aria-label="Analisi metadati MP4">
              <h2 class="video-tool-section-title">1. Analizza un MP4 locale</h2>
              <label class="field">
                <span>File video MP4</span>
                <input ref={fileInput} type="file" accept=".mp4,.m4v,video/mp4" onChange={(event) => changeFile(event.currentTarget.files?.[0] ?? null)} disabled={inspectionStatus === "running"} />
                <small>Leggiamo solo intestazioni e metadati «moov» fino a 8 MiB. Il file resta nel browser.</small>
              </label>
              {file && <p class="video-tool-muted">Selezionato: <strong>{file.name}</strong> · {formatVideoNumber(file.size)} byte</p>}
              <ToolActions>
                <ToolSubmitButton disabled={!file} busy={inspectionStatus === "running"} busyLabel="Lettura metadati…">Analizza metadati</ToolSubmitButton>
                {inspectionStatus === "running" && <ToolCancelButton onCancel={cancelInspection} />}
                <ToolResetButton onClick={reset} disabled={inspectionStatus === "running"} />
              </ToolActions>
              {inspectionMessage && <p role="alert" class="video-tool-alert">{inspectionMessage}</p>}
            </form>
          </ToolFormCard>
          <ToolFormCard>
            <form onSubmit={calculate} aria-label="Calcolo dimensione obiettivo del video">
              <h2 class="video-tool-section-title">2. Calcola il budget di bitrate</h2>
              <p class="video-tool-muted">È solo un calcolo matematico: non modifica né comprime il video.</p>
              <div class="field-grid">
                <label class="field">
                  <span>Durata (secondi)</span>
                  <input data-video-duration type="number" min="0.001" step="any" inputMode="decimal" required value={durationInput} onInput={(event) => { setDurationInput(event.currentTarget.value); clearPlan(); }} placeholder="Es. 90" />
                  <small>{inspection?.durationSeconds !== null && inspection !== null ? "Compilata dalla durata MP4 letta; puoi modificarla." : "Inserisci una durata verificata se il file non la dichiara."}</small>
                </label>
                <label class="field">
                  <span>Dimensione obiettivo</span>
                  <input data-video-target type="number" min="0.001" step="any" inputMode="decimal" required value={targetInput} onInput={(event) => { setTargetInput(event.currentTarget.value); clearPlan(); }} />
                </label>
              </div>
              <label class="field">
                <span>Unità della dimensione</span>
                <select value={unit} onChange={(event) => { setUnit(event.currentTarget.value as VideoSizeUnit); clearPlan(); }}>
                  <option value="MB">MB (1.000.000 byte)</option>
                  <option value="MiB">MiB (1.048.576 byte)</option>
                </select>
              </label>
              <label class="field">
                <span>Budget audio</span>
                <select value={audioChoice} onChange={(event) => { setAudioChoice(event.currentTarget.value as AudioChoice); clearPlan(); }}>
                  <option value="unknown">Sconosciuto (non sottrarre una stima)</option>
                  <option value="zero">0 kbit/s (dichiaro assenza audio)</option>
                  <option value="estimate">Inserisco un bitrate audio ipotetico</option>
                </select>
              </label>
              {audioChoice === "estimate" && (
                <label class="field">
                  <span>Bitrate audio stimato (kbit/s)</span>
                  <input type="number" min="0" step="any" value={audioKbps} onInput={(event) => { setAudioKbps(event.currentTarget.value); clearPlan(); }} />
                  <small>Stima fornita da te; il parser non misura il bitrate audio.</small>
                </label>
              )}
              <label class="field">
                <span>Riserva per contenitore (MB decimali, indicata da te)</span>
                <input type="number" min="0" step="any" value={overheadMB} onInput={(event) => { setOverheadMB(event.currentTarget.value); clearPlan(); }} />
                <small>Zero significa nessuna riserva applicata, non overhead misurato uguale a zero.</small>
              </label>
              <ToolActions><ToolSubmitButton>Calcola bitrate teorico</ToolSubmitButton></ToolActions>
              {planError && <p role="alert" class="video-tool-alert">{planError}</p>}
            </form>
          </ToolFormCard>
        </div>
        <ToolResultPanel eyebrow="Metadati e calcolo" placeholder="Seleziona un MP4 e premi «Analizza metadati», oppure inserisci una durata per il calcolo." state={inspectionStatus === "success" || plan ? "success" : inspectionStatus}>
          {inspection && (
            <section data-video-inspection aria-label="Risultato analisi MP4">
              <h2 class="video-tool-result-title">Metadati verificabili</h2>
              <dl class="video-tool-facts">
                <div><dt>Contenitore</dt><dd>MP4 (ISO BMFF)</dd></div>
                <div><dt>Brand dichiarato</dt><dd><code>{inspection.majorBrand}</code></dd></div>
                <div><dt>Dimensione file</dt><dd>{formatVideoNumber(inspection.bytes)} byte</dd></div>
                <div><dt>Durata dichiarata</dt><dd data-video-inspected-duration>{formatVideoDuration(inspection.durationSeconds)}</dd></div>
                <div><dt>Bitrate medio contenitore</dt><dd>{formatContainerRate(inspection)}</dd></div>
                <div><dt>Tracce dichiarate</dt><dd>{inspection.totalTracks} totali; {inspection.videoTracks} video, {inspection.audioTracks} audio</dd></div>
                <div><dt>MP4 frammentato</dt><dd>{inspection.containsMovieFragments ? "Sì" : "No"}</dd></div>
              </dl>
              <h3 class="video-tool-minor-title">Tracce ({inspection.tracks.length})</h3>
              <div class="video-tool-table-wrap">
                <table class="video-tool-table">
                  <thead><tr><th scope="col">Tipo / ID</th><th scope="col">Codec FourCC</th><th scope="col">Risoluzione</th><th scope="col">Rotazione</th><th scope="col">FPS / CFR-VFR</th></tr></thead>
                  <tbody>{inspection.tracks.map((track, index) => (
                    <tr key={index}>
                      <th scope="row">{track.kind} / {track.id ?? UNKNOWN_VIDEO_VALUE}</th>
                      <td>{track.codecFourCc ?? UNKNOWN_VIDEO_VALUE}</td>
                      <td>{formatTrackResolution(track)}</td>
                      <td>{formatVideoRotation(track.quarterTurnDegrees)}</td>
                      <td>{formatFrameRate(track)} / {track.frameRateMode === "unknown" ? UNKNOWN_VIDEO_VALUE : track.frameRateMode}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
              <ul class="video-tool-notes">{inspection.warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul>
            </section>
          )}
          {plan && (
            <section data-video-plan aria-label="Risultato calcolo bitrate">
              <h2 class="video-tool-result-title">Budget teorico</h2>
              <strong class="result-value" data-video-budget>{formatPlanRate(plan.totalStreamBitrateBps)}</strong>
              <p>Bitrate complessivo dei flussi dopo la riserva dichiarata.</p>
              <dl class="video-tool-facts">
                <div><dt>Video residuo</dt><dd>{formatPlanRate(plan.videoBitrateBps)}</dd></div>
                <div><dt>Audio assunto</dt><dd>{formatPlanRate(plan.audioBitrateBps)}</dd></div>
                <div><dt>Riserva dichiarata</dt><dd>{formatVideoNumber(plan.reservedOverheadBytes)} byte</dd></div>
                <div><dt>Dimensione obiettivo</dt><dd>{formatVideoNumber(plan.targetBytes)} byte</dd></div>
                <div><dt>Raggiungibilità con encoder</dt><dd>{UNKNOWN_VIDEO_VALUE}</dd></div>
              </dl>
              <p class="video-tool-muted">{planDescription(plan)} Nessuna transcodifica viene avviata.</p>
            </section>
          )}
          {!inspection && !plan && <p class="video-tool-muted">{inspectionStatus === "running" ? "Lettura dei soli metadati in corso…" : "I dati non disponibili saranno indicati come sconosciuti."}</p>}
        </ToolResultPanel>
      </ToolOperation>
    </div>
  );
}
