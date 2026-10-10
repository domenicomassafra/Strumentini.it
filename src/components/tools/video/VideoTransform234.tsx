import { useEffect, useRef, useState } from "preact/hooks";
import type { VideoTransformResult234 } from "../../../engines/video/video-transform-234";
import type { CompressionPlan38, CompressionReceipt38 } from "../../../engines/video/compression-strategy-38";

/** WebCodecs H.264/AAC local encoder, capability-gated and never auto-started. */
export function VideoTransform234({ file, durationSeconds }: { readonly file: File | null; readonly durationSeconds?: number | null }) {
  const [begin, setBegin] = useState("0");
  const [end, setEnd] = useState("");
  const [width, setWidth] = useState("320");
  const [height, setHeight] = useState("240");
  const [bitrate, setBitrate] = useState("600");
  const [strategy, setStrategy] = useState<"bitrate" | "target-size">("bitrate");
  const [targetMb, setTargetMb] = useState("0.08");
  const [plan, setPlan] = useState<CompressionPlan38 | null>(null);
  const [receipt, setReceipt] = useState<CompressionReceipt38 | null>(null);
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
    setPlan(null);
    setReceipt(null);
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
      const { planCompression38, measureCompression38 } = await import("../../../engines/video/compression-strategy-38");
      const start = Number(begin);
      const selectedEnd = end.trim() === "" ? durationSeconds : Number(end);
      if (selectedEnd === null || selectedEnd === undefined || !Number.isFinite(selectedEnd)) {
        throw new Error("VIDEO_38_DURATION: Carica i metadati video oppure indica la fine del taglio.");
      }
      const candidate = planCompression38(strategy === "bitrate"
        ? { mode: "bitrate", videoBitrateKbps: Number(bitrate) }
        : { mode: "target-size", targetMegabytes: Number(targetMb) }, selectedEnd - start);
      const converted = await transformVideoMp4Local234(file, {
        start, end: end.trim() === "" ? null : Number(end),
        width: Number(width), height: Number(height), videoBitrateBps: candidate.requestedVideoBitrateBps,
      }, controller.signal, value => {
        if (sequence.current === operation && Number.isFinite(value)) setStatus(`Codifica H.264+AAC: ${Math.round(value * 100)}%…`);
      });
      if (controller.signal.aborted || sequence.current !== operation) return;
      const nextUrl = URL.createObjectURL(converted.blob);
      currentUrl.current = nextUrl;
      setUrl(nextUrl);
      setResult(converted);
      setPlan(candidate);
      setReceipt(measureCompression38(candidate, converted.sourceBytes, converted.bytes, converted.duration));
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
    <h3>Comprimi, taglia e converti video in MP4 (WebCodecs)</h3>
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
      <label class="field"><span>Strategia di compressione</span>
        <select aria-label="Strategia di compressione" data-video-compression-strategy value={strategy} disabled={busy}
          onChange={e => { setStrategy(e.currentTarget.value as "bitrate" | "target-size"); clearResult(); }}>
          <option value="bitrate">Bitrate video richiesto (VBR)</option>
          <option value="target-size">Dimensione file obiettivo (stima)</option>
        </select></label>
      {strategy === "bitrate"
        ? <label class="field"><span>Bitrate video obiettivo (kbit/s)</span><input type="number" min="180" max="3000" step="10" value={bitrate} disabled={busy}
          onInput={e => { setBitrate(e.currentTarget.value); clearResult(); }} /></label>
        : <label class="field"><span>Dimensione obiettivo (MB decimali, stima)</span><input type="number" min="0.01" max="8" step="0.01" value={targetMb} disabled={busy}
          onInput={e => { setTargetMb(e.currentTarget.value); clearResult(); }} />
          <small>Calcolata con audio AAC 96 kbit/s e 4096 byte di riserva; video 180–3000 kbit/s. Non garantita dall'encoder VBR.</small></label>}
    </div>
    <div class="actions">
      <button type="button" disabled={!file || busy || probe === "checking"} onClick={() => void detect()}>Verifica encoder WebCodecs</button>
      <button type="button" disabled={!file || busy || probe !== "yes"} onClick={() => void convert()}>Genera MP4 H.264 + AAC</button>
      <button type="button" disabled={!busy} onClick={cancel}>Annulla conversione</button>
    </div>
    <p role="status" data-video-transform-capability aria-live="polite">{capability}</p>
    <p role="status" data-video-transform-status aria-live="polite">{status}</p>
    {result && url && plan && receipt && <section data-video-transform-result aria-label="MP4 locale ricodificato">
      <p data-video-compression-38><strong>Prima → dopo (misurati):</strong> {result.sourceBytes} → {result.bytes} byte
        ({receipt.savedBytes >= 0 ? "risparmio" : "aumento"} {Math.abs(receipt.savedBytes)} byte, {receipt.savedPercent.toFixed(2)}%).
        Video {result.sourceVideoCodec.toUpperCase()} {result.sourceWidth}×{result.sourceHeight} → H.264 {result.width}×{result.height};
        audio {result.sourceAudioCodec.toUpperCase()} → AAC.
        Durata originale {result.sourceDurationSeconds.toFixed(3)} s; clip {result.start.toFixed(3)}–{result.end.toFixed(3)} s,
        durata prodotta {result.duration.toFixed(3)} s.</p>
      <p data-video-compression-strategy-result>Strategia: {plan.strategy === "target-size" ? "dimensione obiettivo stimata" : "bitrate video richiesto"};
        richiesta video {Math.round(plan.requestedVideoBitrateBps / 1000)} kbit/s, audio 96 kbit/s;
        bitrate effettivo medio del <em>file complessivo</em> {Math.round(receipt.actualAvgTotalBitrateBps / 1000)} kbit/s.
        {receipt.requestedSizeBytes === null
          ? " Il risultato dipende dal contenuto del video e non garantisce una riduzione."
          : ` Dimensione obiettivo ${receipt.requestedSizeBytes} byte: ${receipt.targetAchieved ? "raggiunta" : "non raggiunta"}. Il target non è garantito.`}
      </p>
      <video src={url} controls preload="metadata" playsInline style={{ maxWidth: "min(100%, 420px)", display: "block" }} />
      <a href={url} download="video-ricodificato.mp4">Scarica MP4 ricodificato</a>
    </section>}
  </section>;
}
