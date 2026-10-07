import { parseXmlDocument, type XmlDocumentModel, type XmlElement, type XmlNode } from "../developer-web/structured-repair";
import { serializeCsvTable, type CsvTable } from "./csv";
import {
  SPREADSHEET_INTERCHANGE_LIMITS,
  tableToXlsx,
  xlsxToCsv,
  type SpreadsheetWriteResult,
} from "./spreadsheet-interchange";

export type XmlInterchangeErrorCode =
  | "AMBIGUOUS_XML_MAPPING"
  | "TABULAR_MAPPING_REQUIRED"
  | "TABULAR_ROW_NOT_FOUND"
  | "TABULAR_TABLE_TOO_LARGE"
  | "INVALID_ROW_PATH"
  | "INVALID_DELIMITER"
  | "XLSX_REOPEN_MISMATCH";

export class XmlInterchangeError extends Error {
  constructor(readonly code: XmlInterchangeErrorCode, message: string) {
    super(`${code}: ${message}`);
    this.name = "XmlInterchangeError";
  }
}

export type XmlJsonValue = null | string | XmlJsonValue[] | { readonly [key: string]: XmlJsonValue };

export interface XmlJsonMappingSummary {
  readonly rootName: string;
  readonly attributePrefix: "@";
  readonly textKey: "#text";
  readonly repeatedChildren: "array";
  readonly emptyElement: "null";
  readonly mixedContent: "refuse";
  readonly commentsAndProcessingInstructions: "refuse-except-xml-declaration";
  readonly entityReferences: "decode-predefined-and-numeric";
}

export interface XmlJsonMappingResult {
  readonly json: string;
  readonly value: { readonly [rootName: string]: XmlJsonValue };
  readonly mapping: XmlJsonMappingSummary;
}

export type XmlTabularColumnSource = "attribute" | "element" | "text";

export interface XmlTabularColumnMapping {
  readonly column: string;
  readonly source: XmlTabularColumnSource;
  readonly xmlName: string;
}

export interface XmlTabularMappingSummary {
  readonly rootName: string;
  readonly rowElement: string;
  readonly rowPath: string;
  readonly rowSelection: "direct-homogeneous-children" | "explicit-relative-path";
  readonly attributePrefix: "attr:";
  readonly textKey: "#text";
  readonly fieldPolicy: "row-attributes-and-direct-leaf-elements";
  readonly missingValues: "empty-string";
  readonly repeatedFields: "refuse";
  readonly mixedContent: "refuse";
  readonly nestedFields: "refuse";
  readonly columnOrder: "attributes-first-seen-then-elements-first-seen-then-text";
  readonly columns: readonly XmlTabularColumnMapping[];
}

export interface XmlTabularMappingResult {
  readonly table: CsvTable;
  readonly rows: number;
  readonly columns: number;
  readonly mapping: XmlTabularMappingSummary;
}

export interface XmlCsvMappingResult {
  readonly csv: string;
  readonly rows: number;
  readonly columns: number;
  readonly mapping: XmlTabularMappingSummary;
  readonly csvPolicy: "formula-like-cells-escaped";
}

export interface XmlXlsxMappingResult extends SpreadsheetWriteResult {
  readonly mapping: XmlTabularMappingSummary;
  readonly reopen: {
    readonly verified: true;
    readonly selectedSheet: string;
    readonly rows: number;
    readonly columns: number;
    readonly policy: "xlsx-values-to-safe-csv";
  };
}

const XML_REFERENCE = /&(?:amp|lt|gt|quot|apos|#[0-9]+|#x[0-9A-Fa-f]+);/gu;
const ROW_PATH_SEGMENT = /^[A-Za-z_:][A-Za-z0-9_.:-]*$/u;

function fail(code: XmlInterchangeErrorCode, message: string): never {
  throw new XmlInterchangeError(code, message);
}

function isXmlCodePoint(value: number): boolean {
  return value === 0x9
    || value === 0xa
    || value === 0xd
    || (value >= 0x20 && value <= 0xd7ff)
    || (value >= 0xe000 && value <= 0xfffd)
    || (value >= 0x10000 && value <= 0x10ffff);
}

function decodeXmlReferences(value: string): string {
  return value.replace(XML_REFERENCE, (reference) => {
    const body = reference.slice(1, -1);
    if (body === "amp") return "&";
    if (body === "lt") return "<";
    if (body === "gt") return ">";
    if (body === "quot") return '"';
    if (body === "apos") return "'";
    const codePoint = body.startsWith("#x") ? Number.parseInt(body.slice(2), 16) : Number.parseInt(body.slice(1), 10);
    if (!Number.isSafeInteger(codePoint) || !isXmlCodePoint(codePoint)) {
      fail("AMBIGUOUS_XML_MAPPING", `XML character reference ${reference} is outside the representable XML 1.0 character range.`);
    }
    return String.fromCodePoint(codePoint);
  });
}

function rejectUnmappedDocumentEnvelope(document: XmlDocumentModel): void {
  const significantBefore = document.before.filter((node) => node.kind !== "text" || node.value.trim() !== "");
  const significantAfter = document.after.filter((node) => node.kind !== "text" || node.value.trim() !== "");
  const allowedDeclaration = significantBefore.length === 1
    && significantBefore[0]?.kind === "pi"
    && significantBefore[0].target.toLowerCase() === "xml";
  if ((significantBefore.length > 0 && !allowedDeclaration) || significantAfter.length > 0) {
    fail("AMBIGUOUS_XML_MAPPING", "Document-level comments or processing instructions are not represented; only an optional XML declaration before the root is accepted.");
  }
}

function unsupportedChildren(element: XmlElement): XmlNode[] {
  return element.children.filter((node) => node.kind === "comment" || node.kind === "pi");
}

function semanticText(element: XmlElement): { readonly hasText: boolean; readonly value: string; readonly hasCdata: boolean } {
  let value = "";
  let hasText = false;
  let hasCdata = false;
  for (const child of element.children) {
    if (child.kind === "text") {
      value += decodeXmlReferences(child.value);
      if (child.value !== "") hasText = true;
    } else if (child.kind === "cdata") {
      value += child.value;
      hasText = true;
      hasCdata = true;
    }
  }
  return { hasText, value, hasCdata };
}

function mapElementToJson(element: XmlElement, path: string): XmlJsonValue {
  if (unsupportedChildren(element).length > 0) {
    fail("AMBIGUOUS_XML_MAPPING", `${path} contains comments or processing instructions that the compact JSON mapping would lose.`);
  }
  const childElements = element.children.filter((node): node is XmlElement => node.kind === "element");
  const text = semanticText(element);
  if (childElements.length > 0) {
    const significantText = element.children.some((node) => node.kind === "cdata" || (node.kind === "text" && node.value.trim() !== ""));
    if (significantText) fail("AMBIGUOUS_XML_MAPPING", `${path} contains mixed text/element content; compact flattening is refused.`);
  }

  if (childElements.length === 0 && element.attributes.length === 0) {
    return text.hasText ? text.value : null;
  }

  const record = Object.create(null) as Record<string, XmlJsonValue>;
  for (const attribute of element.attributes) record[`@${attribute.name}`] = decodeXmlReferences(attribute.value);
  if (childElements.length === 0) {
    if (text.hasText) record["#text"] = text.value;
    return record;
  }

  const groups = new Map<string, XmlJsonValue[]>();
  for (const child of childElements) {
    const childPath = `${path}/${child.name}`;
    const group = groups.get(child.name) ?? [];
    group.push(mapElementToJson(child, childPath));
    groups.set(child.name, group);
  }
  for (const [name, values] of groups) record[name] = values.length === 1 ? values[0]! : values;
  return record;
}

export function xmlToJson(input: string, indent = 2): XmlJsonMappingResult {
  if (!Number.isInteger(indent) || indent < 0 || indent > 10) fail("AMBIGUOUS_XML_MAPPING", "JSON indent must be an integer from 0 through 10.");
  const document = parseXmlDocument(input);
  rejectUnmappedDocumentEnvelope(document);
  const rootValue = mapElementToJson(document.root, `/${document.root.name}`);
  const root = Object.create(null) as Record<string, XmlJsonValue>;
  root[document.root.name] = rootValue;
  const json = JSON.stringify(root, null, indent);
  return {
    json,
    value: JSON.parse(json) as { readonly [rootName: string]: XmlJsonValue },
    mapping: {
      rootName: document.root.name,
      attributePrefix: "@",
      textKey: "#text",
      repeatedChildren: "array",
      emptyElement: "null",
      mixedContent: "refuse",
      commentsAndProcessingInstructions: "refuse-except-xml-declaration",
      entityReferences: "decode-predefined-and-numeric",
    },
  };
}

function significantContent(element: XmlElement): XmlNode[] {
  return element.children.filter((node) => node.kind !== "text" || node.value.trim() !== "");
}

function elementChildrenOnly(element: XmlElement, path: string): XmlElement[] {
  const significant = significantContent(element);
  if (significant.some((node) => node.kind !== "element")) {
    fail("AMBIGUOUS_XML_MAPPING", `${path} contains text, CDATA, comments or processing instructions beside row/container elements.`);
  }
  return significant as XmlElement[];
}

function requireWrapperWithoutAttributes(element: XmlElement, path: string): void {
  if (element.attributes.length > 0) {
    fail("AMBIGUOUS_XML_MAPPING", `${path} has attributes that would be dropped by the tabular mapping.`);
  }
}

function normalizedRowPath(rowPath: string): string[] {
  const value = rowPath.trim().replace(/^\/+|\/+$/gu, "");
  if (value === "") fail("INVALID_ROW_PATH", "Explicit rowPath must contain at least one XML element name relative to the root.");
  const parts = value.split("/");
  if (parts.some((part) => !ROW_PATH_SEGMENT.test(part))) fail("INVALID_ROW_PATH", "rowPath must contain slash-separated XML element names only.");
  return parts;
}

function resolveTabularRows(root: XmlElement, rowPath?: string): {
  readonly rows: readonly XmlElement[];
  readonly rowName: string;
  readonly rowPath: string;
  readonly selection: XmlTabularMappingSummary["rowSelection"];
} {
  requireWrapperWithoutAttributes(root, `/${root.name}`);
  if (rowPath === undefined) {
    const direct = elementChildrenOnly(root, `/${root.name}`);
    if (direct.length === 0) fail("TABULAR_ROW_NOT_FOUND", `/${root.name} contains no direct row elements.`);
    const names = [...new Set(direct.map(({ name }) => name))];
    if (names.length !== 1) {
      fail("TABULAR_MAPPING_REQUIRED", `/${root.name} has heterogeneous direct children (${names.join(", ")}); provide an explicit lossless rowPath or restructure the XML.`);
    }
    const rowName = names[0]!;
    return { rows: direct, rowName, rowPath: `/${root.name}/${rowName}`, selection: "direct-homogeneous-children" };
  }

  const segments = normalizedRowPath(rowPath);
  let container = root;
  let containerPath = `/${root.name}`;
  for (const segment of segments.slice(0, -1)) {
    requireWrapperWithoutAttributes(container, containerPath);
    const children = elementChildrenOnly(container, containerPath);
    const matching = children.filter(({ name }) => name === segment);
    if (matching.length !== 1 || children.length !== 1) {
      fail("AMBIGUOUS_XML_MAPPING", `${containerPath} must contain exactly one <${segment}> wrapper and no sibling data for rowPath=${rowPath}.`);
    }
    container = matching[0]!;
    containerPath += `/${segment}`;
  }

  requireWrapperWithoutAttributes(container, containerPath);
  const rowName = segments.at(-1)!;
  const children = elementChildrenOnly(container, containerPath);
  if (children.length === 0 || children.some(({ name }) => name !== rowName)) {
    const found = [...new Set(children.map(({ name }) => name))];
    if (children.length === 0) fail("TABULAR_ROW_NOT_FOUND", `${containerPath} contains no <${rowName}> rows.`);
    fail("AMBIGUOUS_XML_MAPPING", `${containerPath} contains sibling element types (${found.join(", ")}); selecting only <${rowName}> would drop data.`);
  }
  return {
    rows: children,
    rowName,
    rowPath: `${containerPath}/${rowName}`,
    selection: "explicit-relative-path",
  };
}

interface ParsedTabularRow {
  readonly values: ReadonlyMap<string, string>;
  readonly attributeColumns: readonly XmlTabularColumnMapping[];
  readonly elementColumns: readonly XmlTabularColumnMapping[];
  readonly usesText: boolean;
  readonly usesElements: boolean;
}

function scalarElementValue(element: XmlElement, path: string): string {
  if (element.attributes.length > 0) fail("AMBIGUOUS_XML_MAPPING", `${path} has attributes; nested field attributes are not flattened implicitly.`);
  if (unsupportedChildren(element).length > 0) fail("AMBIGUOUS_XML_MAPPING", `${path} contains comments or processing instructions.`);
  if (element.children.some((node) => node.kind === "element")) fail("AMBIGUOUS_XML_MAPPING", `${path} is nested beyond the supported row→leaf-field shape.`);
  return semanticText(element).value;
}

function parseTabularRow(row: XmlElement, rowIndex: number, rowPath: string): ParsedTabularRow {
  if (unsupportedChildren(row).length > 0) fail("AMBIGUOUS_XML_MAPPING", `${rowPath}[${rowIndex}] contains comments or processing instructions.`);
  const childElements = row.children.filter((node): node is XmlElement => node.kind === "element");
  const hasScalarContent = row.children.some((node) => node.kind === "cdata" || (node.kind === "text" && node.value.trim() !== ""));
  if (childElements.length > 0 && hasScalarContent) {
    fail("AMBIGUOUS_XML_MAPPING", `${rowPath}[${rowIndex}] contains mixed row text and child fields.`);
  }

  const values = new Map<string, string>();
  const attributeColumns: XmlTabularColumnMapping[] = [];
  const elementColumns: XmlTabularColumnMapping[] = [];
  for (const attribute of row.attributes) {
    const column = `attr:${attribute.name}`;
    values.set(column, decodeXmlReferences(attribute.value));
    attributeColumns.push({ column, source: "attribute", xmlName: attribute.name });
  }

  const seenFields = new Set<string>();
  for (const child of childElements) {
    if (seenFields.has(child.name)) {
      fail("AMBIGUOUS_XML_MAPPING", `${rowPath}[${rowIndex}] repeats <${child.name}>; repeated row fields require an explicit non-tabular mapping.`);
    }
    seenFields.add(child.name);
    values.set(child.name, scalarElementValue(child, `${rowPath}[${rowIndex}]/${child.name}`));
    elementColumns.push({ column: child.name, source: "element", xmlName: child.name });
  }

  const usesText = childElements.length === 0 && hasScalarContent;
  if (usesText) values.set("#text", semanticText(row).value);
  return { values, attributeColumns, elementColumns, usesText, usesElements: childElements.length > 0 };
}

function assertTabularBounds(rows: number, columns: number): void {
  const cells = (rows + 1) * columns;
  if (rows + 1 > SPREADSHEET_INTERCHANGE_LIMITS.maxRows
    || columns > SPREADSHEET_INTERCHANGE_LIMITS.maxColumns
    || cells > SPREADSHEET_INTERCHANGE_LIMITS.maxCells) {
    fail("TABULAR_TABLE_TOO_LARGE", `Mapped table exceeds local limits (${rows} rows, ${columns} columns, ${cells} cells).`);
  }
}

export function xmlToTabularTable(input: string, options: { readonly rowPath?: string } = {}): XmlTabularMappingResult {
  const document = parseXmlDocument(input);
  rejectUnmappedDocumentEnvelope(document);
  const resolved = resolveTabularRows(document.root, options.rowPath);
  const parsedRows = resolved.rows.map((row, index) => parseTabularRow(row, index + 1, resolved.rowPath));
  if (parsedRows.some(({ usesText }) => usesText) && parsedRows.some(({ usesElements }) => usesElements)) {
    fail("AMBIGUOUS_XML_MAPPING", `${resolved.rowPath} mixes scalar-text rows and child-field rows.`);
  }

  const attributeColumns: XmlTabularColumnMapping[] = [];
  const elementColumns: XmlTabularColumnMapping[] = [];
  const seenAttributes = new Set<string>();
  const seenElements = new Set<string>();
  for (const row of parsedRows) {
    for (const column of row.attributeColumns) {
      if (!seenAttributes.has(column.column)) {
        seenAttributes.add(column.column);
        attributeColumns.push(column);
      }
    }
    for (const column of row.elementColumns) {
      if (!seenElements.has(column.column)) {
        seenElements.add(column.column);
        elementColumns.push(column);
      }
    }
  }
  const textColumn: XmlTabularColumnMapping[] = parsedRows.some(({ usesText }) => usesText)
    ? [{ column: "#text", source: "text", xmlName: "#text" }]
    : [];
  const columns = [...attributeColumns, ...elementColumns, ...textColumn];
  if (columns.length === 0) fail("AMBIGUOUS_XML_MAPPING", `${resolved.rowPath} contains no representable attributes, leaf fields or row text.`);
  assertTabularBounds(parsedRows.length, columns.length);
  const header = columns.map(({ column }) => column);
  const table: CsvTable = {
    header,
    rows: parsedRows.map(({ values }) => header.map((column) => values.get(column) ?? "")),
    delimiter: ",",
    warnings: [],
  };
  return {
    table,
    rows: table.rows.length,
    columns: table.header.length,
    mapping: {
      rootName: document.root.name,
      rowElement: resolved.rowName,
      rowPath: resolved.rowPath,
      rowSelection: resolved.selection,
      attributePrefix: "attr:",
      textKey: "#text",
      fieldPolicy: "row-attributes-and-direct-leaf-elements",
      missingValues: "empty-string",
      repeatedFields: "refuse",
      mixedContent: "refuse",
      nestedFields: "refuse",
      columnOrder: "attributes-first-seen-then-elements-first-seen-then-text",
      columns,
    },
  };
}

export function xmlToCsv(
  input: string,
  options: { readonly rowPath?: string; readonly delimiter?: "," | ";" | "\t" | "|" } = {},
): XmlCsvMappingResult {
  const delimiter = options.delimiter ?? ",";
  if (![",", ";", "\t", "|"].includes(delimiter)) fail("INVALID_DELIMITER", "CSV delimiter must be comma, semicolon, tab or pipe.");
  const mapped = xmlToTabularTable(input, { ...(options.rowPath === undefined ? {} : { rowPath: options.rowPath }) });
  return {
    csv: serializeCsvTable({ ...mapped.table, delimiter }),
    rows: mapped.rows,
    columns: mapped.columns,
    mapping: mapped.mapping,
    csvPolicy: "formula-like-cells-escaped",
  };
}

export async function xmlToXlsx(
  input: string,
  options: { readonly rowPath?: string; readonly sheetName?: string } = {},
): Promise<XmlXlsxMappingResult> {
  const mapped = xmlToTabularTable(input, { ...(options.rowPath === undefined ? {} : { rowPath: options.rowPath }) });
  const generated = await tableToXlsx(mapped.table, { ...(options.sheetName === undefined ? {} : { sheetName: options.sheetName }) });
  const reopened = await xlsxToCsv(generated.bytes);
  const expectedCsv = serializeCsvTable({ ...mapped.table, delimiter: "," });
  if (reopened.csv !== expectedCsv || reopened.rows !== mapped.rows || reopened.columns !== mapped.columns) {
    fail("XLSX_REOPEN_MISMATCH", "Generated XLSX reopened with values or dimensions different from the mapped XML table.");
  }
  return {
    ...generated,
    mapping: mapped.mapping,
    reopen: {
      verified: true,
      selectedSheet: reopened.selectedSheet,
      rows: reopened.rows,
      columns: reopened.columns,
      policy: reopened.policy,
    },
  };
}
