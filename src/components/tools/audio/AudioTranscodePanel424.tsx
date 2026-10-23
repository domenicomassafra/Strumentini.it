import { useEffect, useRef, useState } from "preact/hooks";
import { recordCompletedTool } from "../../../workbench/completed-tool";
import {
  AUDIO_424_BITRATES_KBPS, AUDIO_424_FORMATS, AUDIO_424_MAX_INPUT_BYTES,
  availableAudioFormats424, transcodeAudio424, type TranscodedAudio424,
} from "../../../engines/browser-audio/transcode-424";

export function AudioTranscodePanel424() {
  const [available, setAvailable] = useState<string[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [format, setFormat] = useState<string>(AUDIO_424_FORMATS[0].mime);
  const [targetKbps, setTargetKbps] = useState<number>(64);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("Seleziona un audio da comprimere sul dispositivo.");
  const [result, setResult] = useState<TranscodedAudio424 | null>(null);
  const [outputUrl, setOutputUrl] = useState("");
  const outputRef = useRef("");
  const controllerRef = useRef<AbortController | null>(null);

  function revoke() {
    if (outputRef.current) URL.revokeObjectURL(outputRef.current);
    outputRef.current = "";
    setOutputUrl("");
    setResult(null);
  }
  useEffect(() => {
    const formats = availableAudioFormats424(typeof MediaRecorder === "undefined"
      ? undefined : (mime) => MediaRecorder.isTypeSupported(mime));
    setAvailable(formats.map((entry) => entry.mime));
    if (formats.length) setFormat(formats[0]!.mime);
    return () => {
      controllerRef.current?.abort();
      if (outputRef.current) URL.revokeObjectURL(outputRef.current);
    };
  }, []);

  function reset(message: string) {
    revoke();
    setStatus(message);
  }
  async function compress() {
    if (!file || busy || controllerRef.current || !available.includes(format)) return;
    reset("Decodifica locale e codifica nativa in tempo reale. La scheda deve restare attiva…");
    const controller = new AbortController();
    controllerRef.current = controller;
    setBusy(true);
    try {
      const encoded = await transcodeAudio424(file, format as typeof AUDIO_424_FORMATS[number]["mime"], targetKbps, controller.signal);
      if (controller.signal.aborted) return;
      const url = URL.createObjectURL(encoded.blob);
      outputRef.current = url;
      setOutputUrl(url);
      setResult(encoded);
      setStatus(encoded.savedPercent > 0
        ? `Audio verificato e ridotto del ${encoded.savedPercent.toFixed(2)}%. Ascolta e scarica il risultato.`
        : "Audio valido, ma questo input non è diventato più piccolo. Confronta le misure prima di scaricarlo.");
      recordCompletedTool("audio-generator");
    } catch (error) {
      if (!controller.signal.aborted) setStatus(error instanceof Error ? error.message : "AUDIO_424_TRANSCODE_FAILED");
    } finally {
      if (controllerRef.current === controller) controllerRef.current = null;
      setBusy(false);
    }
  }

  const chosen = AUDIO_424_FORMATS.find(({ mime }) => mime === format);
  return <section class="tool-surface" id="audio-compression-424" data-audio-transcode-424>
    <h3>Comprimi audio · qualità e formato</h3>
    <p class="file-note">Conversione locale con l'encoder già disponibile nel browser. Accetta file audio decodificabili, fino a 12 MiB e 60 s mono/stereo. Il bitrate è una richiesta all'encoder: la dimensione effettiva viene misurata dopo la conversione. MP3 in uscita non è disponibile. Nessun caricamento online.</p>
    <label class="field"><span>File audio locale</span>
      <input type="file" accept="audio/*,.wav,.mp3,.m4a,.ogg,.webm" disabled={busy}
        onChange={(event) => {
          setFile(event.currentTarget.files?.[0] ?? null);
          reset("File selezionato. Scegli formato e qualità, poi comprimi.");
        }} />
    </label>
    <div class="field-grid">
      <label class="field"><span>Formato di uscita</span>
        <select value={format} disabled={busy || !available.length} onChange={(event) => {
          setFormat(event.currentTarget.value); reset("Formato cambiato: serve una nuova conversione.");
        }}>
          {AUDIO_424_FORMATS.map((item) => <option key={item.mime} value={item.mime} disabled={!available.includes(item.mime)}>
            {item.label}{!available.includes(item.mime) ? " · non supportato qui" : ""}
          </option>)}
        </select>
      </label>
      <label class="field"><span>Qualità richiesta · kbps</span>
        <select value={targetKbps} disabled={busy} onChange={(event) => {
          setTargetKbps(Number(event.currentTarget.value)); reset("Qualità cambiata: serve una nuova conversione.");
        }}>
          {AUDIO_424_BITRATES_KBPS.map((kbps) => <option key={kbps} value={kbps}>{kbps} kbps</option>)}
        </select>
      </label>
    </div>
    {available.length === 0 && <p role="alert">AUDIO_424_ENCODER_UNSUPPORTED: questo browser non offre gli encoder richiesti. Nessuna conversione fittizia.</p>}
    <div class="actions">
      <button type="button" disabled={busy || !file || file.size > AUDIO_424_MAX_INPUT_BYTES || !available.includes(format)}
        onClick={() => void compress()}>Comprimi audio</button>
      <button type="button" disabled={!busy} onClick={() => { controllerRef.current?.abort(); setStatus("Conversione annullata: nessun nuovo file pubblicato."); }}>Annulla</button>
    </div>
    <p role="status" aria-live="polite" data-audio-424-status>{status}</p>
    {result && chosen && <section data-audio-424-result>
      <h4>Risultato misurato</h4>
      <dl>
        <dt>Formato e codec verificati dai byte</dt><dd>{result.container} · {result.codec}</dd>
        <dt>Bitrate richiesto (indicativo)</dt><dd>{result.requestedKbps} kbps</dd>
        <dt>Bitrate medio reale (file/durata)</dt><dd>{result.actualKbps.toFixed(2)} kbps</dd>
        <dt>Dimensione prima → dopo</dt><dd>{result.inputBytes.toLocaleString("it-IT")} → {result.outputBytes.toLocaleString("it-IT")} byte</dd>
        <dt>Risparmio misurato</dt><dd>{result.savedPercent.toFixed(2)}%</dd>
        <dt>Durata decodificata del risultato</dt><dd>{result.durationSeconds.toFixed(2)} s</dd>
      </dl>
      <p class="file-note">Verificati container, codec, decodifica, durata e livello del segnale. La qualità percettiva varia in base al browser: ascolta prima di scaricare.</p>
      <audio controls preload="metadata" src={outputUrl} aria-label="Ascolta audio compresso" />
      <div class="actions"><a href={outputUrl} download={`audio-compresso-424.${chosen.extension}`}>Scarica audio verificato</a></div>
    </section>}
  </section>;
}
