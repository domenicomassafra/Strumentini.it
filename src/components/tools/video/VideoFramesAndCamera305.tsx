import { useEffect, useRef, useState } from "preact/hooks";
import type { VideoFrame305Result } from "../../../engines/video/frame-extract-305";

/** Opt-in local frame extraction and camera test. No upload, recorder or webcam auto-start. */
export function VideoFramesAndCamera305() {
  const fileVideo = useRef<HTMLVideoElement>(null);
  const cameraVideo = useRef<HTMLVideoElement>(null);
  const cameraStream = useRef<MediaStream | null>(null);
  const cameraVersion = useRef(0);
  const fileUrl = useRef("");
  const resultUrl = useRef("");
  const extraction = useRef<AbortController | null>(null);
  const generation = useRef(0);
  const [file, setFile] = useState<File | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [requested, setRequested] = useState("0.4");
  const [frame, setFrame] = useState<VideoFrame305Result | null>(null);
  const [frameStatus, setFrameStatus] = useState("Seleziona un video locale. Non verrà caricato in rete.");
  const [busy, setBusy] = useState(false);
  const [cameraStatus, setCameraStatus] = useState("Camera inattiva. Il browser chiede il permesso solo su tua richiesta.");
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraBusy, setCameraBusy] = useState(false);

  function clearResult() {
    if (resultUrl.current) URL.revokeObjectURL(resultUrl.current);
    resultUrl.current = "";
    setFrame(null);
  }

  function stopCamera() {
    cameraVersion.current += 1;
    for (const track of cameraStream.current?.getTracks() ?? []) track.stop();
    cameraStream.current = null;
    if (cameraVideo.current) cameraVideo.current.srcObject = null;
    setCameraActive(false);
    setCameraBusy(false);
    setCameraStatus("Camera disattivata; tracce locali rilasciate.");
  }

  useEffect(() => () => {
    generation.current++;
    cameraVersion.current++;
    extraction.current?.abort();
    if (fileUrl.current) URL.revokeObjectURL(fileUrl.current);
    if (resultUrl.current) URL.revokeObjectURL(resultUrl.current);
    for (const track of cameraStream.current?.getTracks() ?? []) track.stop();
  }, []);

  function choose(next: File | null) {
    generation.current++;
    extraction.current?.abort();
    extraction.current = null;
    setBusy(false);
    setLoaded(false);
    clearResult();
    if (fileUrl.current) URL.revokeObjectURL(fileUrl.current);
    fileUrl.current = "";
    setFile(null);
    if (fileVideo.current) fileVideo.current.removeAttribute("src");
    if (!next) { setFrameStatus("Seleziona un video locale."); return; }
    if (next.size === 0 || next.size > 50 * 1024 * 1024) {
      setFrameStatus("File non accettato: massimo 50 MiB; nessuna decodifica avviata.");
      return;
    }
    fileUrl.current = URL.createObjectURL(next);
    setFile(next);
    if (fileVideo.current) { fileVideo.current.src = fileUrl.current; fileVideo.current.load(); }
    setFrameStatus("Caricamento metadati locale; nessun frame estratto.");
  }

  async function capture() {
    const video = fileVideo.current;
    if (!video || !loaded || extraction.current) return;
    const point = Number(requested);
    const abort = new AbortController();
    extraction.current = abort;
    const current = ++generation.current;
    clearResult();
    setBusy(true);
    setFrameStatus("Ricerca del fotogramma decodificato dal browser…");
    try {
      const { captureVideoFrame305 } = await import("../../../engines/video/frame-extract-305");
      const result = await captureVideoFrame305(video, point, abort.signal);
      if (abort.signal.aborted || current !== generation.current) return;
      resultUrl.current = URL.createObjectURL(result.blob);
      setFrame(result);
      setFrameStatus("PNG creato localmente. Il timestamp effettivo è mostrato soltanto se verificato dal browser.");
    } catch (error) {
      if (!abort.signal.aborted && current === generation.current) setFrameStatus(error instanceof Error ? error.message : "Estrazione non disponibile.");
    } finally {
      if (extraction.current === abort) extraction.current = null;
      if (current === generation.current) setBusy(false);
    }
  }

  function cancelFrame() {
    generation.current++;
    extraction.current?.abort();
    extraction.current = null;
    clearResult();
    setBusy(false);
    setFrameStatus("Estrazione annullata; nessun PNG pubblicato.");
  }

  async function startCamera() {
    if (cameraBusy || cameraStream.current) return;
    const version = ++cameraVersion.current;
    setCameraBusy(true);
    setCameraStatus("Richiesta di permesso alla camera in corso…");
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("Camera non supportata o origine non sicura.");
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      if (version !== cameraVersion.current) {
        for (const track of stream.getTracks()) track.stop();
        return;
      }
      cameraStream.current = stream;
      for (const track of stream.getTracks()) track.addEventListener("ended", () => {
        if (cameraStream.current === stream) stopCamera();
      }, { once: true });
      if (cameraVideo.current) {
        cameraVideo.current.srcObject = stream;
        await cameraVideo.current.play().catch(() => undefined);
      }
      setCameraActive(true);
      setCameraStatus("Camera attiva localmente; nessun video registrato o inviato.");
    } catch (error) {
      if (version !== cameraVersion.current) return;
      stopCamera();
      setCameraStatus(error instanceof Error ? `Camera non disponibile/permesso negato: ${error.name}` : "Camera non disponibile.");
    } finally { if (version === cameraVersion.current) setCameraBusy(false); }
  }

  return <section class="tool-surface" data-video-frame-camera-305>
    <h2>Fotogramma locale e prova webcam</h2>
    <p class="file-note">Funzione sperimentale: decodifica nel browser, senza transcoder o caricamenti. Il seek può cadere su un fotogramma vicino: l'esattezza temporale viene dichiarata solo se il browser fornisce un timestamp di presentazione.</p>
    <div class="field-grid">
      <label class="field"><span>Video locale (massimo 50 MiB)</span><input type="file" accept=".mp4,.webm,.m4v,video/mp4,video/webm" onChange={(event) => choose(event.currentTarget.files?.[0] ?? null)} /></label>
      <label class="field"><span>Timestamp richiesto, secondi</span><input type="number" min="0" step="0.001" value={requested} onInput={(event) => { setRequested(event.currentTarget.value); clearResult(); }} /></label>
    </div>
    <video ref={fileVideo} muted playsInline preload="metadata" style={{ display: "none" }} onLoadedMetadata={() => setLoaded(true)} onError={() => { setLoaded(false); setFrameStatus("Formato o codec non decodificabile da questo browser."); }} />
    {loaded && file && <p class="file-note">Sorgente: {file.name}; durata dichiarata {Number(fileVideo.current?.duration ?? 0).toFixed(3)} s; dimensioni {fileVideo.current?.videoWidth} × {fileVideo.current?.videoHeight}</p>}
    <div class="actions">
      <button type="button" disabled={!loaded || busy} onClick={() => void capture()}>Estrai fotogramma PNG</button>
      <button type="button" disabled={!busy} onClick={cancelFrame}>Annulla estrazione</button>
    </div>
    <p role="status" aria-live="polite" data-frame-status>{frameStatus}</p>
    {frame && resultUrl.current && <section aria-label="PNG del fotogramma" data-frame-result>
      <p>Richiesto: {frame.requestedSeconds.toFixed(3)} s. {frame.reportedPresentationSeconds === null
        ? "Timestamp effettivo non verificabile dal browser; precisione sconosciuta."
        : `Timestamp di presentazione dichiarato dal browser: ${frame.reportedPresentationSeconds.toFixed(3)} s; errore assoluto: ${frame.absoluteErrorSeconds!.toFixed(3)} s.`}
      </p>
      <img src={resultUrl.current} alt="Fotogramma locale estratto" style={{ display: "block", maxWidth: "100%", maxHeight: "260px" }} />
      <a href={resultUrl.current} download="fotogramma-locale.png">Scarica fotogramma PNG</a>
    </section>}
    <h3>Prova webcam (senza registrazione)</h3>
    <p class="file-note">Il permesso è richiesto solo premendo Attiva. La camera viene rilasciata con Disattiva, alla revoca del permesso o all'uscita dalla pagina.</p>
    <div class="actions">
      <button type="button" disabled={cameraBusy || cameraActive} onClick={() => void startCamera()}>Attiva camera</button>
      <button type="button" disabled={!cameraActive && !cameraBusy} onClick={stopCamera}>Disattiva camera</button>
    </div>
    <p role="status" aria-live="polite" data-camera-status>{cameraStatus}</p>
    <video ref={cameraVideo} playsInline muted autoplay={false} style={{ display: cameraActive ? "block" : "none", maxWidth: "100%", maxHeight: "260px" }} aria-label="Anteprima webcam locale" />
  </section>;
}
