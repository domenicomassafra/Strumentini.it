import { analyzeOoxmlPackage, OOXML_PACKAGE_LIMITS, OoxmlPackageError, type OoxmlPackageAnalysis, type OoxmlPackageKind } from "./package";
import { parseXmlDocument } from "../developer-web/structured-repair";
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
  // Snapshot before the asynchronous unzip: verified raw ZIP bytes must be
  // the exact bytes consumed even when a caller reuses/mutates its buffer.
  const source = input instanceof Uint8Array ? input.slice() : new Uint8Array(input.slice(0));
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
  // Real OOXML permits whitespace around = and either attribute quote style.
  // The old regex silently dropped valid links and accepted malformed XML or
  // shadowed duplicate IDs; the bounded XML parser rejects both cases.
  let root: ReturnType<typeof parseXmlDocument>["root"];
  try {
    root = parseXmlDocument(xml).root;
  } catch {
    fail("Office relationship XML is invalid or exceeds the bounded XML parser limits.");
  }
  const packageNamespace = "http://schemas.openxmlformats.org/package/2006/relationships";
  // XML prefixes are aliases, not identities. Resolve the namespace URI in
  // scope for EACH relationship, including declarations overridden on a child.
  // Otherwise <evil:Relationship> in a foreign namespace can forge a DOCX href.
  const namespace = (
    qualifiedName: string,
    attributes: readonly { readonly name: string; readonly value: string }[],
    inherited: readonly { readonly name: string; readonly value: string }[] = [],
  ): string | null => {
    const parts = qualifiedName.split(":");
    if (parts.length > 2 || parts.some((part) => part === "")) return null;
    const declaration = parts.length === 2 ? `xmlns:${parts[0]}` : "xmlns";
    const defined = attributes.find((entry) => entry.name === declaration)
      ?? inherited.find((entry) => entry.name === declaration);
    return defined === undefined ? null : decodeEntities(defined.value);
  };
  if (root.name.split(":").at(-1) !== "Relationships") fail("Unexpected OOXML relationships document root.");
  if (namespace(root.name, root.attributes) !== packageNamespace) {
    fail("OOXML relationships XML has an unsupported namespace.");
  }
  const ids = new Set<string>();
  for (const child of root.children) {
    if (child.kind !== "element") continue;
    if (child.name.split(":").at(-1) !== "Relationship" ||
      namespace(child.name, child.attributes, root.attributes) !== packageNamespace) {
      fail("OOXML relationship element has an unsupported or unbound namespace.");
    }
    const attribute = (name: string) => child.attributes.find((entry) => entry.name === name)?.value;
    const id = attribute("Id");
    const target = attribute("Target");
    const type = attribute("Type");
    const mode = attribute("TargetMode");
    if (!id || !target || !type || (mode !== undefined && mode !== "Internal" && mode !== "External")) {
      fail("OOXML relationship has missing or unsupported required attributes.");
    }
    const decodedId = decodeEntities(id);
    if (ids.has(decodedId)) fail("OOXML relationship IDs are ambiguous or duplicated.");
    ids.add(decodedId);
    output.push({ id: decodedId, target: decodeEntities(target), external: mode === "External" });
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

export async function generateDocxFromSemanticText(input: string, sourceFormat: "text" | "markdown" | "html"): Promise<DocxGenerationResult> {
  if (XML_ENCODER.encode(input).byteLength > 2 * 1024 * 1024) throw new OoxmlPackageError("PACKAGE_TOO_LARGE", "DOCX semantic source exceeds the 2 MiB bounded input limit.");
  const unsupported = new Set<string>();
  const blocks = sourceFormat === "text" ? parseTextBlocks(input) : sourceFormat === "markdown" ? parseMarkdownBlocks(input, unsupported) : await parseHtmlBlocks(input, unsupported);
  // The established HTML/Markdown preflight remains the only source of blocks:
  // docx never parses HTML, downloads images or resolves links.
  const { Document, ExternalHyperlink, HeadingLevel, LevelFormat, Packer, Paragraph, Table, TableCell, TableRow, TextRun } = await import("docx");
  const runs = (value: string, style?: string) => value.split("\n").map((piece, index) =>
    new TextRun({ text: piece, ...(index > 0 ? { break: 1 } : {}), ...(style === undefined ? {} : { style }) }));
  const paragraph = (block: GeneratedBlock) => {
    const plain = stripMarkdownInline(block.text ?? "");
    const children: (InstanceType<typeof TextRun> | InstanceType<typeof ExternalHyperlink>)[] = [];
    let cursor = 0;
    for (const link of block.links ?? []) {
      if (!/^(?:https?:\/\/|mailto:|tel:)/iu.test(link.target) || !link.text) continue;
      const index = plain.indexOf(link.text, cursor);
      if (index < 0) continue;
      if (index > cursor) children.push(...runs(plain.slice(cursor, index)));
      children.push(new ExternalHyperlink({ link: link.target, children: runs(link.text, "Hyperlink") }));
      cursor = index + link.text.length;
    }
    if (cursor < plain.length || children.length === 0) children.push(...runs(plain.slice(cursor)));
    return new Paragraph({
      children,
      ...(block.type === "heading" ? { heading: HeadingLevel[`HEADING_${block.level ?? 1}` as keyof typeof HeadingLevel] } : {}),
      ...(block.type === "code" ? { style: "CodeBlock" } : {}),
      ...(block.type === "list-item" ? block.ordered ? { numbering: { reference: "ordered", level: 0 } } : { bullet: { level: 0 } } : {}),
    });
  };
  const children = blocks.map((block) => block.type === "table"
    ? new Table({ rows: (block.rows ?? []).map((row) => new TableRow({ children: row.map((cell) =>
      new TableCell({ children: [new Paragraph({ children: runs(cell) })] })) })) })
    : paragraph(block));
  const document = new Document({
    creator: "", lastModifiedBy: "",
    styles: { paragraphStyles: [{ id: "CodeBlock", name: "Code Block", basedOn: "Normal", run: { font: "Courier New" } }] },
    numbering: { config: [{ reference: "ordered", levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: "start" }] }] },
    sections: [{ properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } }, children }],
  });
  // JSZip's nodebuffer output is unavailable inside a real browser Worker.
  const bytes = new Uint8Array(await Packer.toArrayBuffer(document));
  if (bytes.byteLength > OOXML_PACKAGE_LIMITS.maxInputBytes) throw new OoxmlPackageError("OUTPUT_TOO_LARGE", "Generated DOCX exceeds the bounded OOXML output limit.");
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
