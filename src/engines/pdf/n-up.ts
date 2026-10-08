import { parsePdf, pdfArray, pdfDict, pdfName, pdfNumber } from "./parser";
import { PdfBuilder, parseJpeg } from "./writer";
import { PDF_LIMITS, type PdfArtifact } from "./types";

export type NUpMode = "2-up" | "4-up" | "custom";
export type NUpPaper = "a4" | "letter" | "custom";
export type NUpOrientation = "portrait" | "landscape";
export type NUpOrder = "row-major" | "column-major";

export interface PdfNUpOptions {
  readonly mode: NUpMode;
  readonly rows?: number;
  readonly columns?: number;
  readonly paper: NUpPaper;
  readonly orientation: NUpOrientation;
  readonly customWidth?: number;
  readonly customHeight?: number;
  readonly margin: number;
  readonly gap: number;
  readonly order: NUpOrder;
}
export interface PdfNUpCell {
  readonly slot: number;
  readonly row: number;
  readonly column: number;
  readonly sourcePage: number | null;
  /** PDF points, from bottom-left. Null source page means intentionally blank padding. */
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}
export interface PdfNUpSheet {
  readonly sheet: number;
  readonly cells: readonly PdfNUpCell[];
}
export interface PdfNUpPlan {
  readonly pageCount: number;
  readonly sheetCount: number;
  readonly rows: number;
  readonly columns: number;
  readonly slotsPerSheet: number;
  readonly blankSlots: number;
  readonly sheetWidth: number;
  readonly sheetHeight: number;
  readonly margin: number;
  readonly gap: number;
  readonly order: NUpOrder;
  readonly sheets: readonly PdfNUpSheet[];
  readonly fidelity: "rasterized-loss-of-selectable-text-links-and-vector-quality";
}

function integer(name: string, value: number, min: number, max: number): number {
  if (!Number.isInteger(value) || value < min || value > max) throw new Error(`INVALID_INPUT: ${name} deve essere intero da ${min} a ${max}`);
  return value;
}

export function planPdfNUp(pageCount: number, options: PdfNUpOptions): PdfNUpPlan {
  integer("Numero pagine", pageCount, 1, 64);
  const rows = options.mode === "2-up" ? 2 : options.mode === "4-up" ? 2
    : options.mode === "custom" ? integer("Righe", options.rows ?? 0, 1, 4) : 0;
  const columns = options.mode === "2-up" ? 1 : options.mode === "4-up" ? 2
    : options.mode === "custom" ? integer("Colonne", options.columns ?? 0, 1, 4) : 0;
  if (rows === 0 || columns === 0 || rows * columns > 8) throw new Error("INVALID_INPUT: Griglia massimo 8 pagine per foglio");
  if (options.order !== "row-major" && options.order !== "column-major") throw new Error("INVALID_INPUT: Ordine non valido");
  if (options.orientation !== "portrait" && options.orientation !== "landscape") throw new Error("INVALID_INPUT: Orientamento non valido");
  if (options.paper !== "a4" && options.paper !== "letter" && options.paper !== "custom") throw new Error("INVALID_INPUT: Carta non valida");
  const size = options.paper === "a4" ? [595.28, 841.89]
    : options.paper === "letter" ? [612, 792] : [options.customWidth, options.customHeight];
  let width = Number(size[0]), height = Number(size[1]);
  if (![width, height].every((value) => Number.isFinite(value) && value >= 240 && value <= 1200)) throw new Error("INVALID_INPUT: Carta tra 240 e 1200 pt");
  if (options.orientation === "landscape") [width, height] = [height, width];
  const margin = options.margin;
  const gap = options.gap;
  if (!Number.isFinite(margin) || margin < 0 || margin > 72 || !Number.isFinite(gap) || gap < 0 || gap > 36) throw new Error("INVALID_INPUT: Margini 0–72 pt, spazi 0–36 pt");
  const cellWidth = (width - 2 * margin - (columns - 1) * gap) / columns;
  const cellHeight = (height - 2 * margin - (rows - 1) * gap) / rows;
  if (cellWidth < 48 || cellHeight < 48) throw new Error("INVALID_INPUT: Celle troppo piccole");
  const slotsPerSheet = rows * columns;
  const sheetCount = Math.ceil(pageCount / slotsPerSheet);
  if (sheetCount > 32) throw new Error("PDF_LIMIT: Massimo 32 fogli n-up per lavoro");
  const sheets = Array.from({ length: sheetCount }, (_, index): PdfNUpSheet => {
    const cells = Array.from({ length: slotsPerSheet }, (_, slot): PdfNUpCell => {
      const row = options.order === "row-major" ? Math.floor(slot / columns) : slot % rows;
      const column = options.order === "row-major" ? slot % columns : Math.floor(slot / rows);
      const pageNumber = index * slotsPerSheet + slot + 1;
      return {
        slot: slot + 1, row, column, sourcePage: pageNumber <= pageCount ? pageNumber : null,
        x: margin + column * (cellWidth + gap),
        y: height - margin - (row + 1) * cellHeight - row * gap,
        width: cellWidth, height: cellHeight,
      };
    });
    return { sheet: index + 1, cells };
  });
  const assigned = sheets.flatMap((sheet) => sheet.cells.map((cell) => cell.sourcePage)).filter((page): page is number => page !== null);
  if (assigned.length !== pageCount || assigned.some((page, index) => page !== index + 1)) throw new Error("PDF_OUTPUT_MISMATCH: Pagine sorgenti perse o riordinate");
  return {
    pageCount, sheetCount, rows, columns, slotsPerSheet,
    blankSlots: sheetCount * slotsPerSheet - pageCount,
    sheetWidth: width, sheetHeight: height, margin, gap, order: options.order, sheets,
    fidelity: "rasterized-loss-of-selectable-text-links-and-vector-quality",
  };
}

function assertRunning(signal?: AbortSignal): void {
  if (signal?.aborted) throw new DOMException("PDF n-up annullato", "AbortError");
}

/** Independently parse each generated sheet and inspect its real PDF geometry and embedded JPEG. */
export function verifyPdfNUp(bytes: Uint8Array, plan: PdfNUpPlan): void {
  if (bytes.length > PDF_LIMITS.maxOutputBytes || new TextDecoder("ascii").decode(bytes.subarray(0, 5)) !== "%PDF-") throw new Error("PDF_OUTPUT_MISMATCH: Signature/dimensione output");
  const document = parsePdf(bytes);
  if (document.pages.length !== plan.sheetCount) throw new Error("PDF_OUTPUT_MISMATCH: Fogli prodotti mancanti");
  document.pages.forEach((page, index) => {
    if (page.object.value.kind !== "dict") throw new Error("PDF_OUTPUT_MISMATCH: Pagina PDF invalida");
    const rect = page.object.value.entries.get("MediaBox");
    if (rect?.kind !== "array" || rect.items.length !== 4) throw new Error("PDF_OUTPUT_MISMATCH: MediaBox assente");
    const numbers = rect.items.map((part) => part.kind === "literal" ? Number(part.value) : NaN);
    if (JSON.stringify(numbers) !== JSON.stringify([0, 0, plan.sheetWidth, plan.sheetHeight])) throw new Error(`PDF_OUTPUT_MISMATCH: Geometria foglio ${index + 1}`);
    const contents = page.object.value.entries.get("Contents");
    if (contents?.kind !== "ref" || document.objects.get(contents.id)?.value.kind !== "stream") throw new Error("PDF_OUTPUT_MISMATCH: Contenuto immagine assente");
    const resources = page.object.value.entries.get("Resources");
    if (resources?.kind !== "dict") throw new Error("PDF_OUTPUT_MISMATCH: Risorse pagina assenti");
    const xobjects = resources.entries.get("XObject");
    const imageRef = xobjects?.kind === "dict" ? xobjects.entries.get("Im0") : undefined;
    const image = imageRef?.kind === "ref" ? document.objects.get(imageRef.id)?.value : undefined;
    if (image?.kind !== "stream" || !parseJpeg(image.bytes)) throw new Error("PDF_OUTPUT_MISMATCH: JPEG imposition non riapribile");
  });
}

function pdfFromNUpJpegs(jpegs: readonly Uint8Array[], plan: PdfNUpPlan): Uint8Array {
  const builder = new PdfBuilder();
  const pagesRef = builder.reserve();
  const pageRefs = jpegs.map((bytes) => {
    const jpeg = parseJpeg(bytes);
    if (jpeg === null || jpeg.width < 1 || jpeg.height < 1) throw new Error("PDF_OUTPUT_MISMATCH: JPEG non verificato");
    const image = builder.putAuto({ kind: "stream", dictionary: pdfDict({
      Type: pdfName("XObject"), Subtype: pdfName("Image"), Width: pdfNumber(jpeg.width), Height: pdfNumber(jpeg.height),
      ColorSpace: pdfName("DeviceRGB"), BitsPerComponent: pdfNumber(8), Filter: pdfName("DCTDecode"),
    }), bytes: jpeg.bytes });
    const content = builder.putAuto({ kind: "stream", dictionary: pdfDict({}), bytes: new TextEncoder().encode(
      `q\n${plan.sheetWidth} 0 0 ${plan.sheetHeight} 0 0 cm\n/Im0 Do\nQ\n`,
    ) });
    return builder.putAuto(pdfDict({
      Type: pdfName("Page"),
      MediaBox: pdfArray([pdfNumber(0), pdfNumber(0), pdfNumber(plan.sheetWidth), pdfNumber(plan.sheetHeight)]),
      Resources: pdfDict({ XObject: pdfDict({ Im0: image }) }),
      Contents: content,
    }));
  });
  builder.put(pagesRef, pdfDict({ Type: pdfName("Pages"), Kids: pdfArray(pageRefs), Count: pdfNumber(pageRefs.length) }));
  const rootRef = builder.putAuto(pdfDict({ Type: pdfName("Catalog"), Pages: pagesRef }));
  return builder.build(rootRef, null);
}

/**
 * Rasterized n-up is deliberately explicit. All visible source pages are rendered
 * serially at bounded resolution; original text, vector geometry, and links are NOT preserved.
 */
export async function createPdfNUp(file: File, options: PdfNUpOptions, signal?: AbortSignal): Promise<{ artifact: PdfArtifact; plan: PdfNUpPlan }> {
  if (!(file instanceof File) || file.size < 8 || file.size > PDF_LIMITS.maxBytes) throw new Error("PDF_LIMIT: File PDF fuori limite");
  assertRunning(signal);
  const source = new Uint8Array(await file.arrayBuffer());
  assertRunning(signal);
  if (new TextDecoder("ascii").decode(source.subarray(0, 5)) !== "%PDF-") throw new Error("INVALID_PDF_SIGNATURE: PDF non valido");
  const [pdfjs, worker] = await Promise.all([import("pdfjs-dist"), import("pdfjs-dist/build/pdf.worker.mjs?url")]);
  assertRunning(signal);
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  const loading = pdfjs.getDocument({ data: source });
  const cancelLoading = () => { void loading.destroy(); };
  signal?.addEventListener("abort", cancelLoading, { once: true });
  try {
    const pdf = await loading.promise;
    const plan = planPdfNUp(pdf.numPages, options);
    const imageScale = Math.min(1.5, Math.sqrt(4_000_000 / (plan.sheetWidth * plan.sheetHeight)));
    const jpegs: Uint8Array[] = [];
    for (const sheet of plan.sheets) {
      assertRunning(signal);
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(plan.sheetWidth * imageScale);
      canvas.height = Math.round(plan.sheetHeight * imageScale);
      const ctx = canvas.getContext("2d", { alpha: false });
      if (ctx === null) throw new Error("UNSUPPORTED_CANVAS: PDF n-up richiede canvas locale");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      try {
        for (const cell of sheet.cells) {
          if (cell.sourcePage === null) continue;
          assertRunning(signal);
          const page = await pdf.getPage(cell.sourcePage);
          let sourceCanvas: HTMLCanvasElement | undefined;
          try {
            // PDF.js applies source CropBox and Rotate here; contain-fit never clips page pixels.
            const upright = page.getViewport({ scale: 1 });
            if (upright.width < 1 || upright.height < 1) throw new Error("UNSUPPORTED_CAPABILITY: Dimensioni pagina PDF non valide");
            if ((await page.getAnnotations({ intent: "display" })).length > 0) throw new Error(`UNSUPPORTED_CAPABILITY: Annotazioni sulla pagina ${cell.sourcePage}; esportazione visiva incompleta`);
            const fit = Math.min(cell.width / upright.width, cell.height / upright.height);
            const viewport = page.getViewport({ scale: fit * imageScale });
            sourceCanvas = document.createElement("canvas");
            sourceCanvas.width = Math.max(1, Math.ceil(viewport.width));
            sourceCanvas.height = Math.max(1, Math.ceil(viewport.height));
            if (sourceCanvas.width * sourceCanvas.height > 4_000_000) throw new Error("PDF_LIMIT: Raster pagina fuori limite");
            const sourceCtx = sourceCanvas.getContext("2d", { alpha: false });
            if (!sourceCtx) throw new Error("UNSUPPORTED_CANVAS: Renderer locale indisponibile");
            const render = page.render({ canvas: sourceCanvas, canvasContext: sourceCtx, viewport, background: "rgb(255,255,255)" });
            const cancelRender = () => render.cancel();
            signal?.addEventListener("abort", cancelRender, { once: true });
            try { await render.promise; }
            finally { signal?.removeEventListener("abort", cancelRender); }
            assertRunning(signal);
            const dx = (cell.x + (cell.width - upright.width * fit) / 2) * imageScale;
            const dy = (plan.sheetHeight - cell.y - cell.height + (cell.height - upright.height * fit) / 2) * imageScale;
            ctx.drawImage(sourceCanvas, dx, dy, upright.width * fit * imageScale, upright.height * fit * imageScale);
          } finally {
            if (sourceCanvas) { sourceCanvas.width = 0; sourceCanvas.height = 0; }
            page.cleanup();
          }
        }
        const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(
          (result) => result ? resolve(result) : reject(new Error("PDF_OUTPUT_MISMATCH: JPEG encode nullo")), "image/jpeg", 0.92,
        ));
        assertRunning(signal);
        if (blob.type !== "image/jpeg" || blob.size > PDF_LIMITS.maxImageBytes) throw new Error("PDF_OUTPUT_MISMATCH: JPEG MIME/dimensione inatteso");
        jpegs.push(new Uint8Array(await blob.arrayBuffer()));
      } finally { canvas.width = 0; canvas.height = 0; }
    }
    const bytes = pdfFromNUpJpegs(jpegs, plan);
    assertRunning(signal);
    verifyPdfNUp(bytes, plan);
    const output = bytes.slice();
    return {
      plan,
      artifact: { bytes: output, blob: new Blob([output], { type: "application/pdf" }), mime: "application/pdf", filename: "pdf-n-up-raster.pdf", pageCount: plan.sheetCount },
    };
  } finally {
    signal?.removeEventListener("abort", cancelLoading);
    await loading.destroy().catch(() => undefined);
  }
}
