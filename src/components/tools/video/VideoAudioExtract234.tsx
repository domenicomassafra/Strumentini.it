import { useEffect, useRef, useState } from "preact/hooks";
import type { VideoAudioResult234 } from "../../../engines/video/audio-extract-234";

/** #234 independent audio-only extraction/trim. The adjacent video transform
 * worker performs A/V-synchronized MP4 remux/reencoding as a separate action. */
export function VideoAudioExtract234({ file }: { readonly file: File | null }) {
  const [begin, setBegin] = useState("0");
  const [end, setEnd] = useState("");
  const [status, setStatus] = useState("Estrazione audio mp4a→WAV disponibile in locale.");
  const [busy, setBusy] = useState(false);
  const [output, setOutput] = useState<VideoAudioResult234 | null>(null);
  const [outputUrl, setOutputUrl] = useState("");
  const pending = useRef<AbortController | null>(null);
  const currentUrl = useRef("");
  const generation = useRef(0);

  function clearOutput() {
    if (currentUrl.current) URL.revokeObjectURL(currentUrl.current);
    currentUrl.current = "";
    setOutputUrl("");
    setOutput(null);
  }

  useEffect(() => {
    generation.current++;
    pending.current?.abort();
    pending.current = null;
    setBusy(false);
    clearOutput();
    setBegin("0");
    setEnd("");
    setStatus("Estrazione audio mp4a→WAV disponibile in locale.");
    return () => {
      generation.current++;
      pending.current?.abort();
      if (currentUrl.current) URL.revokeObjectURL(currentUrl.current);
    };
  }, [file]);

  function cancel() {
    generation.current++;
    pending.current?.abort();
    pending.current = null;
    clearOutput();
    setBusy(false);
    setStatus("VIDEO_AUDIO_CANCELLED: Operazione interrotta; nessun WAV parziale scaricabile.");
  }

  async function extract() {
    if (!file || pending.current) return;
    clearOutput();
    const controller = new AbortController();
    pending.current = controller;
    const operation = ++generation.current;
    setBusy(true);
    setStatus("Verifica struttura MP4, decodifica mp4a e scrittura PCM16 nel Worker locale…");
    try {
      const { extractAudioWav234 } = await import("../../../engines/video/audio-extract-234");
      const result = await extractAudioWav234(file, {
        startSeconds: begin.trim() === "" ? Number.NaN : Number(begin), endSeconds: end.trim() === "" ? null : Number(end),
      }, controller.signal);
      if (controller.signal.aborted || generation.current !== operation) return;
      const url = URL.createObjectURL(result.blob);
      currentUrl.current = url;
      setOutputUrl(url);
      setOutput(result);
      setStatus("WAV verificato: header RIFF, PCM16, byte e durata del campionamento coerenti.");
    } catch (error) {
      if (!controller.signal.aborted && generation.current === operation) {
        setStatus(error instanceof Error ? error.message : "VIDEO_AUDIO_UNSUPPORTED: Non è possibile verificare l'estrazione.");
      }
    } finally {
      if (pending.current === controller) pending.current = null;
      if (generation.current === operation) setBusy(false);
    }
  }

  return <section class="tool-surface" data-video-audio-234 aria-label="Estrazione audio dal video">
    <h3>Estrai audio MP4 (mp4a) in WAV (sperimentale)</h3>
    <p class="file-note">Usa il video locale selezionato sopra. Sono ammessi soltanto MP4/M4V con una traccia video e una singola traccia audio mp4a, fino a 12 MiB e 60 s; il WAV finale non supera 16 MiB. Il profilo audio concreto deve essere decodificabile dal browser e può essere ricampionato a 48 kHz; il WAV PCM16 è senza compressione e può essere più grande dell'originale. Nessun invio in rete.</p>
    <p class="file-note">Il taglio WAV riguarda soltanto l'audio dopo la decodifica, con precisione al campione. Per un MP4 ricodificato con audio e video sincronizzati usa il pannello «Comprimi, taglia e converti video» sottostante, che verifica l'encoder WebCodecs del browser prima di procedere. Il WAV estratto rimane un file audio separato.</p>
    <div class="field-grid">
      <label class="field"><span>Inizio audio (secondi)</span><input type="number" min="0" step="0.001" value={begin} disabled={busy} onInput={(event) => { setBegin(event.currentTarget.value); clearOutput(); }} /></label>
      <label class="field"><span>Fine audio (secondi, vuoto = tutta la traccia)</span><input type="number" min="0.05" step="0.001" value={end} disabled={busy} onInput={(event) => { setEnd(event.currentTarget.value); clearOutput(); }} /></label>
    </div>
    <div class="actions">
      <button type="button" disabled={!file || busy} onClick={() => void extract()}>Estrai WAV dal video</button>
      <button type="button" disabled={!busy} onClick={cancel}>Annulla estrazione WAV</button>
    </div>
    <p role="status" data-video-audio-status aria-live="polite">{status}</p>
    {output && outputUrl && <section data-video-audio-result aria-label="Audio WAV estratto">
      <p class="file-note">mp4a decodificato → PCM16 WAV; {output.channels} canale/i; {output.sampleRate} Hz; intervallo decodificato {output.startSeconds.toFixed(3)}–{output.endSeconds.toFixed(3)} s; durata {output.durationSeconds.toFixed(3)} s; {output.sourceBytes} byte origine → {output.outputBytes} byte WAV. Nessun nuovo video generato.</p>
      <audio src={outputUrl} controls preload="metadata" />
      <div class="actions"><a href={outputUrl} download="audio-estratto.wav">Scarica WAV PCM16</a></div>
    </section>}
  </section>;
}
