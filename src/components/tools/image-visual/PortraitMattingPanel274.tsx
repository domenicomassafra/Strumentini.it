import { useEffect, useRef, useState } from "preact/hooks";
import { checkPortraitInput, PORTRAIT_LOCAL_FILES, PORTRAIT_MODEL_REVISION, PORTRAIT_MAX_FILE_BYTES, PORTRAIT_MAX_PIXELS, PORTRAIT_TIMEOUT_MS } from "../../../engines/image/portrait-modnet-274";

type Reply = { kind: "progress"; message: string } | { kind: "error"; code: string }
  | { kind: "result"; bytes: ArrayBuffer; width: number; height: number; transparent: number; opaque: number; mixed: number };

function readableError(code: string): string {
  if (code === "FILE_SIZE_LIMIT") return "Il file deve avere dimensione tra 64 byte e 8 MiB.";
  if (code === "PIXEL_LIMIT") return "Dimensione massima 1600 pixel per lato e 2 milioni di pixel totali.";
  if (code === "MEMORY_LIMIT") return "Il dispositivo dichiara meno di 4 GiB di RAM. Rifiuto per limitare l'uso di memoria.";
  if (code === "MASK_DEGENERATE") return "La maschera del ritratto è risultata uniforme; nessun PNG ingannevole è stato prodotto.";
  if (code === "TIMEOUT") return "Tempo limite di 120 secondi superato: processo interrotto.";
  return `Rimozione sfondo non disponibile (${code.replace(/[^a-zA-Z0-9:_ -]/gu, "").slice(0, 80)}). Verifica formato, memoria e supporto WASM del browser.`;
}

export function PortraitMattingPanel274() {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("Modello inattivo: il download parte solo dopo il consenso.");
  const [result, setResult] = useState<{ url: string; width: number; height: number; transparent: number; opaque: number; mixed: number } | null>(null);
  const worker = useRef<Worker | null>(null);
  const preload = useRef<AbortController | null>(null);
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const generation = useRef(0);
  const resultUrl = useRef<string | null>(null);

  function stop() {
    worker.current?.terminate(); worker.current = null;
    preload.current?.abort(); preload.current = null;
    if (timeout.current !== null) clearTimeout(timeout.current);
    timeout.current = null;
  }
  function clearResult() {
    if (resultUrl.current) URL.revokeObjectURL(resultUrl.current);
    resultUrl.current = null;
    setResult(null);
  }
  useEffect(() => {
    const onLeave = () => { generation.current++; stop(); clearResult(); };
    window.addEventListener("pagehide", onLeave);
    return () => { window.removeEventListener("pagehide", onLeave); onLeave(); };
  }, []);

  function cancel() {
    generation.current++;
    stop(); setBusy(false);
    setStatus("Operazione annullata: Worker terminato, nessun file caricato su un server.");
  }

  function choose(next: File | null) {
    if (busy) cancel();
    else generation.current++;
    clearResult(); setFile(next);
    setStatus("Pronto: premi Avvia per caricare modello e WASM dal sito.");
  }

  function freeModelMemory() {
    generation.current++;
    stop();
    setStatus("Memoria del modello liberata. Il PNG già creato rimane scaricabile.");
  }

  async function start() {
    if (!file || busy) return;
    const id = ++generation.current;
    setBusy(true); clearResult(); setStatus("Validazione locale dell'immagine…");
    try {
      if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) throw new Error("UNSUPPORTED_IMAGE");
      if (file.size < 64 || file.size > PORTRAIT_MAX_FILE_BYTES) throw new Error("FILE_SIZE_LIMIT");
      const image = await createImageBitmap(file);
      const { width, height } = image;
      image.close();
      checkPortraitInput(file.size, width, height, (navigator as Navigator & { deviceMemory?: number }).deviceMemory);
      if (generation.current !== id) return;
      const bytes = await file.arrayBuffer();
      if (generation.current !== id) return;
      const preloadController = new AbortController();
      preload.current = preloadController;
      timeout.current = setTimeout(() => {
        if (generation.current === id) {
          stop(); setBusy(false); setStatus(readableError("TIMEOUT"));
        }
      }, PORTRAIT_TIMEOUT_MS);
      // Warm CacheStorage in the page. WebKit workers can read this cache but
      // discard entries written from a Worker when the Worker terminates.
      // The model is fetched only after the explicit user click.
      if (typeof caches !== "undefined") {
        try {
          const cache = await caches.open("portrait-modnet-274");
          for (const path of PORTRAIT_LOCAL_FILES) {
            if (generation.current !== id) return;
            const url = new URL(path, window.location.origin).href;
            if (await cache.match(url)) continue;
            setStatus("Download del modello autorizzato dal sito e preparazione cache locale…");
            const response = await fetch(url, { signal: preloadController.signal });
            if (!response.ok) throw new Error("MODEL_NOT_AVAILABLE");
            await cache.put(url, response);
          }
        } catch (error) {
          if (generation.current !== id || preloadController.signal.aborted) return;
          // Private browsing and storage quotas may disable persistence.
          // The Worker can still perform same-origin inference without it.
          if (error instanceof Error && error.message === "MODEL_NOT_AVAILABLE") throw error;
        }
      }
      preload.current = null;
      if (generation.current !== id) return;
      // Keep the already loaded Worker while this page remains open. Starting a
      // fresh module Worker would require network access even after its model
      // files were cached, making the next offline run fail before inference.
      const instance = worker.current ?? new Worker(new URL("../../../engines/image/portrait-modnet-worker-274.ts", import.meta.url), { type: "module" });
      worker.current = instance;
      instance.onerror = () => {
        if (generation.current !== id) return;
        stop(); setBusy(false); setStatus(readableError("WORKER_ERROR"));
      };
      instance.onmessage = (event: MessageEvent<Reply>) => {
        if (generation.current !== id) return;
        const message = event.data;
        if (message.kind === "progress") setStatus(message.message);
        if (message.kind === "error") {
          stop(); setBusy(false); setStatus(readableError(message.code));
        }
        if (message.kind === "result") {
          if (timeout.current !== null) clearTimeout(timeout.current);
          timeout.current = null;
          setBusy(false);
          const url = URL.createObjectURL(new Blob([message.bytes], { type: "image/png" }));
          resultUrl.current = url;
          setResult({ url, width: message.width, height: message.height, transparent: message.transparent, mixed: message.mixed, opaque: message.opaque });
          setStatus("PNG RGBA decodificato e verificato localmente. Controlla visivamente capelli, contorni e sfondi complessi.");
        }
      };
      instance.postMessage({ kind: "start", bytes, mime: file.type, memoryGB: (navigator as Navigator & { deviceMemory?: number }).deviceMemory }, [bytes]);
      setStatus("Caricamento dal sito: download autorizzato, nessuna immagine inviata in rete…");
    } catch (error) {
      if (generation.current !== id) return;
      stop(); setBusy(false);
      setStatus(readableError(error instanceof Error ? error.message : "UNKNOWN_ERROR"));
    }
  }

  return <section class="tool-surface" data-portrait-274 aria-label="Laboratorio rimozione sfondo ritratto">
    <h2>Rimozione sfondo ritratti · esperimento locale</h2>
    <p>Solo persone e ritratti. MODNet costruisce un alpha matte per capelli e bordi tramite Transformers.js e WASM. Non è un modello per oggetti generici. Il file resta nel browser; modello quantizzato (6,6 MB) e runtime (circa 14 MB) si scaricano solo dopo Avvia, dallo stesso sito, e possono restare nella cache HTTP. Anche offline funziona soltanto dopo aver caricato gli asset in cache; la disponibilità dipende dalla cache del browser.</p>
    <p>JPG, PNG o WebP fino a 8 MiB, massimo 1600 px per lato e {PORTRAIT_MAX_PIXELS.toLocaleString("it-IT")} pixel. Richiede WebAssembly e memoria disponibile; i browser con RAM dichiarata inferiore a 4 GiB vengono rifiutati. Puoi interrompere il Worker; nessun fallback verso servizi remoti.</p>
    <label class="field"><span>Fotografia ritratto</span><input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={(e) => choose(e.currentTarget.files?.[0] ?? null)} /></label>
    {file && <p>Input: {file.name} ({file.size.toLocaleString("it-IT")} byte)</p>}
    <div class="tool-actions"><button type="button" disabled={!file || busy} onClick={() => void start()}>Avvia (autorizzo il download locale)</button>
      {busy && <button type="button" onClick={cancel}>Annulla e libera memoria</button>}
      {!busy && worker.current && <button type="button" onClick={freeModelMemory}>Libera memoria del modello</button>}
    </div>
    <p role="status" aria-live="polite">{status}</p>
    {result && <section aria-label="Risultato PNG trasparente"><h3>PNG RGBA · {result.width}×{result.height}</h3>
      <img src={result.url} alt="Anteprima del ritratto con sfondo trasparente" style="max-width: 100%; max-height: 500px; object-fit: contain; background: repeating-conic-gradient(#ddd 0% 25%, #fff 0% 50%) 0 0 / 20px 20px;" />
      <p data-alpha-counts>Alpha: {result.transparent} trasparenti, {result.mixed} semitrasparenti, {result.opaque} opachi.</p>
      <a href={result.url} download="ritratto-sfondo-trasparente.png">Scarica PNG trasparente</a>
    </section>}
    <p><small>MODNet Xenova · revisione {PORTRAIT_MODEL_REVISION.slice(0, 12)} · q8 CPU/WASM. Valutazione in corso; qualità capelli, Safari mobile e dispositivi reali non certificati Gold.</small></p>
  </section>;
}
