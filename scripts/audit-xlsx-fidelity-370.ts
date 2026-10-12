/**
 * #370 offline XLSX donor experiment. The returned bytes are diagnostic and
 * never imply an approved converter. Independent oracle: Python ZIP/XML and
 * pinned openpyxl; donor: the installed, pinned SheetJS inside the #368 spike.
 */
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { analyzeOoxmlPackage } from "../src/engines/ooxml/package";

const HERE = dirname(fileURLToPath(import.meta.url));
const DEFAULT_SPIKE = resolve(HERE, "../spikes/heavy-local-feasibility");
const SHEETJS_VERSION = "0.18.5";
const SHEETJS_LICENSE = "Apache-2.0";
const SHEETJS_LICENSE_SHA256 = "4d2a38ac35cda06a555c84074a819d413339cd3691b822cae50f8f322fe01f64";
const MAX_INPUT_BYTES = 2 * 1024 * 1024;
const MAX_ORACLE_OUTPUT = 5 * 1024 * 1024;

const ORACLE_370 = String.raw`
import io, json, sys, zipfile, xml.etree.ElementTree as ET
from datetime import date, datetime
import openpyxl
from openpyxl.cell.rich_text import CellRichText, TextBlock

assert openpyxl.__version__ == '3.1.5', 'ORACLE_VERSION_MISMATCH'
data = sys.stdin.buffer.read()
with zipfile.ZipFile(io.BytesIO(data)) as zipf:
    infos = zipf.infolist()
    assert len(infos) <= 256, 'ORACLE_ENTRY_LIMIT'
    assert sum(i.file_size for i in infos) <= 16 * 1024 * 1024, 'ORACLE_EXPANSION_LIMIT'
    assert zipf.testzip() is None, 'ORACLE_ZIP_CORRUPT'
    names = set(zipf.namelist())
    assert '[Content_Types].xml' in names, 'ORACLE_CONTENT_TYPES_MISSING'
    content_types = zipf.read('[Content_Types].xml')
    content_root = ET.fromstring(content_types)
    # SheetJS emits an inert generic .bin Default type even without a VBA part.
    # Only actual macro members or active OOXML Override declarations refuse.
    assert all('vbaProject.bin' not in n and '/activeX/' not in n for n in names), 'ORACLE_MACRO_PART_REFUSED'
    assert not any(n.tag.endswith('Override') and any(x in n.attrib.get('ContentType', '') for x in ('macroEnabled', 'vbaProject', 'activeX')) for n in content_root), 'ORACLE_MACRO_REFUSED'
    ns = {'m': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
    formula_caches = {}
    rich_xml = 0
    for name in names:
        if name == 'xl/sharedStrings.xml':
            root = ET.fromstring(zipf.read(name))
            rich_xml += sum(1 for si in root.findall('m:si', ns) if len(si.findall('m:r', ns)) > 1)
        elif name.startswith('xl/worksheets/sheet') and name.endswith('.xml'):
            root = ET.fromstring(zipf.read(name))
            for cell in root.findall('.//m:sheetData/m:row/m:c', ns):
                formula = cell.find('m:f', ns)
                if formula is not None:
                    cached = cell.find('m:v', ns)
                    formula_caches[name + ':' + cell.attrib.get('r', '')] = cached.text if cached is not None else None
                if cell.find('m:is/m:r', ns) is not None:
                    rich_xml += 1
    external_rels = 0
    for name in names:
        if name.endswith('.rels'):
            root = ET.fromstring(zipf.read(name))
            external_rels += sum(node.attrib.get('TargetMode') == 'External' for node in root)
    external_workbook_links = sum(name.startswith('xl/externalLinks/') and name.endswith('.xml') for name in names)

book = openpyxl.load_workbook(io.BytesIO(data), data_only=False, read_only=False, rich_text=True, keep_links=True)
values = openpyxl.load_workbook(io.BytesIO(data), data_only=True, read_only=False, rich_text=True, keep_links=True)
cells = {}
for sheet in book:
    for row in sheet:
        for cell in row:
            if cell.value is None: continue
            value = cell.value
            if isinstance(value, (datetime, date)): value = value.isoformat()
            elif isinstance(value, CellRichText): value = str(value)
            key = sheet.title + '!' + cell.coordinate
            cached = values[sheet.title][cell.coordinate].value
            if isinstance(cached, (datetime, date)): cached = cached.isoformat()
            if not isinstance(cached, (str, int, float, bool, type(None))): cached = str(cached)
            cells[key] = {
                'type': cell.data_type, 'value': value, 'format': cell.number_format,
                'link': cell.hyperlink.target if cell.hyperlink else None,
                'richRuns': sum(isinstance(x, TextBlock) for x in cell.value) if isinstance(cell.value, CellRichText) else 0,
                'cached': cached if cell.data_type == 'f' else None,
            }
assert len(cells) <= 15000, 'ORACLE_CELL_LIMIT'
print(json.dumps({'sheets': book.sheetnames, 'cells': cells, 'richXml': rich_xml,
    'formulaCaches': formula_caches, 'externalRelationships': external_rels,
    'externalWorkbookLinks': external_workbook_links, 'zipMembers': len(names),
    'mediaParts': sorted(n for n in names if n.startswith('xl/media/') and not n.endswith('/')),
    'chartParts': sorted(n for n in names if n.startswith('xl/charts/') and n.endswith('.xml'))}, ensure_ascii=True))
`;

export interface XlsxCell370 {
  readonly type: string;
  readonly value: string | number | boolean;
  readonly format: string;
  readonly link: string | null;
  readonly richRuns: number;
  readonly cached: string | number | boolean | null;
}
export interface XlsxInventory370 {
  readonly sheets: string[];
  readonly cells: Record<string, XlsxCell370>;
  readonly richXml: number;
  readonly formulaCaches: Record<string, string | null>;
  readonly externalRelationships: number;
  readonly externalWorkbookLinks: number;
  readonly zipMembers: number;
  readonly mediaParts: string[];
  readonly chartParts: string[];
}
export interface XlsxDonorReport370 {
  readonly ticket: 370;
  readonly decision: "NO_GO";
  readonly promotionApproved: false;
  readonly donor: "xlsx@0.18.5";
  readonly oracle: "Python ZIP/XML + openpyxl@3.1.5";
  readonly sourceSha256: string;
  readonly candidateSha256: string | null;
  readonly inputBytes: number;
  readonly candidateBytes: number;
  readonly elapsedMs: number | null;
  readonly source: XlsxInventory370;
  readonly candidate: XlsxInventory370 | null;
  readonly mismatches: readonly string[];
  readonly refusalReasons: readonly string[];
  readonly mobilePerformance: "NOT_RUN";
}
export interface XlsxAuditOptions370 {
  readonly python: string;
  readonly spike?: string;
  readonly signal?: AbortSignal;
  readonly onCandidate?: (candidate: Buffer) => void;
}

const hash = (source: Uint8Array): string => createHash("sha256").update(source).digest("hex");
function fail(code: string): never { throw new Error(`XLSX370_${code}`); }
function checkCancel(signal?: AbortSignal): void {
  if (signal?.aborted) throw new DOMException("XLSX370 audit cancelled", "AbortError");
}
function inventory370(source: Buffer, python: string): XlsxInventory370 {
  const oracle = spawnSync(python, ["-c", ORACLE_370], {
    input: source, timeout: 15_000, maxBuffer: MAX_ORACLE_OUTPUT, encoding: "utf8",
  });
  if (oracle.error || oracle.status !== 0) fail(`ORACLE_FAILED: ${(oracle.stderr || oracle.error?.message || "unknown").slice(0, 240)}`);
  try { return JSON.parse(oracle.stdout) as XlsxInventory370; }
  catch { return fail("ORACLE_INVALID_JSON"); }
}
function pinnedDonor370(spike: string): { read: (bytes: Buffer, options: object) => unknown; write: (book: unknown, options: object) => Buffer } {
  const vendor = resolve(spike, "node_modules/xlsx");
  try {
    const info = JSON.parse(readFileSync(resolve(vendor, "package.json"), "utf8")) as { version?: string; license?: string };
    if (info.version !== SHEETJS_VERSION || info.license !== SHEETJS_LICENSE
        || hash(readFileSync(resolve(vendor, "LICENSE"))) !== SHEETJS_LICENSE_SHA256) fail("DONOR_PIN_OR_LICENSE_MISMATCH");
    return createRequire(resolve(spike, "package.json"))("xlsx") as ReturnType<typeof pinnedDonor370>;
  } catch { return fail("DONOR_PIN_OR_LICENSE_MISMATCH"); }
}

/** The donor actually emits a byte-for-byte new XLSX; the oracle never calls it. */
export function auditXlsxFidelity370(source: Buffer, opts: XlsxAuditOptions370): XlsxDonorReport370 {
  checkCancel(opts?.signal);
  if (!opts || typeof opts.python !== "string" || opts.python.trim() === "") fail("PINNED_ORACLE_REQUIRED");
  if (!Buffer.isBuffer(source) || source.length < 64 || source.length > MAX_INPUT_BYTES) fail("INPUT_LIMIT");
  const packageInfo = analyzeOoxmlPackage(source);
  if (packageInfo.kind !== "xlsx" || packageInfo.entryCount > 256 || packageInfo.totalUncompressedBytes > 16 * 1024 * 1024) fail("PACKAGE_LIMIT_OR_KIND");
  const originalHash = hash(source);
  const before = inventory370(source, opts.python);
  checkCancel(opts.signal);
  const xlsx = pinnedDonor370(opts.spike ?? DEFAULT_SPIKE);
  const start = performance.now();
  const book = xlsx.read(source, { type: "buffer", cellFormula: true, cellStyles: true, cellDates: true, bookVBA: false, WTF: true });
  checkCancel(opts.signal);
  const candidate = Buffer.from(xlsx.write(book, { type: "buffer", bookType: "xlsx", compression: true }));
  const elapsedMs = performance.now() - start;
  checkCancel(opts.signal);
  if (candidate.length > MAX_INPUT_BYTES || analyzeOoxmlPackage(candidate).kind !== "xlsx") fail("CANDIDATE_INVALID_OR_LIMIT");
  const after = inventory370(candidate, opts.python);
  checkCancel(opts.signal);
  if (originalHash !== hash(source)) fail("SOURCE_MUTATED");
  opts.onCandidate?.(Buffer.from(candidate));

  const mismatches: string[] = [];
  if (JSON.stringify(before.sheets) !== JSON.stringify(after.sheets)) mismatches.push("SHEET_NAMES_OR_ORDER_CHANGED");
  for (const [key, original] of Object.entries(before.cells)) {
    const next = after.cells[key];
    if (!next) { mismatches.push(`CELL_MISSING:${key}`); continue; }
    if (next.type !== original.type || next.value !== original.value) mismatches.push(`CELL_VALUE_OR_TYPE_CHANGED:${key}`);
    if (next.format !== original.format) mismatches.push(`NUMBER_FORMAT_CHANGED:${key}`);
    if (next.link !== original.link) mismatches.push(`HYPERLINK_CHANGED:${key}`);
    if (next.richRuns !== original.richRuns) mismatches.push(`RICH_TEXT_RUNS_CHANGED:${key}`);
    if (next.cached !== original.cached) mismatches.push(`FORMULA_CACHED_VALUE_CHANGED:${key}`);
  }
  for (const key of Object.keys(after.cells)) if (!(key in before.cells)) mismatches.push(`CELL_INSERTED:${key}`);
  if (before.richXml !== after.richXml) mismatches.push("RICH_XML_COUNT_CHANGED");
  if (before.mediaParts.length !== after.mediaParts.length) {
    mismatches.push(`MEDIA_PARTS_LOST:${before.mediaParts.length}->${after.mediaParts.length}`);
  }
  if (before.chartParts.length !== after.chartParts.length) {
    mismatches.push(`CHART_PARTS_LOST:${before.chartParts.length}->${after.chartParts.length}`);
  }
  if (before.externalWorkbookLinks !== after.externalWorkbookLinks) mismatches.push("EXTERNAL_WORKBOOK_LINKS_CHANGED");
  if (before.externalRelationships !== after.externalRelationships) mismatches.push("EXTERNAL_RELATIONSHIP_COUNT_CHANGED");
  const reasons = new Set<string>(["PRODUCTION_GATE_NOT_APPROVED"]);
  if (mismatches.length) reasons.add("XLSX_SEMANTIC_FIDELITY_LOSS");
  if (Object.values(before.cells).some((cell) => cell.type === "f")) reasons.add("FORMULA_NOT_EVALUATED");
  if (Object.values(before.formulaCaches).some((value) => value !== null)) reasons.add("FORMULA_CACHED_RESULT_UNTRUSTED");
  if (before.richXml || Object.values(before.cells).some((cell) => cell.richRuns > 0)) reasons.add("RICH_TEXT_FIDELITY_UNVERIFIED");
  if (before.externalRelationships || before.externalWorkbookLinks || Object.values(before.cells).some((cell) => cell.link)) {
    reasons.add("EXTERNAL_LINKS_NOT_APPROVED");
  }
  return {
    ticket: 370, decision: "NO_GO", promotionApproved: false,
    donor: "xlsx@0.18.5", oracle: "Python ZIP/XML + openpyxl@3.1.5",
    sourceSha256: originalHash, candidateSha256: hash(candidate), inputBytes: source.length,
    candidateBytes: candidate.length, elapsedMs, source: before, candidate: after,
    mismatches, refusalReasons: [...reasons],
    mobilePerformance: "NOT_RUN",
  };
}

// Manual diagnostic CLI, never promotes a donor or emits an XLSX into product
// paths. Usage: SPREADSHEET370_PYTHON=/path/to/pinned/python
//   ./node_modules/.bin/tsx scripts/audit-xlsx-fidelity-370.ts path/to/source.xlsx
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const input = process.argv[2];
  const python = process.env.SPREADSHEET370_PYTHON;
  try {
    if (!input || !python) fail("CLI_INPUT_AND_PINNED_ORACLE_REQUIRED");
    const result = auditXlsxFidelity370(readFileSync(resolve(input)), { python });
    process.stdout.write(`${JSON.stringify({ ticket: result.ticket, decision: result.decision,
      productionApproved: result.promotionApproved, donor: result.donor, oracle: result.oracle,
      sourceSha256: result.sourceSha256, candidateSha256: result.candidateSha256,
      sourceBytes: result.inputBytes, candidateBytes: result.candidateBytes,
      elapsedMsSingleTrial: result.elapsedMs, sourceSheets: result.source.sheets,
      sourceCells: Object.keys(result.source.cells).length, candidateCells: Object.keys(result.candidate?.cells ?? {}).length,
      mismatches: result.mismatches, refusalReasons: result.refusalReasons,
      mobilePerformance: result.mobilePerformance }, null, 2)}\n`);
  } catch (error) {
    process.stderr.write(`XLSX370_NO_GO: ${error instanceof Error ? error.message : String(error)}\n`);
  }
  process.exitCode = 2;
}
