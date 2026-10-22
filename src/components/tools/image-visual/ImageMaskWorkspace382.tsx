import { useEffect, useRef, useState } from "preact/hooks";
import {
  moveSelection382,
  pointerPixel382,
  selectImagePixels382,
  selectionFromDrag382,
  type ImageSelection382,
  type SelectionPoint382,
  type SelectionMode382,
} from "../../../engines/image/selection-mask-382";
import { readImageTransformSource, type PixelFrame } from "../../../engines/image/transform-workspace";
import { toolRuntime } from "../../../runtime/tool-runtime";
import {
  gutterStateFor, InlineError, ToolActions, ToolCancelButton, ToolOperation,
  ToolResetButton, ToolResultPanel, ToolSubmitButton, useToolOperation,
} from "../shared";
import { ImageResultV2, prepareImageResult, type PreparedImageResult } from "./ImageResultV2";

interface SelectionDrag382 {
  readonly pointerId: number;
  readonly start: SelectionPoint382;
  readonly previous: ImageSelection382;
}

function initialSelection(frame: PixelFrame): ImageSelection382 {
  return { x: 0, y: 0, width: frame.width, height: frame.height, shape: "rectangle" };
}

function paintFrame(canvas: HTMLCanvasElement, frame: PixelFrame): CanvasRenderingContext2D | null {
  canvas.width = frame.width;
  canvas.height = frame.height;
  const context = canvas.getContext("2d");
  if (context === null) return null;
  const data = context.createImageData(frame.width, frame.height);
  data.data.set(frame.data);
  context.putImageData(data, 0, 0);
  return context;
}

export function ImageMaskWorkspace382() {
  const [file, setFile] = useState<File | null>(null);
  const [source, setSource] = useState<PixelFrame | null>(null);
  const [selection, setSelection] = useState<ImageSelection382 | null>(null);
  const [mode, setMode] = useState<SelectionMode382>("crop");
  const [zoom, setZoom] = useState(1);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const sourceCanvas = useRef<HTMLCanvasElement>(null);
  const resultCanvas = useRef<HTMLCanvasElement>(null);
  const dragging = useRef<SelectionDrag382 | null>(null);
  const loadVersion = useRef(0);

  const operation = useToolOperation<PreparedImageResult>(async (signal) => {
    if (file === null || selection === null) throw new Error("INVALID_INPUT");
    const run = await toolRuntime.run("image-crop", { file, selection, mode }, {}, signal);
    if (!run.ok) return run;
    return { ok: true, tool: run.tool, value: await prepareImageResult(run.value), defaults: run.defaults };
  }, { formatThrownError: () => "L'esportazione PNG della selezione non è riuscita." });

  useEffect(() => {
    if (source === null || selection === null) return;
    try {
      const canvas = sourceCanvas.current;
      if (canvas !== null) {
        const context = paintFrame(canvas, source);
        if (context !== null) {
          context.save();
          context.lineWidth = 1;
          context.strokeStyle = "#ff2d55";
          context.setLineDash([6, 4]);
          context.strokeRect(selection.x + 0.5, selection.y + 0.5, selection.width - 1, selection.height - 1);
          context.restore();
        }
      }
      const preview = selectImagePixels382(source, selection, mode);
      if (resultCanvas.current !== null) paintFrame(resultCanvas.current, preview);
      setError("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Anteprima non disponibile");
    }
  }, [source, selection, mode]);

  function reset(): void {
    loadVersion.current += 1;
    dragging.current = null;
    setFile(null);
    setSource(null);
    setSelection(null);
    setMode("crop");
    setError("");
    setLoading(false);
    operation.reset();
  }

  async function chooseFile(event: Event): Promise<void> {
    const selected = event.currentTarget instanceof HTMLInputElement ? event.currentTarget.files?.[0] ?? null : null;
    const version = ++loadVersion.current;
    setSource(null);
    setSelection(null);
    setFile(selected);
    setError("");
    operation.reset();
    if (selected === null) return;
    setLoading(true);
    try {
      const frame = await readImageTransformSource(selected);
      if (version !== loadVersion.current) return;
      // Respect the same conservative memory guard used by the pixel operation.
      if (frame.width * frame.height > 4_000_000) throw new Error("PIXEL_LIMIT: Selezione limitata a 4 MP su questo editor.");
      setSource(frame);
      setSelection(initialSelection(frame));
    } catch (caught) {
      if (version === loadVersion.current) setError(caught instanceof Error ? caught.message : "File non decodificabile");
    } finally {
      if (version === loadVersion.current) setLoading(false);
    }
  }

  function point(event: PointerEvent): SelectionPoint382 | null {
    if (source === null || !(event.currentTarget instanceof HTMLCanvasElement)) return null;
    const { left, top, width, height } = event.currentTarget.getBoundingClientRect();
    try { return pointerPixel382(event.clientX, event.clientY, { left, top, width, height }, source.width, source.height); }
    catch { return null; }
  }

  function down(event: PointerEvent): void {
    if (source === null || selection === null || !(event.currentTarget instanceof HTMLCanvasElement)) return;
    const start = point(event);
    if (start === null) return;
    dragging.current = { pointerId: event.pointerId, start, previous: selection };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function move(event: PointerEvent): void {
    const drag = dragging.current;
    if (drag === null || drag.pointerId !== event.pointerId || source === null) return;
    const end = point(event);
    if (end !== null) {
      setSelection(selectionFromDrag382(drag.start, end, source.width, source.height, drag.previous.shape));
      operation.reset();
    }
  }

  function up(event: PointerEvent, cancel = false): void {
    const drag = dragging.current;
    if (drag === null || drag.pointerId !== event.pointerId) return;
    dragging.current = null;
    if (event.currentTarget instanceof HTMLCanvasElement && event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (cancel) setSelection(drag.previous);
    else moveFinal(drag, point(event));
    operation.reset();
  }

  function moveFinal(drag: SelectionDrag382, end: SelectionPoint382 | null): void {
    if (source !== null && end !== null) setSelection(selectionFromDrag382(drag.start, end, source.width, source.height, drag.previous.shape));
  }

  function keyboardMove(event: KeyboardEvent): void {
    if (source === null || selection === null) return;
    const step = event.shiftKey ? 10 : 1;
    const direction = ({ ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] } as Record<string, [number, number]>)[event.key];
    if (direction === undefined) return;
    event.preventDefault();
    setSelection(moveSelection382(selection, direction[0], direction[1], source.width, source.height));
    operation.reset();
  }

  function setCoordinate(field: "x" | "y" | "width" | "height", value: string): void {
    if (source === null || selection === null) return;
    const number = Number(value);
    if (!Number.isSafeInteger(number)) return;
    const next = { ...selection, [field]: number };
    const width = Math.min(source.width, Math.max(1, next.width));
    const height = Math.min(source.height, Math.max(1, next.height));
    setSelection({ ...next, width, height, x: Math.min(source.width - width, Math.max(0, next.x)), y: Math.min(source.height - height, Math.max(0, next.y)) });
    operation.reset();
  }

  async function submit(event: Event): Promise<void> {
    event.preventDefault();
    if (source === null || selection === null || file === null) { setError("Scegli prima un'immagine locale."); return; }
    await operation.run();
  }

  return <ToolOperation busy={operation.isRunning || loading}>
    <form onSubmit={(event) => void submit(event)}>
      <label class="field"><span>Immagine per selezione e maschera</span><input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => void chooseFile(event)} disabled={operation.isRunning} /><small>Elaborazione locale. PNG di output con alpha conservato, senza modificare il file originale.</small></label>
      {source !== null && selection !== null && <>
        <fieldset class="field"><legend>Output</legend><div class="actions">
          <button type="button" aria-pressed={mode === "crop"} onClick={() => { setMode("crop"); operation.reset(); }}>Ritaglia selezione</button>
          <button type="button" aria-pressed={mode === "mask"} onClick={() => { setMode("mask"); operation.reset(); }}>Maschera su immagine intera</button>
        </div></fieldset>
        <fieldset class="field"><legend>Forma di selezione</legend><div class="actions">
          <button type="button" aria-pressed={selection.shape === "rectangle"} onClick={() => { setSelection({ ...selection, shape: "rectangle" }); operation.reset(); }}>Rettangolo</button>
          <button type="button" aria-pressed={selection.shape === "ellipse"} onClick={() => { setSelection({ ...selection, shape: "ellipse" }); operation.reset(); }}>Ellisse</button>
        </div></fieldset>
        <p class="file-note">Trascina con mouse o touch sulla sorgente per selezionare. Focalizza il canvas e usa le frecce per spostare di 1 px, Shift + frecce di 10 px. Le coordinate numeriche offrono lo stesso controllo.</p>
        <div style={{ overflow: "auto", maxHeight: "490px" }}><canvas data-selection-source="true" ref={sourceCanvas} tabIndex={0} aria-label="Selezione sorgente: trascina o usa le frecce per spostare la selezione" onPointerDown={down} onPointerMove={move} onPointerUp={(event) => up(event)} onPointerCancel={(event) => up(event, true)} onKeyDown={keyboardMove} style={{ touchAction: "none", imageRendering: "pixelated", width: `${Math.max(320, source.width * zoom)}px`, maxWidth: "none", height: "auto" }} /></div>
        <div class="field-grid">{(["x", "y", "width", "height"] as const).map((field) => <label class="field" key={field}><span>{field.toUpperCase()} · px</span><input aria-label={`Selezione ${field}`} type="number" min={field === "x" || field === "y" ? 0 : 1} step="1" value={selection[field]} onChange={(event) => setCoordinate(field, event.currentTarget.value)} /></label>)}</div>
        <label class="field"><span>Zoom pixel</span><select aria-label="Zoom pixel" value={zoom} onChange={(event) => setZoom(Number(event.currentTarget.value))}>{[1, 2, 4, 8].map((value) => <option key={value} value={value}>{value}×</option>)}</select></label>
        <p class="file-note">Anteprima esatta output: {mode === "crop" ? `${selection.width}×${selection.height}` : `${source.width}×${source.height}`} px; alpha originale × copertura della maschera.</p>
        <div style={{ overflow: "auto", maxHeight: "490px" }}><canvas data-selection-preview="true" ref={resultCanvas} role="img" aria-label="Anteprima pixel e trasparenza PNG" style={{ imageRendering: "pixelated", maxWidth: "100%", height: "auto" }} /></div>
      </>}
      <InlineError message={error || operation.error} />
      <ToolActions><ToolSubmitButton busy={operation.isRunning || loading} busyLabel="Esportazione…">Esporta PNG selezione</ToolSubmitButton>{operation.isRunning ? <ToolCancelButton onCancel={operation.cancel} /> : <ToolResetButton onClick={reset} />}</ToolActions>
    </form>
    <ToolResultPanel eyebrow="PNG verificato" placeholder="Il risultato apparirà qui dopo l'esportazione." busy={operation.isRunning} state={gutterStateFor(operation.status)}>
      {operation.result !== null && file !== null && <ImageResultV2 toolId="image-crop" result={operation.result} sourceFiles={[file]} onReset={reset} onRetry={() => operation.run()} />}
    </ToolResultPanel>
  </ToolOperation>;
}
