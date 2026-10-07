import { useEffect, useRef, useState } from "preact/hooks";
import {
  chooseSupportedRecorderMimeType,
  deriveRecordedBlobType,
  extensionForRecordedMimeType,
  pauseRecordingClock,
  recordingDurationMs,
  resumeRecordingClock,
  rmsAudioLevel,
  startRecordingClock,
  type RecordingClock,
} from "../../engines/browser-audio";

const MAX_RECORDING_MS = 15 * 60 * 1000;
const MAX_RECORDING_BYTES = 256 * 1024 * 1024;

interface RecordingResult {
  readonly url: string;
  readonly bytes: number;
  readonly mimeType: string;
  readonly durationMs: number;
  readonly filename: string;
}

interface TrackHealth {
  readonly label: string;
  readonly readyState: MediaStreamTrackState;
  readonly muted: boolean;
  readonly enabled: boolean;
}

function accessErrorMessage(error: unknown): string {
  if (error instanceof DOMException) {
    if (error.name === "NotAllowedError" || error.name === "SecurityError") {
      return "Accesso al microfono negato o revocato. Puoi cambiare il permesso del sito e riprovare.";
    }
    if (error.name === "NotFoundError") return "Nessun microfono disponibile. Collega o abilita un dispositivo e riprova.";
    if (error.name === "NotReadableError" || error.name === "AbortError") {
      return "Il microfono non è leggibile in questo momento. Chiudi eventuali app che lo stanno usando e riprova.";
    }
  }
  return "Non riesco ad aprire il microfono. Controlla i permessi del browser e riprova.";
}

export function MicrophoneRecorderTool() {
  const [status, setStatus] = useState("Il microfono non viene richiesto finché non premi Attiva microfono.");
  const [mediaSupported, setMediaSupported] = useState(false);
  const [hasMicrophone, setHasMicrophone] = useState(false);
  const [health, setHealth] = useState<TrackHealth | null>(null);
  const [level, setLevel] = useState(0);
  const [recorderState, setRecorderState] = useState<RecordingState>("inactive");
  const [durationMs, setDurationMs] = useState(0);
  const [result, setResult] = useState<RecordingResult | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const chunkBytesRef = useRef(0);
  const clockRef = useRef<RecordingClock | null>(null);
  const stopReasonRef = useRef<string | null>(null);
  const revokedRef = useRef(false);
  const discardOnStopRef = useRef(false);
  const resultUrlRef = useRef<string | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const meterFrameRef = useRef<number | null>(null);

  function clearResult() {
    if (resultUrlRef.current !== null) URL.revokeObjectURL(resultUrlRef.current);
    resultUrlRef.current = null;
    setResult(null);
  }

  function closeMeter() {
    if (meterFrameRef.current !== null) cancelAnimationFrame(meterFrameRef.current);
    meterFrameRef.current = null;
    try { sourceRef.current?.disconnect(); } catch {}
    sourceRef.current = null;
    analyserRef.current = null;
    const context = audioContextRef.current;
    audioContextRef.current = null;
    if (context !== null) void context.close().catch(() => undefined);
    setLevel(0);
  }

  function releaseMicrophone() {
    closeMeter();
    const stream = streamRef.current;
    streamRef.current = null;
    for (const track of stream?.getTracks() ?? []) {
      track.onended = null;
      track.onmute = null;
      track.onunmute = null;
      try { track.stop(); } catch {}
    }
    setHasMicrophone(false);
    setHealth(null);
  }

  function refreshHealth(track: MediaStreamTrack) {
    setHealth({
      label: track.label || "Microfono autorizzato",
      readyState: track.readyState,
      muted: track.muted,
      enabled: track.enabled,
    });
  }

  function currentDuration(nowMs = performance.now()): number {
    const clock = clockRef.current;
    return clock === null ? 0 : recordingDurationMs(clock, nowMs);
  }

  function requestStop(reason: string) {
    const recorder = recorderRef.current;
    if (recorder === null || recorder.state === "inactive") return;
    stopReasonRef.current = reason;
    try {
      recorder.stop();
    } catch {
      recorderRef.current = null;
      chunksRef.current = [];
      chunkBytesRef.current = 0;
      clockRef.current = null;
      releaseMicrophone();
      setRecorderState("inactive");
      setStatus("Il registratore non ha completato lo stop. Il microfono è stato comunque rilasciato.");
    }
  }

  function startMeter(stream: MediaStream) {
    const AudioContextConstructor = window.AudioContext
      ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (AudioContextConstructor === undefined) return;
    try {
      const context = new AudioContextConstructor();
      const analyser = context.createAnalyser();
      analyser.fftSize = 1024;
      const source = context.createMediaStreamSource(stream);
      source.connect(analyser);
      audioContextRef.current = context;
      sourceRef.current = source;
      analyserRef.current = analyser;
      const samples = new Float32Array(analyser.fftSize);
      const tick = () => {
        if (analyserRef.current === null) return;
        analyser.getFloatTimeDomainData(samples);
        setLevel(rmsAudioLevel(samples));
        const recorder = recorderRef.current;
        if (recorder !== null && recorder.state !== "inactive") {
          const measured = currentDuration();
          setDurationMs(measured);
          if (measured >= MAX_RECORDING_MS) requestStop("Limite di 15 minuti raggiunto: registrazione fermata.");
        }
        meterFrameRef.current = requestAnimationFrame(tick);
      };
      meterFrameRef.current = requestAnimationFrame(tick);
    } catch {
      setLevel(0);
    }
  }

  async function activateMicrophone() {
    if (!mediaSupported) {
      setStatus("Questo browser non espone getUserMedia e MediaRecorder. Usa un browser che li supporta e ricarica la pagina.");
      return;
    }
    if (recorderRef.current !== null && recorderRef.current.state !== "inactive") {
      requestStop("Registrazione fermata prima di riaprire il microfono.");
      return;
    }
    releaseMicrophone();
    revokedRef.current = false;
    setStatus("Richiesta del microfono in corso…");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      const track = stream.getAudioTracks()[0];
      if (track === undefined) {
        for (const item of stream.getTracks()) item.stop();
        setStatus("Il browser ha restituito uno stream senza traccia audio. Riprova con un altro microfono.");
        return;
      }
      streamRef.current = stream;
      setHasMicrophone(true);
      refreshHealth(track);
      track.onmute = () => refreshHealth(track);
      track.onunmute = () => refreshHealth(track);
      track.onended = () => {
        revokedRef.current = true;
        refreshHealth(track);
        if (recorderRef.current !== null && recorderRef.current.state !== "inactive") {
          requestStop("Accesso al microfono terminato durante la registrazione.");
        } else {
          releaseMicrophone();
          setStatus("Accesso al microfono terminato o revocato. Correggi il permesso/dispositivo e premi Riprova microfono.");
        }
      };
      startMeter(stream);
      setStatus("Microfono attivo. Il livello qui sotto usa solo campioni locali e non viene inviato in rete.");
    } catch (error) {
      releaseMicrophone();
      setStatus(accessErrorMessage(error));
    }
  }

  function startRecording() {
    const stream = streamRef.current;
    const track = stream?.getAudioTracks()[0];
    if (!mediaSupported || stream === null || track === undefined || track.readyState !== "live") {
      setStatus("Attiva prima un microfono disponibile.");
      return;
    }
    clearResult();
    chunksRef.current = [];
    chunkBytesRef.current = 0;
    stopReasonRef.current = null;
    revokedRef.current = false;
    discardOnStopRef.current = false;
    const supportedProbe = typeof MediaRecorder.isTypeSupported === "function"
      ? MediaRecorder.isTypeSupported.bind(MediaRecorder)
      : undefined;
    const mimeType = chooseSupportedRecorderMimeType(supportedProbe);
    let recorder: MediaRecorder;
    try {
      recorder = mimeType === null ? new MediaRecorder(stream) : new MediaRecorder(stream, { mimeType });
    } catch (error) {
      setStatus(error instanceof Error ? `MediaRecorder non può partire: ${error.message}` : "MediaRecorder non può partire con questo microfono.");
      return;
    }
    recorderRef.current = recorder;
    recorder.ondataavailable = (event) => {
      if (discardOnStopRef.current || event.data.size <= 0) return;
      if (chunkBytesRef.current + event.data.size > MAX_RECORDING_BYTES) {
        stopReasonRef.current = "Limite locale di 256 MiB raggiunto: registrazione fermata.";
        if (recorder.state !== "inactive") requestStop(stopReasonRef.current);
        return;
      }
      chunksRef.current.push(event.data);
      chunkBytesRef.current += event.data.size;
      if (chunkBytesRef.current === MAX_RECORDING_BYTES && recorder.state !== "inactive") {
        requestStop("Limite locale di 256 MiB raggiunto: registrazione fermata.");
      }
    };
    recorder.onstart = () => {
      clockRef.current = startRecordingClock(performance.now());
      setDurationMs(0);
      setRecorderState(recorder.state);
      setStatus(`Registrazione avviata. Formato scelto dal runtime: ${recorder.mimeType || "non dichiarato dal browser"}.`);
    };
    recorder.onpause = () => {
      if (clockRef.current !== null) clockRef.current = pauseRecordingClock(clockRef.current, performance.now());
      setDurationMs(currentDuration());
      setRecorderState(recorder.state);
      setStatus("Registrazione in pausa.");
    };
    recorder.onresume = () => {
      if (clockRef.current !== null) clockRef.current = resumeRecordingClock(clockRef.current, performance.now());
      setRecorderState(recorder.state);
      setStatus("Registrazione ripresa.");
    };
    recorder.onerror = () => {
      stopReasonRef.current = "Il browser ha segnalato un errore durante la registrazione.";
    };
    recorder.onstop = () => {
      if (discardOnStopRef.current) {
        discardOnStopRef.current = false;
        recorderRef.current = null;
        chunksRef.current = [];
        chunkBytesRef.current = 0;
        clockRef.current = null;
        setDurationMs(0);
        setRecorderState("inactive");
        releaseMicrophone();
        clearResult();
        setStatus("Ripristinato. Il microfono verrà richiesto solo dopo un nuovo clic su Attiva microfono.");
        return;
      }
      if (clockRef.current !== null) clockRef.current = pauseRecordingClock(clockRef.current, performance.now());
      const measuredDuration = Math.max(0, Math.round(currentDuration()));
      setDurationMs(measuredDuration);
      const chunks = chunksRef.current;
      const blobType = deriveRecordedBlobType(chunks, recorder.mimeType);
      const blob = new Blob(chunks, blobType === "" ? undefined : { type: blobType });
      const finalMimeType = blob.type || "non dichiarato dal browser";
      if (blob.size > 0) {
        const url = URL.createObjectURL(blob);
        resultUrlRef.current = url;
        setResult({
          url,
          bytes: blob.size,
          mimeType: finalMimeType,
          durationMs: measuredDuration,
          filename: `registrazione-audio.${extensionForRecordedMimeType(blob.type)}`,
        });
      } else {
        setResult(null);
      }
      recorderRef.current = null;
      chunksRef.current = [];
      chunkBytesRef.current = 0;
      clockRef.current = null;
      setRecorderState("inactive");
      releaseMicrophone();
      const reason = stopReasonRef.current;
      stopReasonRef.current = null;
      if (revokedRef.current) {
        setStatus(blob.size > 0
          ? "Accesso al microfono terminato o revocato. La parte già registrata resta disponibile localmente; puoi correggere il permesso e riprovare."
          : "Accesso al microfono terminato o revocato. Correggi il permesso e riprova.");
      } else if (blob.size === 0) {
        setStatus(reason ?? "Il browser non ha prodotto dati audio utilizzabili. Puoi riattivare il microfono e riprovare.");
      } else {
        setStatus(reason ?? "Registrazione conclusa. Il microfono è stato rilasciato e il Blob resta solo in questa pagina.");
      }
    };
    try {
      recorder.start(1000);
    } catch (error) {
      recorderRef.current = null;
      setStatus(error instanceof Error ? `MediaRecorder non è partito: ${error.message}` : "MediaRecorder non è partito.");
    }
  }

  function pauseRecording() {
    const recorder = recorderRef.current;
    if (recorder?.state !== "recording") return;
    try { recorder.pause(); } catch { setStatus("Il browser non ha accettato la pausa."); }
  }

  function resumeRecording() {
    const recorder = recorderRef.current;
    if (recorder?.state !== "paused") return;
    try { recorder.resume(); } catch { setStatus("Il browser non ha accettato la ripresa."); }
  }

  function deactivateMicrophone() {
    if (recorderRef.current !== null && recorderRef.current.state !== "inactive") {
      requestStop("Registrazione fermata e microfono rilasciato.");
      return;
    }
    releaseMicrophone();
    setStatus("Microfono disattivato.");
  }

  function reset() {
    if (recorderRef.current !== null && recorderRef.current.state !== "inactive") {
      discardOnStopRef.current = true;
      try { recorderRef.current.stop(); } catch {}
    }
    releaseMicrophone();
    clearResult();
    chunksRef.current = [];
    chunkBytesRef.current = 0;
    clockRef.current = null;
    setDurationMs(0);
    setRecorderState("inactive");
    setStatus("Ripristinato. Il microfono verrà richiesto solo dopo un nuovo clic su Attiva microfono.");
  }

  useEffect(() => {
    setMediaSupported(
      navigator.mediaDevices?.getUserMedia !== undefined
      && typeof MediaRecorder !== "undefined",
    );
    return () => {
      const recorder = recorderRef.current;
      if (recorder !== null && recorder.state !== "inactive") {
        discardOnStopRef.current = true;
        try { recorder.stop(); } catch {}
      }
      const stream = streamRef.current;
      for (const track of stream?.getTracks() ?? []) {
        track.onended = null;
        track.onmute = null;
        track.onunmute = null;
        try { track.stop(); } catch {}
      }
      if (meterFrameRef.current !== null) cancelAnimationFrame(meterFrameRef.current);
      try { sourceRef.current?.disconnect(); } catch {}
      if (audioContextRef.current !== null) void audioContextRef.current.close().catch(() => undefined);
      if (resultUrlRef.current !== null) URL.revokeObjectURL(resultUrlRef.current);
    };
  }, []);

  const seconds = (durationMs / 1000).toFixed(1);

  return <div class="tool-surface" data-microphone-recorder>
    {!mediaSupported && <p class="error" role="alert">Questo browser non espone getUserMedia e MediaRecorder. Puoi usare la pagina senza concedere permessi, ma la registrazione richiede entrambe le API.</p>}

    <p class="file-note">
      Privacy: Strumentini chiede il microfono solo dopo un tuo clic. Stream, campioni del livello e registrazione restano nella memoria del browser;
      il download usa un URL Blob locale. Nessun upload o codec remoto viene usato da questo strumento.
    </p>
    <p class="file-note">Limiti locali: massimo 15 minuti di audio attivo o 256 MiB di chunk. Il formato viene scelto soltanto tra quelli dichiarati supportati dal MediaRecorder del browser; se il browser non espone una scelta, viene usato il suo formato predefinito e mostrato il tipo effettivo del Blob.</p>

    <div class="actions">
      <button type="button" onClick={activateMicrophone} disabled={!mediaSupported || recorderState !== "inactive"}>
        {hasMicrophone ? "Riapri microfono" : status.includes("negato") || status.includes("revocato") || status.includes("terminato") ? "Riprova microfono" : "Attiva microfono"}
      </button>
      <button type="button" onClick={deactivateMicrophone} disabled={!hasMicrophone}>Disattiva microfono</button>
      <button type="button" onClick={reset}>Azzera</button>
    </div>

    {health !== null && <section aria-label="Stato microfono">
      <dl class="result-list">
        <div><dt>Dispositivo</dt><dd>{health.label}</dd></div>
        <div><dt>Traccia</dt><dd>{health.readyState}</dd></div>
        <div><dt>Muted</dt><dd>{health.muted ? "sì" : "no"}</dd></div>
        <div><dt>Enabled</dt><dd>{health.enabled ? "sì" : "no"}</dd></div>
      </dl>
      <label class="field">
        <span>Livello live · RMS locale {Math.round(level * 100)}%</span>
        <progress max={1} value={level} aria-label="Livello microfono" />
      </label>
    </section>}

    <div class="actions">
      <button type="button" onClick={startRecording} disabled={!hasMicrophone || recorderState !== "inactive"}>Registra</button>
      <button type="button" onClick={pauseRecording} disabled={recorderState !== "recording"}>Pausa</button>
      <button type="button" onClick={resumeRecording} disabled={recorderState !== "paused"}>Riprendi</button>
      <button type="button" onClick={() => requestStop("Registrazione fermata dall'utente.")} disabled={recorderState === "inactive"}>Ferma registrazione</button>
    </div>
    <p aria-live="polite">Durata audio attivo misurata: {seconds} s</p>

    {result !== null && <section aria-label="Registrazione locale">
      <h2>Registrazione locale</h2>
      <audio controls src={result.url} preload="metadata">Il browser non supporta la riproduzione audio integrata.</audio>
      <dl class="result-list">
        <div><dt>Tipo Blob effettivo</dt><dd>{result.mimeType}</dd></div>
        <div><dt>Dimensione effettiva</dt><dd>{result.bytes.toLocaleString("it-IT")} byte</dd></div>
        <div><dt>Durata misurata</dt><dd>{(result.durationMs / 1000).toFixed(2)} s</dd></div>
      </dl>
      <div class="actions">
        <a class="button" href={result.url} download={result.filename}>Scarica registrazione</a>
      </div>
    </section>}

    <p role="status" aria-live="polite">{status}</p>
  </div>;
}
