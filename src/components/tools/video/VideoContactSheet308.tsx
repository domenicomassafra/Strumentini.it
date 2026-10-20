import { useEffect, useRef, useState } from "preact/hooks";
import { recordCompletedTool } from "../../../workbench/completed-tool";
import type { ContactSheet308Result } from "../../../engines/video/contact-sheet-308";

/** Additional export mode for the existing #305 decoded-video workspace. */
export function VideoContactSheet308({ video, file }: { readonly video: HTMLVideoElement; readonly file: File }) {
  const [count, setCount] = useState(4);
  const [status, setStatus] = useState("Esporta solo fotogrammi il cui timestamp di presentazione è verificato dal browser.");
  const [busy, setBusy] = useState(false);
  const [progress411, setProgress411] = useState<{ phase: "read" | "frames"; completed: number; total: number } | null>(null);
  const [result, setResult] = useState<ContactSheet308Result | null>(null);
  const abort = useRef<AbortController | null>(null);
  const urls = useRef<string[]>([]);
  const [sheetUrl, setSheetUrl] = useState("");
  const [zipUrl, setZipUrl] = useState("");

  function clearUrls() {
    urls.current.forEach((url) => URL.revokeObjectURL(url));
    urls.current = [];
    setSheetUrl("");
    setZipUrl("");
    setResult(null);
  }

  useEffect(() => () => {
    abort.current?.abort();
    urls.current.forEach((url) => URL.revokeObjectURL(url));
  }, []);
  useEffect(() => {
    // A new source invalidates any pending/finished ZIP from the previous video.
    abort.current?.abort();
    abort.current = null;
    setBusy(false);
    setProgress411(null);
    clearUrls();
  }, [file]);

  function cancel() {
    abort.current?.abort();
    abort.current = null;
    setBusy(false);
    setProgress411(null);
    setStatus("Esportazione annullata: nessun file incompleto disponibile.");
    clearUrls();
  }

  async function exportFrames() {
    if (abort.current) return;
    clearUrls();
    setBusy(true);
    setProgress411(null);
    setStatus("Decodifica sequenziale e verifica timestamp locale…");
    const controller = new AbortController();
    abort.current = controller;
    try {
      const { exportVideoContactSheet308 } = await import("../../../engines/video/contact-sheet-308");
      const exported = await exportVideoContactSheet308(video, file, count, controller.signal,
        (phase, completed, total) => {
          if (abort.current !== controller || controller.signal.aborted) return;
          setProgress411({ phase, completed, total });
          if (phase === "frames" && completed === total) setStatus("Fotogrammi verificati: composizione ZIP in corso, nessuna percentuale di compressione stimata.");
        });
      if (controller.signal.aborted || abort.current !== controller) return;
      const nextSheet = URL.createObjectURL(exported.sheet);
      const nextZip = URL.createObjectURL(exported.zip);
      urls.current = [nextSheet, nextZip];
      setResult(exported);
      setSheetUrl(nextSheet);
      setZipUrl(nextZip);
      setStatus(`Pronto: ${exported.frames.length} PNG, contact sheet e manifest.json in ZIP STORE locale verificato.`);
      recordCompletedTool("video-inspector");
    } catch (error) {
      if (!controller.signal.aborted) setStatus(error instanceof Error ? error.message : "Esportazione non verificabile in questo browser.");
    } finally {
      if (abort.current === controller) { abort.current = null; setBusy(false); setProgress411(null); }
    }
  }

  return <section class="tool-surface" data-video-contact-sheet-308>
    <h3>Contact sheet video e contesto AI (senza AI)</h3>
    <p class="file-note">Crea un archivio locale con PNG numerati, contact sheet e manifest di provenienza con SHA-256. Nessuna interpretazione generata, nessuna richiesta alla rete. Se il browser non conferma un timestamp entro 160 ms, l'esportazione si interrompe senza ZIP.</p>
    <label class="field"><span>Fotogrammi (2–8)</span><input type="number" min="2" max="8" step="1" disabled={busy} value={count} onInput={(event) => { setCount(Number(event.currentTarget.value)); clearUrls(); }} /></label>
    <div class="actions">
      <button type="button" disabled={busy} onClick={() => void exportFrames()}>Genera contact sheet e ZIP</button>
      <button type="button" disabled={!busy} onClick={cancel}>Annulla contact sheet</button>
    </div>
    {busy && progress411 && <p class="file-note" data-media-progress411>
      <progress value={progress411.completed} max={progress411.total}
        aria-label={progress411.phase === "read" ? "Byte video letti" : "Fotogrammi verificati"} />
      {progress411.completed} / {progress411.total} {progress411.phase === "read" ? "byte video letti" : "fotogrammi verificati"}
    </p>}
    <p role="status" data-contact-status aria-live="polite">{status}</p>
    {result && sheetUrl && zipUrl && <section data-contact-result aria-label="Export contact sheet video">
      <p>{result.frames.map((item) => `${item.requestedSeconds.toFixed(3)} → ${item.presentedSeconds.toFixed(3)} s`).join(" · ")}</p>
      <img src={sheetUrl} alt="Contact sheet estratta dal video locale" style={{ display: "block", maxWidth: "100%", maxHeight: "430px" }} />
      <div class="actions">
        <a href={sheetUrl} download="contact-sheet.png">Scarica contact sheet PNG</a>
        <a href={zipUrl} download="video-context.zip">Scarica ZIP con PNG e manifest</a>
      </div>
      <p class="file-note">File ZIP: {result.zipEntries.join(", ")}. Il manifest dichiara solo dati MP4 e timestamp di presentazione verificati.</p>
    </section>}
  </section>;
}
