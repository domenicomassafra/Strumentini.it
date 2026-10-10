import { useEffect, useRef, useState } from "preact/hooks";
import type { VideoTransformResult234 } from "../../../engines/video/video-transform-234";

/** WebCodecs H.264/AAC local encoder, capability-gated and never auto-started. */
export function VideoTransform234({ file }: { readonly file: File | null }) {
  const [begin, setBegin] = useState("0");
  const [end, setEnd] = useState("");
  const [width, setWidth] = useState("320");
  const [height, setHeight] = useState("240");
  const [bitrate, setBitrate] = useState("600");
  const [probe, setProbe] = useState<"unknown" | "checking" | "yes" | "no">("unknown");
  const [capability, setCapability] = useState("Verifica supporto H.264 + AAC prima di convertire.");
  const [status, setStatus] = useState("Nessun video codificato.");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<VideoTransformResult234 | null>(null);
  const [url, setUrl] = useState("");
  const currentUrl = useRef("");
  const pending = useRef<AbortController | null>(null);
  const sequence = useRef(0);

  function clearResult() {
    if (currentUrl.current) URL.revokeObjectURL(currentUrl.current);
    currentUrl.current = "";
    setUrl("");
    setResult(null);
  }
  function cancel() {
    sequence.current++;
    pending.current?.abort();
    pending.current = null;
    setBusy(false);
    clearResult();
    setStatus("VIDEO_234_CANCELLED: Encoder fermato; nessun MP4 parziale.");
  }
  useEffect(() => {
    sequence.current++;
    pending.current?.abort();
    pending.current = null;
    setBusy(false);
    clearResult();
    setProbe("unknown");
    setCapability("Verifica supporto H.264 + AAC prima di convertire.");
    setStatus("Nessun video codificato.");
    return () => {
      sequence.current++;
      pending.current?.abort();
      if (currentUrl.current) URL.revokeObjectURL(currentUrl.current);
    };
  }, [file]);

  async function detect() {
    if (pending.current) return;
    const controller = new AbortController();
    pending.current = controller;
    const operation = ++sequence.current;
    setProbe("checking");
    try {
      const { probeVideoTransform234 } = await import("../../../engines/video/video-transform-234");
      const capability = await probeVideoTransform234(Number(width), Number(height), controller.signal,
        file?.name.toLowerCase().endsWith(".webm") ? "webm" : "mp4");
      if (controller.signal.aborted || sequence.current !== operation) return;
      setProbe(capability.supported ? "yes" : "no");
      setCapability(capability.reason);
    } catch (error) {
      if (!controller.signal.aborted && sequence.current === operation) {
        setProbe("no");
        setCapability(error instanceof Error ? error.message : "WebCodecs non disponibili.");
      }
    } finally { if (pending.current === controller) pending.current = null; }
  }

  async function convert() {
    if (!file || pending.current || probe !== "yes") return;
    clearResult();
    const controller = new AbortController();
    pending.current = controller;
    const operation = ++sequence.current;
    setBusy(true);
    setStatus("WebCodecs: decodifica e ricodifica reali H.264 + AAC nel Worker locale…");
    try {
      const { transformVideoMp4Local234 } = await import("../../../engines/video/video-transform-234");
      const converted = await transformVideoMp4Local234(file, {
        start: Number(begin), end: end.trim() === "" ? null : Number(end),
        width: Number(width), height: Number(height), videoBitrateBps: Number(bitrate) * 1000,
      }, controller.signal, value => {
        if (sequence.current === operation && Number.isFinite(value)) setStatus(`Codifica H.264+AAC: ${Math.round(value * 100)}%…`);
      });
      if (controller.signal.aborted || sequence.current !== operation) return;
      const nextUrl = URL.createObjectURL(converted.blob);
      currentUrl.current = nextUrl;
      setUrl(nextUrl);
      setResult(converted);
      setStatus("Nuovo MP4 H.264 + AAC generato e metadati ricontrollati; bitrate richiesto approssimativo.");
    } catch (error) {
      if (!controller.signal.aborted && sequence.current === operation) {
        setStatus(error instanceof Error ? error.message : "VIDEO_234_WORKER_FAILED: conversione non riuscita.");
      }
    } finally {
      if (pending.current === controller) pending.current = null;
      if (sequence.current === operation) setBusy(false);
    }
  }

  return <section class="tool-surface" data-video-transform-234>
    <h3>Trasforma video MP4 localmente (WebCodecs)</h3>
    <p class="file-note">Nuovo MP4 con video H.264 ricodificato e audio AAC ricodificato nello stesso contenitore; supporto encoder verificato dal browser. Sorgenti: MP4 H.264/AAC oppure WebM VP8/Opus, fino a 12 MiB, massimo 12 secondi e 1280×720. Operazione sperimentale: dimensione finale e target bitrate sono indicativi; il taglio è verificato entro 180 ms sulla durata dichiarata. Non sostituisce un editor frame-perfect. Nessun file inviato in rete.</p>
    <div class="field-grid">
      <label class="field"><span>Inizio video (s)</span><input type="number" min="0" step="0.01" value={begin} disabled={busy}
        onInput={e => { setBegin(e.currentTarget.value); clearResult(); }} /></label>
      <label class="field"><span>Fine video (s, vuoto = fine file)</span><input type="number" min="0.4" step="0.01" value={end} disabled={busy}
        onInput={e => { setEnd(e.currentTarget.value); clearResult(); }} /></label>
      <label class="field"><span>Larghezza codificata (px pari)</span><input type="number" min="32" max="1280" step="2" value={width} disabled={busy}
        onInput={e => { setWidth(e.currentTarget.value); setProbe("unknown"); clearResult(); }} /></label>
      <label class="field"><span>Altezza codificata (px pari)</span><input type="number" min="32" max="720" step="2" value={height} disabled={busy}
        onInput={e => { setHeight(e.currentTarget.value); setProbe("unknown"); clearResult(); }} /></label>
      <label class="field"><span>Bitrate video obiettivo (kbit/s)</span><input type="number" min="180" max="3000" step="10" value={bitrate} disabled={busy}
        onInput={e => { setBitrate(e.currentTarget.value); clearResult(); }} /></label>
    </div>
    <div class="actions">
      <button type="button" disabled={!file || busy || probe === "checking"} onClick={() => void detect()}>Verifica encoder WebCodecs</button>
      <button type="button" disabled={!file || busy || probe !== "yes"} onClick={() => void convert()}>Genera MP4 H.264 + AAC</button>
      <button type="button" disabled={!busy} onClick={cancel}>Annulla conversione</button>
    </div>
    <p role="status" data-video-transform-capability aria-live="polite">{capability}</p>
    <p role="status" data-video-transform-status aria-live="polite">{status}</p>
    {result && url && <section data-video-transform-result aria-label="MP4 locale ricodificato">
      <p>Nuovo MP4: {result.width}×{result.height}; H.264 + AAC; durata {result.duration.toFixed(3)} s;
        taglio {result.start.toFixed(3)}–{result.end.toFixed(3)} s; {result.sourceBytes} → {result.bytes} byte.</p>
      <video src={url} controls preload="metadata" playsInline style={{ maxWidth: "min(100%, 420px)", display: "block" }} />
      <a href={url} download="video-ricodificato.mp4">Scarica MP4 ricodificato</a>
    </section>}
  </section>;
}
