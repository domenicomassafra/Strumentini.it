import { useEffect, useRef, useState } from "preact/hooks";
import type { AudioJob231, AudioJobResult231, AudioPreviewJob036, AudioPreviewResult036 } from "../../../engines/browser-audio/timeline-worker-231";
import { inspectAudioPcm16Source231 } from "../../../engines/browser-audio/timeline-231";
import { executeAudioJob231 } from "../../../engines/browser-audio/execute-job-411";
import { readMediaFile411 } from "../../../engines/media/read-file-411";
import { createOutputArtifactDescriptor, type OutputArtifactDescriptor } from "../../../runtime/output-artifact";
import { requestBrowserDownload339 } from "../../../runtime/browser-download-339";
import { AUTO_DOWNLOAD_KEY_339, browserStorage339, changeAutoDownload339, readAutoDownload339 } from "../../../runtime/download-policy-339";

const INPUT_LIMIT = 12 * 1024 * 1024;
const TOTAL_LIMIT = 24 * 1024 * 1024;

/**
 * Opt-in WAV PCM file processing workspace; #231 remains the bounded DSP.
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
  const [progress411, setProgress411] = useState<{ phase: "read" | "frames"; completed: number; total: number } | null>(null);
  const [status, setStatus] = useState("Seleziona uno o due file WAV PCM16, poi avvia il montaggio locale.");
  const [rendered, setRendered] = useState<AudioJobResult231 | null>(null);
  const [previewed, setPreviewed] = useState<AudioPreviewResult036 | null>(null);
  const [artifact, setArtifact] = useState<OutputArtifactDescriptor | null>(null);
  // SSR and the first hydration render must agree. Re-read persisted consent in
  // the mount effect, forcing a real DOM checkbox update when it is enabled.
  const [autoDownload, setAutoDownload] = useState(false);
  const [downloadStatus, setDownloadStatus] = useState("");
  const [outputUrl, setOutputUrl] = useState("");
  const urlRef = useRef("");
  const pending = useRef<AbortController | null>(null);
  const generation = useRef(0);

  function clearOutput() {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = "";
    setOutputUrl("");
    setRendered(null);
    setPreviewed(null);
    setArtifact(null);
    setDownloadStatus("");
  }
  function changeSettings() {
    clearOutput();
    setStatus("Parametri modificati: rielabora per avere una nuova anteprima verificata.");
  }
  function choose(next: readonly File[]) {
    generation.current++;
    pending.current?.abort(); pending.current = null;
    setBusy(false);
    setProgress411(null);
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
    setBusy(false); setProgress411(null); clearOutput();
    setStatus("AUDIO_231_CANCELLED: Montaggio interrotto; nessun output parziale disponibile.");
  }
  useEffect(() => () => {
    generation.current++;
    pending.current?.abort();
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
  }, []);
  useEffect(() => {
    const reportVisibility = () => {
      if (document.hidden && pending.current) {
        setStatus("MEDIA_411_SUSPENDED: Scheda in background; torna in primo piano o annulla e riprova.");
      } else if (pending.current) {
        setStatus("MEDIA_411_RESUMED: Scheda attiva; se il lavoro è fermo, annulla e riprova.");
      }
    };
    document.addEventListener("visibilitychange", reportVisibility);
    return () => document.removeEventListener("visibilitychange", reportVisibility);
  }, []);
  useEffect(() => {
    // Astro may render the initial checkbox before browser storage is ready.
    setAutoDownload(readAutoDownload339(browserStorage339()));
    const onStorage = (event: StorageEvent) => {
      if (event.key === AUTO_DOWNLOAD_KEY_339 || event.key === null) setAutoDownload(readAutoDownload339(browserStorage339()));
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  function chooseAutoDownload(enabled: boolean) {
    const { saved, persistedEnabled } = changeAutoDownload339(browserStorage339(), enabled);
    setAutoDownload(persistedEnabled === true);
    setDownloadStatus(saved ? (enabled
      ? "Download automatico attivo per i prossimi WAV elaborati. Puoi revocare il consenso."
      : "Download automatico disattivato. Il download manuale resta disponibile.")
      : persistedEnabled === true
        ? "Impossibile revocare la preferenza: il download automatico è ancora attivo nel browser. Riprova o cancella le preferenze del sito."
        : enabled
          ? "Impossibile salvare la preferenza: download automatico non attivato."
          : "Impossibile confermare la revoca nel browser. Controlla le preferenze del sito prima di un'altra elaborazione.");
  }

  function download() {
    setDownloadStatus(requestBrowserDownload339(artifact)
      ? "Download richiesto al browser. Il salvataggio sul dispositivo non può essere confermato qui."
      : "Download non disponibile: il browser lo ha bloccato o il WAV non è verificato. Puoi riprovare manualmente.");
  }

  async function process(mode: "preview" | "render" = "render") {
    if (pending.current || files.length < 1) return;
    const autoAtStart = autoDownload && readAutoDownload339(browserStorage339());
    clearOutput();
    const controller = new AbortController();
    pending.current = controller;
    const op = ++generation.current;
    setBusy(true);
    setProgress411(null);
    setStatus("Lettura WAV locale; nessun invio di dati in rete…");
    try {
      if (files.length > 2 || files.some((file) => !/\.wav$/iu.test(file.name) || file.size < 44 || file.size > INPUT_LIMIT) ||
          files.reduce((n, file) => n + file.size, 0) > TOTAL_LIMIT) {
        throw new Error("AUDIO_231_INPUT_LIMIT: solo 1–2 file WAV entro 12 MiB ciascuno.");
      }
      const totalRead = files.reduce((n, file) => n + file.size, 0);
      let previouslyRead = 0;
      const sources: ArrayBuffer[] = [];
      for (const file of files) {
        const buffer = await readMediaFile411(file, {
          maxBytes: INPUT_LIMIT, signal: controller.signal,
          onProgress: (loaded) => {
            if (controller.signal.aborted || op !== generation.current) return;
            setProgress411({ phase: "read", completed: previouslyRead + loaded, total: totalRead });
          },
        });
        sources.push(buffer);
        previouslyRead += file.size;
      }
      if (controller.signal.aborted || op !== generation.current) return;
      setProgress411(null);
      const job: AudioJob231 | AudioPreviewJob036 = {
        kind: mode, sources,
        startSeconds: begin.trim() === "" ? Number.NaN : Number(begin),
        endSeconds: end.trim() === "" ? null : Number(end),
        secondFirst, gain: gain.trim() === "" ? Number.NaN : Number(gain),
        dsp: {
          speed: { ratio: speed.trim() === "" ? Number.NaN : Number(speed) },
          ...(removeSilence ? { silence: { thresholdSample: Number(threshold), minimumFrames: Number(minimumFrames) } } : {}),
          ...(normalize ? { normalize: { targetPeakSample: Number(target) } } : {}),
        },
      };
      setStatus(mode === "preview" ? "Anteprima durata/silenzi nel Worker locale cancellabile…" : "Montaggio e analisi della waveform in un Worker locale cancellabile…");
      const result = await executeAudioJob231(job, controller.signal, (completed, total) => {
        if (!controller.signal.aborted && op === generation.current) {
          setProgress411({ phase: "frames", completed, total });
        }
      });
      if (controller.signal.aborted || op !== generation.current) return;
      if (result.kind === "preview") {
        setPreviewed(result);
        setStatus("Anteprima tecnica calcolata su campioni reali, senza esportazione. Modifica le soglie e riprova, oppure genera WAV PCM16.");
        return;
      }
      const bytes = new Uint8Array(result.wav);
      const verified = inspectAudioPcm16Source231(bytes);
      if (verified.frames !== result.preview.outputFrames ||
          verified.sampleRate !== result.preview.timeline.sampleRate ||
          verified.channels !== result.preview.timeline.channelCount) {
        throw new Error("AUDIO_231_OUTPUT_VERIFY: Lettura del WAV prodotto non coerente.");
      }
      const output = createOutputArtifactDescriptor({
        kind: "file", name: "montaggio-pcm16.wav", mime: "audio/wav", bytes,
        verification: { state: "verified", verifiedMime: "audio/wav", method: "RIFF/WAV PCM16 letto e verificato dai byte dopo il Worker" },
        fidelity: "structural", fidelityNote: "WAV PCM16 effettivamente elaborato, con gain, tagli e velocità applicati.",
      });
      try {
        const url = URL.createObjectURL(new Blob([result.wav], { type: "audio/wav" }));
        urlRef.current = url;
        setOutputUrl(url);
      } catch {
        setOutputUrl("");
      }
      setRendered(result);
      setArtifact(output);
      setStatus("WAV PCM16 generato nel Worker: codec, durata, campioni, dimensione e waveform verificati.");
      if (autoAtStart && readAutoDownload339(browserStorage339())) {
        setDownloadStatus(requestBrowserDownload339(output)
          ? "Download automatico richiesto al browser. Se bloccato, usa Scarica WAV PCM16 verificato."
          : "Download automatico non disponibile. Puoi provare Scarica WAV PCM16 verificato.");
      }
    } catch (error) {
      if (!controller.signal.aborted && op === generation.current) {
        setStatus(error instanceof Error ? error.message : "AUDIO_231_WORKER_FAILED");
      }
    } finally {
      if (generation.current === op) setProgress411(null);
      if (pending.current === controller) pending.current = null;
      if (generation.current === op) setBusy(false);
    }
  }

  const readyFiles = files.length > 0 && files.length <= 2 && files.every((file) =>
    /\.wav$/iu.test(file.name) && file.size >= 44 && file.size <= INPUT_LIMIT) &&
    files.reduce((n, file) => n + file.size, 0) <= TOTAL_LIMIT;

  return <section id="audio-processing" class="tool-surface" aria-label="Converti taglia e unisci WAV PCM" data-audio-timeline-231>
    <h3>Converti, taglia e unisci WAV in locale</h3>
    <p class="file-note">Workspace condiviso: converti WAV PCM 8/16/24/32 bit o IEEE Float32 in WAV PCM16, taglia il primo file e unisci facoltativamente il secondo. Mono/stereo, 8–48 kHz, massimo 60 s per file, 12 MiB a sorgente (24 MiB totale), senza upload. Le due tracce devono avere frequenza e canali uguali. La conversione da 24/32 bit o float a 16 bit comporta quantizzazione; la conversione non ricampiona e non è una compressione con perdita MP3/AAC. Soglie del silenzio, picco, gain e velocità 0,5–2× sono nella stessa esportazione. I tagli possono fare click e <strong>cambiare velocità modifica anche l'intonazione</strong>. Nessun codec remoto, pitch-preserving stretch, true-peak o LUFS nella sezione.</p>
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
      <button type="button" disabled={!readyFiles || busy} onClick={() => void process("preview")}>Anteprima taglio e silenzi</button>
      <button type="button" disabled={!readyFiles || busy} onClick={() => void process()}>Elabora e mostra waveform</button>
      <button type="button" disabled={!busy} onClick={cancel}>Annulla montaggio</button>
    </div>
    <label class="checkbox-field" data-download-optin339>
      <input type="checkbox" checked={autoDownload} onChange={(event) => chooseAutoDownload(event.currentTarget.checked)} />
      <span>Scarica automaticamente i prossimi WAV elaborati (facoltativo)</span>
    </label>
    <p class="file-note">Inizialmente disattivato. Non scarica risultati già mostrati; puoi revocare il consenso. Il browser può bloccare i download: il comando manuale resta disponibile.</p>
    {downloadStatus !== "" && <p role="status" class="file-note" data-download-status339>{downloadStatus}</p>}
    {busy && progress411 && <p class="file-note" data-media-progress411>
      <progress value={progress411.completed} max={progress411.total}
        aria-label={progress411.phase === "read" ? "Byte WAV letti" : "Frame WAV scritti"} />
      {progress411.completed} / {progress411.total} {progress411.phase === "read" ? "byte letti realmente" : "frame PCM elaborati"}
    </p>}
    <p role="status" aria-live="polite" data-audio-timeline-status>{status}</p>
    {previewed !== null && <section data-audio-036-preview aria-label="Anteprima tecnica prima dell'esportazione">
      <h4>Anteprima locale: nessun WAV ancora creato</h4>
      <dl>
        <dt>Durata dopo taglio/unione</dt><dd>{(previewed.preview.sourceTimelineFrames / previewed.preview.timeline.sampleRate).toFixed(3)} s</dd>
        <dt>Frame silenzio da rimuovere</dt><dd>{previewed.preview.removedFrames} in {previewed.preview.silenceRemoved.length} intervalli</dd>
        <dt>Durata stimata dai campioni</dt><dd>{previewed.preview.durationSeconds.toFixed(3)} s</dd>
        <dt>Byte WAV PCM16 previsti</dt><dd>{previewed.preview.outputBytes.toLocaleString("it-IT")} byte (calcolo esatto dei frame)</dd>
        <dt>Picco previsto</dt><dd>{previewed.preview.outputPeakSample} PCM16</dd>
      </dl>
      <p class="file-note">I numeri sono calcolati sui campioni reali della timeline prima di esportare. Per ascoltare e scaricare occorre elaborare il file: l'anteprima non genera un audio fittizio.</p>
    </section>}
    {rendered !== null && artifact !== null && <section data-audio-timeline-result aria-label="Anteprima WAV realmente elaborato">
      <h4>Ricevuta audio convertito · WAV RIFF PCM16</h4>
      <dl data-audio-036-receipt>
        <dt>Codec/container di uscita</dt><dd>RIFF/WAVE · PCM signed 16-bit LE</dd>
        <dt>Bitrate PCM di uscita</dt><dd>{rendered.preview.timeline.sampleRate * rendered.preview.timeline.channelCount * 16} bit/s (non compresso)</dd>
        <dt>Dimensione prima → dopo</dt><dd>{files.reduce((sum, file) => sum + file.size, 0).toLocaleString("it-IT")} byte → {rendered.wav.byteLength.toLocaleString("it-IT")} byte</dd>
        {rendered.sourceFormats.map((format, i) => <>
          <dt key={`source-label-${i}`}>Sorgente {i + 1} · codec, durata, bitrate</dt>
          <dd key={`source-value-${i}`}>{format.sourceEncoding} · {format.sourceDurationSeconds.toFixed(3)} s · {format.sampleRate} Hz · {format.channels} canali · {format.sourceBitrateBps} bit/s</dd>
        </>)}
      </dl>
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
      {outputUrl !== "" && <audio controls preload="metadata" src={outputUrl} />}
      {outputUrl === "" && <p class="file-note">Anteprima audio non disponibile nel browser. I byte WAV verificati restano nel risultato.</p>}
      <div class="actions"><button type="button" onClick={download}>Scarica WAV PCM16 verificato</button></div>
    </section>}
  </section>;
}
