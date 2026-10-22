import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import { composeImageLayers381, IMAGE_LAYER_381_LIMITS, type ImageLayer381 } from "../../../engines/image/layer-compositor-381";
import { preflightLayerImages381 } from "../../../engines/image/layer-input-381";
import { pixelFrameToCanvas, readImageTransformSource, type PixelFrame } from "../../../engines/image/transform-workspace";
import { ImageResultV2, prepareImageResult, type PreparedImageResult } from "./ImageResultV2";

interface LayerEntry extends ImageLayer381 {
  readonly name: string;
  readonly file: File;
}

/** A bounded, local layer surface on the existing image-crop workspace. List order is back to front. */
export function ImageLayers381Tool() {
  const [layers, setLayers] = useState<readonly LayerEntry[]>([]);
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<PreparedImageResult | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const requestRef = useRef(0);
  const revisionRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => {
    requestRef.current += 1;
    abortRef.current?.abort();
  }, []);

  const composition = useMemo((): { frame: PixelFrame | null; error: string } => {
    if (size === null || layers.length === 0) return { frame: null, error: "" };
    try {
      return { frame: composeImageLayers381(size.width, size.height, layers), error: "" };
    } catch (cause) {
      return { frame: null, error: cause instanceof Error ? cause.message : "Composizione non disponibile" };
    }
  }, [layers, size]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas === null || composition.frame === null) return;
    const frame = composition.frame;
    canvas.width = frame.width;
    canvas.height = frame.height;
    const context = canvas.getContext("2d");
    if (context === null) return;
    const image = context.createImageData(frame.width, frame.height);
    image.data.set(frame.data);
    context.putImageData(image, 0, 0);
  }, [composition]);

  function reset() {
    requestRef.current += 1;
    revisionRef.current += 1;
    abortRef.current?.abort();
    abortRef.current = null;
    setLayers([]);
    setSize(null);
    setResult(null);
    setBusy(false);
    setError("");
  }

  async function chooseFiles(event: Event) {
    const files = event.currentTarget instanceof HTMLInputElement ? Array.from(event.currentTarget.files ?? []) : [];
    const request = ++requestRef.current;
    revisionRef.current += 1;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLayers([]);
    setSize(null);
    setResult(null);
    setError("");
    setBusy(files.length > 0);
    if (files.length === 0) return;
    try {
      const dimensions = await preflightLayerImages381(files, controller.signal);
      const decoded: LayerEntry[] = [];
      for (const file of files) {
        const frame = await readImageTransformSource(file, controller.signal);
        decoded.push({ name: file.name, file, frame, x: 0, y: 0, opacity: 1, visible: true });
      }
      if (request !== requestRef.current || controller.signal.aborted) return;
      setSize({ width: dimensions.width, height: dimensions.height });
      setLayers(decoded);
    } catch (cause) {
      if (request === requestRef.current && !controller.signal.aborted) {
        setError(cause instanceof Error ? cause.message : "Le immagini non possono essere aperte");
      }
    } finally {
      if (request === requestRef.current) setBusy(false);
    }
  }

  function change(index: number, update: Partial<Pick<LayerEntry, "opacity" | "visible" | "x" | "y">>) {
    revisionRef.current += 1;
    setLayers((current) => current.map((layer, at) => at === index ? { ...layer, ...update } : layer));
    setResult(null);
  }

  function move(index: number, direction: -1 | 1) {
    revisionRef.current += 1;
    setLayers((current) => {
      const next = [...current];
      const other = index + direction;
      if (other < 0 || other >= next.length) return current;
      [next[index], next[other]] = [next[other]!, next[index]!];
      return next;
    });
    setResult(null);
  }

  async function exportPng() {
    const frame = composition.frame;
    if (frame === null) return;
    const at = requestRef.current;
    const revision = revisionRef.current;
    setBusy(true);
    setError("");
    try {
      // Encode from the same RGBA frame used by preview, even if a paint effect is still pending.
      const canvas = pixelFrameToCanvas(frame);
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((value) => value ? resolve(value) : reject(new Error("PNG non esportabile")), "image/png");
      });
      const verified = await prepareImageResult({ blob, filename: "immagine-livelli.png", outputMime: "image/png", width: frame.width, height: frame.height });
      if (at === requestRef.current && revision === revisionRef.current) setResult(verified);
    } catch (cause) {
      if (at === requestRef.current) setError(cause instanceof Error ? cause.message : "Esportazione non riuscita");
    } finally {
      if (at === requestRef.current) setBusy(false);
    }
  }

  return <section data-str-381="layers" aria-label="Editor immagini a livelli">
    <p>Componi fino a {IMAGE_LAYER_381_LIMITS.maxLayers} immagini sul dispositivo, senza inviarle in rete. Il primo file stabilisce la dimensione del canvas; l’elenco va dal fondo al primo piano.</p>
    <label htmlFor="layers-381-files">Immagini locali (PNG, JPEG, WebP)</label>
    <input id="layers-381-files" type="file" multiple accept="image/png,image/jpeg,image/webp" onChange={chooseFiles} disabled={busy} />
    <button type="button" onClick={reset} disabled={busy && layers.length === 0}>Azzera livelli</button>
    {busy && <p role="status">Elaborazione locale in corso…</p>}
    {(error || composition.error) && <p role="alert">{error || composition.error}</p>}
    {size !== null && <>
      <p data-381-dimensions>Canvas: {size.width} × {size.height} px. Input originali invariati; opacità e ordine modificano soltanto la composizione.</p>
      <ol data-381-layer-list>
        {layers.map((layer, index) => <li key={layer.file.name + index} data-381-layer={index}>
          <strong>{index + 1}. {layer.name}</strong>{" "}
          <label>
            <input type="checkbox" checked={layer.visible} onChange={(event) => change(index, { visible: event.currentTarget.checked })} /> Visibile
          </label>{" "}
          <label>Opacità {Math.round(layer.opacity * 100)}%
            <input type="range" min="0" max="100" step="1" value={layer.opacity * 100}
              aria-label={`Opacità livello ${index + 1}`}
              onInput={(event) => change(index, { opacity: Number(event.currentTarget.value) / 100 })} />
          </label>{" "}
          <button type="button" disabled={index === 0} aria-label={`Porta dietro livello ${index + 1}`} onClick={() => move(index, -1)}>Indietro</button>{" "}
          <button type="button" disabled={index === layers.length - 1} aria-label={`Porta avanti livello ${index + 1}`} onClick={() => move(index, 1)}>Avanti</button>
        </li>)}
      </ol>
      <canvas ref={canvasRef} data-381-canvas aria-label="Anteprima composizione livelli" style={{ display: "block", maxWidth: "100%", height: "auto", border: "1px solid currentColor" }} />
      <button type="button" data-381-export onClick={exportPng} disabled={busy || composition.frame === null}>Prepara PNG composito</button>
      {result !== null && <ImageResultV2 toolId="image-crop" result={result} sourceFiles={layers.map((layer) => layer.file)} onReset={reset} onRetry={exportPng} />}
    </>}
  </section>;
}
