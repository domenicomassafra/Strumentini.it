import { unzipSync, zipSync } from "fflate";
import { analyzeOoxmlPackage } from "../ooxml/package";
import { parseXmlDocument, type XmlElement } from "../developer-web/structured-repair";
import {
  WorkbookError389, type Workbook389, type WorkbookCell389, WORKBOOK_389_LIMITS,
  cellIndex389, cellAddress389, recalculateWorkbook389, strictWorkbookNumber389,
} from "./workbook-formulas-389";

const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8", { fatal: true });
const blank = (): WorkbookCell389 => ({ kind: "blank", input: "", value: "" });

function refuse(message: string): never { throw new WorkbookError389("UNSUPPORTED_WORKBOOK", message); }
function localName(element: XmlElement) { return element.name.split(":").at(-1); }
function children(element: XmlElement, name: string): XmlElement[] {
  return element.children.filter((child): child is XmlElement => child.kind === "element" && localName(child) === name);
}
function attribute(element: XmlElement, name: string) {
  const raw = element.attributes.find((attr) => attr.name === name)?.value;
  return raw === undefined ? undefined : unescapeXml(raw);
}
function unescapeXml(raw: string): string {
  return raw.replace(/&(?:amp|lt|gt|quot|apos|#x[0-9a-fA-F]+|#[0-9]+);/gu, (entity) => {
    const item = entity.slice(1, -1);
    if (item.startsWith("#")) return String.fromCodePoint(Number.parseInt(item.slice(item[1] === "x" ? 2 : 1), item[1] === "x" ? 16 : 10));
    return ({ amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" } as Record<string, string>)[item] ?? entity;
  });
}
function elementText(element: XmlElement): string {
  if (element.children.some((child) => child.kind !== "text" && child.kind !== "cdata")) refuse(`Struttura testo XML non supportata: ${element.name}`);
  return unescapeXml(element.children.map((child) => child.kind === "text" || child.kind === "cdata" ? child.value : "").join(""));
}
function getOne(parent: XmlElement, name: string): XmlElement | undefined {
  const matches = children(parent, name);
  if (matches.length > 1) refuse(`Elemento OOXML duplicato: ${name}`);
  return matches[0];
}
function parsePart(entries: Record<string, Uint8Array>, path: string): XmlElement {
  const content = entries[path];
  if (!content) refuse(`Parte mancante: ${path}`);
  try { return parseXmlDocument(decoder.decode(content)).root; }
  catch { return refuse(`XML OOXML invalido: ${path}`); }
}
function checkAllowed(element: XmlElement, allowed: readonly string[]) {
  for (const node of element.children) if (node.kind === "element" && !allowed.includes(localName(node) ?? "")) {
    refuse(`Funzione Excel non conservabile nell'editor: ${localName(node)}`);
  }
}
function xmlEscape(value: string): string {
  if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/u.test(value)) {
    throw new WorkbookError389("INVALID_CELL", "Carattere non consentito nel formato XML.");
  }
  return value.replace(/&/gu, "&amp;").replace(/</gu, "&lt;").replace(/>/gu, "&gt;").replace(/"/gu, "&quot;").replace(/'/gu, "&apos;");
}

function sharedStrings(entries: Record<string, Uint8Array>): string[] {
  if (!entries["xl/sharedStrings.xml"]) return [];
  const root = parsePart(entries, "xl/sharedStrings.xml");
  if (localName(root) !== "sst") refuse("Tabella stringhe XLSX non valida.");
  return children(root, "si").map((entry) => {
    checkAllowed(entry, ["t"]);
    const text = getOne(entry, "t");
    if (!text) refuse("Le stringhe con formattazione ricca non sono supportate.");
    return elementText(text);
  });
}

function inspectPackage(bytes: ArrayBuffer) {
  if (!(bytes instanceof ArrayBuffer) || bytes.byteLength > WORKBOOK_389_LIMITS.bytes) {
    throw new WorkbookError389("FILE_TOO_LARGE", "Workbook XLSX oltre il limite locale di 10 MiB.");
  }
  const analysis = analyzeOoxmlPackage(bytes);
  if (analysis.kind !== "xlsx" || analysis.sheetCount !== 1) refuse("Questo editor accetta un unico foglio Excel XLSX.");
  const entries = unzipSync(new Uint8Array(bytes));
  const manifest = parsePart(entries, "[Content_Types].xml");
  if (localName(manifest) !== "Types" || decoder.decode(entries["[Content_Types].xml"]).match(/macroEnabled|vbaProject|activeX/iu)) {
    refuse("Macro, ActiveX e workbook con macro sono esclusi.");
  }
  if (manifest.children.some((node) => node.kind === "element" && node.attributes.some((attr) => /macroEnabled|vbaProject|activeX/iu.test(unescapeXml(attr.value))))) {
    refuse("Dichiarazione di macro/ActiveX nel manifesto Excel.");
  }
  if (Object.keys(entries).some((name) => /(?:externalLinks|vbaProject|embeddings|drawings|charts|pivot|tables|comments|connections|queryTables|customXml|metadata)\//iu.test(name) || /(?:^|\/)calcChain\.xml$/iu.test(name))) {
    refuse("Collegamenti esterni, oggetti e strutture avanzate non sono modificabili.");
  }
  for (const path of Object.keys(entries)) {
    if (path.endsWith(".rels")) {
      const rels = parsePart(entries, path);
      if (localName(rels) !== "Relationships" || children(rels, "Relationship").some((relation) =>
        attribute(relation, "TargetMode") === "External" ||
        /(?:^\w+:|externalLink)/iu.test(attribute(relation, "Target") ?? "") ||
        /externalLink/iu.test(attribute(relation, "Type") ?? ""))) {
        refuse("Riferimenti remoti o hyperlink esterni sono esclusi.");
      }
    }
  }
  const workbook = parsePart(entries, "xl/workbook.xml");
  if (localName(workbook) !== "workbook") refuse("Workbook.xml non valido.");
  checkAllowed(workbook, ["fileVersion", "fileSharing", "workbookPr", "bookViews", "sheets", "calcPr", "extLst", "definedNames"]);
  if (children(workbook, "extLst").length) refuse("Estensioni workbook non supportate.");
  const names = getOne(workbook, "definedNames");
  if (names) checkAllowed(names, ["definedName"]);
  if (names && children(names, "definedName").length) refuse("Nomi definiti e formule indirette non supportati.");
  const sheetNodes = getOne(workbook, "sheets");
  const sheets = sheetNodes ? children(sheetNodes, "sheet") : [];
  if (sheets.length !== 1) refuse("È richiesto esattamente un foglio.");
  const sheetName = attribute(sheets[0]!, "name");
  const relationId = attribute(sheets[0]!, "r:id");
  if (!sheetName || !relationId) refuse("Nome o relazione del foglio assente.");
  const rels = parsePart(entries, "xl/_rels/workbook.xml.rels");
  const relationship = children(rels, "Relationship").find((node) => attribute(node, "Id") === relationId);
  const target = relationship && attribute(relationship, "Target");
  if (!target || !/\/worksheet$/u.test(attribute(relationship!, "Type") ?? "") || /[\\?#%]/u.test(target)) {
    refuse("Relazione worksheet non supportata.");
  }
  const parts = target.startsWith("/") ? [] : ["xl"];
  for (const part of target.split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") { if (parts.length === 0) refuse("Percorso foglio fuori dall'archivio."); parts.pop(); }
    else parts.push(part);
  }
  const sheetPath = parts.join("/");
  if (!/^xl\/worksheets\/[^/]+\.xml$/u.test(sheetPath) || !entries[sheetPath]) refuse("Worksheet non trovata.");
  const styles = entries["xl/styles.xml"] ? parsePart(entries, "xl/styles.xml") : undefined;
  if (styles) {
    if (localName(styles) !== "styleSheet") refuse("Stili Excel non validi.");
    // An absent cell s attribute and explicit s="0" both use cellXfs[0].
    // Reject dates and other effective formats even when the index is zero.
    const xfs = getOne(styles, "cellXfs");
    const defaultXf = xfs && children(xfs, "xf")[0];
    const namedXfs = getOne(styles, "cellStyleXfs");
    const baseXf = namedXfs && children(namedXfs, "xf")[0];
    // OOXML omits numFmtId for the built-in General style (equivalent to 0).
    if (!defaultXf || (attribute(defaultXf, "numFmtId") ?? "0") !== "0" ||
        (baseXf && (attribute(baseXf, "numFmtId") ?? "0") !== "0")) {
      refuse("Formato di cella predefinito non General (date/stili) non supportato.");
    }
  }
  const sheet = parsePart(entries, sheetPath);
  if (localName(sheet) !== "worksheet") refuse("Struttura worksheet non valida.");
  checkAllowed(sheet, ["sheetPr", "dimension", "sheetViews", "sheetFormatPr", "sheetData", "pageMargins", "printOptions", "pageSetup"]);
  if (children(sheet, "pageSetup").length) refuse("Impostazioni di stampa avanzate non supportate.");
  return { entries, sheet, sheetPath, sheetName, workbook };
}

function readWorkbook(bytes: ArrayBuffer): Workbook389 {
  const { entries, sheet, sheetName } = inspectPackage(bytes);
  const strings = sharedStrings(entries);
  const data = getOne(sheet, "sheetData");
  if (!data) refuse("SheetData mancante.");
  if (data.attributes.length) refuse("Attributi sheetData non preservabili.");
  const rows = Array.from({ length: WORKBOOK_389_LIMITS.rows }, () => Array.from({ length: WORKBOOK_389_LIMITS.columns }, blank));
  let lastRow = 0, lastColumn = 0;
  const addresses = new Set<string>();
  for (const row of children(data, "row")) {
    if (row.attributes.some((attr) => attr.name !== "r")) refuse("Formato di riga/righe nascoste non preservabile.");
    checkAllowed(row, ["c"]);
    for (const cell of children(row, "c")) {
      if (cell.attributes.some((attr) => !["r", "s", "t"].includes(attr.name))) refuse("Attributi di cella non preservabili.");
      const addr = attribute(cell, "r");
      if (!addr) refuse("Cella senza indirizzo nel file Excel.");
      const [r, c] = cellIndex389(addr);
      if (attribute(row, "r") !== String(r + 1)) refuse("Indirizzo di cella incoerente con la riga.");
      if (addresses.has(addr)) refuse("Celle duplicate nel workbook.");
      addresses.add(addr);
      if (attribute(cell, "s") && attribute(cell, "s") !== "0") refuse("Formato di cella non supportato (date/stili): dati originali conservati.");
      checkAllowed(cell, ["f", "v", "is"]);
      const formula = getOne(cell, "f"), value = getOne(cell, "v"), inline = getOne(cell, "is");
      const type = attribute(cell, "t") ?? "n";
      let next: WorkbookCell389 = blank();
      if (formula) {
        if (formula.attributes.length || inline || (type !== "n" && type !== "str")) refuse("Formule matriciali, condivise o tipizzate non supportate.");
        const expression = elementText(formula);
        next = { kind: "formula", input: "=" + expression, value: "" };
      } else if (type === "inlineStr" && inline) {
        checkAllowed(inline, ["t"]);
        const text = getOne(inline, "t");
        if (!text) refuse("Stringa inline priva di testo.");
        next = { kind: "text", input: elementText(text), value: "" };
      } else if (type === "s" && value) {
        const index = Number(elementText(value));
        if (!Number.isInteger(index) || index < 0 || index >= strings.length) refuse("Indice stringa condivisa invalido.");
        next = { kind: "text", input: strings[index]!, value: "" };
      } else if (type === "n" && value) {
        const raw = elementText(value);
        strictWorkbookNumber389(raw);
        next = { kind: "number", input: raw, value: "" };
      } else if (!(type === "n" && !value && !inline)) refuse(`Tipo di cella Excel non supportato: ${type}`);
      rows[r]![c] = next;
      lastRow = Math.max(lastRow, r + 1); lastColumn = Math.max(lastColumn, c + 1);
    }
  }
  return recalculateWorkbook389({ sheetName, cells: rows.slice(0, Math.max(1, lastRow)).map((row) => row.slice(0, Math.max(1, lastColumn))) });
}

function serializeCell(cell: WorkbookCell389, address: string): string {
  if (cell.kind === "blank") return "";
  if (cell.kind === "text") {
    return `<c r="${address}" t="inlineStr"><is><t xml:space="preserve">${xmlEscape(cell.input)}</t></is></c>`;
  }
  if (cell.kind === "number") { strictWorkbookNumber389(cell.input); return `<c r="${address}"><v>${cell.input}</v></c>`; }
  if (!cell.input.startsWith("=") || !Number.isFinite(Number(cell.value))) refuse("Valore di formula non ricalcolato.");
  return `<c r="${address}"><f>${xmlEscape(cell.input.slice(1))}</f><v>${xmlEscape(cell.value)}</v></c>`;
}

export function openXlsxWorkbook389(bytes: ArrayBuffer): Workbook389 { return readWorkbook(bytes); }

export function exportXlsxWorkbook389(source: ArrayBuffer, workbook: Workbook389): ArrayBuffer {
  const original = inspectPackage(source);
  if (original.sheetName !== workbook.sheetName) refuse("Il nome del foglio sorgente è cambiato.");
  const checked = recalculateWorkbook389(workbook);
  const lines = checked.cells.map((row, rowIndex) => {
    const cells = row.map((cell, col) => serializeCell(cell, cellAddress389(rowIndex, col))).join("");
    return cells ? `<row r="${rowIndex + 1}">${cells}</row>` : "";
  }).join("");
  const replacement = `<sheetData>${lines}</sheetData>`;
  const old = decoder.decode(original.entries[original.sheetPath]!);
  const tag = /<(?:[A-Za-z_][\w.-]*:)?sheetData(?:\s[^>]*)?\s*\/>|<(?:[A-Za-z_][\w.-]*:)?sheetData(?:\s[^>]*)?>[^]*?<\/(?:[A-Za-z_][\w.-]*:)?sheetData\s*>/gu;
  if ([...old.matchAll(tag)].length !== 1) refuse("Impossibile sostituire una sola sezione sheetData.");
  let next = old.replace(tag, replacement);
  const dimension = /<(?:[A-Za-z_][\w.-]*:)?dimension\b[^>]*\/\s*>/u;
  if (/<(?:[A-Za-z_][\w.-]*:)?dimension\b/u.test(next)) {
    if (!dimension.test(next)) refuse("Dimensione del foglio non modificabile in modo veritiero.");
    next = next.replace(dimension, `<dimension ref="A1:${cellAddress389(checked.cells.length - 1, checked.cells[0]!.length - 1)}"/>`);
  }
  original.entries[original.sheetPath] = encoder.encode(next);
  const workbookXml = decoder.decode(original.entries["xl/workbook.xml"]!);
  const calc = /<(?:[A-Za-z_][\w.-]*:)?calcPr\b[^>]*\/\s*>/u;
  const calcElement = getOne(original.workbook, "calcPr");
  // Preserve fullPrecision and calcId: they change Excel semantics if silently dropped.
  const calcAttrs = (calcElement?.attributes ?? [])
    .filter((attr) => !["calcMode", "fullCalcOnLoad", "forceFullCalc"].includes(attr.name))
    .map((attr) => ` ${attr.name}="${xmlEscape(unescapeXml(attr.value))}"`).join("");
  const autoCalc = `<${calcElement?.name ?? "calcPr"}${calcAttrs} calcMode="auto" fullCalcOnLoad="1" forceFullCalc="1"/>`;
  if (/<(?:[A-Za-z_][\w.-]*:)?calcPr\b/u.test(workbookXml) && !calc.test(workbookXml)) {
    refuse("Proprietà di calcolo workbook non modificabili in sicurezza.");
  }
  original.entries["xl/workbook.xml"] = encoder.encode(calc.test(workbookXml) ? workbookXml.replace(calc, autoCalc) :
    workbookXml.replace(/<\/workbook\s*>/u, autoCalc + "</workbook>"));
  const zipped = zipSync(original.entries, { level: 6 });
  if (zipped.byteLength > 20 * 1024 * 1024) throw new WorkbookError389("FILE_TOO_LARGE", "Export XLSX oltre 20 MiB.");
  const output = zipped.buffer.slice(zipped.byteOffset, zipped.byteOffset + zipped.byteLength) as ArrayBuffer;
  analyzeOoxmlPackage(output);
  return output;
}
