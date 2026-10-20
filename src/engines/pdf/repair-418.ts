import { PDFDocument } from "pdf-lib";

const MAX_BYTES = 4 * 1024 * 1024;
const MAX_PAGES = 40;

export class PdfRepair418Error extends Error {
  constructor(readonly code: "REFUSED" | "UNSUPPORTED" | "LIMIT" | "CANCELLED" | "VERIFICATION_FAILED", message: string) {
    super(message);
    this.name = "PdfRepair418Error";
  }
}

export interface PdfRepair418Result {
  readonly bytes: Uint8Array;
  readonly profile: "single-classic-xref-pointer-only";
  readonly originalBytes: number;
  readonly repairedBytes: number;
  readonly pageCount: number;
  readonly changedByteRange: readonly [number, number];
  readonly losses: readonly string[];
  readonly note: string;
}

function refuse(code: PdfRepair418Error["code"], message: string): never {
  throw new PdfRepair418Error(code, message);
}

function cancelled(signal?: AbortSignal): void {
  if (signal?.aborted) refuse("CANCELLED", "PDF recovery cancelled.");
}

async function inspectIndependent(bytes: Uint8Array, signal?: AbortSignal): Promise<string> {
  cancelled(signal);
  const runningInNode = typeof process !== "undefined" && Boolean(process.versions?.node);
  const pdfjs = runningInNode
    ? await import("pdfjs-dist/legacy/build/pdf.mjs")
    : await import("pdfjs-dist");
  if (!runningInNode) {
    pdfjs.GlobalWorkerOptions.workerSrc = (await import("pdfjs-dist/build/pdf.worker.mjs?url")).default;
  }
  const task = pdfjs.getDocument({ data: new Uint8Array(bytes), stopAtErrors: true, useSystemFonts: false });
  try {
    const doc = await task.promise;
    if (doc.numPages < 1 || doc.numPages > MAX_PAGES) refuse("LIMIT", "PDF page budget exceeded.");
    const pages: unknown[] = [];
    for (let number = 1; number <= doc.numPages; number++) {
      cancelled(signal);
      const page = await doc.getPage(number);
      const content = await page.getTextContent();
      const annotations = await page.getAnnotations({ intent: "display" });
      pages.push({ view: page.view, text: content.items.map((item) => ("str" in item ? item.str : "")), annotations });
      page.cleanup();
    }
    return JSON.stringify(pages);
  } finally {
    await task.destroy();
  }
}

/** Check that the classic table describes every physical object exactly once. */
function verifyClassicTable(view: string, offset: number): void {
  const trailerAt = view.indexOf("trailer", offset + 4);
  if (trailerAt <= offset) refuse("REFUSED", "Classic table has no trailer.");
  const records = view.slice(offset, trailerAt).trim().split(/\r\n|\r|\n/).map((line) => line.trim());
  if (records.shift() !== "xref") refuse("REFUSED", "Malformed classic xref table.");
  const visible = new Set<string>();
  let cursor = 0;
  let total = 0;
  while (cursor < records.length) {
    const heading = /^(\d+) (\d+)$/.exec(records[cursor++] ?? "");
    if (!heading) refuse("REFUSED", "Invalid xref subsection.");
    const start = Number(heading[1]);
    const count = Number(heading[2]);
    total += count;
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(count) || count < 1 || total > 1024) {
      refuse("LIMIT", "Unsupported xref object count.");
    }
    for (let i = 0; i < count; i++) {
      const entry = /^(\d{10}) (\d{5}) ([fn])$/.exec(records[cursor++] ?? "");
      if (!entry) refuse("REFUSED", "Invalid fixed-width xref entry.");
      if (entry[3] !== "n") continue;
      const id = start + i;
      const generation = Number(entry[2]);
      const at = Number(entry[1]);
      const key = id + ":" + generation;
      if (visible.has(key) || at >= offset || at < 9 ||
          !view.slice(at, at + 50).startsWith(id + " " + generation + " obj")) {
        refuse("REFUSED", "Duplicate or mismatched xref object offset.");
      }
      visible.add(key);
    }
  }
  const physical = [...view.slice(0, offset).matchAll(/(?:^|[\r\n])(\d+) (\d+) obj\b/g)]
    .map((match) => match[1] + ":" + match[2]);
  if (physical.length !== visible.size || physical.some((key) => !visible.has(key))) {
    refuse("REFUSED", "Unindexed, duplicated or shadow PDF objects.");
  }
}

/** Restrictive recovery of an isolated damaged startxref pointer only. Never overwrites the original. */
export async function repairPdf418(input: Uint8Array, signal?: AbortSignal): Promise<PdfRepair418Result> {
  cancelled(signal);
  if (!(input instanceof Uint8Array) || input.byteLength < 50 || input.byteLength > MAX_BYTES) {
    refuse("LIMIT", "PDF recovery accepts 50 bytes to 4 MiB.");
  }
  const original = input.slice();
  const view = new TextDecoder("windows-1252").decode(original);
  if (!/^%PDF-1\.[0-7][\r\n]/.test(view)) refuse("REFUSED", "Invalid PDF header.");
  if (/(?:\/Encrypt\b|\/ObjStm\b|\/Type\s*\/XRef\b|\/Prev\b|\/ByteRange\b|\/Linearized\b)/.test(view)) {
    refuse("UNSUPPORTED", "Encrypted, signed, incremental, linearized or compressed-xref PDFs unsupported.");
  }
  const xrefs = [...view.matchAll(/(?:^|[\r\n])xref(?=[\r\n])/g)];
  if (xrefs.length !== 1) refuse("REFUSED", "Exactly one classic xref table required.");
  const xref = xrefs[0]!;
  const offset = xref.index + xref[0].length - 4;
  if (!/^xref[\r\n]+0\s+\d+[\r\n]/.test(view.slice(offset))) refuse("REFUSED", "Unsupported xref structure.");
  if ((view.match(/(?:^|[\r\n])trailer\s*<</g) ?? []).length !== 1) refuse("REFUSED", "Ambiguous trailer.");
  verifyClassicTable(view, offset);
  const footers = [...view.matchAll(/startxref\s+(\d+)\s+%%EOF/g)];
  const footer = footers[0];
  if (footers.length !== 1 || !footer || footer.index + footer[0].length !== view.trimEnd().length) {
    refuse("REFUSED", "Ambiguous PDF footer.");
  }
  if (!Number.isSafeInteger(Number(footer[1])) || Number(footer[1]) === offset) {
    refuse("REFUSED", "No isolated broken xref pointer.");
  }
  const position = footer.index + footer[0].indexOf(footer[1]!);
  const digits = new TextEncoder().encode(String(offset));
  const repaired = new Uint8Array(original.length - footer[1]!.length + digits.length);
  repaired.set(original.subarray(0, position));
  repaired.set(digits, position);
  repaired.set(original.subarray(position + footer[1]!.length), position + digits.length);
  if (repaired.length > MAX_BYTES) refuse("LIMIT", "Repaired PDF exceeds byte budget.");
  let before: string;
  try {
    before = await inspectIndependent(original, signal);
  } catch (error) {
    if (error instanceof PdfRepair418Error) throw error;
    refuse("VERIFICATION_FAILED", "Original visible content cannot be independently verified.");
  }
  cancelled(signal);
  try {
    const parsed = await PDFDocument.load(repaired, { ignoreEncryption: false, updateMetadata: false });
    if (parsed.getPageCount() < 1 || parsed.getPageCount() > MAX_PAGES) refuse("LIMIT", "Page budget exceeded.");
    const after = await inspectIndependent(repaired, signal);
    if (before !== after) refuse("VERIFICATION_FAILED", "Reconstruction changes visible pages, text or annotations.");
    return {
      bytes: repaired,
      profile: "single-classic-xref-pointer-only",
      originalBytes: original.byteLength,
      repairedBytes: repaired.byteLength,
      pageCount: parsed.getPageCount(),
      changedByteRange: [position, position + footer[1]!.length],
      losses: [],
      note: "Only startxref bytes were changed; both parsers agreed on visible page content. Keep original for independent inspection.",
    };
  } catch (error) {
    if (error instanceof PdfRepair418Error) throw error;
    refuse("VERIFICATION_FAILED", "Independent parser rejected the reconstructed PDF.");
  }
}
