/**
 * STR-420: strict local PDF -> semantic DOCX for unambiguous selectable text
 * and complete ruled tables. PDF.js supplies geometry, #254 validates grids,
 * and the already-adopted MIT docx writer emits real Word paragraphs/tables.
 */
import { pdfToMarkdown } from "./index";
import { visualLines53 } from "./text-layout-53";
import { previewPdfTable254, type PdfTablePreview254 } from "./pdf-table-xlsx-254";

export interface PdfDocx57Result {
  readonly bytes: Uint8Array;
  readonly filename: string;
  readonly pageCount: number;
  readonly sourceSha256: string;
  readonly textByPage: readonly { page: number; text: string }[];
  readonly tableCount: number;
  readonly losses: readonly string[];
  readonly policy: "editable-text-and-ruled-tables-no-faithful-layout";
}

export const PDF_DOCX_57_LIMITS = {
  maxInputBytes: 8 * 1024 * 1024, maxPages: 12, maxOutputBytes: 4 * 1024 * 1024,
} as const;

type Page420 = { page: number; text: string; width: number; height: number; table?: PdfTablePreview254 };
type WordBlock420 = { type: "paragraph"; text: string } | { type: "table"; rows: readonly (readonly string[])[] };
const losses = [
  "Sono ricostruiti testo orizzontale e tabelle con griglia completa; colonne affiancate e immagini sono rifiutate.",
  "Font, stili, margini interni delle celle e coordinate esatte non sono ricostruiti.",
  "La dimensione di pagina e l'ordine dei blocchi vengono conservati; il confronto visivo al pixel non e garantito.",
] as const;
const hex = (bytes: Uint8Array) => Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
const stopped = (signal?: AbortSignal) => {
  if (signal?.aborted) throw new DOMException("Conversione PDF annullata", "AbortError");
};

async function pages420(file: File, bytes: Uint8Array, count: number, signal?: AbortSignal): Promise<Page420[]> {
  const pdfjs = typeof document === "undefined"
    ? await import("pdfjs-dist/legacy/build/pdf.mjs") : await import("pdfjs-dist");
  if (typeof document !== "undefined") {
    pdfjs.GlobalWorkerOptions.workerSrc = (await import("pdfjs-dist/build/pdf.worker.mjs?url")).default;
  }
  const loading = pdfjs.getDocument({ data: bytes.slice(), useSystemFonts: true, disableFontFace: true });
  const abort = () => { void loading.destroy(); };
  signal?.addEventListener("abort", abort, { once: true });
  try {
    const pdf = await loading.promise;
    if (pdf.numPages !== count) throw new Error("PDF420_PAGE_MISMATCH");
    const result: Page420[] = [];
    const imageOps = Object.entries(pdfjs.OPS).filter(([name]) =>
      /^(?:paint.*Image|paint.*Mask|paintSolidColorImageMask)/u.test(name)).map(([, value]) => value);
    for (let number = 1; number <= count; number++) {
      stopped(signal);
      const page = await pdf.getPage(number);
      try {
        if (page.rotate !== 0) throw new Error("PDF420_ROTATED: Pagine ruotate non supportate.");
        const viewport = page.getViewport({ scale: 1 });
        const [content, operators] = await Promise.all([page.getTextContent(), page.getOperatorList()]);
        stopped(signal);
        if (operators.fnArray.some((op) => imageOps.includes(op))) {
          throw new Error("PDF420_IMAGE_UNSUPPORTED: Immagini PDF non ricostruibili come oggetti Word.");
        }
        const items = content.items.filter((item) => "str" in item && item.str.trim() !== "")
          .map((item) => {
            if (!("str" in item)) throw new Error("PDF420_LAYOUT_UNSUPPORTED");
            return item;
          });
        if (items.length > 5000) throw new Error("PDF420_LIMIT: Troppi frammenti testuali.");
        const text = visualLines53(items.map((item) => ({
          str: item.str, transform: item.transform, width: item.width,
        })));
        if (!text.trim()) throw new Error("PDF57_OCR_REQUIRED: La pagina e priva di testo.");
        let table: PdfTablePreview254 | undefined;
        if (operators.fnArray.includes(pdfjs.OPS.constructPath)) {
          try {
            table = await previewPdfTable254(file, {
              page: number,
              region: { x: 0, y: 0, width: viewport.width, height: viewport.height },
            }, signal);
          } catch (error) {
            // Even an incomplete grid or unrelated vector figure is outside
            // this intentionally narrow semantic reconstruction contract.
            throw new Error("PDF420_LAYOUT_UNSUPPORTED: Grafica o griglia non ricostruibile (" +
              (error instanceof Error ? error.message : "PDF") + ").");
          }
        }
        if (table) {
          const { x, y, width, height } = table.region;
          // The selected region is the page; reject any extra text outside
          // the actual detected table by comparing the recovered cell strings.
          const sourceWords = items.map((item) => item.str.trim()).filter(Boolean).sort();
          const cellWords = table.cells.flat().map((cell) => cell.trim()).filter(Boolean).sort();
          if (JSON.stringify(sourceWords) !== JSON.stringify(cellWords) ||
              x !== 0 || y !== 0 || width !== viewport.width || height !== viewport.height) {
            throw new Error("PDF420_MIXED_LAYOUT: Testo e griglia di pagina non corrispondono.");
          }
        } else {
          // A page whose text has side-by-side blocks has no unambiguous
          // reading order. Do not misrepresent columns as plain paragraphs.
          const fragments = items.map((item) => ({
            x: item.transform[4]!, y: item.transform[5]!,
            right: item.transform[4]! + item.width,
          }));
          for (const a of fragments) for (const b of fragments) {
            if (a === b || Math.abs(a.y - b.y) > 2 || b.x <= a.x) continue;
            if (b.x - a.right > 36) {
              throw new Error("PDF420_COLUMNS_UNSUPPORTED: Colonne o blocchi affiancati ambigui.");
            }
          }
          // Independent columns can have staggered baselines. Their text
          // clusters still occupy disjoint horizontal bands and overlap in Y.
          // Require two fragments on each side to avoid confusing a single
          // right-aligned line with a second column.
          if (fragments.length >= 4) for (const edge of new Set(fragments.map(({ right }) => right))) {
            let left = 0, right = 0;
            let leftMinY = Infinity, leftMaxY = -Infinity;
            let rightMinY = Infinity, rightMaxY = -Infinity;
            for (const part of fragments) {
              if (part.right <= edge + 0.5) {
                left++;
                leftMinY = Math.min(leftMinY, part.y);
                leftMaxY = Math.max(leftMaxY, part.y);
              } else if (part.x >= edge + 36) {
                right++;
                rightMinY = Math.min(rightMinY, part.y);
                rightMaxY = Math.max(rightMaxY, part.y);
              } else { left = -1; break; }
            }
            if (left >= 2 && right >= 2 &&
                Math.min(leftMaxY, rightMaxY) > Math.max(leftMinY, rightMinY)) {
              throw new Error("PDF420_COLUMNS_UNSUPPORTED: Colonne sfalsate con lettura ambigua.");
            }
          }
        }
        result.push({ page: number, text, width: viewport.width, height: viewport.height, ...(table ? { table } : {}) });
      } finally { page.cleanup(); }
    }
    return result;
  } finally {
    signal?.removeEventListener("abort", abort);
    await loading.destroy().catch(() => undefined);
  }
}

export async function pdfToDocx57(file: File, signal?: AbortSignal): Promise<PdfDocx57Result> {
  if (!(file instanceof File) || !/\.pdf$/iu.test(file.name) ||
      file.size < 8 || file.size > PDF_DOCX_57_LIMITS.maxInputBytes) {
    throw new Error("PDF57_INPUT: Seleziona un PDF locale valido fino a 8 MiB.");
  }
  stopped(signal);
  const source = new Uint8Array(await file.arrayBuffer());
  stopped(signal);
  const converted = await pdfToMarkdown(file.name, source, signal);
  stopped(signal);
  if (converted.status === "encrypted") {
    throw new Error("PDF57_ENCRYPTED: Il PDF cifrato deve essere sbloccato con un processo autorizzato.");
  }
  if (converted.status !== "converted" || converted.pages.length === 0) {
    throw new Error("PDF57_OCR_REQUIRED: Il PDF non contiene testo selezionabile; occorre OCR locale.");
  }
  if (converted.truncated || converted.pageCount > PDF_DOCX_57_LIMITS.maxPages ||
      converted.pages.length !== converted.pageCount) {
    throw new Error("PDF57_LIMIT: Massimo 12 pagine, senza testo troncato.");
  }
  if (converted.pages.some(({ text, truncated }) => truncated || !text.trim())) {
    throw new Error("PDF57_OCR_REQUIRED: Almeno una pagina non contiene testo completo.");
  }

  const sourceSha256 = hex(new Uint8Array(await crypto.subtle.digest("SHA-256", source)));
  const pages = await pages420(file, source, converted.pageCount, signal);
  if (pages.some(({ width, height }) => Math.abs(width - pages[0]!.width) > 0.5 ||
      Math.abs(height - pages[0]!.height) > 0.5)) {
    throw new Error("PDF420_PAGE_SIZE_UNSUPPORTED: Le pagine hanno dimensioni differenti.");
  }
  const { Document, Packer, Paragraph, Table, TableCell, TableRow, TextRun, WidthType } = await import("docx");
  const blocks: WordBlock420[] = [];
  const children: Array<InstanceType<typeof Paragraph> | InstanceType<typeof Table>> = [];
  const paragraph = (text: string, pageBreakBefore = false) => {
    children.push(new Paragraph({ children: [new TextRun(text)], ...(pageBreakBefore ? { pageBreakBefore } : {}) }));
    blocks.push({ type: "paragraph", text });
  };
  paragraph("PDF originale: " + file.name);
  paragraph("SHA-256 PDF: " + sourceSha256);
  paragraph("AVVERTENZE: ricostruzione semantica limitata, senza fedelta visiva completa.");
  for (const loss of losses) paragraph(loss);
  for (const page of pages) {
    paragraph("Pagina PDF " + page.page + " di " + pages.length + " · " + file.name, page.page > 1);
    if (page.table) {
      const rows = page.table.cells;
      children.push(new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: rows.map((row) => new TableRow({
          children: row.map((cell) => new TableCell({
            children: [new Paragraph({ children: [new TextRun(cell)] })],
          })),
        })),
      }));
      blocks.push({ type: "table", rows });
    } else {
      for (const line of page.text.split("\n").filter(Boolean)) paragraph(line);
    }
  }
  stopped(signal);
  const document = new Document({
    creator: "", lastModifiedBy: "",
    sections: [{
      properties: {
        page: {
          size: { width: Math.round(pages[0]!.width * 20), height: Math.round(pages[0]!.height * 20) },
          margin: { top: 720, right: 720, bottom: 720, left: 720 },
        },
      },
      children,
    }],
  });
  const bytes = new Uint8Array(await Packer.toArrayBuffer(document));
  if (bytes.length < 100 || bytes.length > PDF_DOCX_57_LIMITS.maxOutputBytes) {
    throw new Error("PDF57_LIMIT: DOCX generato troppo grande o vuoto.");
  }
  const [{ analyzeOoxmlPackage }, { extractDocxSemantics }] = await Promise.all([
    import("../ooxml/package"), import("../ooxml/office-semantics"),
  ]);
  if (analyzeOoxmlPackage(bytes).kind !== "docx") throw new Error("PDF57_VERIFY: Pacchetto Word non valido.");
  const reopened = await extractDocxSemantics(bytes);
  stopped(signal);
  if (reopened.blocks.length !== blocks.length || blocks.some((block, index) => {
    const actual = reopened.blocks[index];
    if (block.type === "table") {
      return actual?.type !== "table" || JSON.stringify(actual.rows) !== JSON.stringify(block.rows);
    }
    return actual?.type !== "paragraph" || actual.text !== block.text;
  }) || reopened.assets.length !== 0) {
    throw new Error("PDF57_VERIFY: La riapertura Word ha perso testo, tabella o provenienza.");
  }
  return {
    bytes,
    filename: file.name.replace(/\.pdf$/iu, "").replaceAll(/[\\/:*?"<>|]/gu, "-").slice(0, 100) + ".docx",
    pageCount: pages.length, sourceSha256, tableCount: pages.filter(({ table }) => !!table).length,
    textByPage: pages.map(({ page, text }) => ({ page, text })), losses,
    policy: "editable-text-and-ruled-tables-no-faithful-layout",
  };
}
