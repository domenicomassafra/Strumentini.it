import { useEffect, useRef, useState } from "preact/hooks";
import type { PdfThumbnailSession } from "../../../engines/pdf/thumbnails";
import type { PdfImagePlacement375 } from "../../../engines/pdf/image-placement-375";
import { runPdfImageWorker375 } from "../../../engines/pdf/image-worker-client-375";
import { PdfResultV2, preparePdfResult, type PreparedPdfResult } from "./PdfResultV2";

interface Props {
  file: File;
  session: PdfThumbnailSession;
}

export function PdfImagePlacement375({ file, session }: Props) {
  const [image, setImage] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");
  const [imageSize, setImageSize] = useState({ width: 1, height: 1 });
  const [pageSize, setPageSize] = useState({ width: 176, height: 208 });
  const [placement, setPlacement] = useState<PdfImagePlacement375>({ page: 1, x: 0.12, y: 0.12, width: 0.3, rotation: 0 });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<PreparedPdfResult | null>(null);
  const active = useRef<AbortController | null>(null);
  const previewRef = useRef<HTMLDivElement | null>(null);
  const chooseSequence = useRef(0);
  const dragRef = useRef<{ pointerId: number; x: number; y: number; left: number; top: number } | null>(null);

  useEffect(() => {
    if (!image) { setImageUrl(""); return; }
    const url = URL.createObjectURL(image);
    setImageUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [image]);

  useEffect(() => {
    let disposed = false;
    const controller = new AbortController();
    let url = "";
    setPreviewUrl("");
    void session.renderPage(placement.page, 0, controller.signal).then((blob) => {
      if (disposed) return;
      url = URL.createObjectURL(blob);
      setPreviewUrl(url);
    }).catch((reason) => {
      if (!disposed) setError("Anteprima PDF non disponibile: " + (reason instanceof Error ? reason.message : "errore"));
    });
    return () => { disposed = true; controller.abort(); if (url) URL.revokeObjectURL(url); };
  }, [session, placement.page]);

  useEffect(() => () => active.current?.abort(), []);

  async function chooseImage(next: File | null) {
    const sequence = ++chooseSequence.current;
    setImage(null);
    setResult(null);
    setError("");
    if (next === null) return;
    if (next.size > 12 * 1024 * 1024) { setError("Immagine oltre 12 MiB"); return; }
    try {
      const { inspectPdfImage375 } = await import("../../../engines/pdf/image-placement-375");
      inspectPdfImage375(new Uint8Array(await next.arrayBuffer()));
      if (sequence === chooseSequence.current) setImage(next);
    } catch (reason) {
      if (sequence === chooseSequence.current) {
        setError(reason instanceof Error ? reason.message : "Immagine non supportata");
      }
    }
  }

  function change(next: Partial<PdfImagePlacement375>) {
    if (busy) return;
    setPlacement((current) => ({ ...current, ...next }));
    setResult(null);
    setError("");
  }
  const width = placement.width * pageSize.width;
  const aspect = placement.rotation % 180 === 0
    ? imageSize.height / imageSize.width : imageSize.width / imageSize.height;
  const height = width * aspect;
  const heightRatio = height / pageSize.height;
  const valid = Number.isFinite(heightRatio) && heightRatio > 0 &&
    placement.x + placement.width <= 1.000001 && placement.y + heightRatio <= 1.000001;
  const maxX = Math.max(0, 1 - placement.width);
  const maxY = Math.max(0, 1 - heightRatio);

  function startDrag(event: PointerEvent) {
    if (busy || !valid) return;
    event.preventDefault();
    dragRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY,
      left: placement.x, top: placement.y };
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  }
  function moveDrag(event: PointerEvent) {
    const start = dragRef.current, rect = previewRef.current?.getBoundingClientRect();
    if (!start || event.pointerId !== start.pointerId || !rect?.width || !rect.height || busy) return;
    change({ x: Math.max(0, Math.min(maxX, start.left + (event.clientX - start.x) / rect.width)),
      y: Math.max(0, Math.min(maxY, start.top + (event.clientY - start.y) / rect.height)) });
  }

  async function save() {
    if (!image || busy || !valid || active.current) return;
    const controller = new AbortController();
    active.current = controller;
    setBusy(true);
    setResult(null);
    setError("");
    try {
      const artifact = await runPdfImageWorker375(file, image, placement, controller.signal);
      if (controller.signal.aborted) return;
      const prepared = await preparePdfResult("pdf-page-reorder", {
        artifacts: [artifact], artifactCount: 1, operation: "insert-image",
        page: placement.page, placement, policy: "Modifica locale e originale intatto. File riaperto e verificato prima di scaricare.",
      });
      if (controller.signal.aborted || active.current !== controller) return;
      if (prepared.artifacts.length !== 1 || prepared.artifacts[0]?.artifact.verification.state !== "verified") {
        throw new Error("PDF_VERIFY: Il PDF generato non ha superato la verifica");
      }
      setResult(prepared);
    } catch (reason) {
      if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "PDF non elaborabile");
    } finally {
      if (active.current === controller) { active.current = null; setBusy(false); }
    }
  }

  return <section data-pdf-image-375>
    <p class="file-note">Aggiungi un PNG o JPEG al PDF, trascinalo nell’anteprima e regolane le dimensioni. Lavora solo sul dispositivo.</p>
    <label class="field"><span>Immagine da inserire</span>
      <input type="file" accept="image/png,image/jpeg,.png,.jpg,.jpeg" disabled={busy} aria-label="Immagine da inserire"
        onChange={(event) => void chooseImage(event.currentTarget.files?.[0] ?? null)} />
      <small>RGB JPEG oppure PNG RGB/RGBA 8 bit, massimo 12 MiB e 16 megapixel. Profili speciali rifiutati.</small>
    </label>
    {error && !image && <p role="alert">{error}</p>}
    {image && <>
      <div class="actions">
        <label>Pagina <input aria-label="Pagina per immagine" type="number" min="1" max={session.pageCount}
          value={placement.page} disabled={busy}
          onInput={(event) => { const page = Number(event.currentTarget.value);
            if (Number.isInteger(page) && page >= 1 && page <= session.pageCount) change({ page }); }}
          style={{ width: "5rem" }} /> di {session.pageCount}</label>
        <label>Rotazione <select aria-label="Ruota immagine" value={String(placement.rotation)} disabled={busy}
          onChange={(event) => change({ rotation: Number(event.currentTarget.value) as PdfImagePlacement375["rotation"] })}>
          <option value="0">0°</option><option value="90">90°</option>
          <option value="180">180°</option><option value="270">270°</option>
        </select></label>
      </div>
      <div class="field">
        <label>Dimensione · {Math.round(placement.width * 100)}% della larghezza pagina
          <input aria-label="Larghezza immagine" type="range" min="5" max="90" step="1"
            value={Math.round(placement.width * 100)} disabled={busy}
            onInput={(event) => change({ width: Number(event.currentTarget.value) / 100 })} />
        </label>
        <label>Posizione orizzontale · {Math.round(placement.x * 100)}%
          <input aria-label="Posizione immagine orizzontale" type="range" min="0" max={Math.max(0, Math.floor(maxX * 100))}
            value={Math.round(placement.x * 100)} disabled={busy}
            onInput={(event) => change({ x: Number(event.currentTarget.value) / 100 })} />
        </label>
        <label>Posizione verticale · {Math.round(placement.y * 100)}%
          <input aria-label="Posizione immagine verticale" type="range" min="0" max={Math.max(0, Math.floor(maxY * 100))}
            value={Math.round(placement.y * 100)} disabled={busy}
            onInput={(event) => change({ y: Number(event.currentTarget.value) / 100 })} />
        </label>
      </div>
      {imageUrl && <img src={imageUrl} alt="" hidden onLoad={(event) => {
        const target = event.currentTarget;
        setImageSize({ width: target.naturalWidth || 1, height: target.naturalHeight || 1 });
      }} />}
      <p class="file-note">Trascina l'immagine sulla pagina oppure usa i tre cursori. Anteprima indicativa: il PDF esportato viene verificato separatamente.</p>
      {previewUrl ? <div ref={previewRef} style={{ position: "relative", display: "inline-block", maxWidth: "100%", lineHeight: 0,
        border: "1px solid var(--border, #888)", overflow: "hidden" }}>
        <img src={previewUrl} alt={"Pagina PDF " + placement.page} style={{ display: "block", maxWidth: "100%", height: "auto" }}
          onLoad={(event) => setPageSize({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight })} />
        {imageUrl && valid && <div role="group" aria-label="Posizione immagine sulla pagina"
          onPointerDown={startDrag} onPointerMove={moveDrag}
          onPointerUp={() => { dragRef.current = null; }} onPointerCancel={() => { dragRef.current = null; }}
          style={{ position: "absolute", left: (placement.x * 100) + "%", top: (placement.y * 100) + "%",
            width: (placement.width * 100) + "%", height: (heightRatio * 100) + "%",
            border: "2px solid var(--accent, #1463ae)", cursor: busy ? "default" : "move", touchAction: "none",
            boxSizing: "border-box", background: "rgba(255,255,255,.1)" }}>
          <img src={imageUrl} alt="Immagine posizionata sul PDF" draggable={false}
            style={{ position: "absolute", maxWidth: "none", objectFit: "fill",
              width: placement.rotation % 180 === 0 ? "100%" : height + "px",
              height: placement.rotation % 180 === 0 ? "100%" : width + "px",
              left: placement.rotation % 180 === 0 ? "0" : ((width - height) / 2) + "px",
              top: placement.rotation % 180 === 0 ? "0" : ((height - width) / 2) + "px",
              transform: "rotate(" + placement.rotation + "deg)", pointerEvents: "none" }} />
        </div>}
      </div> : <p role="status">Creazione anteprima della pagina…</p>}
      {!valid && <p role="alert">L'immagine supera i bordi visibili della pagina. Riduci la dimensione o spostala.</p>}
      <div class="actions">
        <button type="button" disabled={busy || !valid || !previewUrl || !image || image.size > 12 * 1024 * 1024}
          onClick={() => void save()}>Salva PDF con immagine</button>
        {busy && <button type="button" onClick={() => active.current?.abort()}>Annulla</button>}
      </div>
      {busy && <p role="status">Inserimento locale nel Worker e verifica PDF…</p>}
      {error && <p role="alert">{error}</p>}
      {result && <PdfResultV2 toolId="pdf-page-reorder" result={result} sourceFiles={[file, image]}
        onRetry={() => void save()} onReset={() => { setImage(null); setResult(null); }} />}
    </>}
  </section>;
}
