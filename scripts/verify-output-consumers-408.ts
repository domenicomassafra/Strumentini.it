/**
 * #408 — Independent, offline, read-only consumer gate for six REAL generated
 * output formats. No UI/Gold receipts, no network calls, no persistence.
 *
 * Run: npx tsx scripts/verify-output-consumers-408.ts
 * Sources are the existing producer modules; consumers are independent:
 *   PDF  pdfjs-dist; PNG sharp/libvips; XLSX read-excel-file;
 *   DOCX fflate + the separately locked sax XML parser;
 *   CSV  a bounded standalone RFC4180 state machine (not PapaParse);
 *   WAV  a strict RIFF/PCM reader (not the browser-audio engine).
 * Only standalone format-level reopen is proved: no Word/Excel app, physical
 * playback, cloud renderer, accessibility/UI, or visual fidelity is claimed.
 */

import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { OUTPUT_408_MAX_ZIP_PARTS, zipParts408 } from "./output-consumers-408-zip";
export { OUTPUT_408_MAX_ZIP_PARTS, OUTPUT_408_MAX_EXPANDED_BYTES } from "./output-consumers-408-zip";
import sharp from "sharp";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import readXlsxFile from "read-excel-file/universal";
import { createSimplePdf } from "../src/engines/pdf/writer";
import { compressPngLossless47 } from "../src/engines/image/png-lossless-47";
import { cleanCsvText } from "../src/engines/table/csv";
import { generateDocxFromSemanticText } from "../src/engines/ooxml/office-semantics";
import { csvToXlsx } from "../src/engines/table/spreadsheet-interchange";
import { renderAudioTimelineDsp231 } from "../src/engines/browser-audio/timeline-dsp-231";
import { audioDspCorpus231 } from "../tests/fixtures/audio-dsp-231-corpus";

export const OUTPUT_408_MAX_BYTES = 4 * 1024 * 1024;
const UTF8 = new TextDecoder("utf-8", { fatal: true });
const encoder = new TextEncoder();

export type Format408 = "pdf" | "png" | "csv" | "docx" | "xlsx" | "wav";
export interface Output408 { readonly format: Format408; readonly mime: string; readonly filename: string; readonly bytes: Uint8Array }
export type ConsumerResult408 =
  | { readonly status: "PASS"; readonly format: Format408; readonly oracle: string; readonly sha256: string; readonly byteLength: number; readonly facts: Readonly<Record<string, number | string | boolean>> }
  | { readonly status: "FAIL"; readonly format: Format408; readonly reason: string }
  | { readonly status: "NOT_RUN"; readonly format: Format408; readonly reason: string };

const contracts: Readonly<Record<Format408, { mime: string; extension: string; oracle: string }>> = {
  pdf: { mime: "application/pdf", extension: ".pdf", oracle: "pdfjs-dist/legacy" },
  png: { mime: "image/png", extension: ".png", oracle: "sharp/libvips" },
  csv: { mime: "text/csv", extension: ".csv", oracle: "independent RFC4180 UTF-8 decoder" },
  docx: { mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", extension: ".docx", oracle: "fflate ZIP + sax XML consumer" },
  xlsx: { mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", extension: ".xlsx", oracle: "read-excel-file/universal" },
  wav: { mime: "audio/wav", extension: ".wav", oracle: "independent RIFF/PCM16 reader" },
};

function refuse(reason: string): never { throw new Error(reason); }
function verify(condition: unknown, reason: string): asserts condition { if (!condition) refuse(reason); }
function ascii(bytes: Uint8Array, from: number, to: number): string {
  return String.fromCharCode(...bytes.subarray(from, to));
}

function validateEnvelope(output: Output408): void {
  const expected = contracts[output.format];
  verify(expected !== undefined, "UNKNOWN_FORMAT");
  verify(output.mime === expected.mime, `WRONG_MIME expected=${expected.mime}`);
  verify(output.filename.endsWith(expected.extension) && /^[a-z0-9][a-z0-9._-]{0,79}$/iu.test(output.filename), "WRONG_EXTENSION_OR_NAME");
  verify(output.bytes instanceof Uint8Array && output.bytes.length > 0, "EMPTY_BYTES");
  verify(output.bytes.byteLength <= OUTPUT_408_MAX_BYTES, "BYTE_BUDGET_EXCEEDED");
  const bytes = output.bytes;
  if (output.format === "pdf") {
    verify(bytes.length >= 32 && ascii(bytes, 0, 5) === "%PDF-", "BAD_PDF_MAGIC");
    verify(/%%EOF\s*$/u.test(ascii(bytes, Math.max(0, bytes.length - 32), bytes.length)), "PDF_EOF_MISSING_OR_TRAILING_GARBAGE");
  } else if (output.format === "png") {
    verify(bytes.length >= 57 && [137, 80, 78, 71, 13, 10, 26, 10].every((n, i) => bytes[i] === n), "BAD_PNG_MAGIC");
    verify(bytes.length >= 12 && ascii(bytes, bytes.length - 8, bytes.length - 4) === "IEND", "PNG_IEND_MISSING");
    // Exact final empty IEND chunk plus CRC; do not accept hidden trailing data.
    verify([...bytes.subarray(bytes.length - 12)].every((b, i) => b === [0, 0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130][i]), "PNG_IEND_OR_TRAILING_BYTES");
  } else if (output.format === "docx" || output.format === "xlsx") {
    verify(bytes.length >= 100 && ascii(bytes, 0, 4) === "PK\x03\x04", "BAD_ZIP_MAGIC");
    // ZIP EOCD must be present, and at the final byte position; comments and
    // trailing bytes are refused for this deterministic producer family.
    let eocd = -1;
    for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) {
      if (ascii(bytes, i, i + 4) === "PK\x05\x06") { eocd = i; break; }
    }
    verify(eocd >= 0 && eocd + 22 === bytes.length, "ZIP_EOCD_MISSING_OR_TRAILING_BYTES");
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    verify(view.getUint16(eocd + 20, true) === 0, "ZIP_COMMENT_NOT_ALLOWED");
    verify(view.getUint16(eocd + 10, true) > 0 && view.getUint16(eocd + 10, true) <= OUTPUT_408_MAX_ZIP_PARTS, "ZIP_MEMBER_LIMIT");
  } else if (output.format === "wav") {
    verify(bytes.length >= 45 && ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 12) === "WAVE", "BAD_RIFF_MAGIC");
  } else {
    verify(bytes.length <= OUTPUT_408_MAX_BYTES, "CSV_SIZE_LIMIT");
  }
}

function readCsv408(bytes: Uint8Array): string[][] {
  const text = UTF8.decode(bytes);
  verify(text.length > 0 && !/\u0000|\uFEFF/u.test(text), "CSV_NOT_CLEAN_UTF8_TEXT");
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  let justClosed = false;
  let atCellStart = true;
  for (let i = 0; i < text.length; i++) {
    const char = text[i]!;
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (char === '"') { quoted = false; justClosed = true; }
      else { cell += char; }
      continue;
    }
    if (char === '"') { verify(atCellStart && !justClosed, "CSV_INVALID_QUOTE"); quoted = true; atCellStart = false; continue; }
    if (char === "," || char === "\n" || char === "\r") {
      row.push(cell); cell = ""; atCellStart = true; justClosed = false;
      if (char !== ",") {
        rows.push(row); row = [];
        if (char === "\r" && text[i + 1] === "\n") i++;
      }
    } else {
      verify(!justClosed && (char >= " " || char === "\t"), "CSV_UNESCAPED_CONTROL_OR_QUOTE");
      cell += char;
      atCellStart = false;
    }
    verify(rows.length < 1000 && cell.length < 32768, "CSV_RESOURCE_LIMIT");
  }
  verify(!quoted, "CSV_TRUNCATED_QUOTED_FIELD");
  if (!atCellStart || row.length > 0) { row.push(cell); rows.push(row); }
  verify(rows.length > 1 && rows.every((r) => r.length === rows[0]?.length), "CSV_EMPTY_OR_RAGGED");
  return rows;
}

/** sax is a transitive dependency pinned by package-lock, not the producer's
 * parser. require() avoids relying on missing optional ambient type packages;
 * the consumer stays strictly typed at this narrow boundary. */
async function docxText408(xml: Uint8Array): Promise<string> {
  interface SaxParser408 {
    onopentag: (node: { name: string }) => void;
    ontext: (text: string) => void;
    onclosetag: (name: string) => void;
    onerror: (error: Error) => void;
    onend: () => void;
    write(value: string): SaxParser408;
    close(): void;
  }
  const sax = createRequire(import.meta.url)("sax") as { parser(strict: boolean, options: { xmlns: boolean; trim: boolean }): SaxParser408 };
  const source = UTF8.decode(xml);
  verify(!/<!DOCTYPE|<!ENTITY/iu.test(source), "DOCX_XML_DTD_REFUSED");
  return await new Promise((resolveText, rejectText) => {
    let text = "";
    let inText = 0;
    const parser = sax.parser(true, { xmlns: false, trim: false });
    parser.onopentag = (node) => { if (node.name === "w:t") inText++; };
    parser.ontext = (part) => { if (inText > 0) text += part; };
    parser.onclosetag = (name) => { if (name === "w:t") inText--; };
    parser.onerror = (error) => rejectText(error);
    parser.onend = () => resolveText(text);
    try { parser.write(source).close(); } catch (error) { rejectText(error); }
  });
}

function wavFrames408(bytes: Uint8Array): { frames: number; peak: number; sampleRate: number } {
  // Producer contract is canonical 44-byte PCM16 LE, not RF64/float/coded WAV.
  const d = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  verify(bytes.length >= 46 && d.getUint32(4, true) + 8 === bytes.length, "WAV_RIFF_SIZE_MISMATCH");
  verify(ascii(bytes, 12, 16) === "fmt " && d.getUint32(16, true) === 16 && d.getUint16(20, true) === 1, "WAV_NOT_PCM");
  const channels = d.getUint16(22, true);
  const sampleRate = d.getUint32(24, true);
  verify(channels >= 1 && channels <= 2 && sampleRate >= 8000 && sampleRate <= 192000, "WAV_CHANNEL_RATE_LIMIT");
  verify(d.getUint16(34, true) === 16 && d.getUint16(32, true) === channels * 2 && d.getUint32(28, true) === sampleRate * channels * 2, "WAV_PCM_LAYOUT_MISMATCH");
  verify(ascii(bytes, 36, 40) === "data" && d.getUint32(40, true) === bytes.length - 44 && (bytes.length - 44) % (channels * 2) === 0, "WAV_TRUNCATED_OR_TRAILING");
  let peak = 0;
  for (let i = 44; i < bytes.length; i += 2) peak = Math.max(peak, Math.abs(d.getInt16(i, true)));
  const frames = (bytes.length - 44) / (channels * 2);
  verify(frames > 0 && peak > 0, "WAV_EMPTY_OR_SILENT");
  verify(channels === 2 && frames === 400, "WAV_EXPECTED_FIXTURE_SHAPE_MISMATCH");
  for (let frame = 0; frame < frames; frame++) {
    const expected = frame < 200 ? [24000, -12000] : frame < 300 ? [16000, -8000] : [8000, -4000];
    for (let channel = 0; channel < channels; channel++) {
      verify(d.getInt16(44 + (frame * channels + channel) * 2, true) === expected[channel], "WAV_SAMPLE_MISMATCH");
    }
  }
  return { frames, peak, sampleRate };
}

export async function verifyOutputConsumer408(output: Output408): Promise<ConsumerResult408> {
  try {
    validateEnvelope(output);
    const bytes = output.bytes;
    let facts: Record<string, number | string | boolean> = {};
    if (output.format === "pdf") {
      const task = getDocument({ data: bytes.slice(), disableAutoFetch: true, disableStream: true,
        useSystemFonts: true, disableFontFace: true });
      try {
        const doc = await task.promise;
        try {
          verify(doc.numPages === 1, "PDF_PAGE_COUNT_MISMATCH");
          const page = await doc.getPage(1);
          const text = (await page.getTextContent()).items.map((item) => "str" in item ? item.str : "").join(" ");
          verify(text.includes("CONSUMER408"), "PDF_SEMANTIC_TEXT_MISSING");
          facts = { pages: doc.numPages, exactMarker: true };
        } finally { doc.cleanup(); }
      } finally { await task.destroy(); }
    } else if (output.format === "png") {
      const image = sharp(bytes, { failOn: "error", limitInputPixels: 1_000_000 });
      const meta = await image.metadata();
      verify(meta.format === "png" && meta.width === 32 && meta.height === 24, "PNG_DECODE_OR_DIMENSIONS_MISMATCH");
      const { data, info } = await image.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      verify(info.width === 32 && info.height === 24 && info.channels === 4 && data.length === 32 * 24 * 4, "PNG_PIXEL_REOPEN_FAILED");
      for (let i = 0; i < data.length; i += 4) {
        verify(data[i] === 22 && data[i + 1] === 99 && data[i + 2] === 188 && data[i + 3] === 204, "PNG_PIXEL_SEMANTIC_MISMATCH");
      }
      facts = { width: info.width, height: info.height, rgbaBytes: data.length, pixelsMatched: 768 };
    } else if (output.format === "csv") {
      const rows = readCsv408(bytes);
      verify(rows.length === 3 && rows[0]?.[0] === "id" && rows[1]?.[0] === "000123" && rows[1]?.[1] === "comma,quoted" && rows[2]?.[1] === "line\nbreak", "CSV_SEMANTIC_ROUNDTRIP_MISMATCH");
      facts = { rows: rows.length, columns: rows[0]!.length, quotedCellsReopened: true };
    } else if (output.format === "docx") {
      const zip = zipParts408(bytes);
      verify(zip["word/document.xml"] && zip["[Content_Types].xml"] && zip["_rels/.rels"], "DOCX_MISSING_MANDATORY_PART");
      const contentTypes = UTF8.decode(zip["[Content_Types].xml"]!);
      verify(contentTypes.includes("wordprocessingml.document.main+xml"), "DOCX_CONTENT_TYPE_MISMATCH");
      const text = await docxText408(zip["word/document.xml"]!);
      verify(text.includes("CONSUMER408") && text.includes("000123"), "DOCX_SEMANTIC_TEXT_MISSING");
      facts = { members: Object.keys(zip).length, markerReopened: true, textCharacters: text.length };
    } else if (output.format === "xlsx") {
      const zip = zipParts408(bytes);
      verify(zip["xl/workbook.xml"] && zip["[Content_Types].xml"] && zip["xl/worksheets/sheet1.xml"], "XLSX_MISSING_REQUIRED_PART");
      const sheets = await readXlsxFile(Uint8Array.from(bytes).buffer as ArrayBuffer) as Array<{ sheet: string; data: unknown[][] }>;
      verify(sheets.length === 1 && sheets[0]?.data.length === 3, "XLSX_SHEET_COUNT_MISMATCH");
      verify(sheets[0]?.data[0]?.[0] === "id" && sheets[0]?.data[1]?.[0] === "000123" && sheets[0]?.data[1]?.[1] === "CONSUMER408" && sheets[0]?.data[2]?.[0] === "008", "XLSX_CELL_ROUNDTRIP_MISMATCH");
      facts = { sheets: sheets.length, rows: sheets[0]!.data.length, leadingZerosPreserved: true };
    } else {
      const decoded = wavFrames408(bytes);
      verify(decoded.frames === 400 && decoded.peak === 24000 && decoded.sampleRate === 8000, "WAV_AUDIO_SEMANTIC_MISMATCH");
      facts = { ...decoded, pcm16Reopened: true, samplesMatched: 800 };
    }
    return { status: "PASS", format: output.format, oracle: contracts[output.format].oracle,
      sha256: createHash("sha256").update(bytes).digest("hex"), byteLength: bytes.length, facts };
  } catch (error) {
    const reason = error instanceof Error ? error.message : "UNKNOWN_CONSUMER_FAILURE";
    if (/Cannot find package|Cannot find module|ERR_MODULE_NOT_FOUND/u.test(reason)) {
      return { status: "NOT_RUN", format: output.format, reason: `INDEPENDENT_ORACLE_NOT_INSTALLED: ${reason}` };
    }
    return { status: "FAIL", format: output.format, reason };
  }
}

/** Exercise actual production-path producer code with deterministic, bounded
 * source inputs. This does NOT imply live UI export has been tested. */
export async function generateOutputSamples408(): Promise<Output408[]> {
  const pdf = createSimplePdf(["CONSUMER408 real PDF generated"]);
  const sourcePng = await sharp({ create: { width: 32, height: 24, channels: 4,
    background: { r: 22, g: 99, b: 188, alpha: 0.8 } } }).png({ compressionLevel: 0 }).toBuffer();
  const png = await compressPngLossless47(new Blob([sourcePng], { type: "image/png" }));
  const csv = cleanCsvText('\uFEFFid,label\r\n000123,"comma,quoted"\r\n008,"line\nbreak"\r\n').output;
  const docx = await generateDocxFromSemanticText("# CONSUMER408\n\nCodice 000123", "markdown");
  const xlsx = await csvToXlsx("id,label\n000123,CONSUMER408\n008,ok\n");
  const { sources, edits, settings } = audioDspCorpus231();
  const wav = renderAudioTimelineDsp231(sources, edits, settings).wav;
  return [
    { format: "pdf", mime: contracts.pdf.mime, filename: "proof.pdf", bytes: pdf },
    { format: "png", mime: contracts.png.mime, filename: "proof.png", bytes: new Uint8Array(await png.blob.arrayBuffer()) },
    { format: "csv", mime: contracts.csv.mime, filename: "proof.csv", bytes: encoder.encode(csv) },
    { format: "docx", mime: contracts.docx.mime, filename: "proof.docx", bytes: new Uint8Array(docx.bytes) },
    { format: "xlsx", mime: contracts.xlsx.mime, filename: "proof.xlsx", bytes: new Uint8Array(xlsx.bytes) },
    { format: "wav", mime: contracts.wav.mime, filename: "proof.wav", bytes: wav },
  ];
}

export async function outputConsumerMatrix408(): Promise<{
  ticket: 408; mode: "OFFLINE_SOURCE_ONLY"; fixtureProfile: "deterministic-input; byte-identities-may-vary-with-producer-metadata";
  results: ConsumerResult408[]; externalOracles: { status: "NOT_RUN"; reason: string }[]; gate: "PASS_LOCAL" | "NO_GO";
}> {
  const outputs = await generateOutputSamples408();
  const results = await Promise.all(outputs.map(verifyOutputConsumer408));
  return {
    ticket: 408, mode: "OFFLINE_SOURCE_ONLY", fixtureProfile: "deterministic-input; byte-identities-may-vary-with-producer-metadata", results,
    externalOracles: [
      { status: "NOT_RUN", reason: "Microsoft Word/LibreOffice DOCX visual layout: no pinned independent installed desktop renderer under this gate" },
      { status: "NOT_RUN", reason: "Microsoft Excel/LibreOffice XLSX formulas/rendering: external application not exercised; cell values only" },
      { status: "NOT_RUN", reason: "WAV physical listening, other OS devices and audio codecs other than PCM16: not exercised" },
      { status: "NOT_RUN", reason: "UI download path, physical iOS/Android, release canary and rollback: not exercised" },
    ],
    gate: results.every((item) => item.status === "PASS") ? "PASS_LOCAL" : "NO_GO",
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const matrix = await outputConsumerMatrix408();
  process.stdout.write(`${JSON.stringify(matrix, null, 2)}\n`);
  if (matrix.gate !== "PASS_LOCAL") process.exitCode = 1;
}
