import { useEffect, useRef, useState } from "preact/hooks";
import type { PdfCompareResult } from "../../../engines/pdf";
import { openPdfThumbnailSession } from "../../../engines/pdf/thumbnails";
import { comparePdfThumbnailPixels } from "../../../engines/pdf/visual-diff";

type ResultView = {
  readonly state: "idle" | "running" | "sample-match" | "different" | "partial";
  readonly message: string;
  readonly changedPixels: number;
  readonly totalPixels: number;
  readonly urls: readonly string[];
};
const empty = (): ResultView => ({ state: "idle", message: "", changedPixels: 0, totalPixels: 0, urls: [] });

async function decodedPixels(file: File, page: number, signal: AbortSignal) {
  const session = await openPdfThumbnailSession(file, signal);
  let bitmap: ImageBitmap | undefined;
  try {
    const blob = await session.renderPage(page, 0, signal);
    bitmap = await createImageBitmap(blob);
    if (signal.aborted) throw new DOMException("Confronto interrotto", "AbortError");
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (ctx === null) throw new Error("CANVAS_UNAVAILABLE: Lettura pixel non supportata");
    ctx.drawImage(bitmap, 0, 0);
    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
    canvas.width = 0;
    canvas.height = 0;
    return { width: pixels.width, height: pixels.height, rgba: pixels.data, blob };
  } finally {
    bitmap?.close();
    await session.close();
  }
}

function asPng(pixels: Uint8ClampedArray, width: number, height: number): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (context === null) throw new Error("CANVAS_UNAVAILABLE: Overlay non disponibile");
  const owned = new Uint8ClampedArray(new ArrayBuffer(pixels.byteLength));
  owned.set(pixels);
  context.putImageData(new ImageData(owned, width, height), 0, 0);
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      canvas.width = 0;
      canvas.height = 0;
      blob === null ? reject(new Error("PNG_ENCODE_FAILED")) : resolve(blob);
    }, "image/png");
  });
}

export function PdfVisualCompare({ first, second, comparison }: {
  readonly first: File;
  readonly second: File;
  readonly comparison: PdfCompareResult;
}) {
  const pairs = comparison.alignment.entries.filter((entry) => entry.firstPage !== null && entry.secondPage !== null);
  const [pairIndex, setPairIndex] = useState(0);
  const [result, setResult] = useState<ResultView>(empty);
  const controller = useRef<AbortController | null>(null);
  const urlRefs = useRef<string[]>([]);
  function revoke() {
    for (const url of urlRefs.current) URL.revokeObjectURL(url);
    urlRefs.current = [];
  }
  function abortAndClear() {
    controller.current?.abort();
    controller.current = null;
    revoke();
    setResult(empty());
  }
  useEffect(() => () => {
    controller.current?.abort();
    revoke();
  }, []);

  async function analyze() {
    const pair = pairs[pairIndex];
    if (pair?.firstPage === null || pair?.secondPage === null || pair === undefined) return;
    abortAndClear();
    const next = new AbortController();
    controller.current = next;
    setResult({ ...empty(), state: "running", message: "Rendering locale sequenziale delle due pagine..." });
    const pendingUrls: string[] = [];
    try {
      // Each PDF.js worker/document is fully closed before the next is opened.
      const a = await decodedPixels(first, pair.firstPage, next.signal);
      const b = await decodedPixels(second, pair.secondPage, next.signal);
      const diff = comparePdfThumbnailPixels(a, b);
      if (next.signal.aborted) return;
      pendingUrls.push(URL.createObjectURL(a.blob), URL.createObjectURL(b.blob));
      if (diff.rgba !== null) {
        const overlay = await asPng(diff.rgba, a.width, a.height);
        if (next.signal.aborted) return;
        pendingUrls.push(URL.createObjectURL(overlay));
      }
      revoke();
      urlRefs.current = [...pendingUrls];
      setResult({
        state: diff.status,
        message: diff.status === "partial" ? diff.reason ?? "Confronto non disponibile"
          : diff.status === "different"
            ? "Differenze rilevate nei pixel delle miniature renderizzate."
            : "Miniature renderizzate identiche a questa risoluzione; l'equivalenza completa NON è certificata.",
        changedPixels: diff.changedPixels, totalPixels: diff.totalPixels, urls: [...pendingUrls],
      });
      pendingUrls.length = 0; // Owned by urlRefs until next selection/unmount.
    } catch (error) {
      if (next.signal.aborted) return;
      revoke();
      setResult({
        ...empty(), state: "partial",
        message: `Confronto parziale: ${error instanceof Error ? error.message : "Impossibile renderizzare una pagina"}`,
      });
    } finally {
      for (const url of pendingUrls) URL.revokeObjectURL(url);
      if (controller.current === next) controller.current = null;
    }
  }

  return (
    <section data-pdf-visual-compare aria-label="Confronto visuale locale tra pagine PDF">
      <p class="file-note">Rendering locale PDF.js su richiesta, di una sola coppia di pagine alla volta. Le miniature (massimo 176×208 px) non equivalgono al confronto visivo completo di tutte le pagine. PDF con immagini o senza testo possono differire anche quando il testo estratto coincide.</p>
      {pairs.length === 0 ? (
        <p role="status">Nessuna coppia allineata. Le pagine aggiunte o rimosse non hanno una controparte pixel confrontabile.</p>
      ) : (
        <>
          <label class="field">
            <span>Coppia di pagine</span>
            <select aria-label="Coppia di pagine da confrontare" value={String(pairIndex)} onChange={(event) => {
              abortAndClear();
              setPairIndex(Number(event.currentTarget.value));
            }}>
              {pairs.map((pair, index) => (
                <option key={index} value={index}>PDF A pagina {pair.firstPage} — PDF B pagina {pair.secondPage} · {pair.kind}</option>
              ))}
            </select>
          </label>
          <div class="actions">
            <button type="button" disabled={result.state === "running"} onClick={() => void analyze()}>Confronta pixel delle miniature</button>
            {result.state === "running" && <button type="button" onClick={abortAndClear}>Interrompi confronto visivo</button>}
          </div>
          {result.state !== "idle" && <p role="status" data-visual-diff-state={result.state}>{result.message}
            {result.totalPixels > 0 ? ` · ${result.changedPixels} / ${result.totalPixels} pixel diversi` : ""}
          </p>}
          {result.urls.length > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 160px), 1fr))", gap: "0.75rem" }}>
              {result.urls.map((url, index) => (
                <div key={url}>
                  <strong>{index === 0 ? "PDF A" : index === 1 ? "PDF B" : "Differenze (rosso)"}</strong>
                  <img src={url} alt={index === 2 ? "Differenze dei pixel renderizzati evidenziate in rosso" : `Anteprima PDF ${index === 0 ? "A" : "B"}`}
                    style={{ width: "100%", maxWidth: "176px", maxHeight: "208px", objectFit: "contain" }} />
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}
