import { analyzeOoxmlPackage, OOXML_PACKAGE_LIMITS, OoxmlPackageError, type OoxmlPackageAnalysis, type OoxmlPackageKind } from "./package";
import type { Zippable } from "fflate";

const XML_DECODER = new TextDecoder("utf-8", { fatal: true });
const XML_ENCODER = new TextEncoder();

export interface OfficeMetadataField {
  readonly part: "docProps/core.xml" | "docProps/app.xml" | "docProps/custom.xml";
  readonly name: string;
  readonly value: string;
}

export interface OfficeStructureInspection {
  readonly kind: OoxmlPackageKind;
  readonly analysis: OoxmlPackageAnalysis;
  readonly metadata: readonly OfficeMetadataField[];
  readonly mediaParts: readonly string[];
  readonly fontParts: readonly string[];
  readonly externalRelationshipCount: number;
  readonly unsupportedConstructs: readonly string[];
  readonly previewPolicy: "semantic-structure-only-not-faithful-rendering";
  readonly activeContentPolicy: "macros-refused-scripts-never-executed-external-links-never-resolved";
}

export interface OfficeMetadataCleanupResult {
  readonly bytes: ArrayBuffer;
  readonly byteLength: number;
  readonly before: readonly OfficeMetadataField[];
  readonly after: readonly OfficeMetadataField[];
  readonly removed: readonly OfficeMetadataField[];
  readonly input: OoxmlPackageAnalysis;
  readonly output: OoxmlPackageAnalysis;
  readonly verification: {
    readonly metadataReinspectionEmpty: true;
    readonly memberSetUnchanged: true;
    readonly relationshipBytesUnchanged: true;
    readonly contentTypesBytesUnchanged: true;
    readonly structuralCountsUnchanged: true;
  };
}

export type DocxSemanticBlock =
  | { readonly type: "paragraph"; readonly text: string; readonly links: readonly DocxLink[] }
  | { readonly type: "heading"; readonly level: 1 | 2 | 3 | 4 | 5 | 6; readonly text: string; readonly links: readonly DocxLink[] }
  | { readonly type: "list-item"; readonly ordered: boolean; readonly text: string; readonly links: readonly DocxLink[] }
  | { readonly type: "table"; readonly rows: readonly (readonly string[])[] };

export interface DocxLink {
  readonly text: string;
  readonly target: string;
  readonly external: boolean;
}

export interface DocxAssetReference {
  readonly relationshipId: string;
  readonly part: string;
  readonly mime: string;
  readonly byteLength: number;
}

export interface DocxSemanticExtraction {
  readonly blocks: readonly DocxSemanticBlock[];
  readonly assets: readonly DocxAssetReference[];
  readonly structureCounts: {
    readonly paragraphs: number;
    readonly headings: number;
    readonly listItems: number;
    readonly tables: number;
    readonly links: number;
    readonly assets: number;
  };
  readonly text: string;
  readonly markdown: string;
  readonly html: string;
  readonly unsupportedConstructs: readonly string[];
  readonly fidelity: "semantic-not-layout";
  readonly activeContentPolicy: "macros-refused-external-resources-never-fetched";
}

export interface DocxGenerationResult {
  readonly bytes: ArrayBuffer;
  readonly byteLength: number;
  readonly sourceFormat: "text" | "markdown" | "html";
  readonly unsupportedConstructs: readonly string[];
  readonly output: OoxmlPackageAnalysis;
  readonly reopened: DocxSemanticExtraction;
  readonly verification: {
    readonly reopened: true;
    readonly memberSetValidated: true;
    readonly deterministicSimpleStyleTemplate: true;
  };
}

export interface PptxOutlineSlide {
  readonly slideNumber: number;
  readonly part: string;
  readonly title: string | null;
  readonly titleSource: "placeholder" | "first-text-fallback" | "none";
  readonly text: readonly string[];
}

export interface PptxOutlineResult {
  readonly slides: readonly PptxOutlineSlide[];
  readonly mediaParts: readonly { readonly part: string; readonly mime: string; readonly byteLength: number }[];
  readonly unsupportedConstructs: readonly string[];
  readonly rasterExport: {
    readonly status: "REFUSED";
    readonly reason: "No approved faithful PPTX renderer exists in the bounded Office runtime.";
  };
}

interface LoadedPackage {
  readonly analysis: OoxmlPackageAnalysis;
  readonly members: Record<string, Uint8Array>;
}

interface Relationship {
  readonly id: string;
  readonly target: string;
  readonly external: boolean;
}

interface GeneratedBlock {
  readonly type: "paragraph" | "heading" | "list-item" | "code" | "table" | "image-placeholder";
  readonly text?: string;
  readonly level?: number;
  readonly ordered?: boolean;
  readonly rows?: readonly (readonly string[])[];
  readonly links?: readonly DocxLink[];
}

function fail(message: string): never {
  throw new OoxmlPackageError("REBUILD_VERIFICATION_FAILED", message);
}

function exactArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

function equalBytes(left: Uint8Array, right: Uint8Array): boolean {
  return left.byteLength === right.byteLength && left.every((value, index) => value === right[index]);
}

function decodeXml(bytes: Uint8Array, path: string): string {
  let xml: string;
  try {
    xml = XML_DECODER.decode(bytes);
  } catch {
    fail(`${path}: XML is not valid UTF-8.`);
  }
  if (/<!DOCTYPE|<!ENTITY/iu.test(xml)) fail(`${path}: DTD/entity declarations are outside the bounded OOXML semantic path.`);
  return xml;
}

function escapeXml(value: string): string {
  return value.replace(/&/gu, "&amp;").replace(/</gu, "&lt;").replace(/>/gu, "&gt;").replace(/"/gu, "&quot;").replace(/'/gu, "&apos;");
}

function escapeHtml(value: string): string {
  return value.replace(/&/gu, "&amp;").replace(/</gu, "&lt;").replace(/>/gu, "&gt;").replace(/"/gu, "&quot;").replace(/'/gu, "&#39;");
}

function decodeEntities(value: string): string {
  const named: Readonly<Record<string, string>> = { amp: "&", apos: "'", gt: ">", lt: "<", quot: '"' };
  return value.replace(/&(?:#(\d+)|#x([0-9a-f]+)|([a-z][a-z0-9]+));/giu, (match, decimal: string | undefined, hex: string | undefined, name: string | undefined) => {
    if (decimal !== undefined) return String.fromCodePoint(Number.parseInt(decimal, 10));
    if (hex !== undefined) return String.fromCodePoint(Number.parseInt(hex, 16));
    return name === undefined ? match : named[name.toLowerCase()] ?? match;
  });
}

function textFromXmlFragment(xml: string, textTagPattern = "(?:w:t|a:t)"): string {
  const values: string[] = [];
  const pattern = new RegExp(`<(${textTagPattern})\\b[^>]*>([\\s\\S]*?)<\\/\\1>`, "giu");
  for (const match of xml.matchAll(pattern)) values.push(decodeEntities((match[2] ?? "").replace(/<[^>]+>/gu, "")));
  return values.join("");
}

async function loadPackage(input: ArrayBuffer | Uint8Array): Promise<LoadedPackage> {
  const source = input instanceof Uint8Array ? input : new Uint8Array(input);
  const analysis = analyzeOoxmlPackage(source);
  const { unzipSync } = await import("fflate");
  let members: Record<string, Uint8Array>;
  try {
    members = unzipSync(source);
  } catch (error) {
    fail(error instanceof Error ? `OOXML members could not be decoded after bounded preflight: ${error.message}` : "OOXML members could not be decoded after bounded preflight.");
  }
  if (Object.keys(members).length !== analysis.entryCount) fail("Decoded OOXML member set differs from the central directory.");
  return { analysis, members };
}

function parseRelationships(xml: string): Relationship[] {
  const output: Relationship[] = [];
  for (const match of xml.matchAll(/<Relationship\b([^>]*)\/?\s*>/giu)) {
    const attrs = match[1] ?? "";
    const id = /\bId=["']([^"']+)["']/iu.exec(attrs)?.[1];
    const target = /\bTarget=["']([^"']+)["']/iu.exec(attrs)?.[1];
    if (id === undefined || target === undefined) continue;
    output.push({ id: decodeEntities(id), target: decodeEntities(target), external: /\bTargetMode=["']External["']/iu.test(attrs) });
  }
  return output;
}

function leafMetadata(part: OfficeMetadataField["part"], xml: string): OfficeMetadataField[] {
  const fields: OfficeMetadataField[] = [];
  for (const match of xml.matchAll(/<([A-Za-z_][\w:.-]*)\b[^>]*>([^<]*)<\/\1>/gu)) {
    const value = decodeEntities((match[2] ?? "").trim());
    if (value === "") continue;
    fields.push({ part, name: match[1] ?? "unknown", value });
  }
  return fields;
}

function inspectMetadataMembers(members: Readonly<Record<string, Uint8Array>>): OfficeMetadataField[] {
  const output: OfficeMetadataField[] = [];
  for (const part of ["docProps/core.xml", "docProps/app.xml", "docProps/custom.xml"] as const) {
    const bytes = members[part];
    if (bytes !== undefined) output.push(...leafMetadata(part, decodeXml(bytes, part)));
  }
  return output;
}

function mimeForPart(path: string): string {
  const extension = path.split(".").at(-1)?.toLowerCase() ?? "";
  return ({ png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", svg: "image/svg+xml", webp: "image/webp", emf: "image/emf", wmf: "image/wmf" } as Readonly<Record<string, string>>)[extension] ?? "application/octet-stream";
}

function externalRelationshipCount(members: Readonly<Record<string, Uint8Array>>): number {
  let count = 0;
  for (const [path, bytes] of Object.entries(members)) {
    if (!/\.rels$/u.test(path)) continue;
    count += parseRelationships(decodeXml(bytes, path)).filter(({ external }) => external).length;
  }
  return count;
}

function unsupportedInventory(kind: OoxmlPackageKind, members: Readonly<Record<string, Uint8Array>>): string[] {
  const paths = Object.keys(members);
  const output = new Set<string>();
  if (paths.some((path) => /(?:activeX|embeddings|oleObject|object)\//iu.test(path))) output.add("Embedded OLE/ActiveX/package objects are inventoried only; they are never executed or rendered.");
  if (paths.some((path) => /charts?\//iu.test(path))) output.add("Charts are structural inventory only; no faithful chart rendering is claimed.");
  if (paths.some((path) => /comments?\d*\.xml$/iu.test(path))) output.add("Comments are not included in the semantic preview.");
  if (kind === "docx" && paths.some((path) => /word\/(?:footnotes|endnotes)\.xml$/u.test(path))) output.add("Footnotes/endnotes are not merged into the primary semantic reading order.");
  if (kind === "pptx") output.add("Slide preview is text/structure only; raster or layout-faithful rendering is refused without an approved renderer.");
  if (kind === "xlsx") output.add("Workbook structure inspection does not claim faithful cell formatting, formula calculation or print-layout rendering.");
  return [...output];
}

export async function inspectOfficeStructure(input: ArrayBuffer | Uint8Array): Promise<OfficeStructureInspection> {
  const { analysis, members } = await loadPackage(input);
  return {
    kind: analysis.kind,
    analysis,
    metadata: inspectMetadataMembers(members),
    mediaParts: analysis.entries.filter(({ classification }) => classification === "media").map(({ path }) => path),
    fontParts: analysis.entries.filter(({ classification }) => classification === "font").map(({ path }) => path),
    externalRelationshipCount: externalRelationshipCount(members),
    unsupportedConstructs: unsupportedInventory(analysis.kind, members),
    previewPolicy: "semantic-structure-only-not-faithful-rendering",
    activeContentPolicy: "macros-refused-scripts-never-executed-external-links-never-resolved",
  };
}

function cleanedMetadataPart(path: string): Uint8Array | null {
  if (path === "docProps/core.xml") return XML_ENCODER.encode('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"/>');
  if (path === "docProps/app.xml") return XML_ENCODER.encode('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"/>');
  if (path === "docProps/custom.xml") return XML_ENCODER.encode('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/custom-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"/>');
  return null;
}

function sameStructuralCounts(left: OoxmlPackageAnalysis, right: OoxmlPackageAnalysis): boolean {
  return left.kind === right.kind && left.entryCount === right.entryCount && left.documentCount === right.documentCount && left.slideCount === right.slideCount && left.sheetCount === right.sheetCount && left.relationshipPartCount === right.relationshipPartCount;
}

export async function cleanOfficeMetadata(input: ArrayBuffer | Uint8Array): Promise<OfficeMetadataCleanupResult> {
  const source = input instanceof Uint8Array ? input : new Uint8Array(input);
  const { analysis: beforeAnalysis, members } = await loadPackage(source);
  const before = inspectMetadataMembers(members);
  const rebuiltMembers: Zippable = {};
  for (const [path, bytes] of Object.entries(members)) rebuiltMembers[path] = [cleanedMetadataPart(path) ?? bytes, { level: 9 }];
  const { zipSync, unzipSync } = await import("fflate");
  const rebuilt = zipSync(rebuiltMembers, { level: 9 });
  if (rebuilt.byteLength > OOXML_PACKAGE_LIMITS.maxInputBytes) throw new OoxmlPackageError("OUTPUT_TOO_LARGE", "Cleaned OOXML package exceeds the bounded output limit.");
  const output = analyzeOoxmlPackage(rebuilt);
  const reopened = unzipSync(rebuilt);
  const after = inspectMetadataMembers(reopened);
  if (after.length !== 0) fail(`Metadata reinspection still found ${after.length} non-empty field(s).`);
  if (Object.keys(members).toSorted().join("\n") !== Object.keys(reopened).toSorted().join("\n")) fail("Metadata cleanup changed the OOXML member set.");
  for (const path of Object.keys(members).filter((path) => /\.rels$/u.test(path))) if (!equalBytes(members[path]!, reopened[path]!)) fail(`Metadata cleanup changed relationship bytes: ${path}.`);
  if (!equalBytes(members["[Content_Types].xml"]!, reopened["[Content_Types].xml"]!)) fail("Metadata cleanup changed [Content_Types].xml bytes.");
  if (!sameStructuralCounts(beforeAnalysis, output)) fail("Metadata cleanup changed document/slide/sheet or relationship counts.");
  return {
    bytes: exactArrayBuffer(rebuilt),
    byteLength: rebuilt.byteLength,
    before,
    after,
    removed: before,
    input: beforeAnalysis,
    output,
    verification: { metadataReinspectionEmpty: true, memberSetUnchanged: true, relationshipBytesUnchanged: true, contentTypesBytesUnchanged: true, structuralCountsUnchanged: true },
  };
}

function docxRelationships(members: Readonly<Record<string, Uint8Array>>): Map<string, Relationship> {
  const bytes = members["word/_rels/document.xml.rels"];
  if (bytes === undefined) return new Map();
  return new Map(parseRelationships(decodeXml(bytes, "word/_rels/document.xml.rels")).map((relationship) => [relationship.id, relationship] as const));
}

function paragraphLinks(xml: string, relationships: ReadonlyMap<string, Relationship>): DocxLink[] {
  const links: DocxLink[] = [];
  for (const match of xml.matchAll(/<w:hyperlink\b[^>]*\br:id=["']([^"']+)["'][^>]*>([\s\S]*?)<\/w:hyperlink>/giu)) {
    const relationship = relationships.get(match[1] ?? "");
    if (relationship === undefined) continue;
    links.push({ text: textFromXmlFragment(match[2] ?? "", "w:t"), target: relationship.target, external: relationship.external });
  }
  return links;
}

function paragraphText(xml: string): string {
  const values: string[] = [];
  const pattern = /<w:t\b[^>]*>([\s\S]*?)<\/w:t>|<w:tab\b[^>]*\/>|<w:(?:br|cr)\b[^>]*\/>/giu;
  for (const match of xml.matchAll(pattern)) {
    const token = match[0];
    if (/^<w:tab\b/iu.test(token)) values.push("\t");
    else if (/^<w:(?:br|cr)\b/iu.test(token)) values.push("\n");
    else values.push(decodeEntities((match[1] ?? "").replace(/<[^>]+>/gu, "")));
  }
  return values.join("");
}

function markdownLinks(text: string, links: readonly DocxLink[]): string {
  let output = text;
  for (const link of links) {
    if (link.text === "" || !output.includes(link.text)) continue;
    const safeTarget = /^(?:https?:|mailto:|tel:|#)/iu.test(link.target) ? link.target.replace(/\)/gu, "%29") : null;
    if (safeTarget !== null) output = output.replace(link.text, `[${link.text}](${safeTarget})`);
  }
  return output;
}

function htmlLinks(text: string, links: readonly DocxLink[]): string {
  const safeLinks = links.filter(({ target }) => /^(?:https?:|mailto:|tel:|#)/iu.test(target));
  if (safeLinks.length === 0) return escapeHtml(text).replace(/\n/gu, "<br />");
  const pieces: string[] = [];
  let cursor = 0;
  for (const link of safeLinks) {
    const found = text.indexOf(link.text, cursor);
    if (found < 0) continue;
    if (found > cursor) pieces.push(escapeHtml(text.slice(cursor, found)));
    pieces.push(`<a href="${escapeHtml(link.target)}" rel="noreferrer">${escapeHtml(link.text)}</a>`);
    cursor = found + link.text.length;
  }
  if (cursor < text.length) pieces.push(escapeHtml(text.slice(cursor)));
  return pieces.join("").replace(/\n/gu, "<br />");
}

export async function extractDocxSemantics(input: ArrayBuffer | Uint8Array): Promise<DocxSemanticExtraction> {
  const { analysis, members } = await loadPackage(input);
  if (analysis.kind !== "docx") throw new OoxmlPackageError("UNSUPPORTED_PACKAGE_KIND", "DOCX semantic extraction requires a DOCX package.");
  const documentBytes = members["word/document.xml"];
  if (documentBytes === undefined) fail("word/document.xml is missing after DOCX package validation.");
  const xml = decodeXml(documentBytes, "word/document.xml");
  const relationships = docxRelationships(members);
  const blocks: DocxSemanticBlock[] = [];
  const blockPattern = /<w:(p|tbl)\b[^>]*>[\s\S]*?<\/w:\1>/giu;
  for (const match of xml.matchAll(blockPattern)) {
    const tag = (match[1] ?? "").toLowerCase();
    const fragment = match[0];
    if (tag === "tbl") {
      const rows: string[][] = [];
      for (const row of fragment.matchAll(/<w:tr\b[^>]*>([\s\S]*?)<\/w:tr>/giu)) {
        const cells: string[] = [];
        for (const cell of (row[1] ?? "").matchAll(/<w:tc\b[^>]*>([\s\S]*?)<\/w:tc>/giu)) cells.push(paragraphText(cell[1] ?? ""));
        rows.push(cells);
      }
      blocks.push({ type: "table", rows });
      continue;
    }
    const text = paragraphText(fragment);
    const links = paragraphLinks(fragment, relationships);
    const heading = /<w:pStyle\b[^>]*\bw:val=["'](?:Heading|Titolo)([1-6])["']/iu.exec(fragment)?.[1];
    if (heading !== undefined) blocks.push({ type: "heading", level: Number(heading) as 1 | 2 | 3 | 4 | 5 | 6, text, links });
    else if (/<w:numPr\b/iu.test(fragment)) blocks.push({ type: "list-item", ordered: /<w:numId\b[^>]*\bw:val=["'](?:2|3|4|5|6|7|8|9)["']/iu.test(fragment), text, links });
    else if (text !== "" || links.length > 0) blocks.push({ type: "paragraph", text, links });
  }
  const assets: DocxAssetReference[] = [];
  for (const embed of xml.matchAll(/<a:blip\b[^>]*\br:embed=["']([^"']+)["'][^>]*\/?\s*>/giu)) {
    const relationship = relationships.get(embed[1] ?? "");
    if (relationship === undefined || relationship.external) continue;
    const normalized = relationship.target.replace(/^\.\//u, "").replace(/^\.\.\//u, "");
    const part = normalized.startsWith("word/") ? normalized : `word/${normalized}`;
    const bytes = members[part];
    if (bytes !== undefined) assets.push({ relationshipId: embed[1]!, part, mime: mimeForPart(part), byteLength: bytes.byteLength });
  }
  const unsupported = new Set(unsupportedInventory("docx", members));
  if (/<w:(?:ins|del)\b/iu.test(xml)) unsupported.add("Tracked changes are not merged into semantic output; review markup requires a dedicated policy.");
  if (/<w:(?:fldSimple|instrText)\b/iu.test(xml)) unsupported.add("Field instructions are not executed; only recoverable displayed text is preserved.");
  if (/<wp:anchor\b/iu.test(xml)) unsupported.add("Floating layout/anchoring is not reproduced in semantic output.");
  if (/<w:altChunk\b/iu.test(xml)) unsupported.add("altChunk embedded content is not interpreted.");
  if (assets.length > 0) unsupported.add("Embedded image bytes are inventoried but not rendered or executed in the semantic HTML preview.");
  const assetText = assets.map(({ part }) => `[Embedded image: ${part}]`);
  const text = [...blocks.map((block) => block.type === "table" ? block.rows.map((row) => row.join("\t")).join("\n") : block.text), ...assetText].join("\n\n");
  const markdown = [...blocks.map((block) => {
    if (block.type === "table") return block.rows.map((row, index) => `| ${row.join(" | ")} |${index === 0 ? `\n| ${row.map(() => "---").join(" | ")} |` : ""}`).join("\n");
    const linked = markdownLinks(block.text, block.links);
    if (block.type === "heading") return `${"#".repeat(block.level)} ${linked}`;
    if (block.type === "list-item") return `${block.ordered ? "1." : "-"} ${linked}`;
    return linked;
  }), ...assetText].join("\n\n");
  const html = [...blocks.map((block) => {
    if (block.type === "table") return `<table><tbody>${block.rows.map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
    const safe = htmlLinks(block.text, block.links);
    if (block.type === "heading") return `<h${block.level}>${safe}</h${block.level}>`;
    if (block.type === "list-item") return `<p data-list-item="${block.ordered ? "ordered" : "unordered"}">${safe}</p>`;
    return `<p>${safe}</p>`;
  }), ...assets.map(({ part, mime, byteLength }) => `<p data-docx-asset="${escapeHtml(part)}">Embedded image (${escapeHtml(mime)}, ${byteLength} bytes): ${escapeHtml(part)}</p>`)].join("\n");
  const structureCounts = {
    paragraphs: blocks.filter(({ type }) => type === "paragraph").length,
    headings: blocks.filter(({ type }) => type === "heading").length,
    listItems: blocks.filter(({ type }) => type === "list-item").length,
    tables: blocks.filter(({ type }) => type === "table").length,
    links: blocks.reduce((sum, block) => sum + (block.type === "table" ? 0 : block.links.length), 0),
    assets: assets.length,
  };
  return { blocks, assets, structureCounts, text, markdown, html, unsupportedConstructs: [...unsupported], fidelity: "semantic-not-layout", activeContentPolicy: "macros-refused-external-resources-never-fetched" };
}

function parseMarkdownBlocks(input: string, unsupported: Set<string>): GeneratedBlock[] {
  const lines = input.replace(/\r\n?/gu, "\n").split("\n");
  const blocks: GeneratedBlock[] = [];
  for (let index = 0; index < lines.length;) {
    const line = lines[index] ?? "";
    if (line.trim() === "") { index += 1; continue; }
    const fence = /^\s*```/u.test(line);
    if (fence) {
      const code: string[] = [];
      index += 1;
      while (index < lines.length && !/^\s*```/u.test(lines[index] ?? "")) { code.push(lines[index] ?? ""); index += 1; }
      if (index < lines.length) index += 1;
      blocks.push({ type: "code", text: code.join("\n") });
      continue;
    }
    const heading = /^(#{1,6})\s+(.+)$/u.exec(line);
    if (heading !== null) { blocks.push({ type: "heading", level: heading[1]!.length, text: heading[2] ?? "", links: parseMarkdownLinks(heading[2] ?? "") }); index += 1; continue; }
    const list = /^\s*(?:(\d+)[.)]|[-*+])\s+(.+)$/u.exec(line);
    if (list !== null) { blocks.push({ type: "list-item", ordered: list[1] !== undefined, text: list[2] ?? "", links: parseMarkdownLinks(list[2] ?? "") }); index += 1; continue; }
    if (/^\s*\|.*\|\s*$/u.test(line) && /^\s*\|?\s*:?-{3,}/u.test(lines[index + 1] ?? "")) {
      const tableLines = [line];
      index += 2;
      while (index < lines.length && /^\s*\|.*\|\s*$/u.test(lines[index] ?? "")) { tableLines.push(lines[index] ?? ""); index += 1; }
      const parsedRows = tableLines.map((row) => row.trim().replace(/^\||\|$/gu, "").split("|").map((cell) => cell.trim()));
      blocks.push({ type: "table", rows: parsedRows });
      continue;
    }
    if (/!\[[^\]]*\]\([^)]+\)/u.test(line)) unsupported.add("Markdown image references are represented as text placeholders; image bytes are not fetched or embedded.");
    const paragraph: string[] = [line];
    index += 1;
    while (index < lines.length && (lines[index] ?? "").trim() !== "" && !/^(?:#{1,6}\s+|\s*(?:\d+[.)]|[-*+])\s+|\s*```)/u.test(lines[index] ?? "")) { paragraph.push(lines[index] ?? ""); index += 1; }
    const value = paragraph.join("\n");
    blocks.push({ type: "paragraph", text: value, links: parseMarkdownLinks(value) });
  }
  return blocks;
}

function parseMarkdownLinks(value: string): DocxLink[] {
  const links: DocxLink[] = [];
  for (const match of value.matchAll(/(?<!!)\[([^\]]+)\]\((https?:\/\/[^\s)]+|mailto:[^\s)]+|tel:[^\s)]+)\)/giu)) links.push({ text: match[1] ?? "", target: match[2] ?? "", external: true });
  return links;
}

function stripMarkdownInline(value: string): string {
  return value.replace(/!\[([^\]]*)\]\([^)]+\)/gu, "[Immagine: $1]").replace(/\[([^\]]+)\]\([^)]+\)/gu, "$1").replace(/(?:\*\*|__|~~|`)(.*?)(?:\*\*|__|~~|`)/gu, "$1");
}

function parseTextBlocks(input: string): GeneratedBlock[] {
  return input.replace(/\r\n?/gu, "\n").split(/\n{2,}/u).filter((part) => part !== "").map((text) => ({ type: "paragraph", text }));
}

async function parseHtmlBlocks(input: string, unsupported: Set<string>): Promise<GeneratedBlock[]> {
  const { parseFragment } = await import("parse5");
  const fragment = parseFragment(input) as unknown as { childNodes?: any[] };
  const blocks: GeneratedBlock[] = [];
  const textContent = (node: any): string => node?.nodeName === "#text" ? String(node.value ?? "") : (node?.childNodes ?? []).map(textContent).join("");
  const linksFromNode = (node: any): DocxLink[] => {
    const links: DocxLink[] = [];
    const visit = (candidate: any): void => {
      if (candidate?.tagName === "a") {
        const href = String((candidate.attrs ?? []).find((attr: any) => attr.name === "href")?.value ?? "").trim();
        if (/^(?:https?:|mailto:|tel:)/iu.test(href)) links.push({ text: textContent(candidate).trim(), target: href, external: true });
        else if (href !== "") unsupported.add("HTML links with unsupported or unsafe schemes are reduced to visible text.");
      }
      for (const child of candidate?.childNodes ?? []) visit(child);
    };
    visit(node);
    return links;
  };
  const walk = (node: any): void => {
    const tag = String(node?.tagName ?? "").toLowerCase();
    if (["script", "style", "iframe", "object", "embed", "template"].includes(tag)) { unsupported.add(`HTML <${tag}> content is omitted and never executed.`); return; }
    if (/^h[1-6]$/u.test(tag)) { blocks.push({ type: "heading", level: Number(tag[1]), text: textContent(node).trim(), links: linksFromNode(node) }); return; }
    if (tag === "p" || tag === "div") { const text = textContent(node).trim(); if (text !== "") blocks.push({ type: "paragraph", text, links: linksFromNode(node) }); return; }
    if (tag === "pre") { blocks.push({ type: "code", text: textContent(node) }); return; }
    if (tag === "li") { blocks.push({ type: "list-item", ordered: node.parentNode?.tagName === "ol", text: textContent(node).trim(), links: linksFromNode(node) }); return; }
    if (tag === "table") {
      const rows: string[][] = [];
      const collectRows = (candidate: any): void => {
        if (candidate?.tagName === "tr") rows.push((candidate.childNodes ?? []).filter((child: any) => child.tagName === "td" || child.tagName === "th").map((cell: any) => textContent(cell).trim()));
        for (const child of candidate?.childNodes ?? []) collectRows(child);
      };
      collectRows(node);
      blocks.push({ type: "table", rows });
      return;
    }
    if (tag === "img") { const alt = (node.attrs ?? []).find((attr: any) => attr.name === "alt")?.value ?? ""; blocks.push({ type: "image-placeholder", text: `[Immagine: ${alt}]` }); unsupported.add("HTML image references are represented as text placeholders; image bytes are not fetched or embedded."); return; }
    for (const child of node?.childNodes ?? []) walk(child);
  };
  for (const node of fragment.childNodes ?? []) walk(node);
  return blocks;
}

function paragraphXml(text: string, options: { readonly style?: string; readonly numberingId?: number; readonly links?: readonly DocxLink[]; readonly linkStart?: number } = {}): { xml: string; relationships: DocxLink[] } {
  const relationships = [...(options.links ?? [])];
  const plain = stripMarkdownInline(text);
  const runXml = (value: string): string => `<w:r><w:t xml:space="preserve">${escapeXml(value)}</w:t></w:r>`;
  const pieces: string[] = [];
  let cursor = 0;
  for (let index = 0; index < relationships.length; index += 1) {
    const link = relationships[index]!;
    const found = plain.indexOf(link.text, cursor);
    if (found < 0) continue;
    if (found > cursor) pieces.push(runXml(plain.slice(cursor, found)));
    pieces.push(`<w:hyperlink r:id="rIdLink${(options.linkStart ?? 0) + index + 1}"><w:r><w:rPr><w:rStyle w:val="Hyperlink"/></w:rPr><w:t xml:space="preserve">${escapeXml(link.text)}</w:t></w:r></w:hyperlink>`);
    cursor = found + link.text.length;
  }
  if (cursor < plain.length) pieces.push(runXml(plain.slice(cursor)));
  if (pieces.length === 0) pieces.push(runXml(plain));
  const props = `${options.style === undefined ? "" : `<w:pStyle w:val="${escapeXml(options.style)}"/>`}${options.numberingId === undefined ? "" : `<w:numPr><w:ilvl w:val="0"/><w:numId w:val="${options.numberingId}"/></w:numPr>`}`;
  return { xml: `<w:p>${props === "" ? "" : `<w:pPr>${props}</w:pPr>`}${pieces.join("")}</w:p>`, relationships };
}

function tableXml(rows: readonly (readonly string[])[]): string {
  return `<w:tbl><w:tblPr><w:tblW w:w="0" w:type="auto"/></w:tblPr>${rows.map((row) => `<w:tr>${row.map((cell) => `<w:tc><w:p><w:r><w:t xml:space="preserve">${escapeXml(cell)}</w:t></w:r></w:p></w:tc>`).join("")}</w:tr>`).join("")}</w:tbl>`;
}

export async function generateDocxFromSemanticText(input: string, sourceFormat: "text" | "markdown" | "html"): Promise<DocxGenerationResult> {
  if (XML_ENCODER.encode(input).byteLength > 2 * 1024 * 1024) throw new OoxmlPackageError("PACKAGE_TOO_LARGE", "DOCX semantic source exceeds the 2 MiB bounded input limit.");
  const unsupported = new Set<string>();
  const blocks = sourceFormat === "text" ? parseTextBlocks(input) : sourceFormat === "markdown" ? parseMarkdownBlocks(input, unsupported) : await parseHtmlBlocks(input, unsupported);
  const relationships: DocxLink[] = [];
  const body = blocks.map((block) => {
    if (block.type === "table") return tableXml(block.rows ?? []);
    const links = block.links ?? [];
    const offset = relationships.length;
    relationships.push(...links);
    if (block.type === "heading") return paragraphXml(block.text ?? "", { style: `Heading${block.level ?? 1}`, links, linkStart: offset }).xml;
    if (block.type === "list-item") return paragraphXml(block.text ?? "", { numberingId: block.ordered ? 2 : 1, links, linkStart: offset }).xml;
    if (block.type === "code") return paragraphXml(block.text ?? "", { style: "CodeBlock" }).xml;
    if (block.type === "image-placeholder") return paragraphXml(block.text ?? "").xml;
    return paragraphXml(block.text ?? "", { links, linkStart: offset }).xml;
  }).join("");
  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:body>${body}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr></w:body></w:document>`;
  const contentTypes = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/></Types>';
  const rootRels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>';
  const documentRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${relationships.map((link, index) => `<Relationship Id="rIdLink${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="${escapeXml(link.target)}" TargetMode="External"/>`).join("")}</Relationships>`;
  const styles = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style><w:style w:type="character" w:styleId="Hyperlink"><w:name w:val="Hyperlink"/><w:rPr><w:color w:val="0563C1"/><w:u w:val="single"/></w:rPr></w:style>' + [1,2,3,4,5,6].map((level) => `<w:style w:type="paragraph" w:styleId="Heading${level}"><w:name w:val="heading ${level}"/><w:basedOn w:val="Normal"/><w:qFormat/></w:style>`).join("") + '<w:style w:type="paragraph" w:styleId="CodeBlock"><w:name w:val="Code Block"/><w:basedOn w:val="Normal"/><w:rPr><w:rFonts w:ascii="Courier New" w:hAnsi="Courier New"/></w:rPr></w:style></w:styles>';
  const numbering = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:abstractNum w:abstractNumId="0"><w:lvl w:ilvl="0"><w:numFmt w:val="bullet"/><w:lvlText w:val="•"/></w:lvl></w:abstractNum><w:abstractNum w:abstractNumId="1"><w:lvl w:ilvl="0"><w:numFmt w:val="decimal"/><w:lvlText w:val="%1."/></w:lvl></w:abstractNum><w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num><w:num w:numId="2"><w:abstractNumId w:val="1"/></w:num></w:numbering>';
  const entries: Zippable = {
    "[Content_Types].xml": [XML_ENCODER.encode(contentTypes), { level: 9 }],
    "_rels/.rels": [XML_ENCODER.encode(rootRels), { level: 9 }],
    "word/document.xml": [XML_ENCODER.encode(documentXml), { level: 9 }],
    "word/_rels/document.xml.rels": [XML_ENCODER.encode(documentRels), { level: 9 }],
    "word/styles.xml": [XML_ENCODER.encode(styles), { level: 9 }],
    "word/numbering.xml": [XML_ENCODER.encode(numbering), { level: 9 }],
  };
  const { zipSync } = await import("fflate");
  const bytes = zipSync(entries, { level: 9 });
  const output = analyzeOoxmlPackage(bytes);
  const reopened = await extractDocxSemantics(bytes);
  return { bytes: exactArrayBuffer(bytes), byteLength: bytes.byteLength, sourceFormat, unsupportedConstructs: [...unsupported], output, reopened, verification: { reopened: true, memberSetValidated: true, deterministicSimpleStyleTemplate: true } };
}

export async function extractPptxOutline(input: ArrayBuffer | Uint8Array): Promise<PptxOutlineResult> {
  const { analysis, members } = await loadPackage(input);
  if (analysis.kind !== "pptx") throw new OoxmlPackageError("UNSUPPORTED_PACKAGE_KIND", "PPTX outline extraction requires a PPTX package.");
  const slideParts = Object.keys(members).filter((path) => /^ppt\/slides\/slide\d+\.xml$/u.test(path)).toSorted((left, right) => Number(/slide(\d+)/u.exec(left)?.[1] ?? 0) - Number(/slide(\d+)/u.exec(right)?.[1] ?? 0));
  const slides = slideParts.map((part, index) => {
    const xml = decodeXml(members[part]!, part);
    const text = [...xml.matchAll(/<a:p\b[^>]*>([\s\S]*?)<\/a:p>/giu)].map((match) => textFromXmlFragment(match[1] ?? "", "a:t")).filter((value) => value !== "");
    const placeholderShape = /<p:sp\b[\s\S]*?<p:ph\b[^>]*\btype=["'](?:title|ctrTitle)["'][^>]*\/?[\s\S]*?<\/p:sp>/iu.exec(xml)?.[0];
    const placeholderTitle = placeholderShape === undefined ? null : textFromXmlFragment(placeholderShape, "a:t") || null;
    const title = placeholderTitle ?? text[0] ?? null;
    return { slideNumber: index + 1, part, title, titleSource: placeholderTitle !== null ? "placeholder" as const : title !== null ? "first-text-fallback" as const : "none" as const, text };
  });
  const mediaParts = Object.entries(members).filter(([path]) => /^ppt\/media\//u.test(path)).map(([part, bytes]) => ({ part, mime: mimeForPart(part), byteLength: bytes.byteLength }));
  return {
    slides,
    mediaParts,
    unsupportedConstructs: unsupportedInventory("pptx", members),
    rasterExport: { status: "REFUSED", reason: "No approved faithful PPTX renderer exists in the bounded Office runtime." },
  };
}
