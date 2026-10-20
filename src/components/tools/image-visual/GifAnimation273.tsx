import { useEffect, useRef, useState } from "preact/hooks";
import { inspectGifBlob } from "../../../engines/image/gif-structure";
import { reencodeAnimatedGif273, type Animation273 } from "../../../engines/image/gif-animation-273";
import { DownloadLink } from "../marketing-media/DownloadLink";

/** Separate, opt-in GIF→animated GIF operation; never changes first-frame exports. */
export function GifAnimation273() {
  const [ready, setReady] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<Animation273 | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const job = useRef<AbortController | null>(null);
  useEffect(() => { setReady(true); return () => job.current?.abort(); }, []);

  async function submit(event: Event) {
    event.preventDefault();
    if (!file || busy) return;
    const controller = new AbortController();
    job.current = controller;
    setBusy(true);
    setResult(null);
    setError("");
    try {
      // The structural inspector is independent of the GIF patch decoder.
      const facts = await inspectGifBlob(file, controller.signal);
      if (!facts.animated) throw Error("Il file è statico: nessuna conversione animata eseguita.");
      const done = await reencodeAnimatedGif273(file, controller.signal);
      if (!controller.signal.aborted) setResult(done);
    } catch (cause) {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Conversione GIF rifiutata.");
    } finally {
      if (job.current === controller) { job.current = null; setBusy(false); }
    }
  }
  return (
    <section class="tool-surface" data-gif-animation-273>
      <h2>GIF animata → GIF animata (separato dalla prima immagine)</h2>
      <p class="file-note">Mantiene numero di fotogrammi e ritardi dichiarati, ricompone gli offset e il disposal GIF 0/1/2/3.
        La palette è esatta fino a 128 colori e approssimata oltre; la trasparenza viene esplicitamente appiattita su bianco.
        Non promette fedeltà dei pixel né conserva la trasparenza originale. Max 30 frame, 256×256 px, 10 secondi, 4 MiB di input.
        Tutto nel browser: nessun upload. Ritardi inferiori a 20 ms sono rifiutati per evitare clamp silenzioso.</p>
      <form onSubmit={submit}>
        <label class="field"><span>GIF animata sorgente</span>
          <input type="file" accept="image/gif,.gif" disabled={!ready || busy} onChange={(event) => {
            job.current?.abort();
            setFile(event.currentTarget.files?.[0] ?? null);
            setResult(null);
            setError("");
          }} />
        </label>
        <button type="submit" disabled={!ready || !file || busy}>{busy ? "Elaborazione locale…" : "Ricrea GIF animata in locale"}</button>
        {busy && <button type="button" onClick={() => { job.current?.abort(); setBusy(false); setResult(null); }}>Annulla</button>}
      </form>
      {error && <p role="alert">{error}</p>}
      {result && <div role="status" data-gif-animation-result>
        <p>{result.frames} frame · {result.width}×{result.height} px · ritardi conservati: {result.delaysCentiseconds.join(", ")} centesimi · ripetizioni: {result.repeat ?? "non dichiarate"}.</p>
        <p>Perdita dichiarata: trasparenza → bianco; oltre 128 colori per frame la palette viene approssimata. Area frame normalizzata a pieno canvas.</p>
        <DownloadLink blob={result.blob} filename="animazione-ricomposta-273.gif">Scarica GIF animata verificata</DownloadLink>
      </div>}
    </section>
  );
}
