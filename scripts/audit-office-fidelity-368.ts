/**
 * Ticket #368: disposable OFFLINE rich Office donor comparison.
 * All candidates are generated in memory and independently read back via
 * JSZip + xmldom; no page rendering, vendor adoption or production grant.
 *
 * Run: ./node_modules/.bin/tsx scripts/audit-office-fidelity-368.ts
 * Code 2 means NO_GO (the expected, reviewable outcome).
 */
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import type { Readable } from "node:stream";
import { fileURLToPath } from "node:url";
import { crc32 } from "node:zlib";
import { analyzeOoxmlPackage, OoxmlPackageError } from "../src/engines/ooxml/package";

export type OfficeFormat368 = "docx" | "xlsx" | "pptx";
type Donor368 = "mammoth" | "xlsx" | "pptxgenjs" | "jszip" | "@xmldom/xmldom";
export const OFFICE_368_FIXTURES = {
  docx: { relativePath: "tests/ooxml-68-corpus/complex.docx", bytes: 201209,
    sha256: "973b551b9ec625584f64b1e475f8c766b5a80cde3fee72fd762d342e7f610dee" },
  xlsx: { relativePath: "tests/ooxml-68-corpus/complex.xlsx", bytes: 171698,
    sha256: "b79b7b703db87eb55a87c023b1f8c6f90530498ca24b3ec7f4be7e6fc02e286f" },
  pptx: { relativePath: "tests/ooxml-68-corpus/complex.pptx", bytes: 198595,
    sha256: "15f39be12cf28a25abbd9be7d3eda9b380065cf1007690389d8ec060725035ab" },
} as const;

const PACKAGE_EVIDENCE: Record<Donor368, {
  version: string; license: string; licenseFile: string; licenseSha256: string;
}> = {
  mammoth: { version: "1.13.0", license: "BSD-2-Clause", licenseFile: "LICENSE",
    licenseSha256: "6663bbd049205d38a496ccacb412a151980b444627d38de218b3b809aef330f1" },
  xlsx: { version: "0.18.5", license: "Apache-2.0", licenseFile: "LICENSE",
    licenseSha256: "4d2a38ac35cda06a555c84074a819d413339cd3691b822cae50f8f322fe01f64" },
  pptxgenjs: { version: "4.0.1", license: "MIT", licenseFile: "LICENSE",
    licenseSha256: "7a2bfe96150786ed1908b8e63f98ebab88875c1e79e28faff6649e0f11f77e52" },
  jszip: { version: "3.10.2", license: "(MIT OR GPL-3.0-or-later)", licenseFile: "LICENSE.markdown",
    licenseSha256: "566c953c6090b1218ca6217dd7359d45dde46581968586dc607d59a78af6a9c4" },
  "@xmldom/xmldom": { version: "0.8.15", license: "MIT", licenseFile: "LICENSE",
    licenseSha256: "4da724fc305d81606b245b324d4d2586916b9d248b23d82183df753ace0fdf71" },
};

const LIMITS_368 = { maxInputBytes: 2_097_152, maxArchiveEntries: 256,
  maxExpandedBytes: 16_777_216, maxOnePartBytes: 5_242_880,
  maxHtmlBytes: 4_194_304, maxSlides: 30, maxTextCharacters: 20_000 };
const FORMATS = ["docx", "xlsx", "pptx"] as const;

interface ZipFile368 {
  dir: boolean;
  _data?: { uncompressedSize?: number; compressedSize?: number; crc32?: number };
  async(type: "nodebuffer" | "string"): Promise<Buffer | string>;
  nodeStream(type: "nodebuffer"): Readable;
}
interface Zip368 {
  files: Record<string, ZipFile368>;
  file(path: string): ZipFile368 | null;
}
type ZipConstructor368 = { loadAsync(bytes: Buffer, options?: { checkCRC32?: boolean }): Promise<Zip368> };
type XmlConstructor368 = new (options?: Record<string, unknown>) => {
  parseFromString(text: string, contentType: string): Document;
};
interface Xml368 {
  DOMParser: XmlConstructor368;
}
interface Spreadsheet368 {
  read(bytes: Buffer, options: Record<string, unknown>): unknown;
  write(book: unknown, options: Record<string, unknown>): Buffer;
}
interface Mammoth368 {
  images: { imgElement(callback: (image: { contentType: string; read(type: string): Promise<string> }) =>
    Promise<{ src: string }>): unknown };
  convertToHtml(source: { buffer: Buffer }, options: { convertImage: unknown }): Promise<{
    value: string; messages: { message: string }[];
  }>;
}
interface Presentation368 {
  defineLayout(layout: { name: string; width: number; height: number }): void;
  layout: string;
  addSlide(): { addText(text: string, options: Record<string, unknown>): void };
  write(options: { outputType: "nodebuffer" }): Promise<Buffer>;
}
type PptxConstructor368 = new () => Presentation368;
interface Runtime368 {
  zip: ZipConstructor368;
  xml: Xml368;
  mammoth: Mammoth368;
  xlsx: Spreadsheet368;
  pptx: PptxConstructor368;
}

export interface PackageInventory368 {
  kind: OfficeFormat368;
  text: string[];
  cells: Record<string, string>;
  formulaCount: number;
  mediaSha256: string[];
  chartCount: number;
  tableCount: number;
  slideCount: number;
  pageGeometry: string | null;
  shapeRectangles: string[];
  externalRelationshipCount: number;
  unsupported: string[];
}
export interface OfficeResult368 {
  state: "NOT_RUN" | "NO_GO" | "MEASURED_WITH_FIDELITY_LOSS";
  reasons: string[];
  outputType: "html" | "xlsx" | "pptx" | null;
  sourceSha256: string | null;
  candidateSha256: string | null;
  sourceBytes: number;
  candidateBytes: number;
  elapsedMs: number | null;
  processRssBeforeBytes: number | null;
  processRssAfterBytes: number | null;
  textMissingCount: number | null;
  sourceMediaCount: number;
  candidateMediaCount: number;
  exactMediaPreservedCount: number;
  sourceChartCount: number;
  candidateChartCount: number;
  sourceTableCount: number;
  sourceFormulaCount: number;
  candidateFormulaCount: number | null;
  sourceSlideCount: number;
  candidateSlideCount: number | null;
  sourceGeometry: string | null;
  candidateGeometry: string | null;
  shapeRectangleMatches: number | null;
  visualPageFidelity: "NOT_VERIFIED";
  noNetwork: "NO_URL_FETCH_REQUESTED";
  unsupported: string[];
}
export interface AuditOptions368 {
  root?: string;
  spike?: string;
  formats?: readonly OfficeFormat368[];
  fixtureOverrides?: Partial<Record<OfficeFormat368, Buffer>>;
  signal?: AbortSignal;
  requiredDonorLicenses?: Partial<Record<Donor368, string>>;
  /** Optional local evidence capture; caller must handle only disposable bytes. */
  onCandidate?: (format: OfficeFormat368, bytes: Buffer) => void;
}
export interface OfficeAudit368 {
  ticket: 368;
  referenceDate: "2026-10-12";
  decision: "NO_GO";
  productionPromotion: false;
  host: { platform: string; arch: string };
  formats: Record<OfficeFormat368, OfficeResult368>;
  licensing: Record<Donor368, { version: string; license: string; verified: boolean; noticeSha256: string }>;
  transitiveLicenseAndSecurityAcceptance: "NOT_VERIFIED";
  externalVendorStatus: {
    libreConvert: "NOT_INSTALLED_NOT_RUN" | "LOCAL_CANDIDATE_FOUND_LICENSE_GATED";
    zetaOffice: "NOT_INSTALLED_NOT_RUN" | "LOCAL_CANDIDATE_FOUND_LICENSE_GATED";
  };
  remainingGates: string[];
}

const sha368 = (bytes: Uint8Array): string => createHash("sha256").update(bytes).digest("hex");
const arr368 = (nodes: NodeListOf<Element> | HTMLCollectionOf<Element>): Element[] => Array.from(nodes);
function elems368(node: Document | Element, name: string): Element[] {
  return arr368(node.getElementsByTagName(name));
}
function text368(value: string): string { return value.normalize("NFC").replace(/\s+/gu, " ").trim(); }
function xml368(source: string, parser: XmlConstructor368): Document {
  if (/<!DOCTYPE|<!ENTITY|<\?xml-stylesheet/iu.test(source)) throw new Error("XML_ACTIVE_CONTENT_REFUSED");
  const errs: string[] = [];
  const instance = new parser({ errorHandler: {
    warning: (m: string) => errs.push(m),
    error: (m: string) => errs.push(m),
    fatalError: (m: string) => errs.push(m),
  } });
  const doc = instance.parseFromString(source, "text/xml");
  if (errs.length || elems368(doc, "parsererror").length) throw new Error("INVALID_OFFICE_XML");
  return doc;
}
function childText368(parent: Element, tag: string): string {
  return text368(elems368(parent, tag).map((el) => el.textContent ?? "").join(""));
}
function sortedNumericParts368(names: string[], pattern: RegExp): string[] {
  return names.filter((name) => pattern.test(name)).sort((a, b) => {
    const ai = Number(a.match(/(\d+)\.xml$/u)?.[1] ?? 0);
    const bi = Number(b.match(/(\d+)\.xml$/u)?.[1] ?? 0);
    return ai - bi;
  });
}
function limit368(abort?: AbortSignal): void {
  if (abort?.aborted) throw new Error("ABORTED");
}

/** Scan physical ZIP32 central entries before JSZip can overwrite duplicate names.
 * Reuse the production OOXML header/local-name verifier; this audit applies its
 * own smaller member budget and rejects additional Unicode/URI path aliases.
 */
function preflightPhysicalZip368(bytes: Buffer, kind: OfficeFormat368): number {
  let parsed: ReturnType<typeof analyzeOoxmlPackage>;
  try {
    parsed = analyzeOoxmlPackage(bytes);
  } catch (error: unknown) {
    if (error instanceof OoxmlPackageError) {
      if (error.code === "MACRO_PACKAGE_UNSUPPORTED" || error.code === "UNSAFE_PACKAGE_PATH") {
        throw new Error("ACTIVE_CONTENT_REFUSED");
      }
      if (error.code === "EXPANSION_LIMIT") throw new Error("ZIP_EXPANSION_LIMIT");
      if (error.code === "PACKAGE_TOO_LARGE") throw new Error("ZIP_ENTRY_LIMIT");
      if (error.code === "CORRUPT_PACKAGE" && error.message.includes("Duplicate OOXML part path")) {
        throw new Error("ZIP_DUPLICATE_MEMBER");
      }
      throw new Error("INVALID_ZIP_CENTRAL_DIRECTORY");
    }
    throw error;
  }
  if (parsed.entryCount > LIMITS_368.maxArchiveEntries) throw new Error("ZIP_ENTRY_LIMIT");
  if (parsed.kind !== kind) throw new Error("OOXML_WRONG_KIND");
  const canonicalPaths = new Set<string>();
  for (const entry of parsed.entries) {
    const path = entry.path;
    // The names are checked against local headers upstream; reject aliases
    // before any ZIP member can disappear through normalization or case folding.
    const segments = path.split("/");
    if (segments.some((segment, index) => segment === "." ||
      (segment === "" && index !== segments.length - 1)) ||
      /%(?:2e|2f|5c|00)/iu.test(path)) throw new Error("ACTIVE_CONTENT_REFUSED");
    const normalized = path.normalize("NFKC").toLocaleLowerCase("en-US").replace(/\/$/u, "");
    if (canonicalPaths.has(normalized)) throw new Error("ZIP_DUPLICATE_MEMBER");
    canonicalPaths.add(normalized);
  }
  return parsed.entryCount;
}

async function openZip368(data: Buffer, kind: OfficeFormat368, Zip: ZipConstructor368,
  Xml: Xml368): Promise<Zip368> {
  if (data.length < 32 || data.length > LIMITS_368.maxInputBytes
    || !data.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04]))) {
    throw new Error("INVALID_ZIP_OR_INPUT_LIMIT");
  }
  const physicalEntries = preflightPhysicalZip368(data, kind);
  let archive: Zip368;
  try { archive = await Zip.loadAsync(data, { checkCRC32: false }); }
  catch { throw new Error("INVALID_ZIP"); }
  if (Object.keys(archive.files).length !== physicalEntries) throw new Error("ZIP_MEMBER_SET_MISMATCH");
  const entries = Object.entries(archive.files).filter(([, entry]) => !entry.dir);
  if (entries.length > LIMITS_368.maxArchiveEntries) throw new Error("ZIP_ENTRY_LIMIT");
  let total = 0;
  for (const [path, entry] of entries) {
    const unsafeOriginalName = (entry as ZipFile368 & { unsafeOriginalName?: string }).unsafeOriginalName;
    if (path.startsWith("/") || path.includes("\\") || path.split("/").includes("..")
      || (unsafeOriginalName !== undefined && unsafeOriginalName !== path)
      || /(?:^|\/)(?:vbaProject\.bin|activeX\/|_xmlsignatures\/)/iu.test(path)
      || (/\.bin$/iu.test(path) && !/^ppt\/printerSettings\/printerSettings\d+\.bin$/iu.test(path))
      || /\.rels$/iu.test(path) && /vbaProject/iu.test(path)) {
      throw new Error("ACTIVE_CONTENT_REFUSED");
    }
    const unpacked = entry._data?.uncompressedSize;
    const packed = entry._data?.compressedSize;
    if (!Number.isSafeInteger(unpacked) || unpacked! < 0
      || unpacked! > LIMITS_368.maxOnePartBytes || (total += unpacked!) > LIMITS_368.maxExpandedBytes
      || !Number.isSafeInteger(packed) || (packed === 0 && unpacked! > 0)
      || (packed! > 0 && unpacked! / packed! > 200)) {
      throw new Error("ZIP_EXPANSION_LIMIT");
    }
  }
  // Central-directory sizes are attacker-controlled. Validate the *actual*
  // expansion and CRC while streaming, ending immediately if a part exceeds
  // either the declared size or our independent per-part/total budget.
  let expandedActual = 0;
  for (const [, entry] of entries) {
    const declared = entry._data?.uncompressedSize;
    const expectedCrc = entry._data?.crc32;
    if (!Number.isSafeInteger(expectedCrc)) throw new Error("INVALID_ZIP_CRC");
    let actual = 0;
    let checksum = 0;
    try {
      const stream = entry.nodeStream("nodebuffer");
      // JSZip's bundled readable-stream predates Symbol.asyncIterator.
      await new Promise<void>((accept, reject) => {
        let ended = false;
        const fail = (error: Error): void => {
          if (ended) return;
          ended = true;
          stream.destroy();
          reject(error);
        };
        stream.on("data", (chunk: Buffer) => {
          if (ended) return;
          actual += chunk.length;
          expandedActual += chunk.length;
          if (actual > declared! || actual > LIMITS_368.maxOnePartBytes
            || expandedActual > LIMITS_368.maxExpandedBytes) {
            fail(new Error("ZIP_EXPANSION_LIMIT"));
            return;
          }
          checksum = crc32(chunk, checksum);
        });
        stream.on("error", () => fail(new Error("INVALID_ZIP_CRC")));
        stream.on("end", () => { if (!ended) { ended = true; accept(); } });
      });
    } catch (error: unknown) {
      if (error instanceof Error && error.message === "ZIP_EXPANSION_LIMIT") throw error;
      throw new Error("INVALID_ZIP_CRC");
    }
    if (actual !== declared || (checksum >>> 0) !== (expectedCrc! >>> 0)) {
      throw new Error("INVALID_ZIP_CRC");
    }
  }
  if (!archive.file("[Content_Types].xml")) throw new Error("OOXML_CONTENT_TYPES_MISSING");
  const types = await part368(archive, "[Content_Types].xml", Xml.DOMParser);
  const typeNamespace = "http://schemas.openxmlformats.org/package/2006/content-types";
  if (!types || types.documentElement?.namespaceURI !== typeNamespace
    || types.documentElement?.localName !== "Types") throw new Error("OOXML_CONTENT_TYPES_INVALID");
  // SheetJS includes a generic "bin" MIME fallback for macro-enabled files
  // even in an ordinary XLSX with no .bin members. Only active *overrides*
  // or a default with matching real parts are grounds for refusal.
  for (const rule of arr368(types.getElementsByTagNameNS(typeNamespace, "*"))) {
    if (rule.localName !== "Default" && rule.localName !== "Override") continue;
    const mime = rule.getAttribute("ContentType");
    if (!mime) throw new Error("OOXML_CONTENT_TYPES_INVALID");
    if (/(?:macroEnabled|vbaProject|activeX)/iu.test(mime)) {
      const extension = rule.getAttribute("Extension")?.toLowerCase();
      const hasMatchingParts = extension && entries.some(([path]) => path.toLowerCase().endsWith(`.${extension}`));
      if (rule.localName === "Override" || hasMatchingParts) throw new Error("ACTIVE_CONTENT_REFUSED");
    }
  }
  const mandatory = { docx: "word/document.xml", xlsx: "xl/workbook.xml", pptx: "ppt/presentation.xml" }[kind];
  if (!archive.file(mandatory)) throw new Error("OOXML_WRONG_KIND");
  return archive;
}
async function part368(zip: Zip368, file: string, xml: XmlConstructor368): Promise<Document | null> {
  const entry = zip.file(file);
  if (!entry) return null;
  const bytes = await entry.async("nodebuffer") as Buffer;
  if (bytes.length > LIMITS_368.maxOnePartBytes) throw new Error("ZIP_PART_LIMIT");
  return xml368(bytes.toString("utf8"), xml);
}

async function inventory368(data: Buffer, kind: OfficeFormat368, runtime: Pick<Runtime368, "zip" | "xml">): Promise<PackageInventory368> {
  const zip = await openZip368(data, kind, runtime.zip, runtime.xml);
  const names = Object.keys(zip.files);
  const mediaSha256 = await Promise.all(names.filter((name) =>
    new RegExp(`^(?:word|xl|ppt)/media/[^/]+$`, "u").test(name))
    .sort().map(async (name) => sha368(await zip.file(name)!.async("nodebuffer") as Buffer)));
  const chartCount = names.filter((name) => /^(?:word|xl|ppt)\/charts\/chart\d+\.xml$/u.test(name)).length;
  const relNamespace = "http://schemas.openxmlformats.org/package/2006/relationships";
  const externalRelationshipCount = (await Promise.all(names.filter((name) => name.endsWith(".rels"))
    .map(async (name) => {
      const rels = await part368(zip, name, runtime.xml.DOMParser);
      if (!rels || rels.documentElement?.namespaceURI !== relNamespace
        || rels.documentElement?.localName !== "Relationships") throw new Error("OOXML_RELATIONSHIPS_INVALID");
      return arr368(rels.getElementsByTagNameNS(relNamespace, "Relationship"))
        .filter((rel) => rel.getAttribute("TargetMode") === "External").length;
    }))).reduce((a, b) => a + b, 0);
  const output: PackageInventory368 = {
    kind, text: [], cells: {}, formulaCount: 0, mediaSha256, chartCount, tableCount: 0, slideCount: 0,
    pageGeometry: null, shapeRectangles: [], externalRelationshipCount, unsupported: [],
  };
  if (kind === "docx") {
    const document = await part368(zip, "word/document.xml", runtime.xml.DOMParser);
    if (!document) throw new Error("DOCX_MAIN_MISSING");
    output.text = elems368(document, "w:t").map((el) => text368(el.textContent ?? "")).filter(Boolean);
    output.tableCount = elems368(document, "w:tbl").length;
    const page = elems368(document, "w:pgSz")[0];
    if (page) output.pageGeometry = `${page.getAttribute("w:w") ?? "?"}x${page.getAttribute("w:h") ?? "?"}twips`;
    output.unsupported.push("font metric mapping not measured", "pagination not rendered", "editable layout not comparable to HTML");
  } else if (kind === "xlsx") {
    const sst = await part368(zip, "xl/sharedStrings.xml", runtime.xml.DOMParser);
    const strings = sst ? elems368(sst, "si").map((item) => childText368(item, "t")) : [];
    const sheets = sortedNumericParts368(names, /^xl\/worksheets\/sheet\d+\.xml$/u);
    if (!sheets.length) throw new Error("XLSX_SHEETS_MISSING");
    for (const [index, sheet] of sheets.entries()) {
      const xml = await part368(zip, sheet, runtime.xml.DOMParser);
      if (!xml) throw new Error("XLSX_SHEET_MISSING");
      for (const cell of elems368(xml, "c")) {
        const type = cell.getAttribute("t") ?? "n";
        const value = childText368(cell, "v");
        const formula = childText368(cell, "f");
        if (elems368(cell, "f").length > 0) output.formulaCount++;
        const inline = childText368(cell, "is");
        const resolved = type === "s" ? strings[Number(value)] ?? "INVALID_SHARED_STRING" : type === "inlineStr" ? inline : value;
        output.cells[`${index + 1}:${cell.getAttribute("r") ?? "?"}`] = `${type === "s" || type === "inlineStr" || type === "str" ? "string" : type === "b" ? "bool" : "number"}:${resolved}${formula ? `:formula:${formula}` : ""}`;
      }
      const margin = elems368(xml, "pageMargins")[0];
      if (margin) output.pageGeometry = "sheet-page-margins-present";
    }
    output.text = Object.values(output.cells);
    output.unsupported.push("chart renderer absent", "sheet print geometry not visually rendered", "font metric fidelity not certified");
  } else {
    const pres = await part368(zip, "ppt/presentation.xml", runtime.xml.DOMParser);
    const geometry = pres ? elems368(pres, "p:sldSz")[0] : null;
    if (geometry) output.pageGeometry = `${geometry.getAttribute("cx") ?? "?"}x${geometry.getAttribute("cy") ?? "?"}emu`;
    const slides = sortedNumericParts368(names, /^ppt\/slides\/slide\d+\.xml$/u);
    if (!slides.length || slides.length > LIMITS_368.maxSlides) throw new Error("PPTX_SLIDE_LIMIT");
    output.slideCount = slides.length;
    for (const slide of slides) {
      const xml = await part368(zip, slide, runtime.xml.DOMParser);
      if (!xml) throw new Error("PPTX_SLIDE_MISSING");
      for (const shape of elems368(xml, "p:sp")) {
        const content = childText368(shape, "a:t");
        if (content) output.text.push(content);
        const xfrm = elems368(shape, "a:xfrm")[0];
        const off = xfrm && elems368(xfrm, "a:off")[0];
        const ext = xfrm && elems368(xfrm, "a:ext")[0];
        if (content && off && ext) output.shapeRectangles.push(`${off.getAttribute("x")},${off.getAttribute("y")},${ext.getAttribute("cx")},${ext.getAttribute("cy")}`);
      }
    }
    output.unsupported.push("slide masters/themes not reimplemented", "embedded chart/Workbook lost",
      "opaque printer settings excluded without interpretation", "raster preview not rendered");
  }
  if (output.text.join("").length > LIMITS_368.maxTextCharacters) throw new Error("OFFICE_TEXT_LIMIT");
  return output;
}

/** An independent XML/ZIP inspector; it never invokes the producing donor. */
export async function inspectOoxml368(bytes: Buffer, kind: OfficeFormat368,
  spike = resolve(dirname(fileURLToPath(import.meta.url)), "../spikes/heavy-local-feasibility")): Promise<PackageInventory368> {
  const r = createRequire(resolve(spike, "package.json"));
  return inventory368(bytes, kind, {
    zip: r("jszip") as ZipConstructor368,
    xml: r("@xmldom/xmldom") as Xml368,
  });
}

function blank368(state: OfficeResult368["state"], reason: string): OfficeResult368 {
  return {
    state, reasons: [reason], outputType: null, sourceSha256: null, candidateSha256: null,
    sourceBytes: 0, candidateBytes: 0, elapsedMs: null, processRssBeforeBytes: null,
    processRssAfterBytes: null, textMissingCount: null, sourceMediaCount: 0, candidateMediaCount: 0,
    exactMediaPreservedCount: 0, sourceChartCount: 0, candidateChartCount: 0,
    sourceTableCount: 0, sourceSlideCount: 0, candidateSlideCount: null, sourceGeometry: null,
    sourceFormulaCount: 0, candidateFormulaCount: null,
    candidateGeometry: null, shapeRectangleMatches: null, visualPageFidelity: "NOT_VERIFIED",
    noNetwork: "NO_URL_FETCH_REQUESTED", unsupported: [],
  };
}
async function inspectLicenses368(spike: string, required: AuditOptions368["requiredDonorLicenses"]) {
  const records = {} as OfficeAudit368["licensing"];
  for (const [name, evidence] of Object.entries(PACKAGE_EVIDENCE) as [Donor368, typeof PACKAGE_EVIDENCE[Donor368]][]) {
    let verified = false;
    try {
      const info = JSON.parse(await readFile(resolve(spike, "node_modules", name, "package.json"), "utf8")) as {
        name?: string; version?: string; license?: string;
      };
      const notice = await readFile(resolve(spike, "node_modules", name, evidence.licenseFile));
      verified = info.name === name && info.version === evidence.version
        && info.license === evidence.license && sha368(notice) === evidence.licenseSha256
        && (required?.[name] === undefined || required[name] === evidence.license);
    } catch { /* absent vendor is an explicit NO_GO */ }
    records[name] = { version: evidence.version, license: evidence.license, verified,
      noticeSha256: evidence.licenseSha256 };
  }
  return records;
}
function requireRuntime368(spike: string): Runtime368 {
  const r = createRequire(resolve(spike, "package.json"));
  return {
    zip: r("jszip") as ZipConstructor368,
    xml: r("@xmldom/xmldom") as Xml368,
    mammoth: r("mammoth") as Mammoth368,
    xlsx: r("xlsx") as Spreadsheet368,
    pptx: r("pptxgenjs") as PptxConstructor368,
  };
}
function decodeEntities368(s: string): string {
  return s.replace(/&(?:amp|lt|gt|quot|apos|nbsp|#\d+|#x[a-f0-9]+);/giu, (code) => {
    const names: Record<string, string> = { "&amp;": "&", "&lt;": "<", "&gt;": ">",
      "&quot;": '"', "&apos;": "'", "&nbsp;": " " };
    if (names[code]) return names[code];
    if (code.startsWith("&#")) {
      const cp = Number.parseInt(code.slice(code[2]?.toLowerCase() === "x" ? 3 : 2, -1),
        code[2]?.toLowerCase() === "x" ? 16 : 10);
      if (cp >= 0 && cp <= 0x10ffff) return String.fromCodePoint(cp);
    }
    return code;
  });
}
async function makeHtml368(source: Buffer, runtime: Runtime368): Promise<{ html: string; media: string[]; warnings: string[] }> {
  const result = await runtime.mammoth.convertToHtml({ buffer: source }, {
    convertImage: runtime.mammoth.images.imgElement(async (image) => ({
      src: `data:${image.contentType};base64,${await image.read("base64")}`,
    })),
  });
  if (Buffer.byteLength(result.value) > LIMITS_368.maxHtmlBytes) throw new Error("HTML_OUTPUT_LIMIT");
  const matches = Array.from(result.value.matchAll(/<img\b[^>]*\bsrc="data:[^;"]+;base64,([a-z0-9+/=]+)"/giu));
  return { html: result.value, media: matches.map((m) => sha368(Buffer.from(m[1]!, "base64"))),
    warnings: result.messages.map((message) => message.message) };
}
async function makeXlsx368(source: Buffer, runtime: Runtime368): Promise<Buffer> {
  const workbook = runtime.xlsx.read(source, { type: "buffer", cellFormula: true,
    cellStyles: true, bookVBA: false, bookFiles: false, WTF: true });
  return Buffer.from(runtime.xlsx.write(workbook, { type: "buffer", bookType: "xlsx", compression: true }));
}
async function makePptx368(source: Buffer, original: PackageInventory368, runtime: Runtime368): Promise<Buffer> {
  const zip = await openZip368(source, "pptx", runtime.zip, runtime.xml);
  const names = sortedNumericParts368(Object.keys(zip.files), /^ppt\/slides\/slide\d+\.xml$/u);
  const pptx = new runtime.pptx();
  const dims = original.pageGeometry?.match(/^(\d+)x(\d+)emu$/u);
  if (!dims) throw new Error("PPTX_GEOMETRY_UNVERIFIED");
  const width = Number(dims[1]) / 914400;
  const height = Number(dims[2]) / 914400;
  if (width <= 0 || height <= 0 || width > 24 || height > 24) throw new Error("PPTX_PAGE_LIMIT");
  pptx.defineLayout({ name: "OFFICE368_SOURCE_DIMENSIONS", width, height });
  pptx.layout = "OFFICE368_SOURCE_DIMENSIONS";
  for (const [index, name] of names.entries()) {
    const slide = pptx.addSlide();
    const doc = await part368(zip, name, runtime.xml.DOMParser);
    if (!doc) throw new Error("PPTX_SLIDE_MISSING");
    let fallbackY = 0.5;
    for (const shape of elems368(doc, "p:sp")) {
      const content = childText368(shape, "a:t");
      if (!content) continue;
      const xfrm = elems368(shape, "a:xfrm")[0];
      const off = xfrm ? elems368(xfrm, "a:off")[0] : null;
      const ext = xfrm ? elems368(xfrm, "a:ext")[0] : null;
      let x = off ? Number(off.getAttribute("x")) / 914400 : 0.5;
      let y = off ? Number(off.getAttribute("y")) / 914400 : fallbackY;
      let w = ext ? Number(ext.getAttribute("cx")) / 914400 : Math.max(0.5, width - 1);
      let h = ext ? Number(ext.getAttribute("cy")) / 914400 : 0.45;
      if (!Number.isFinite(x + y + w + h)) throw new Error("PPTX_SHAPE_GEOMETRY_INVALID");
      x = Math.max(0, Math.min(x, width - 0.1));
      y = Math.max(0, Math.min(y, height - 0.1));
      w = Math.max(0.1, Math.min(w, width - x));
      h = Math.max(0.1, Math.min(h, height - y));
      slide.addText(content, { x, y, w, h, fontSize: 16, margin: 0, breakLine: false });
      fallbackY = Math.min(height - 0.2, fallbackY + 0.6);
    }
    if (index > LIMITS_368.maxSlides) throw new Error("PPTX_SLIDE_LIMIT");
  }
  return Buffer.from(await pptx.write({ outputType: "nodebuffer" }));
}

async function measure368(kind: OfficeFormat368, root: string, spike: string,
  opts: AuditOptions368, licensing: OfficeAudit368["licensing"]): Promise<OfficeResult368> {
  const result = blank368("NO_GO", "NOT_YET_MEASURED");
  const needed: Donor368[] = ["jszip", "@xmldom/xmldom",
    kind === "docx" ? "mammoth" : kind === "xlsx" ? "xlsx" : "pptxgenjs"];
  if (!needed.every((name) => licensing[name].verified)) {
    result.reasons = ["DONOR_LICENSE_MISMATCH"];
    return result;
  }
  const manifest = OFFICE_368_FIXTURES[kind];
  let source: Buffer;
  try { source = opts.fixtureOverrides?.[kind] ?? await readFile(resolve(root, manifest.relativePath)); }
  catch { result.reasons = ["SOURCE_MISSING"]; return result; }
  if (source.length !== manifest.bytes || sha368(source) !== manifest.sha256) {
    result.reasons = ["SOURCE_SHA256_CHANGED"]; return result;
  }
  if (opts.signal?.aborted) { result.reasons = ["ABORTED"]; return result; }
  let candidate: Buffer | null = null;
  const began = performance.now();
  const processRssBeforeBytes = process.memoryUsage().rss;
  try {
    const runtime = requireRuntime368(spike);
    const original = await inventory368(source, kind, runtime);
    limit368(opts.signal);
    let html: Awaited<ReturnType<typeof makeHtml368>> | null = null;
    if (kind === "docx") {
      html = await makeHtml368(source, runtime);
      candidate = Buffer.from(html.html, "utf8");
    } else if (kind === "xlsx") {
      candidate = await makeXlsx368(source, runtime);
    } else {
      candidate = await makePptx368(source, original, runtime);
    }
    limit368(opts.signal);
    opts.onCandidate?.(kind, Buffer.from(candidate));
    const reopened = kind === "docx" ? null : await inventory368(candidate, kind, runtime);
    const plainHtml = html ? text368(decodeEntities368(html.html.replace(/<[^>]+>/gu, " "))) : "";
    const missing = kind === "docx"
      ? original.text.filter((fragment) => !plainHtml.includes(fragment))
      : kind === "xlsx"
        ? Object.entries(original.cells).filter(([address, value]) => reopened?.cells[address] !== value)
        : original.text.filter((fragment) => !reopened?.text.includes(fragment));
    const candidateMedia = html ? html.media : reopened?.mediaSha256 ?? [];
    const candidateCounts = [...candidateMedia];
    const exactMediaPreservedCount = original.mediaSha256.filter((media) => {
      const found = candidateCounts.indexOf(media);
      if (found < 0) return false;
      candidateCounts.splice(found, 1);
      return true;
    }).length;
    return {
      state: "MEASURED_WITH_FIDELITY_LOSS", reasons: [],
      outputType: kind === "docx" ? "html" : kind,
      sourceSha256: manifest.sha256, candidateSha256: sha368(candidate),
      sourceBytes: source.length, candidateBytes: candidate.length,
      elapsedMs: Math.round((performance.now() - began) * 10) / 10,
      processRssBeforeBytes, processRssAfterBytes: process.memoryUsage().rss,
      textMissingCount: missing.length, sourceMediaCount: original.mediaSha256.length,
      candidateMediaCount: candidateMedia.length, exactMediaPreservedCount,
      sourceChartCount: original.chartCount, candidateChartCount: reopened?.chartCount ?? 0,
      sourceTableCount: original.tableCount, sourceSlideCount: original.slideCount,
      sourceFormulaCount: original.formulaCount, candidateFormulaCount: reopened?.formulaCount ?? null,
      candidateSlideCount: reopened?.slideCount ?? null,
      sourceGeometry: original.pageGeometry, candidateGeometry: reopened?.pageGeometry ?? null,
      shapeRectangleMatches: kind === "pptx" ? original.shapeRectangles.filter((rect, i) =>
        reopened?.shapeRectangles[i] === rect).length : null,
      visualPageFidelity: "NOT_VERIFIED", noNetwork: "NO_URL_FETCH_REQUESTED",
      unsupported: [
        ...original.unsupported,
        ...(kind === "docx"
          ? ["HTML is not a pagination/print-layout reference", "DOCX styles and editable image anchors cannot be equated with HTML"]
          : kind === "xlsx"
            ? ["SheetJS 0.18.5 is not an approved production donor", "drawings/charts and images are not preserved",
              ...(original.formulaCount === 0 ? ["formula fidelity not measured: this source has no formulas"] : [])]
            : ["PptxGenJS has no rich PPTX importer; candidate intentionally reconstructs text boxes only",
              "source slide images/charts/theme/master/embedded objects excluded"]),
        ...(original.externalRelationshipCount ? ["external relationships present; URL fetch was not requested"] : []),
        ...(html?.warnings ?? []),
      ],
    };
  } catch (error: unknown) {
    result.reasons = [error instanceof Error ? error.message : String(error)];
    return result;
  }
}

export async function auditOfficeFidelity368(options: AuditOptions368 = {}): Promise<OfficeAudit368> {
  const root = options.root ?? resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const spike = options.spike ?? resolve(root, "spikes/heavy-local-feasibility");
  const licensing = await inspectLicenses368(spike, options.requiredDonorLicenses);
  const formats = {
    docx: blank368("NOT_RUN", "NOT_REQUESTED"),
    xlsx: blank368("NOT_RUN", "NOT_REQUESTED"),
    pptx: blank368("NOT_RUN", "NOT_REQUESTED"),
  };
  const selected = new Set(options.formats ?? FORMATS);
  for (const kind of FORMATS) {
    if (selected.has(kind)) {
      formats[kind] = await measure368(kind, root, spike, options, licensing);
    }
  }
  return {
    ticket: 368, referenceDate: "2026-10-12", decision: "NO_GO", productionPromotion: false,
    host: { platform: process.platform, arch: process.arch }, formats, licensing,
    transitiveLicenseAndSecurityAcceptance: "NOT_VERIFIED",
    externalVendorStatus: {
      libreConvert: [
        "/Applications/LibreOffice.app/Contents/MacOS/soffice",
        "/opt/homebrew/bin/soffice",
        "/usr/local/bin/soffice",
        resolve(spike, "node_modules/libreoffice-convert"),
        resolve(spike, "node_modules/libreconvert"),
      ].some((path) => existsSync(path)) ? "LOCAL_CANDIDATE_FOUND_LICENSE_GATED" : "NOT_INSTALLED_NOT_RUN",
      zetaOffice: [
        "/Applications/ZetaOffice.app",
        resolve(spike, "node_modules/zetaoffice"),
        resolve(spike, "node_modules/@zetaoffice"),
      ].some((path) => existsSync(path)) ? "LOCAL_CANDIDATE_FOUND_LICENSE_GATED" : "NOT_INSTALLED_NOT_RUN",
    },
    remainingGates: [
      "Neither LibreConvert nor ZetaOffice was available for a licensed local test; no vendor output claimed",
      "DOCX and PPTX candidates are semantic/text projections, not page-accurate conversions",
      "XLSX historical security/license and drawing/chart fidelity are not production-approved (#270)",
      "Fonts, page rendering, editability, pixel diffs, and image positions unverified",
      "Transitive licenses, third-party isolation, physical mobile memory/cancellation, privacy/network trace unverified",
      "No production promotion, Gold or paid license approval",
    ],
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  auditOfficeFidelity368().then((result) => {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    process.exitCode = 2;
  }).catch((err: unknown) => {
    process.stderr.write(`OFFICE368_NO_GO: ${err instanceof Error ? err.message : String(err)}\n`);
    process.exitCode = 2;
  });
}
