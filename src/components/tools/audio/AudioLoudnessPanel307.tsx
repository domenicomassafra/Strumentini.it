import { useEffect, useRef, useState } from "preact/hooks";
import type { Loudness307Result } from "../../../engines/browser-audio/loudness-307";

const BYTE_LIMIT = 20 * 1024 * 1024;
const displayed = (lufs: number | null, unit: string): string => lufs === null ? "Non misurabile (silenzio)" : `${lufs.toFixed(2)} ${unit}`;

/** Opt-in, local 48 kHz mono/stereo analyser, not a broadcast certification. */
export function AudioLoudnessPanel307() {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState("Scegli un file audio locale da analizzare.");
  const [result, setResult] = useState<Loudness307Result | null>(null);
  const [running, setRunning] = useState(false);
  const controller = useRef<AbortController | null>(null);

  useEffect(() => () => controller.current?.abort(), []);

  function choose(input: File | null) {
    controller.current?.abort();
    setFile(input);
    setResult(null);
    setStatus(input === null ? "Scegli un file audio locale da analizzare." : `Selezionato: ${input.name}. Nessuna analisi avviata.`);
  }

  async function run() {
    if (file === null) return;
    const abort = new AbortController();
    controller.current?.abort();
    controller.current = abort;
    setResult(null);
    setRunning(true);
    setStatus("Decodifica e misura locale in corso…");
    try {
      if (file.size === 0 || file.size > BYTE_LIMIT) throw new Error("Dimensione non supportata: limite 20 MiB.");
      if (typeof OfflineAudioContext === "undefined") throw new Error("Decodifica Web Audio non disponibile in questo browser.");
      // Explicitly request 48 kHz: otherwise the 48 kHz K-weighting filter
      // coefficients would silently produce false LUFS at another rate.
      const context = new OfflineAudioContext(2, 1, 48_000);
      const bytes = await file.arrayBuffer();
      if (abort.signal.aborted) return;
      const decoded = await context.decodeAudioData(bytes);
      if (abort.signal.aborted) return;
      if (decoded.numberOfChannels < 1 || decoded.numberOfChannels > 2 || decoded.duration > 60 || decoded.duration < 0.4) {
        throw new Error("Supportati solo mono/stereo e durate tra 0,4 e 60 secondi.");
      }
      const { analyzeLoudness307 } = await import("../../../engines/browser-audio/loudness-307");
      const channels = Array.from({ length: decoded.numberOfChannels }, (_, index) => decoded.getChannelData(index));
      const measured = analyzeLoudness307(channels, decoded.sampleRate, abort.signal);
      if (abort.signal.aborted) return;
      setResult(measured);
      setStatus("Analisi completata sui campioni decodificati localmente.");
    } catch (error) {
      if (!abort.signal.aborted) setStatus(error instanceof Error ? `Analisi non disponibile: ${error.message}` : "File non analizzabile.");
    } finally {
      if (controller.current === abort) { controller.current = null; setRunning(false); }
    }
  }

  return <section class="tool-surface" aria-label="Misuratore loudness locale" data-audio-loudness-307>
    <h3>Analisi loudness locale (LUFS)</h3>
    <p class="file-note">Profilo circoscritto: ITU-R BS.1770-5, filtri K a 48 kHz, mono/stereo e gate EBU Tech 3341. Non misura il vero picco intercampione (dBTP), non calcola LRA e non certifica la conformità broadcast. Il browser può ricampionare durante la decodifica.</p>
    <label class="field"><span>File audio (massimo 20 MiB, 0,4–60 secondi)</span>
      <input type="file" accept="audio/*,.wav,.mp3,.m4a,.ogg,.flac" disabled={running} onChange={(event) => choose(event.currentTarget.files?.[0] ?? null)} />
    </label>
    <div class="actions">
      <button type="button" disabled={file === null || running} onClick={() => void run()}>{running ? "Analisi in corso" : "Analizza localmente"}</button>
      <button type="button" disabled={!running} onClick={() => { controller.current?.abort(); controller.current = null; setRunning(false); setStatus("Analisi annullata, nessun risultato pubblicato."); }}>Annulla</button>
    </div>
    <p role="status" aria-live="polite">{status}</p>
    {result !== null && <section aria-label="Risultati analisi LUFS" data-loudness-results>
      <dl>
        <dt>Loudness integrata, gate EBU</dt><dd>{displayed(result.integratedLufs, "LUFS")}</dd>
        <dt>Momentanea, ultimi 400 ms</dt><dd>{displayed(result.momentaryLufs, "LUFS")}</dd>
        <dt>Breve termine, ultimi 3 s (o durata disponibile)</dt><dd>{displayed(result.shortTermLufs, "LUFS")}</dd>
        <dt>Picco dei campioni, non true peak</dt><dd>{displayed(result.samplePeakDbfs, "dBFS")}</dd>
        <dt>Blocchi oltre gate assoluto / relativo</dt><dd>{result.absoluteGatedBlocks} / {result.relativeGatedBlocks}</dd>
        <dt>Durata / canali / frequenza</dt><dd>{result.durationSeconds.toFixed(2)} s · {result.channelCount} · {result.sampleRate} Hz</dd>
      </dl>
      <small>{result.caveat}</small>
    </section>}
  </section>;
}
