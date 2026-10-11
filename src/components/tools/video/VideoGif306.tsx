import { useEffect, useRef, useState } from "preact/hooks";
import { recordCompletedTool } from "../../../workbench/completed-tool";
import type { VideoGif306Result } from "../../../engines/video/video-gif-306";

/** Video→animated GIF on the existing local-video selection, lazily on click. */
export function VideoGif306({ file }: { readonly file: File | null }) {
  const [begin, setBegin] = useState("0");
  const [end, setEnd] = useState("");
  const [fps, setFps] = useState<5 | 10>(5);
  const [maxWidth, setMaxWidth] = useState("160");
  const [scale, setScale] = useState<0.5 | 1>(1);
  const [status, setStatus] = useState("Seleziona un video locale per creare una GIF animata.");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<VideoGif306Result | null>(null);
  const [url, setUrl] = useState("");
  const current = useRef("");
  const active = useRef<AbortController | null>(null);
  const generation = useRef(0);

  function clearOutput() {
    if (current.current) URL.revokeObjectURL(current.current);
    current.current = "";
    setUrl(""); setResult(null);
  }
  function cancel() {
    generation.current++;
    active.current?.abort();
    active.current = null;
    setBusy(false);
    clearOutput();
    setStatus("VIDEO_GIF_306_CANCELLED: Elaborazione annullata, nessuna GIF parziale.");
  }
  useEffect(() => {
    generation.current++;
    active.current?.abort();
    active.current = null;
    setBusy(false);
    clearOutput();
    setStatus("Video cambiato. Seleziona massimo 3 secondi per la GIF.");
    return () => {
      generation.current++;
      active.current?.abort();
      if (current.current) URL.revokeObjectURL(current.current);
    };
  }, [file]);

  async function convert() {
    if (!file || active.current) return;
    clearOutput();
    const abort = new AbortController();
    active.current = abort;
    const operation = ++generation.current;
    setBusy(true);
    setStatus("Decodifica fotogrammi nel Worker e codifica GIF89a locale…");
    try {
      const { videoToGif306 } = await import("../../../engines/video/video-gif-306");
      const completed = await videoToGif306(file, {
        start: Number(begin), end: end.trim() === "" ? null : Number(end),
        fps, maxWidth: Number(maxWidth), scale,
      }, abort.signal, (done, total) => {
        if (generation.current === operation) setStatus(`Codifica GIF: ${done}/${total} frame…`);
      });
      if (abort.signal.aborted || generation.current !== operation) return;
      const next = URL.createObjectURL(completed.blob);
      current.current = next;
      setUrl(next);
      setResult(completed);
      setStatus(`GIF89a verificata: ${completed.frames} frame, ${completed.durationSeconds.toFixed(2)} s, ${completed.bytes} byte.`);
      recordCompletedTool("video-inspector");
    } catch (cause) {
      if (!abort.signal.aborted && generation.current === operation) {
        setStatus(cause instanceof Error ? cause.message : "VIDEO_GIF_306_WORKER: GIF non disponibile.");
      }
    } finally {
      if (active.current === abort) active.current = null;
      if (generation.current === operation) setBusy(false);
    }
  }

  function updateSetting(action: () => void) { action(); clearOutput(); }

  return <section class="tool-surface" data-video-gif-306 aria-label="Converti video in GIF animata">
    <h3>Video → GIF animata locale</h3>
    <p class="file-note">Usa il video selezionato sopra: MP4 H.264 o WebM VP8, massimo 12 MiB / 12 s.
      Scegli un intervallo di <strong>0,2–3 secondi</strong> con 5 oppure 10 fps, massimo 30 frame e
      lato massimo 256 px. L'immagine viene ridotta a una tavolozza di 128 colori per fotogramma:
      i colori fotografici possono presentare bande. L'audio non viene incluso nel GIF.
      Tutto avviene nel browser, senza caricamenti remoti; su dispositivi senza decoder verificato la conversione viene rifiutata.</p>
    <div class="field-grid">
      <label class="field"><span>Inizio clip (secondi)</span><input type="number" min="0" step="0.1" value={begin} disabled={busy}
        onInput={event => updateSetting(() => setBegin(event.currentTarget.value))} /></label>
      <label class="field"><span>Fine clip (secondi, vuoto = max 3 s)</span><input type="number" min="0.2" step="0.1" value={end} disabled={busy}
        onInput={event => updateSetting(() => setEnd(event.currentTarget.value))} /></label>
      <label class="field"><span>Fotogrammi al secondo</span>
        <select aria-label="GIF FPS" disabled={busy} value={fps} onChange={event => updateSetting(() => setFps(Number(event.currentTarget.value) as 5 | 10))}>
          <option value="5">5 fps</option><option value="10">10 fps</option>
        </select></label>
      <label class="field"><span>Larghezza massima</span><select aria-label="GIF larghezza" disabled={busy} value={maxWidth}
        onChange={event => updateSetting(() => setMaxWidth(event.currentTarget.value))}>
        <option value="96">96 px</option><option value="160">160 px</option><option value="256">256 px</option>
      </select></label>
      <label class="field"><span>Scala</span><select aria-label="GIF scala" disabled={busy} value={scale}
        onChange={event => updateSetting(() => setScale(Number(event.currentTarget.value) as 0.5 | 1))}>
        <option value="1">100%</option><option value="0.5">50%</option>
      </select></label>
    </div>
    <div class="actions">
      <button type="button" disabled={!file || busy} onClick={() => void convert()}>Converti video in GIF</button>
      <button type="button" disabled={!busy} onClick={cancel}>Annulla conversione GIF</button>
    </div>
    <p role="status" aria-live="polite" data-video-gif-status>{status}</p>
    {result && url && <section data-video-gif-result aria-label="GIF animata prodotta">
      <p>{result.frames} frame · {result.width}×{result.height} px · {result.durationSeconds.toFixed(2)} s · {result.bytes} byte.
        Ritardi per frame: {result.delaysCentiseconds.join(", ")} centesimi di secondo.</p>
      <img src={url} alt="Anteprima della GIF animata prodotta" style={{ display: "block", maxWidth: "100%", imageRendering: "auto" }} />
      <a href={url} download="video-convertito.gif">Scarica GIF animata</a>
    </section>}
  </section>;
}
