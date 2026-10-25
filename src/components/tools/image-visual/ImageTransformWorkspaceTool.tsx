import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import {
  applyImageTransformPixels,
  defaultImageTransformState,
  normalizeImageTransformState,
  readImageTransformSource,
  transformPreflight,
  type ImageTransformState,
  type ImageRedactionMode,
  type PixelFrame,
  type QuarterTurn,
} from "../../../engines/image/transform-workspace";
import {
  perspectiveTransformPixels,
  type PerspectiveCorners,
  type PerspectivePoint,
} from "../../../engines/image/advanced-workspace";
import {
  commitImageProject385,
  createImageProjectHistory385,
  redoImageProject385,
  resetImageProject385,
  undoImageProject385,
  type ImageProjectHistory385,
} from "../../../engines/image/project-history-385";
import { ImageProjectError385 } from "../../../engines/image/project-storage-385";
import type { ImageSnapshotOpen475, ImageSnapshotReference475 } from "../../../engines/image/editor-project-475";
import { toolRuntime } from "../../../runtime/tool-runtime";
import {
  gutterStateFor,
  InlineError,
  ResultProvenance,
  ToolActions,
  ToolCancelButton,
  ToolOperation,
  ToolResetButton,
  ToolResultPanel,
  ToolSubmitButton,
  useToolOperation,
} from "../shared";
import { ImageResultV2, prepareImageResult, type PreparedImageResult } from "./ImageResultV2";
import { ImageProjectControls385 } from "./ImageProjectControls385";
import { clamp, contentPoint, cropMoved, transformedContentDimensions } from "./ImageTransformInteractions";
import { drawPerspectiveBoundary, fullPerspectiveCorners, previewPixelData } from "./ImageTransformPerspectivePreview";

interface DragState {
  readonly pointerId: number;
  readonly clientX: number;
  readonly clientY: number;
  readonly base: ImageTransformState;
}

interface RedactionDragState {
  readonly pointerId: number;
  readonly startX: number;
  readonly startY: number;
  readonly base: ImageTransformState;
}

type PerspectiveCornerKey = keyof PerspectiveCorners;

interface PerspectiveDragState {
  readonly pointerId: number;
  readonly corner: PerspectiveCornerKey;
}

function nextQuarterTurn(value: QuarterTurn): QuarterTurn {
  return value === 0 ? 90 : value === 90 ? 180 : value === 180 ? 270 : 0;
}

export function ImageTransformWorkspaceTool() {
  const [file, setFile] = useState<File | null>(null);
  const [source, setSource] = useState<PixelFrame | null>(null);
  const [history, setHistory] = useState<ImageProjectHistory385 | null>(null);
  const [savedProject, setSavedProject] = useState<ImageSnapshotReference475 | null>(null);
  const [draft, setDraft] = useState<ImageTransformState | null>(null);
  const [previewError, setPreviewError] = useState("");
  const [preflightNote, setPreflightNote] = useState("");
  const [interactionMode, setInteractionMode] = useState<"crop" | "redact">("crop");
  const [workspaceMode, setWorkspaceMode] = useState<"transform" | "perspective">("transform");
  const [perspectiveCorners, setPerspectiveCorners] = useState<PerspectiveCorners | null>(null);
  const [selectedCorner, setSelectedCorner] = useState<PerspectiveCornerKey>("topLeft");
  const [redactionMode, setRedactionMode] = useState<ImageRedactionMode>("solid");
  const [redactionColor, setRedactionColor] = useState("#000000");
  const [redactionX, setRedactionX] = useState("0");
  const [redactionY, setRedactionY] = useState("0");
  const [redactionWidth, setRedactionWidth] = useState("64");
  const [redactionHeight, setRedactionHeight] = useState("32");
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const perspectiveSourceRef = useRef<HTMLCanvasElement | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const redactionDragRef = useRef<RedactionDragState | null>(null);
  const perspectiveDragRef = useRef<PerspectiveDragState | null>(null);
  const loadSequence = useRef(0);
  const activeState = draft ?? history?.current ?? null;

  const operation = useToolOperation<PreparedImageResult>(async (signal) => {
    if (file === null || source === null) throw new Error("INVALID_INPUT");
    const run = workspaceMode === "perspective"
      ? await toolRuntime.run("image-crop", { file, perspective: perspectiveCorners }, {}, signal)
      : await toolRuntime.run("image-crop", { file, transform: activeState, mime: "image/png" }, {}, signal);
    if (!run.ok) return run;
    return { ok: true, tool: run.tool, value: await prepareImageResult(run.value), defaults: run.defaults };
  }, { formatThrownError: () => "L'esportazione dell'immagine non è riuscita. Controlla file e trasformazioni." });

  useEffect(() => {
    if (source === null || canvasRef.current === null) return;
    try {
      const pixels = workspaceMode === "perspective"
        ? perspectiveTransformPixels(source, perspectiveCorners)
        : activeState === null ? null : applyImageTransformPixels(source, activeState);
      if (pixels === null) return;
      previewPixelData(canvasRef.current, pixels);
      if (workspaceMode === "perspective" && perspectiveCorners !== null && perspectiveSourceRef.current !== null) {
        drawPerspectiveBoundary(perspectiveSourceRef.current, source, perspectiveCorners);
      }
      setPreviewError("");
    } catch (error) {
      setPreviewError(error instanceof Error ? error.message : "Anteprima non disponibile");
    }
  }, [activeState, perspectiveCorners, source, workspaceMode]);

  function invalidateExport(): void {
    operation.reset();
  }

  function commit(next: ImageTransformState): void {
    if (source === null || history === null) return;
    try {
      const normalized = normalizeImageTransformState(next, source.width, source.height);
      setHistory(commitImageProject385(history, normalized));
      setDraft(null);
      invalidateExport();
      setPreviewError("");
    } catch (error) {
      setPreviewError(error instanceof Error ? error.message : "Trasformazione non valida");
    }
  }

  async function chooseFile(event: Event): Promise<void> {
    const selected = event.currentTarget instanceof HTMLInputElement ? event.currentTarget.files?.[0] ?? null : null;
    const sequence = loadSequence.current + 1;
    loadSequence.current = sequence;
    setFile(selected);
    setSource(null);
    setHistory(null);
    setSavedProject(null);
    setDraft(null);
    setPerspectiveCorners(null);
    setPreviewError("");
    setPreflightNote("");
    invalidateExport();
    if (selected === null) return;
    const initialPreflight = transformPreflight(selected.size);
    if (initialPreflight.state === "unsupported") {
      setPreviewError(initialPreflight.reasons.join(" "));
      return;
    }
    if (initialPreflight.state === "degraded") setPreflightNote(initialPreflight.reasons.join(" "));
    try {
      const frame = await readImageTransformSource(selected);
      if (loadSequence.current !== sequence) return;
      const decodedPreflight = transformPreflight(selected.size);
      setPreflightNote(decodedPreflight.state === "degraded" ? decodedPreflight.reasons.join(" ") : "Decodifica immagine supportata; elaborazione ed export restano locali.");
      setSource(frame);
      setHistory(createImageProjectHistory385(defaultImageTransformState(frame.width, frame.height)));
      setPerspectiveCorners(fullPerspectiveCorners(frame));
    } catch (error) {
      if (loadSequence.current !== sequence) return;
      setPreviewError(error instanceof Error ? error.message : "Immagine non decodificabile");
    }
  }

  function updateCropDimension(field: "width" | "height", raw: string): void {
    if (source === null || activeState === null) return;
    const maximum = field === "width" ? source.width : source.height;
    const value = clamp(Math.round(Number(raw) || 1), 1, maximum);
    const crop = { ...activeState.crop, [field]: value };
    crop.x = clamp(crop.x, 0, source.width - crop.width);
    crop.y = clamp(crop.y, 0, source.height - crop.height);
    commit({ ...activeState, crop });
  }

  function moveCrop(deltaX: number, deltaY: number): void {
    if (source === null || activeState === null) return;
    commit(cropMoved(activeState, source, deltaX, deltaY));
  }

  function pointerDown(event: PointerEvent): void {
    if (source === null || activeState === null || !(event.currentTarget instanceof HTMLCanvasElement)) return;
    if (interactionMode === "redact") {
      const point = contentPoint(event, event.currentTarget, source, activeState);
      if (point === null) return;
      redactionDragRef.current = { pointerId: event.pointerId, startX: point.x, startY: point.y, base: activeState };
      event.currentTarget.setPointerCapture(event.pointerId);
      return;
    }
    dragRef.current = { pointerId: event.pointerId, clientX: event.clientX, clientY: event.clientY, base: activeState };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function pointerMove(event: PointerEvent): void {
    if (redactionDragRef.current !== null) return;
    const drag = dragRef.current;
    if (drag === null || drag.pointerId !== event.pointerId || source === null || !(event.currentTarget instanceof HTMLCanvasElement)) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const deltaX = rect.width === 0 ? 0 : (event.clientX - drag.clientX) * source.width / rect.width;
    const deltaY = rect.height === 0 ? 0 : (event.clientY - drag.clientY) * source.height / rect.height;
    setDraft(cropMoved(drag.base, source, deltaX, deltaY));
  }

  function pointerUp(event: PointerEvent): void {
    const redactionDrag = redactionDragRef.current;
    if (redactionDrag !== null && redactionDrag.pointerId === event.pointerId && source !== null && event.currentTarget instanceof HTMLCanvasElement) {
      redactionDragRef.current = null;
      if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
      const point = contentPoint(event, event.currentTarget, source, redactionDrag.base);
      if (point !== null) {
        const x = Math.min(redactionDrag.startX, point.x);
        const y = Math.min(redactionDrag.startY, point.y);
        const width = Math.max(1, Math.abs(point.x - redactionDrag.startX) + 1);
        const height = Math.max(1, Math.abs(point.y - redactionDrag.startY) + 1);
        commit({ ...redactionDrag.base, redactions: [...redactionDrag.base.redactions, { x, y, width, height, mode: redactionMode, color: redactionColor }] });
      }
      return;
    }
    const drag = dragRef.current;
    if (drag === null || drag.pointerId !== event.pointerId) return;
    dragRef.current = null;
    if (event.currentTarget instanceof HTMLCanvasElement && event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    if (draft !== null) commit(draft);
    else setDraft(null);
  }

  function keyboardMove(event: KeyboardEvent): void {
    const distance = event.shiftKey ? 10 : 1;
    if (event.key === "ArrowLeft") moveCrop(-distance, 0);
    else if (event.key === "ArrowRight") moveCrop(distance, 0);
    else if (event.key === "ArrowUp") moveCrop(0, -distance);
    else if (event.key === "ArrowDown") moveCrop(0, distance);
    else return;
    event.preventDefault();
  }

  function undo(): void {
    if (history === null) return;
    setHistory(undoImageProject385(history));
    setDraft(null);
    invalidateExport();
  }

  function redo(): void {
    if (history === null) return;
    setHistory(redoImageProject385(history));
    setDraft(null);
    invalidateExport();
  }

  function resetTransforms(): void {
    if (history === null) return;
    setHistory(resetImageProject385(history));
    setDraft(null);
    invalidateExport();
  }

  function resetAll(): void {
    loadSequence.current += 1;
    setFile(null);
    setSource(null);
    setHistory(null);
    setSavedProject(null);
    setDraft(null);
    setPerspectiveCorners(null);
    setPreviewError("");
    setPreflightNote("");
    setInteractionMode("crop");
    setWorkspaceMode("transform");
    operation.reset();
  }

  async function openSavedProject(project: ImageSnapshotOpen475): Promise<void> {
    const sequence = ++loadSequence.current;
    const frame = await readImageTransformSource(project.original);
    if (sequence !== loadSequence.current) throw new ImageProjectError385("PROJECT_CHANGED");
    if (frame.width !== project.width || frame.height !== project.height) throw new ImageProjectError385("UNSUPPORTED_SCHEMA");
    setFile(project.original);
    setSource(frame);
    setHistory(project.history);
    setSavedProject({ id: project.id, name: project.name, version: 2 });
    setWorkspaceMode("transform");
    setPerspectiveCorners(fullPerspectiveCorners(frame));
    setDraft(null);
    setPreviewError("");
    invalidateExport();
  }

  async function submit(event: Event): Promise<void> {
    event.preventDefault();
    if (file === null || source === null || (workspaceMode === "transform" && activeState === null) || (workspaceMode === "perspective" && perspectiveCorners === null)) {
      setPreviewError("Scegli prima un'immagine locale.");
      return;
    }
    await operation.run();
  }

  const current = activeState;
  const result = operation.result;
  const alphaCopy = current === null
    ? ""
    : workspaceMode === "perspective"
      ? "La prospettiva ricampiona RGBA con omografia inversa bilineare; nessun pixel fuori dal quadrilatero scelto entra nell'output."
    : current.backgroundMode === "color"
      ? `Alpha appiattito esplicitamente sullo sfondo ${current.backgroundColor}; PNG finale opaco nell'area immagine.`
      : current.roundCrop
        ? "Alpha sorgente preservato; il round crop rende trasparenti i pixel fuori dalla maschera."
        : "Alpha sorgente preservato nel PNG finale.";
  const historyCount = history?.past.length ?? 0;
  const previewDimensions = useMemo(() => {
    if (source === null) return null;
    try {
      const pixels = workspaceMode === "perspective"
        ? perspectiveTransformPixels(source, perspectiveCorners)
        : current === null ? null : applyImageTransformPixels(source, current);
      if (pixels === null) return null;
      return `${pixels.width}×${pixels.height} px`;
    } catch {
      return null;
    }
  }, [current, perspectiveCorners, source, workspaceMode]);

  function addNumericRedaction(): void {
    if (current === null || source === null) return;
    const dimensions = transformedContentDimensions(current);
    const x = clamp(Math.round(Number(redactionX) || 0), 0, Math.max(0, dimensions.width - 1));
    const y = clamp(Math.round(Number(redactionY) || 0), 0, Math.max(0, dimensions.height - 1));
    const width = clamp(Math.round(Number(redactionWidth) || 1), 1, Math.max(1, dimensions.width - x));
    const height = clamp(Math.round(Number(redactionHeight) || 1), 1, Math.max(1, dimensions.height - y));
    commit({ ...current, redactions: [...current.redactions, { x, y, width, height, mode: redactionMode, color: redactionColor }] });
  }

  function updatePerspectiveCorner(key: PerspectiveCornerKey, axis: "x" | "y", raw: string): void {
    if (source === null || perspectiveCorners === null) return;
    const maximum = axis === "x" ? source.width - 1 : source.height - 1;
    const value = clamp(Number(raw) || 0, 0, maximum);
    setPerspectiveCorners({ ...perspectiveCorners, [key]: { ...perspectiveCorners[key], [axis]: value } });
    operation.reset();
  }

  function perspectivePointerPoint(event: PointerEvent, canvas: HTMLCanvasElement): PerspectivePoint | null {
    if (source === null) return null;
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    return {
      x: clamp((event.clientX - rect.left) * source.width / rect.width, 0, source.width - 1),
      y: clamp((event.clientY - rect.top) * source.height / rect.height, 0, source.height - 1),
    };
  }

  function nearestCorner(point: PerspectivePoint): PerspectiveCornerKey | null {
    if (perspectiveCorners === null || source === null) return null;
    const keys: PerspectiveCornerKey[] = ["topLeft", "topRight", "bottomRight", "bottomLeft"];
    let best: PerspectiveCornerKey | null = null;
    let distance = Number.POSITIVE_INFINITY;
    for (const key of keys) {
      const candidate = perspectiveCorners[key];
      const currentDistance = Math.hypot(candidate.x - point.x, candidate.y - point.y);
      if (currentDistance < distance) {
        distance = currentDistance;
        best = key;
      }
    }
    return distance <= Math.max(source.width, source.height) * 0.15 ? best : null;
  }

  function perspectivePointerDown(event: PointerEvent): void {
    if (!(event.currentTarget instanceof HTMLCanvasElement)) return;
    const point = perspectivePointerPoint(event, event.currentTarget);
    if (point === null) return;
    const corner = nearestCorner(point);
    if (corner === null) return;
    setSelectedCorner(corner);
    perspectiveDragRef.current = { pointerId: event.pointerId, corner };
    event.currentTarget.setPointerCapture(event.pointerId);
    setPerspectiveCorners((currentCorners) => currentCorners === null ? currentCorners : { ...currentCorners, [corner]: point });
    operation.reset();
  }

  function perspectivePointerMove(event: PointerEvent): void {
    const drag = perspectiveDragRef.current;
    if (drag === null || drag.pointerId !== event.pointerId || !(event.currentTarget instanceof HTMLCanvasElement)) return;
    const point = perspectivePointerPoint(event, event.currentTarget);
    if (point === null) return;
    setPerspectiveCorners((currentCorners) => currentCorners === null ? currentCorners : { ...currentCorners, [drag.corner]: point });
    operation.reset();
  }

  function perspectivePointerUp(event: PointerEvent): void {
    if (perspectiveDragRef.current?.pointerId !== event.pointerId) return;
    perspectiveDragRef.current = null;
    if (event.currentTarget instanceof HTMLCanvasElement && event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  }

  function perspectiveKeyboardMove(event: KeyboardEvent): void {
    if (source === null || perspectiveCorners === null) return;
    const delta = event.shiftKey ? 10 : 1;
    let dx = 0;
    let dy = 0;
    if (event.key === "ArrowLeft") dx = -delta;
    else if (event.key === "ArrowRight") dx = delta;
    else if (event.key === "ArrowUp") dy = -delta;
    else if (event.key === "ArrowDown") dy = delta;
    else return;
    event.preventDefault();
    const currentPoint = perspectiveCorners[selectedCorner];
    setPerspectiveCorners({
      ...perspectiveCorners,
      [selectedCorner]: {
        x: clamp(currentPoint.x + dx, 0, source.width - 1),
        y: clamp(currentPoint.y + dy, 0, source.height - 1),
      },
    });
    operation.reset();
  }

  return (
    <ToolOperation busy={operation.isRunning}>
      <form onSubmit={submit} noValidate>
        <label class="field">
          <span>Immagine</span>
          <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => void chooseFile(event)} disabled={operation.isRunning} />
          <small>Decodifica, anteprima, trasformazioni ed export avvengono nel browser. Nessun upload.</small>
        </label>

        {source !== null && <fieldset class="field"><legend>Modalità</legend><div class="actions"><button type="button" aria-pressed={workspaceMode === "transform"} onClick={() => { setWorkspaceMode("transform"); operation.reset(); }}>Ritaglio / modifica</button><button type="button" aria-pressed={workspaceMode === "perspective"} onClick={() => { setWorkspaceMode("perspective"); operation.reset(); }}>Prospettiva documento</button></div></fieldset>}

        {source !== null && current !== null && (
          <>
            <section class="image-transform-stage" aria-label="Anteprima interattiva trasformazioni">
              <p class="file-note">{workspaceMode === "perspective" ? "Questa è la preview esatta dell'export prospettico. Il canvas sorgente qui sotto mostra invece il quadrilatero/crop scelto." : "In modalità ritaglio trascina per spostare il crop; con il canvas a fuoco usa le frecce. In modalità redazione trascina una regione: i pixel vengono riscritti nella stessa pipeline dell'export."}</p>
              <canvas
                ref={canvasRef}
                class="image-transform-canvas"
                tabIndex={workspaceMode === "transform" ? 0 : -1}
                aria-label={workspaceMode === "perspective" ? "Anteprima esatta dell'export prospettico" : interactionMode === "redact" ? "Anteprima pixel trasformata; trascina per aggiungere una redazione distruttiva" : "Anteprima pixel trasformata; trascina o usa le frecce per spostare il ritaglio"}
                data-transform-preview="true"
                onPointerDown={workspaceMode === "transform" ? pointerDown : undefined}
                onPointerMove={workspaceMode === "transform" ? pointerMove : undefined}
                onPointerUp={workspaceMode === "transform" ? pointerUp : undefined}
                onPointerCancel={workspaceMode === "transform" ? pointerUp : undefined}
                onKeyDown={workspaceMode === "transform" ? keyboardMove : undefined}
              />
              <p class="file-note" role="status">Output previsto: {previewDimensions ?? "—"}. {alphaCopy}</p>
            </section>

            {workspaceMode === "perspective" && perspectiveCorners !== null && <fieldset class="field" data-perspective-controls><legend>Quattro angoli e confine crop</legend><p class="file-note">Il contorno rosso è il confine sorgente che verrà rettificato. Trascina un punto con mouse/touch; seleziona un angolo e usa frecce (Shift = 10 px), oppure modifica X/Y numericamente.</p><canvas ref={perspectiveSourceRef} class="image-transform-canvas" tabIndex={0} aria-label={`Confine prospettiva sorgente; angolo selezionato ${selectedCorner}`} data-perspective-boundary="true" onPointerDown={perspectivePointerDown} onPointerMove={perspectivePointerMove} onPointerUp={perspectivePointerUp} onPointerCancel={perspectivePointerUp} onKeyDown={perspectiveKeyboardMove} /><div class="actions">{(["topLeft", "topRight", "bottomRight", "bottomLeft"] as PerspectiveCornerKey[]).map((key) => <button type="button" aria-pressed={selectedCorner === key} onClick={() => setSelectedCorner(key)}>{key === "topLeft" ? "Alto sx" : key === "topRight" ? "Alto dx" : key === "bottomRight" ? "Basso dx" : "Basso sx"}</button>)}</div><div class="field-grid">{(["topLeft", "topRight", "bottomRight", "bottomLeft"] as PerspectiveCornerKey[]).flatMap((key) => ([<label class="field" key={`${key}-x`}><span>{key} X</span><input aria-label={`${key} X`} type="number" min="0" max={source.width - 1} step="1" value={Math.round(perspectiveCorners[key].x)} onInput={(event) => updatePerspectiveCorner(key, "x", event.currentTarget.value)} /></label>, <label class="field" key={`${key}-y`}><span>{key} Y</span><input aria-label={`${key} Y`} type="number" min="0" max={source.height - 1} step="1" value={Math.round(perspectiveCorners[key].y)} onInput={(event) => updatePerspectiveCorner(key, "y", event.currentTarget.value)} /></label>]))}</div><ResultProvenance>Confine crop: TL {perspectiveCorners.topLeft.x.toFixed(1)},{perspectiveCorners.topLeft.y.toFixed(1)} → TR {perspectiveCorners.topRight.x.toFixed(1)},{perspectiveCorners.topRight.y.toFixed(1)} → BR {perspectiveCorners.bottomRight.x.toFixed(1)},{perspectiveCorners.bottomRight.y.toFixed(1)} → BL {perspectiveCorners.bottomLeft.x.toFixed(1)},{perspectiveCorners.bottomLeft.y.toFixed(1)}.</ResultProvenance></fieldset>}

            <div hidden={workspaceMode === "perspective"}>
            <fieldset class="field">
              <legend>Ritaglio</legend>
              <div class="field-grid">
                <label class="field"><span>Larghezza · px</span><input type="number" min="1" max={source.width} value={current.crop.width} onChange={(event) => updateCropDimension("width", event.currentTarget.value)} /></label>
                <label class="field"><span>Altezza · px</span><input type="number" min="1" max={source.height} value={current.crop.height} onChange={(event) => updateCropDimension("height", event.currentTarget.value)} /></label>
              </div>
              <label class="checkbox-row"><input type="checkbox" checked={current.roundCrop} onChange={(event) => commit({ ...current, roundCrop: event.currentTarget.checked })} /><span>Round crop · maschera ellittica</span></label>
            </fieldset>

            <fieldset class="field" data-redaction-controls>
              <legend>Redazione distruttiva</legend>
              <p class="file-note">Non è un overlay reversibile: la regione viene sostituita nei pixel esportati. La pixelatura distrugge i pixel originali ma può conservare indizi visivi aggregati; usa il riempimento pieno per occultamento più forte.</p>
              <div class="actions">
                <button type="button" aria-pressed={interactionMode === "crop"} onClick={() => setInteractionMode("crop")}>Sposta ritaglio</button>
                <button type="button" aria-pressed={interactionMode === "redact"} onClick={() => setInteractionMode("redact")}>Disegna redazione</button>
              </div>
              <div class="field-grid">
                <label class="field"><span>Tipo</span><select value={redactionMode} onChange={(event) => setRedactionMode(event.currentTarget.value === "pixelate" ? "pixelate" : "solid")}><option value="solid">Riempimento pieno</option><option value="pixelate">Pixelatura distruttiva</option></select></label>
                <label class="field"><span>Colore pieno</span><input type="color" value={redactionColor} onInput={(event) => setRedactionColor(event.currentTarget.value)} /></label>
                <label class="field"><span>X</span><input type="number" min="0" value={redactionX} onInput={(event) => setRedactionX(event.currentTarget.value)} /></label>
                <label class="field"><span>Y</span><input type="number" min="0" value={redactionY} onInput={(event) => setRedactionY(event.currentTarget.value)} /></label>
                <label class="field"><span>Larghezza</span><input type="number" min="1" value={redactionWidth} onInput={(event) => setRedactionWidth(event.currentTarget.value)} /></label>
                <label class="field"><span>Altezza</span><input type="number" min="1" value={redactionHeight} onInput={(event) => setRedactionHeight(event.currentTarget.value)} /></label>
              </div>
              <button type="button" onClick={addNumericRedaction}>Aggiungi regione da coordinate</button>
              {current.redactions.length > 0 && <ul>{current.redactions.map((region, index) => <li key={`${index}-${region.x}-${region.y}`}><code>{region.mode}</code> · {region.x},{region.y} · {region.width}×{region.height} <button type="button" onClick={() => commit({ ...current, redactions: current.redactions.filter((_item, itemIndex) => itemIndex !== index) })}>Rimuovi</button></li>)}</ul>}
              <small>{current.redactions.length} regione/i. Undo ripristina esattamente lo stato precedente.</small>
            </fieldset>

            <fieldset class="field">
              <legend>Orientamento</legend>
              <div class="actions">
                <button type="button" onClick={() => commit({ ...current, rotate: nextQuarterTurn(current.rotate) })}>Ruota 90°</button>
                <button type="button" aria-pressed={current.flipHorizontal} onClick={() => commit({ ...current, flipHorizontal: !current.flipHorizontal })}>Ribalta orizzontale</button>
                <button type="button" aria-pressed={current.flipVertical} onClick={() => commit({ ...current, flipVertical: !current.flipVertical })}>Ribalta verticale</button>
              </div>
            </fieldset>

            <fieldset class="field">
              <legend>Bordo e sfondo</legend>
              <div class="field-grid">
                <label class="field"><span>Bordo · {current.border}px</span><input type="range" min="0" max="128" step="1" value={current.border} onInput={(event) => commit({ ...current, border: Number(event.currentTarget.value) })} /></label>
                <label class="field"><span>Colore bordo</span><input type="color" value={current.borderColor} onInput={(event) => commit({ ...current, borderColor: event.currentTarget.value })} /></label>
                <label class="field"><span>Gestione alpha</span><select value={current.backgroundMode} onChange={(event) => commit({ ...current, backgroundMode: event.currentTarget.value === "color" ? "color" : "transparent" })}><option value="transparent">Preserva trasparenza</option><option value="color">Appiattisci su colore</option></select></label>
                {current.backgroundMode === "color" && <label class="field"><span>Colore sfondo</span><input type="color" value={current.backgroundColor} onInput={(event) => commit({ ...current, backgroundColor: event.currentTarget.value })} /></label>}
              </div>
            </fieldset>

            <fieldset class="field">
              <legend>Tono</legend>
              <div class="field-grid">
                <label class="field"><span>Luminosità · {current.brightness}</span><input type="range" min="-100" max="100" step="1" value={current.brightness} onInput={(event) => commit({ ...current, brightness: Number(event.currentTarget.value) })} /></label>
                <label class="field"><span>Contrasto · {current.contrast}</span><input type="range" min="-100" max="100" step="1" value={current.contrast} onInput={(event) => commit({ ...current, contrast: Number(event.currentTarget.value) })} /></label>
                <label class="field"><span>Saturazione · {current.saturation}</span><input type="range" min="-100" max="100" step="1" value={current.saturation} onInput={(event) => commit({ ...current, saturation: Number(event.currentTarget.value) })} /></label>
              </div>
              <small>Il tono viene applicato ai pixel del contenuto prima di maschera, sfondo e bordo; l'alpha non viene alterato dai controlli tonali.</small>
            </fieldset>

            <ToolActions>
              <button type="button" onClick={undo} disabled={historyCount === 0 || operation.isRunning}>Annulla ultima modifica</button>
              <button type="button" onClick={redo} disabled={!history?.future.length || operation.isRunning}>Ripeti modifica</button>
              <button type="button" onClick={resetTransforms} disabled={historyCount === 0 || operation.isRunning}>Ripristina trasformazioni</button>
            </ToolActions>
            </div>
          </>
        )}

        <ImageProjectControls385 file={file} source={source} history={history} previous={savedProject} editable={workspaceMode === "transform"} onSaved={setSavedProject} onOpen={openSavedProject} />

        {preflightNote !== "" && <p class="file-note" role="status">{preflightNote}</p>}
        <InlineError message={previewError || operation.error} />
        <ToolActions>
          <ToolSubmitButton busy={operation.isRunning} busyLabel="Esportazione…">{workspaceMode === "perspective" ? "Esporta prospettiva PNG verificata" : "Esporta PNG verificato"}</ToolSubmitButton>
          {operation.isRunning ? <ToolCancelButton onCancel={operation.cancel} /> : <ToolResetButton onClick={resetAll} />}
        </ToolActions>
      </form>
      <ToolResultPanel eyebrow="Risultato verificato" placeholder="L'export PNG verificato apparirà qui, usando gli stessi pixel dell'anteprima." busy={operation.isRunning} state={gutterStateFor(operation.status)}>
        {result !== null && file !== null && <ImageResultV2 toolId="image-crop" result={result} sourceFiles={[file]} onReset={resetAll} onRetry={() => operation.run()} />}
      </ToolResultPanel>
    </ToolOperation>
  );
}
