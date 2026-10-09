import { useEffect, useRef, useState } from "preact/hooks";
import type { AudioJob231, AudioJobResult231 } from "../../../engines/browser-audio/timeline-worker-231";

const INPUT_LIMIT = 12 * 1024 * 1024;
const TOTAL_LIMIT = 24 * 1024 * 1024;
const BARS = 192;

/** Owns exactly one disposable Worker and never publishes cancelled output. */
function executeAudioJob231(job: AudioJob231, signal: AbortSignal): Promise<AudioJobResult231> {
  if (signal.aborted) return Promise.reject(new DOMException("Montaggio annullato", "AbortError"));
  if (typeof Worker === "undefined") return Promise.reject(new Error("AUDIO_231_WORKER_UNSUPPORTED: Web Worker non disponibile."));
  return new Promise((resolve, reject) => {
    let worker: Worker;
    try { worker = new Worker(new URL("../../../engines/browser-audio/timeline-worker-231.ts", import.meta.url), { type: "module" }); }
    catch (error) { reject(error); return; }
    let settled = false;
    let watchdog: ReturnType<typeof setTimeout> | undefined;
    const finish = (error?: Error, result?: AudioJobResult231) => {
      if (settled) return;
      settled = true;
      if (watchdog !== undefined) clearTimeout(watchdog);
      signal.removeEventListener("abort", onAbort);
      worker.terminate();
      if (error) reject(error);
      else if (result) resolve(result);
      else reject(new Error("AUDIO_231_WORKER_FAILED: Nessun output verificabile."));
    };
    const onAbort = () => finish(new DOMException("Montaggio annullato", "AbortError"));
    signal.addEventListener("abort", onAbort, { once: true });
    worker.onmessage = (event: MessageEvent<AudioJobResult231 | { kind: "error"; message: string }>) => {
      const response = event.data;
      if (response?.kind === "error") { finish(new Error(response.message)); return; }
      if (response?.kind !== "done" || !(response.wav instanceof ArrayBuffer) ||
          !response.preview || response.wav.byteLength !== response.preview.outputBytes ||
          !Array.isArray(response.peaks) || response.peaks.length !== BARS ||
          response.peaks.some((peak) => !Number.isFinite(peak) || peak < 0 || peak > 1)) {
        finish(new Error("AUDIO_231_OUTPUT_VERIFY: Output Worker non coerente."));
        return;
      }
      finish(undefined, response);
    };
    worker.onerror = () => finish(new Error("AUDIO_231_WORKER_FAILED: Elaborazione locale fallita."));
    watchdog = setTimeout(() => finish(new Error("AUDIO_231_WORKER_TIMEOUT: Elaborazione oltre il tempo massimo.")), 60_000);
    if (signal.aborted) { onAbort(); return; }
    try { worker.postMessage(job, job.sources.slice()); }
    catch (error) { finish(error instanceof Error ? error : new Error("AUDIO_231_WORKER_FAILED")); }
  });
}

/**
 * Opt-in WAV PCM16 slice of #231, deliberately not a general audio editor.
 * No uploaded files, no decoding by a hosted API, no auto-playback, no Gold.
 */
export function AudioTimelinePanel231() {
  const [files, setFiles] = useState<readonly File[]>([]);
  const [begin, setBegin] = useState("0");
  const [end, setEnd] = useState("");
  const [secondFirst, setSecondFirst] = useState(false);
  const [gain, setGain] = useState("1");
  const [speed, setSpeed] = useState("1");
  const [normalize, setNormalize] = useState(false);
  const [target, setTarget] = useState("24000");
  const [removeSilence, setRemoveSilence] = useState(false);
  const [threshold, setThreshold] = useState("10");
  const [minimumFrames, setMinimumFrames] = useState("400");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("Seleziona uno o due file WAV PCM16, poi avvia il montaggio locale.");
  const [rendered, setRendered] = useState<AudioJobResult231 | null>(null);
  const [outputUrl, setOutputUrl] = useState("");
  const urlRef = useRef("");
  const pending = useRef<AbortController | null>(null);
  const generation = useRef(0);

  function clearOutput() {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = "";
    setOutputUrl("");
    setRendered(null);
  }
  function changeSettings() {
    clearOutput();
    setStatus("Parametri modificati: rielabora per avere una nuova anteprima verificata.");
  }
  function choose(next: readonly File[]) {
    generation.current++;
    pending.current?.abort(); pending.current = null;
    setBusy(false);
    clearOutput();
    setFiles(next);
    setSecondFirst(false);
    if (next.length === 0) setStatus("Nessun WAV selezionato.");
    else if (next.length > 2 || next.some((file) => !/\.wav$/iu.test(file.name) || file.size < 44 || file.size > INPUT_LIMIT) ||
        next.reduce((n, file) => n + file.size, 0) > TOTAL_LIMIT) {
      setStatus("AUDIO_231_INPUT_LIMIT: massimo due WAV PCM16, 12 MiB per file e 24 MiB complessivi.");
    } else setStatus(`${next.length} WAV selezionato/i. Nessuna elaborazione iniziata; formato da verificare nel Worker.`);
  }
  function cancel() {
    generation.current++;
    pending.current?.abort(); pending.current = null;
    setBusy(false); clearOutput();
    setStatus("AUDIO_231_CANCELLED: Montaggio interrotto; nessun output parziale disponibile.");
  }
  useEffect(() => () => {
    generation.current++;
    pending.current?.abort();
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
  }, []);

  async function process() {
    if (pending.current || files.length < 1) return;
    clearOutput();
    const controller = new AbortController();
    pending.current = controller;
    const op = ++generation.current;
    setBusy(true);
    setStatus("Lettura WAV locale; nessun invio di dati in rete…");
    try {
      if (files.length > 2 || files.some((file) => !/\.wav$/iu.test(file.name) || file.size < 44 || file.size > INPUT_LIMIT) ||
          files.reduce((n, file) => n + file.size, 0) > TOTAL_LIMIT) {
        throw new Error("AUDIO_231_INPUT_LIMIT: solo 1–2 file WAV entro 12 MiB ciascuno.");
      }
      const sources = await Promise.all(files.map((file) => file.arrayBuffer()));
      if (controller.signal.aborted || op !== generation.current) return;
      const job: AudioJob231 = {
        kind: "render", sources,
        startSeconds: begin.trim() === "" ? Number.NaN : Number(begin),
        endSeconds: end.trim() === "" ? null : Number(end),
        secondFirst, gain: gain.trim() === "" ? Number.NaN : Number(gain),
        dsp: {
          speed: { ratio: speed.trim() === "" ? Number.NaN : Number(speed) },
          ...(removeSilence ? { silence: { thresholdSample: Number(threshold), minimumFrames: Number(minimumFrames) } } : {}),
          ...(normalize ? { normalize: { targetPeakSample: Number(target) } } : {}),
        },
      };
      setStatus("Montaggio e analisi della waveform in un Worker locale cancellabile…");
      const result = await executeAudioJob231(job, controller.signal);
      if (controller.signal.aborted || op !== generation.current) return;
      const url = URL.createObjectURL(new Blob([result.wav], { type: "audio/wav" }));
      urlRef.current = url;
      setOutputUrl(url);
      setRendered(result);
      setStatus("WAV PCM16 generato nel Worker: parametri, campioni, durata e waveform verificati.");
    } catch (error) {
      if (!controller.signal.aborted && op === generation.current) {
        setStatus(error instanceof Error ? error.message : "AUDIO_231_WORKER_FAILED");
      }
    } finally {
      if (pending.current === controller) pending.current = null;
      if (generation.current === op) setBusy(false);
    }
  }

  const readyFiles = files.length > 0 && files.length <= 2 && files.every((file) =>
    /\.wav$/iu.test(file.name) && file.size >= 44 && file.size <= INPUT_LIMIT) &&
    files.reduce((n, file) => n + file.size, 0) <= TOTAL_LIMIT;

  return <section class="tool-surface" aria-label="Montaggio WAV PCM16 sperimentale" data-audio-timeline-231>
    <h3>Montaggio WAV PCM16 (sperimentale)</h3>
    <p class="file-note">Solo file RIFF/WAVE PCM16 mono/stereo, 8–48 kHz, massimo 60 s per sorgente, 12 MiB per file (24 MiB totale). Due sorgenti richiedono stesso campionamento e numero di canali. Taglio sul primo file, concatenazione facoltativa del secondo, gain, picco, silenzi e velocità 0,5–2×. I tagli possono fare click; <strong>cambiare velocità modifica anche l'intonazione</strong>: non è time-stretch con pitch conservato. Nessun MP3/M4A, codec remoto, true-peak o LUFS in questa sezione.</p>
    <label class="field"><span>Uno o due file .wav locali (nessun caricamento sul server)</span>
      <input type="file" accept=".wav,audio/wav,audio/x-wav" multiple disabled={busy} onChange={(event) => choose(Array.from(event.currentTarget.files ?? []))} />
    </label>
    {files.length > 0 && <p class="file-note">Selezione: {files.map((file) => `${file.name} (${file.size} B)`).join(" → ")}. Ordine del secondo WAV configurabile qui sotto.</p>}
    <div class="field-grid">
      <label class="field"><span>Taglio inizio primo WAV (secondi)</span><input type="number" min="0" step="0.001" value={begin} disabled={busy} onInput={(event) => { setBegin(event.currentTarget.value); changeSettings(); }} /></label>
      <label class="field"><span>Taglio fine primo WAV (secondi, vuoto = fino alla fine)</span><input type="number" min="0" step="0.001" value={end} disabled={busy} onInput={(event) => { setEnd(event.currentTarget.value); changeSettings(); }} /></label>
      <label class="field"><span>Gain lineare (0–4, rifiuta clipping)</span><input type="number" min="0" max="4" step="0.1" value={gain} disabled={busy} onInput={(event) => { setGain(event.currentTarget.value); changeSettings(); }} /></label>
      <label class="field"><span>Velocità (0,5–2×, cambia pitch)</span><input type="number" min="0.5" max="2" step="0.25" value={speed} disabled={busy} onInput={(event) => { setSpeed(event.currentTarget.value); changeSettings(); }} /></label>
      <label class="field"><span><input type="checkbox" checked={secondFirst} disabled={busy || files.length !== 2} onChange={(event) => { setSecondFirst(event.currentTarget.checked); changeSettings(); }} /> Secondo WAV prima del primo</span></label>
      <label class="field"><span><input type="checkbox" checked={normalize} disabled={busy} onChange={(event) => { setNormalize(event.currentTarget.checked); changeSettings(); }} /> Normalizza il picco dei campioni (non LUFS)</span></label>
      {normalize && <label class="field"><span>Picco target PCM16 (1–32767)</span><input type="number" min="1" max="32767" step="1" value={target} disabled={busy} onInput={(event) => { setTarget(event.currentTarget.value); changeSettings(); }} /></label>}
      <label class="field"><span><input type="checkbox" checked={removeSilence} disabled={busy} onChange={(event) => { setRemoveSilence(event.currentTarget.checked); changeSettings(); }} /> Elimina run di silenzio in tutti i canali</span></label>
      {removeSilence && <>
        <label class="field"><span>Soglia assoluta PCM16 (0–32767)</span><input type="number" min="0" max="32767" step="1" value={threshold} disabled={busy} onInput={(event) => { setThreshold(event.currentTarget.value); changeSettings(); }} /></label>
        <label class="field"><span>Run minimo (frame alla frequenza originale)</span><input type="number" min="1" step="1" value={minimumFrames} disabled={busy} onInput={(event) => { setMinimumFrames(event.currentTarget.value); changeSettings(); }} /></label>
      </>}
    </div>
    <div class="actions">
      <button type="button" disabled={!readyFiles || busy} onClick={() => void process()}>Elabora e mostra waveform</button>
      <button type="button" disabled={!busy} onClick={cancel}>Annulla montaggio</button>
    </div>
    <p role="status" aria-live="polite" data-audio-timeline-status>{status}</p>
    {rendered !== null && outputUrl !== "" && <section data-audio-timeline-result aria-label="Anteprima WAV realmente elaborato">
      <dl>
        <dt>Durata montaggio / output</dt><dd>{rendered.preview.sourceTimelineFrames / rendered.preview.timeline.sampleRate} s → {rendered.preview.durationSeconds.toFixed(3)} s</dd>
        <dt>Frequenza / canali</dt><dd>{rendered.preview.timeline.sampleRate} Hz / {rendered.preview.timeline.channelCount}</dd>
        <dt>Frame silenzio rimossi</dt><dd>{rendered.preview.removedFrames}</dd>
        <dt>Picco PCM16 dopo elaborazione</dt><dd>{rendered.preview.outputPeakSample}</dd>
        <dt>Gain DSP / velocità</dt><dd>{rendered.preview.appliedGain.toFixed(3)}× / {rendered.preview.speedRatio}× (intonazione variabile)</dd>
        <dt>Output verificato</dt><dd>{rendered.preview.outputFrames} frame / {rendered.wav.byteLength} byte PCM16 WAV</dd>
      </dl>
      <svg role="img" aria-label="Forma d'onda misurata dai campioni del file WAV elaborato" viewBox="0 0 192 100" preserveAspectRatio="none" style="width:100%;height:100px;display:block" data-audio-timeline-waveform>
        <title>Forma d'onda misurata dal WAV elaborato, non simulata</title>
        {rendered.peaks.map((peak, i) => {
          const h = Math.max(1, peak * 94);
          return <rect key={i} x={i} y={(100 - h) / 2} width="0.85" height={h} fill="currentColor" />;
        })}
      </svg>
      <p class="file-note">Ascolto solo dopo il tuo clic. Il player riproduce il WAV risultante, non l'originale.</p>
      <audio controls preload="metadata" src={outputUrl} />
      <div class="actions"><a href={outputUrl} download="montaggio-pcm16.wav">Scarica WAV PCM16 verificato</a></div>
    </section>}
  </section>;
}
