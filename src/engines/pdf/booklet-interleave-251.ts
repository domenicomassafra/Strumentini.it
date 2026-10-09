import { inspectPdfBytes, mutatePdf } from "./index";
import { parsePdf, type PdfDocumentModel } from "./parser";
import { buildPdfFromPages, createSimplePdf, type PdfBuildPage } from "./writer";
import { createPdfNUp } from "./n-up";
import type { PdfArtifact } from "./types";

export type DuplexFlip = "short-edge" | "long-edge";
export type InterleaveBackOrder = "forward" | "reverse";
export type MismatchPolicy = "reject" | "pad-shorter";
export type BookletPaper = "a4" | "letter";

export interface Booklet251Options {
  readonly flip: DuplexFlip;
  readonly paper: BookletPaper;
  readonly margin: number;
  readonly gap: number;
}
export interface Interleave251Options {
  readonly backOrder: InterleaveBackOrder;
  readonly mismatchPolicy: MismatchPolicy;
}
export interface BookletFace251 {
  /** Printed face in output PDF order, 1-based. Faces 1/2 are physical sheet 1 front/back. */
  readonly face: number;
  readonly sheet: number;
  readonly side: "front" | "back";
  readonly left: number | null;
  readonly right: number | null;
  readonly rotation: 0 | 180;
}
export interface BookletPlan251 {
  readonly mode: "booklet";
  readonly inputPages: number;
  readonly paddedPages: number;
  readonly blankPages: number;
  readonly sheetCount: number;
  readonly faces: readonly BookletFace251[];
  readonly duplexNote: string;
  readonly fidelity: "rasterized-output";
}
export interface InterleaveSlot251 {
  readonly outputPage: number;
  readonly source: "front" | "back";
  readonly sourcePage: number | null;
}
export interface InterleavePlan251 {
  readonly mode: "interleave";
  readonly frontPages: number;
  readonly backPages: number;
  readonly blankPages: number;
  readonly pages: readonly InterleaveSlot251[];
  readonly policy: MismatchPolicy;
  readonly backOrder: InterleaveBackOrder;
  readonly fidelity: "vector-pages-cloned";
}
export interface BookletOutput251 {
  readonly artifact: PdfArtifact;
  readonly plan: BookletPlan251;
}
export interface InterleaveOutput251 {
  readonly artifact: PdfArtifact;
  readonly plan: InterleavePlan251;
}

function requireCount(value: number, label: string, max: number): void {
  if (!Number.isInteger(value) || value < 1 || value > max) {
    throw new Error(`PDF_LIMIT: ${label} deve avere da 1 a ${max} pagine`);
  }
}
function requireFile(value: File, label: string): void {
  if (!(value instanceof File) || value.size < 8 || value.size > 25 * 1024 * 1024) {
    throw new Error(`PDF_LIMIT: ${label} deve essere un PDF locale fino a 25 MiB`);
  }
}
function checkSignal(signal?: AbortSignal): void {
  if (signal?.aborted) throw new DOMException("Imposizione PDF annullata", "AbortError");
}
function requireSource(bytes: Uint8Array) {
  const inspected = inspectPdfBytes(bytes);
  if (inspected.encrypted) throw new Error("UNSUPPORTED_CAPABILITY: PDF protetto da password");
  return inspected;
}
function pageSource(file: Uint8Array) {
  const inspected = requireSource(file);
  const model = parsePdf(file);
  // buildPdfFromPages uses safe flattening and deliberately discards interactive
  // actions. Reject sources where that would otherwise silently lose content.
  const root = model.root === null ? undefined : model.objects.get(model.root.id)?.value;
  const interactiveCatalogKeys = ["AcroForm", "OpenAction", "AA", "Names", "Perms"];
  if (root?.kind === "dict" && interactiveCatalogKeys.some((key) => root.entries.has(key))) {
    throw new Error("UNSUPPORTED_CAPABILITY: Il PDF contiene moduli o azioni interattive non preservabili");
  }
  if (hasInteractivePage(model) || inspected.links.length > 0 || inspected.forms.length > 0) {
    throw new Error("UNSUPPORTED_CAPABILITY: Pagine annotate, link o moduli interattivi non preservabili");
  }
  return { model, inspected };
}
function hasInteractivePage(model: PdfDocumentModel): boolean {
  return model.pages.some((page) =>
    page.object.value.kind === "dict" && ["Annots", "AA", "A", "PresSteps"].some((key) =>
      page.object.value.kind === "dict" && page.object.value.entries.has(key)));
}
function blankLike(width: number, height: number): PdfBuildPage {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width < 50 || height < 50 || width > 14400 || height > 14400) {
    throw new Error("INVALID_INPUT: Dimensioni pagina bianca invalide");
  }
  // A real white PDF page (empty string has no visible glyphs), not a placeholder.
  const model = parsePdf(createSimplePdf([""], { width, height }));
  return { document: model, page: model.pages[0]! };
}
function artifact(bytes: Uint8Array, filename: string, pageCount: number): PdfArtifact {
  const copy = Uint8Array.from(bytes);
  return {
    bytes: copy, blob: new Blob([copy], { type: "application/pdf" }),
    filename, mime: "application/pdf", pageCount,
  };
}

/** Full-booklet nested fold; 4 logical pages per physical sheet, two PDF faces each. */
export function planBooklet251(pageCount: number, options: Booklet251Options): BookletPlan251 {
  requireCount(pageCount, "Booklet", 32);
  if (!options || !["short-edge", "long-edge"].includes(options.flip)) throw new Error("INVALID_INPUT: Seleziona il lato del duplex");
  if (!["a4", "letter"].includes(options.paper)) throw new Error("INVALID_INPUT: Carta A4 o Letter richiesta");
  if (!Number.isFinite(options.margin) || options.margin < 0 || options.margin > 72 ||
      !Number.isFinite(options.gap) || options.gap < 0 || options.gap > 36) {
    throw new Error("INVALID_INPUT: Margine 0–72 pt, spazio 0–36 pt");
  }
  const paddedPages = Math.ceil(pageCount / 4) * 4;
  const sheetCount = paddedPages / 4;
  const mapped = (number: number) => number <= pageCount ? number : null;
  const faces: BookletFace251[] = [];
  for (let sheet = 0; sheet < sheetCount; sheet += 1) {
    faces.push({
      face: sheet * 2 + 1, sheet: sheet + 1, side: "front",
      left: mapped(paddedPages - sheet * 2), right: mapped(1 + sheet * 2), rotation: 0,
    });
    faces.push({
      face: sheet * 2 + 2, sheet: sheet + 1, side: "back",
      left: mapped(2 + sheet * 2), right: mapped(paddedPages - 1 - sheet * 2),
      rotation: options.flip === "long-edge" ? 180 : 0,
    });
  }
  const all = faces.flatMap((face) => [face.left, face.right]).filter((num): num is number => num !== null);
  if (all.length !== pageCount || new Set(all).size !== pageCount) throw new Error("PDF_OUTPUT_MISMATCH: Booklet source page loss");
  return {
    mode: "booklet", inputPages: pageCount, paddedPages, blankPages: paddedPages - pageCount,
    sheetCount, faces,
    duplexNote: options.flip === "short-edge"
      ? "Stampa duplex lato corto su carta orizzontale; fronte e retro nell'ordine 1,2,3,4… senza riordino del driver."
      : "Stampa duplex lato lungo su carta orizzontale: il PDF ruota fisicamente di 180° ciascun retro per compensare il ribaltamento. Disabilitare l'auto-rotazione nel driver.",
    fidelity: "rasterized-output",
  };
}

/** Back pages can be fed in the same direction or reversed from the duplex scanner. */
export function planInterleave251(frontPages: number, backPages: number, options: Interleave251Options): InterleavePlan251 {
  requireCount(frontPages, "Fronte", 32);
  requireCount(backPages, "Retro", 32);
  if (!options || !["forward", "reverse"].includes(options.backOrder) ||
      !["reject", "pad-shorter"].includes(options.mismatchPolicy)) throw new Error("INVALID_INPUT: Policy retro/mismatch non valida");
  if (frontPages !== backPages && options.mismatchPolicy === "reject") {
    throw new Error(`LENGTH_MISMATCH: ${frontPages} pagine fronte e ${backPages} retro; seleziona esplicitamente «Aggiungi pagine bianche»`);
  }
  const count = Math.max(frontPages, backPages);
  const pages: InterleaveSlot251[] = [];
  for (let index = 0; index < count; index += 1) {
    pages.push({ outputPage: pages.length + 1, source: "front", sourcePage: index < frontPages ? index + 1 : null });
    pages.push({ outputPage: pages.length + 1, source: "back",
      sourcePage: index < backPages ? options.backOrder === "reverse" ? backPages - index : index + 1 : null });
  }
  const usedFronts = pages.filter((page) => page.source === "front" && page.sourcePage !== null);
  const usedBacks = pages.filter((page) => page.source === "back" && page.sourcePage !== null);
  if (usedFronts.length !== frontPages || usedBacks.length !== backPages) throw new Error("PDF_OUTPUT_MISMATCH: Interleave page loss");
  return {
    mode: "interleave", frontPages, backPages, blankPages: count * 2 - frontPages - backPages,
    pages, policy: options.mismatchPolicy, backOrder: options.backOrder,
    fidelity: "vector-pages-cloned",
  };
}

/**
 * Reuse the public #250 image composer without changing or taking ownership of
 * any n-up file. Imposed pages become JPEG raster: glyphs are no longer selectable.
 */
export async function createBooklet251(file: File, options: Booklet251Options, signal?: AbortSignal): Promise<BookletOutput251> {
  requireFile(file, "Sorgente");
  checkSignal(signal);
  const { model, inspected } = pageSource(new Uint8Array(await file.arrayBuffer()));
  const plan = planBooklet251(model.pages.length, options);
  checkSignal(signal);
  const first = inspected.pages[0]!;
  const blank = blankLike(first.width, first.height);
  const sourcePages: PdfBuildPage[] = plan.faces.flatMap((face) =>
    [face.left, face.right].map((number): PdfBuildPage =>
      number === null ? blank : { document: model, page: model.pages[number - 1]! }));
  const reordered = buildPdfFromPages(sourcePages, { flatten: true, stripMetadata: true });
  checkSignal(signal);
  const nup = await createPdfNUp(new File([Uint8Array.from(reordered)], "booklet-imposition-input.pdf", { type: "application/pdf" }), {
    mode: "custom", rows: 1, columns: 2, paper: options.paper, orientation: "landscape",
    margin: options.margin, gap: options.gap, order: "row-major",
  }, signal);
  let output = nup.artifact.bytes;
  if (options.flip === "long-edge") {
    const rotations: Record<number, 180> = Object.fromEntries(
      plan.faces.filter((face) => face.side === "back").map((face) => [face.face, 180 as const]));
    output = (await mutatePdf(output, { kind: "rotate", rotations, flatten: true, stripMetadata: true }, signal))[0]!.bytes;
  }
  const inspectedOutput = requireSource(output);
  if (inspectedOutput.pageCount !== plan.faces.length || inspectedOutput.pages.some((page, index) =>
    Math.abs(page.width - nup.plan.sheetWidth) > 0.05 ||
    Math.abs(page.height - nup.plan.sheetHeight) > 0.05 ||
    page.rotation !== plan.faces[index]!.rotation)) {
    throw new Error("PDF_OUTPUT_MISMATCH: Geometria o rotazione booklet non verificata");
  }
  return { artifact: artifact(output, "pdf-booklet-251.pdf", plan.faces.length), plan };
}

/** Vector-preserving file interleave; missing sides are actual blank pages. */
export async function createInterleave251(front: File, back: File, options: Interleave251Options, signal?: AbortSignal): Promise<InterleaveOutput251> {
  requireFile(front, "Fronte");
  requireFile(back, "Retro");
  checkSignal(signal);
  const fronts = pageSource(new Uint8Array(await front.arrayBuffer()));
  const backs = pageSource(new Uint8Array(await back.arrayBuffer()));
  const plan = planInterleave251(fronts.model.pages.length, backs.model.pages.length, options);
  const pages: PdfBuildPage[] = plan.pages.map((slot) => {
    const source = slot.source === "front" ? fronts : backs;
    if (slot.sourcePage !== null) return { document: source.model, page: source.model.pages[slot.sourcePage - 1]! };
    const counterpart = slot.source === "front" ? backs : fronts;
    const geometry = counterpart.inspected.pages[Math.min(Math.floor((slot.outputPage - 1) / 2), counterpart.inspected.pageCount - 1)]!;
    return blankLike(geometry.width, geometry.height);
  });
  checkSignal(signal);
  const output = buildPdfFromPages(pages, { flatten: true, stripMetadata: true });
  const check = requireSource(output);
  if (check.pageCount !== plan.pages.length) throw new Error("PDF_OUTPUT_MISMATCH: Interleave pages missing");
  return { artifact: artifact(output, "pdf-interleave-251.pdf", plan.pages.length), plan };
}
