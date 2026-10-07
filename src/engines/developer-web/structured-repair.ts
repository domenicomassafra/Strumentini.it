import {
  type DeveloperDiagnostic,
  type DeveloperWebResult,
  type JsonRecord,
  assertInputSize,
  invalid,
} from "./types";
import { parseJsonWithMetadata, validateJson } from "./structured-data";

const MAX_JSON_DIFFS = 20_000;
const JSON_DIFF_PREVIEW = 200;
const MAX_XML_DEPTH = 64;
const MAX_XML_NODES = 50_000;

function safeRecord(): JsonRecord {
  return Object.create(null) as JsonRecord;
}

function safeSet(record: JsonRecord, key: string, value: unknown): void {
  Object.defineProperty(record, key, { configurable: true, enumerable: true, value, writable: true });
}

function lineColumn(input: string, index: number, path?: string): DeveloperDiagnostic {
  const before = input.slice(0, index);
  const lines = before.split("\n");
  return {
    line: lines.length,
    column: (lines.at(-1)?.length ?? 0) + 1,
    character: index + 1,
    ...(path === undefined ? {} : { path }),
    context: input.slice(Math.max(0, index - 24), Math.min(input.length, index + 24)).replaceAll("\n", "↵"),
  };
}

export interface JsonRepairEdit {
  readonly startCharacter: number;
  readonly endCharacterExclusive: number;
  readonly replacement: string;
  readonly reason: "REMOVE_UTF8_BOM" | "REPLACE_LINE_COMMENT" | "REPLACE_BLOCK_COMMENT" | "REMOVE_TRAILING_COMMA";
}

function scanString(input: string, start: number): number {
  let escaped = false;
  for (let index = start + 1; index < input.length; index += 1) {
    const character = input[index]!;
    if (escaped) {
      escaped = false;
      continue;
    }
    if (character === "\\") {
      escaped = true;
      continue;
    }
    if (character === '"') return index + 1;
  }
  return input.length;
}

function blockCommentEnd(input: string, start: number): number {
  const end = input.indexOf("*/", start + 2);
  if (end < 0) invalid("JSON_REPAIR_REFUSED", "Unterminated block comments are ambiguous and are not repaired.", lineColumn(input, start));
  return end + 2;
}

function nextSignificantJsonCharacter(input: string, start: number): number {
  let index = start;
  while (index < input.length) {
    const character = input[index]!;
    if (/\s/u.test(character)) {
      index += 1;
      continue;
    }
    if (character === "/" && input[index + 1] === "/") {
      const newline = input.indexOf("\n", index + 2);
      index = newline < 0 ? input.length : newline + 1;
      continue;
    }
    if (character === "/" && input[index + 1] === "*") {
      index = blockCommentEnd(input, index);
      continue;
    }
    return index;
  }
  return index;
}

function collectJsonRepairEdits(input: string): JsonRepairEdit[] {
  const edits: JsonRepairEdit[] = [];
  let index = 0;
  if (input.startsWith("\uFEFF")) {
    edits.push({ startCharacter: 1, endCharacterExclusive: 2, replacement: "", reason: "REMOVE_UTF8_BOM" });
    index = 1;
  }
  while (index < input.length) {
    const character = input[index]!;
    if (character === '"') {
      index = scanString(input, index);
      continue;
    }
    if (character === "/" && input[index + 1] === "/") {
      const newline = input.indexOf("\n", index + 2);
      const end = newline < 0 ? input.length : newline;
      edits.push({ startCharacter: index + 1, endCharacterExclusive: end + 1, replacement: "", reason: "REPLACE_LINE_COMMENT" });
      index = end;
      continue;
    }
    if (character === "/" && input[index + 1] === "*") {
      const end = blockCommentEnd(input, index);
      edits.push({ startCharacter: index + 1, endCharacterExclusive: end + 1, replacement: " ", reason: "REPLACE_BLOCK_COMMENT" });
      index = end;
      continue;
    }
    if (character === ",") {
      const next = nextSignificantJsonCharacter(input, index + 1);
      if (input[next] === "}" || input[next] === "]") {
        edits.push({ startCharacter: index + 1, endCharacterExclusive: index + 2, replacement: "", reason: "REMOVE_TRAILING_COMMA" });
      }
    }
    index += 1;
  }
  return edits;
}

function applyJsonRepairEdits(input: string, edits: readonly JsonRepairEdit[]): string {
  let cursor = 0;
  let output = "";
  for (const edit of edits) {
    const start = edit.startCharacter - 1;
    const end = edit.endCharacterExclusive - 1;
    if (start < cursor || start < 0 || end < start || end > input.length) invalid("JSON_REPAIR_REFUSED", "Repair spans overlapped or escaped the bounded input.");
    output += input.slice(cursor, start) + edit.replacement;
    cursor = end;
  }
  return output + input.slice(cursor);
}

export function jsonRepairOperation(input: string): DeveloperWebResult {
  assertInputSize(input);
  const strict = validateJson(input);
  if (strict.valid) {
    return {
      valid: true,
      changed: false,
      repaired: input,
      edits: [],
      duplicateKeys: strict.duplicateKeys,
      warnings: strict.duplicateKeys.length === 0 ? [] : ["Le chiavi duplicate restano un problema di interoperabilità e non vengono riparate automaticamente."],
    };
  }
  const edits = collectJsonRepairEdits(input);
  if (edits.length === 0) invalid("JSON_REPAIR_REFUSED", "The malformed JSON requires an ambiguous semantic or structural guess, so repair was refused.", strict.diagnostic);
  const repaired = applyJsonRepairEdits(input, edits);
  const parsed = validateJson(repaired);
  if (!parsed.valid) invalid("JSON_REPAIR_REFUSED", "The deterministic safe edits were insufficient; no further guessing was attempted.", parsed.diagnostic);
  return {
    valid: true,
    changed: repaired !== input,
    repaired,
    edits,
    duplicateKeys: parsed.duplicateKeys,
    warnings: parsed.duplicateKeys.length === 0 ? [] : ["Le chiavi duplicate restano un problema di interoperabilità e non vengono riparate automaticamente."],
  };
}

type JsonDifferenceKind = "add" | "remove" | "type" | "value" | "order";

export interface JsonDifference {
  readonly kind: JsonDifferenceKind;
  readonly path: string;
  readonly left?: unknown;
  readonly right?: unknown;
  readonly leftType?: string;
  readonly rightType?: string;
}

function jsonValueType(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value;
}

function jsonPointerSegment(value: string): string {
  return value.replaceAll("~", "~0").replaceAll("/", "~1");
}

function canonicalJsonValue(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJsonValue).join(",")}]`;
  if (typeof value === "object" && value !== null) {
    return `{${Object.entries(value as JsonRecord)
      .toSorted(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => `${JSON.stringify(key)}:${canonicalJsonValue(child)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function arraysAreReordered(left: readonly unknown[], right: readonly unknown[]): boolean {
  if (left.length !== right.length || left.length < 2) return false;
  const leftCanonical = left.map(canonicalJsonValue);
  const rightCanonical = right.map(canonicalJsonValue);
  if (leftCanonical.every((value, index) => value === rightCanonical[index])) return false;
  return leftCanonical.toSorted().every((value, index) => value === rightCanonical.toSorted()[index]);
}

function addDifference(output: JsonDifference[], difference: JsonDifference): void {
  if (output.length >= MAX_JSON_DIFFS) invalid("JSON_DIFF_TOO_LARGE", `JSON diff exceeds the ${MAX_JSON_DIFFS}-difference local limit.`);
  output.push(difference);
}

function diffJsonValue(left: unknown, right: unknown, path: string, output: JsonDifference[]): void {
  const leftType = jsonValueType(left);
  const rightType = jsonValueType(right);
  if (leftType !== rightType) {
    addDifference(output, { kind: "type", path, left, right, leftType, rightType });
    return;
  }
  if (Array.isArray(left) && Array.isArray(right)) {
    if (arraysAreReordered(left, right)) {
      addDifference(output, { kind: "order", path, left, right, leftType: "array", rightType: "array" });
      return;
    }
    const maximum = Math.max(left.length, right.length);
    for (let index = 0; index < maximum; index += 1) {
      const childPath = `${path}/${index}`;
      if (index >= left.length) addDifference(output, { kind: "add", path: childPath, right: right[index], rightType: jsonValueType(right[index]) });
      else if (index >= right.length) addDifference(output, { kind: "remove", path: childPath, left: left[index], leftType: jsonValueType(left[index]) });
      else diffJsonValue(left[index], right[index], childPath, output);
    }
    return;
  }
  if (typeof left === "object" && left !== null && typeof right === "object" && right !== null) {
    const leftRecord = left as JsonRecord;
    const rightRecord = right as JsonRecord;
    const keys = [...new Set([...Object.keys(leftRecord), ...Object.keys(rightRecord)])].toSorted();
    for (const key of keys) {
      const childPath = `${path}/${jsonPointerSegment(key)}`;
      const hasLeft = Object.hasOwn(leftRecord, key);
      const hasRight = Object.hasOwn(rightRecord, key);
      if (!hasLeft) addDifference(output, { kind: "add", path: childPath, right: rightRecord[key], rightType: jsonValueType(rightRecord[key]) });
      else if (!hasRight) addDifference(output, { kind: "remove", path: childPath, left: leftRecord[key], leftType: jsonValueType(leftRecord[key]) });
      else diffJsonValue(leftRecord[key], rightRecord[key], childPath, output);
    }
    return;
  }
  if (!Object.is(left, right)) addDifference(output, { kind: "value", path, left, right, leftType, rightType });
}

export function jsonStructuralDiffOperation(leftInput: string, rightInput: string): DeveloperWebResult {
  const left = parseJsonWithMetadata(leftInput);
  const right = parseJsonWithMetadata(rightInput);
  const differences: JsonDifference[] = [];
  diffJsonValue(left.value, right.value, "", differences);
  const preview = differences.slice(0, JSON_DIFF_PREVIEW);
  const duplicateKeys = { left: left.duplicateKeys, right: right.duplicateKeys };
  return {
    valid: true,
    equal: differences.length === 0,
    differenceCount: differences.length,
    preview,
    previewTruncated: differences.length > preview.length,
    differences,
    duplicateKeys,
    pathFormat: "RFC 6901 JSON Pointer; the root path is the empty string",
    warnings: left.duplicateKeys.length + right.duplicateKeys.length === 0
      ? []
      : ["Almeno un input contiene chiavi duplicate: il parser mantiene l'ultimo valore e il diff segnala questa caveat esplicitamente."],
  };
}

const TYPESCRIPT_RESERVED = new Set([
  "any", "as", "boolean", "break", "case", "catch", "class", "const", "constructor", "continue", "debugger", "declare", "default", "delete", "do", "else", "enum", "export", "extends", "false", "finally", "for", "from", "function", "get", "if", "implements", "import", "in", "infer", "instanceof", "interface", "is", "keyof", "let", "module", "namespace", "never", "new", "null", "number", "object", "of", "package", "private", "protected", "public", "readonly", "require", "return", "set", "static", "string", "super", "switch", "symbol", "this", "throw", "true", "try", "type", "typeof", "undefined", "unique", "unknown", "var", "void", "while", "with", "yield",
]);

function safeTypeName(input: string): string {
  const trimmed = input.trim();
  let result = trimmed.replace(/[^A-Za-z0-9_$]+/gu, "_");
  if (result === "") result = "Root";
  if (!/^[A-Za-z_$]/u.test(result)) result = `_${result}`;
  if (TYPESCRIPT_RESERVED.has(result)) result = `${result}_`;
  return result;
}

function inferTypeScript(value: unknown, depth = 0): string {
  if (depth > 64) invalid("JSON_INFERENCE_TOO_DEEP", "JSON inference exceeds the local nesting limit.");
  if (value === null) return "null";
  if (typeof value === "string") return "string";
  if (typeof value === "number") return "number";
  if (typeof value === "boolean") return "boolean";
  if (Array.isArray(value)) {
    if (value.length === 0) return "readonly unknown[]";
    const types = [...new Set(value.map((child) => inferTypeScript(child, depth + 1)))].toSorted();
    const item = types.length === 1 ? types[0]! : `(${types.join(" | ")})`;
    return `readonly ${item}[]`;
  }
  const entries = Object.entries(value as JsonRecord).toSorted(([left], [right]) => left.localeCompare(right));
  if (entries.length === 0) return "Readonly<Record<string, unknown>>";
  const indent = "  ".repeat(depth + 1);
  const closeIndent = "  ".repeat(depth);
  return `{\n${entries.map(([key, child]) => `${indent}readonly ${JSON.stringify(key)}: ${inferTypeScript(child, depth + 1)};`).join("\n")}\n${closeIndent}}`;
}

function inferJsonSchema(value: unknown, depth = 0): JsonRecord {
  if (depth > 64) invalid("JSON_INFERENCE_TOO_DEEP", "JSON inference exceeds the local nesting limit.");
  const schema = safeRecord();
  if (value === null) {
    safeSet(schema, "type", "null");
    return schema;
  }
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    safeSet(schema, "type", typeof value === "number" && Number.isInteger(value) ? "integer" : typeof value);
    return schema;
  }
  if (Array.isArray(value)) {
    safeSet(schema, "type", "array");
    if (value.length === 0) {
      safeSet(schema, "items", safeRecord());
      return schema;
    }
    const byCanonical = new Map<string, JsonRecord>();
    for (const child of value) {
      const inferred = inferJsonSchema(child, depth + 1);
      byCanonical.set(canonicalJsonValue(inferred), inferred);
    }
    const variants = [...byCanonical.entries()].toSorted(([left], [right]) => left.localeCompare(right)).map(([, child]) => child);
    safeSet(schema, "items", variants.length === 1 ? variants[0] : Object.assign(safeRecord(), { anyOf: variants }));
    return schema;
  }
  safeSet(schema, "type", "object");
  const properties = safeRecord();
  const keys = Object.keys(value as JsonRecord).toSorted();
  for (const key of keys) safeSet(properties, key, inferJsonSchema((value as JsonRecord)[key], depth + 1));
  safeSet(schema, "properties", properties);
  safeSet(schema, "required", keys);
  safeSet(schema, "additionalProperties", true);
  return schema;
}

function generatedSchemaAccepts(value: unknown, schema: JsonRecord, depth = 0): boolean {
  if (depth > 64) return false;
  const anyOf = schema.anyOf;
  if (Array.isArray(anyOf)) return anyOf.some((candidate) => typeof candidate === "object" && candidate !== null && !Array.isArray(candidate) && generatedSchemaAccepts(value, candidate as JsonRecord, depth + 1));
  const type = schema.type;
  if (type === undefined) return true;
  if (type === "null") return value === null;
  if (type === "string") return typeof value === "string";
  if (type === "boolean") return typeof value === "boolean";
  if (type === "number") return typeof value === "number" && Number.isFinite(value);
  if (type === "integer") return typeof value === "number" && Number.isInteger(value);
  if (type === "array") {
    if (!Array.isArray(value)) return false;
    const items = schema.items;
    if (typeof items !== "object" || items === null || Array.isArray(items)) return false;
    return value.every((child) => generatedSchemaAccepts(child, items as JsonRecord, depth + 1));
  }
  if (type === "object") {
    if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
    const record = value as JsonRecord;
    const properties = typeof schema.properties === "object" && schema.properties !== null && !Array.isArray(schema.properties)
      ? schema.properties as JsonRecord
      : safeRecord();
    const required = Array.isArray(schema.required) ? schema.required.filter((item): item is string => typeof item === "string") : [];
    if (required.some((key) => !Object.hasOwn(record, key))) return false;
    for (const [key, childSchema] of Object.entries(properties)) {
      if (!Object.hasOwn(record, key)) continue;
      if (typeof childSchema !== "object" || childSchema === null || Array.isArray(childSchema)) return false;
      if (!generatedSchemaAccepts(record[key], childSchema as JsonRecord, depth + 1)) return false;
    }
    return true;
  }
  return false;
}

export function jsonInferenceOperation(input: string, requestedTypeName = "Root", mode = "both"): DeveloperWebResult {
  if (mode !== "both" && mode !== "typescript" && mode !== "json-schema") invalid("INVALID_MODE", "Inference mode must be both, typescript, or json-schema.");
  const parsed = parseJsonWithMetadata(input);
  const rootTypeName = safeTypeName(requestedTypeName);
  const typeBody = inferTypeScript(parsed.value);
  const typescript = `export type ${rootTypeName} = ${typeBody};\n`;
  const inferred = inferJsonSchema(parsed.value);
  const schema = safeRecord();
  safeSet(schema, "$schema", "https://json-schema.org/draft/2020-12/schema");
  safeSet(schema, "title", rootTypeName);
  for (const [key, value] of Object.entries(inferred)) safeSet(schema, key, value);
  const schemaJson = JSON.stringify(schema, null, 2);
  const sourceExampleValidatesSchema = generatedSchemaAccepts(parsed.value, schema);
  if (!sourceExampleValidatesSchema) invalid("INVALID_JSON", "Generated schema failed to validate the source example.");
  return {
    valid: true,
    mode,
    requestedTypeName,
    rootTypeName,
    ...(mode === "json-schema" ? {} : { typescript }),
    ...(mode === "typescript" ? {} : { schema, schemaJson }),
    sourceExampleValidatesSchema,
    duplicateKeys: parsed.duplicateKeys,
    limitations: [
      "L'inferenza descrive soltanto l'esempio fornito e non deduce opzionalità da dati assenti.",
      "Gli array eterogenei diventano unioni; gli array vuoti usano unknown/items senza vincoli.",
      "Le proprietà osservate sono required nello schema, mentre proprietà aggiuntive restano consentite.",
      "Le chiavi TypeScript sono sempre string-literal quotate, incluse __proto__, constructor e prototype.",
    ],
    warnings: rootTypeName === requestedTypeName.trim() ? [] : [`Il nome radice è stato normalizzato deterministicamente in ${rootTypeName}.`],
  };
}

export type XmlNode = XmlElement | XmlText | XmlComment | XmlCdata | XmlProcessingInstruction;

export interface XmlAttribute {
  readonly name: string;
  readonly value: string;
  readonly quote: '"' | "'";
}

export interface XmlElement {
  readonly kind: "element";
  readonly name: string;
  readonly attributes: readonly XmlAttribute[];
  readonly children: readonly XmlNode[];
}

export interface XmlText { readonly kind: "text"; readonly value: string }
export interface XmlComment { readonly kind: "comment"; readonly value: string }
export interface XmlCdata { readonly kind: "cdata"; readonly value: string }
export interface XmlProcessingInstruction { readonly kind: "pi"; readonly target: string; readonly body: string }

interface XmlParser {
  readonly input: string;
  index: number;
  nodeCount: number;
  readonly path: string[];
}

const XML_NAME = /^[A-Za-z_:][A-Za-z0-9_.:-]*/u;
const XML_ENTITY = /^(?:amp|lt|gt|quot|apos|#[0-9]+|#x[0-9A-Fa-f]+)$/u;

function isXml10Character(codePoint: number): boolean {
  return codePoint === 0x9
    || codePoint === 0xA
    || codePoint === 0xD
    || (codePoint >= 0x20 && codePoint <= 0xD7FF)
    || (codePoint >= 0xE000 && codePoint <= 0xFFFD)
    || (codePoint >= 0x10000 && codePoint <= 0x10FFFF);
}

function xmlFail(parser: XmlParser, code: string, message: string, index = parser.index): never {
  invalid(code, message, lineColumn(parser.input, index, parser.path.length === 0 ? "/" : `/${parser.path.join("/")}`));
}

function xmlNode(parser: XmlParser): void {
  parser.nodeCount += 1;
  if (parser.nodeCount > MAX_XML_NODES) xmlFail(parser, "XML_TOO_LARGE", `XML exceeds the ${MAX_XML_NODES}-node local limit.`);
}

function validateXmlCharacters(parser: XmlParser): void {
  let offset = 0;
  for (const character of parser.input) {
    const codePoint = character.codePointAt(0) ?? -1;
    if (!isXml10Character(codePoint)) {
      xmlFail(parser, "INVALID_XML", `Character U+${Math.max(0, codePoint).toString(16).toUpperCase().padStart(4, "0")} is outside the XML 1.0 Char production.`, offset);
    }
    offset += character.length;
  }
}

function xmlName(parser: XmlParser): string {
  const match = XML_NAME.exec(parser.input.slice(parser.index));
  if (match === null) xmlFail(parser, "INVALID_XML", "Expected an XML name.");
  parser.index += match[0].length;
  return match[0];
}

function xmlWhitespace(parser: XmlParser): void {
  while (/\s/u.test(parser.input[parser.index] ?? "")) parser.index += 1;
}

function validateXmlEntities(parser: XmlParser, value: string, absoluteStart: number): void {
  for (let offset = 0; offset < value.length; offset += 1) {
    if (value[offset] !== "&") continue;
    const semicolon = value.indexOf(";", offset + 1);
    if (semicolon < 0) xmlFail(parser, "INVALID_XML_ENTITY", "Unterminated XML entity reference.", absoluteStart + offset);
    const entity = value.slice(offset + 1, semicolon);
    if (!XML_ENTITY.test(entity)) xmlFail(parser, "XML_EXTERNAL_ENTITY_DISABLED", "Only predefined and numeric XML entity references are allowed; DTD/entity resolution is disabled.", absoluteStart + offset);
    if (entity.startsWith("#")) {
      const hexadecimal = entity.startsWith("#x");
      const digits = entity.slice(hexadecimal ? 2 : 1);
      const codePoint = Number.parseInt(digits, hexadecimal ? 16 : 10);
      if (!Number.isSafeInteger(codePoint) || !isXml10Character(codePoint)) {
        xmlFail(parser, "INVALID_XML_ENTITY", `Numeric XML character reference ${entity}; is outside the XML 1.0 Char production.`, absoluteStart + offset);
      }
    }
    offset = semicolon;
  }
}

function parseXmlComment(parser: XmlParser): XmlComment {
  const start = parser.index;
  const end = parser.input.indexOf("-->", start + 4);
  if (end < 0) xmlFail(parser, "INVALID_XML", "Unterminated XML comment.", start);
  const value = parser.input.slice(start + 4, end);
  if (value.includes("--")) xmlFail(parser, "INVALID_XML", "XML comments may not contain --.", start);
  parser.index = end + 3;
  xmlNode(parser);
  return { kind: "comment", value };
}

function parseXmlCdata(parser: XmlParser): XmlCdata {
  const start = parser.index;
  const end = parser.input.indexOf("]]>", start + 9);
  if (end < 0) xmlFail(parser, "INVALID_XML", "Unterminated CDATA section.", start);
  const value = parser.input.slice(start + 9, end);
  parser.index = end + 3;
  xmlNode(parser);
  return { kind: "cdata", value };
}

function parseXmlPi(parser: XmlParser): XmlProcessingInstruction {
  const start = parser.index;
  parser.index += 2;
  const target = xmlName(parser);
  const end = parser.input.indexOf("?>", parser.index);
  if (end < 0) xmlFail(parser, "INVALID_XML", "Unterminated processing instruction.", start);
  const body = parser.input.slice(parser.index, end);
  parser.index = end + 2;
  xmlNode(parser);
  return { kind: "pi", target, body };
}

function parseXmlElement(parser: XmlParser, depth: number): XmlElement {
  if (depth > MAX_XML_DEPTH) xmlFail(parser, "XML_TOO_DEEP", `XML nesting exceeds the ${MAX_XML_DEPTH}-level local limit.`);
  const start = parser.index;
  if (parser.input[parser.index] !== "<") xmlFail(parser, "INVALID_XML", "Expected an XML element.");
  parser.index += 1;
  const name = xmlName(parser);
  parser.path.push(name);
  const attributes: XmlAttribute[] = [];
  const seenAttributes = new Set<string>();
  while (true) {
    xmlWhitespace(parser);
    if (parser.input.startsWith("/>", parser.index)) {
      parser.index += 2;
      parser.path.pop();
      xmlNode(parser);
      return { kind: "element", name, attributes, children: [] };
    }
    if (parser.input[parser.index] === ">") {
      parser.index += 1;
      break;
    }
    if (parser.index >= parser.input.length) xmlFail(parser, "INVALID_XML", "Unterminated start tag.", start);
    const attributeName = xmlName(parser);
    if (seenAttributes.has(attributeName)) xmlFail(parser, "INVALID_XML", `Duplicate XML attribute: ${attributeName}.`);
    seenAttributes.add(attributeName);
    xmlWhitespace(parser);
    if (parser.input[parser.index] !== "=") xmlFail(parser, "INVALID_XML", "Expected = after XML attribute name.");
    parser.index += 1;
    xmlWhitespace(parser);
    const quote = parser.input[parser.index];
    if (quote !== '"' && quote !== "'") xmlFail(parser, "INVALID_XML", "XML attribute values must be quoted.");
    parser.index += 1;
    const valueStart = parser.index;
    const valueEnd = parser.input.indexOf(quote, valueStart);
    if (valueEnd < 0) xmlFail(parser, "INVALID_XML", "Unterminated XML attribute value.", valueStart);
    const value = parser.input.slice(valueStart, valueEnd);
    if (value.includes("<")) xmlFail(parser, "INVALID_XML", "XML attribute values may not contain a literal < character.", valueStart);
    validateXmlEntities(parser, value, valueStart);
    attributes.push({ name: attributeName, value, quote });
    parser.index = valueEnd + 1;
  }
  const children: XmlNode[] = [];
  while (parser.index < parser.input.length) {
    if (parser.input.startsWith("</", parser.index)) {
      parser.index += 2;
      const closing = xmlName(parser);
      xmlWhitespace(parser);
      if (parser.input[parser.index] !== ">") xmlFail(parser, "INVALID_XML", "Expected > after XML closing tag.");
      parser.index += 1;
      if (closing !== name) xmlFail(parser, "INVALID_XML", `Mismatched XML closing tag: expected ${name}, received ${closing}.`);
      parser.path.pop();
      xmlNode(parser);
      return { kind: "element", name, attributes, children };
    }
    if (parser.input.startsWith("<!--", parser.index)) {
      children.push(parseXmlComment(parser));
      continue;
    }
    if (parser.input.startsWith("<![CDATA[", parser.index)) {
      children.push(parseXmlCdata(parser));
      continue;
    }
    if (parser.input.startsWith("<?", parser.index)) {
      children.push(parseXmlPi(parser));
      continue;
    }
    if (parser.input[parser.index] === "<") {
      if (parser.input.startsWith("<!", parser.index)) xmlFail(parser, "XML_EXTERNAL_ENTITY_DISABLED", "DTD/entity declarations are disabled; only comments and CDATA are accepted after <!.");
      children.push(parseXmlElement(parser, depth + 1));
      continue;
    }
    const textStart = parser.index;
    const next = parser.input.indexOf("<", textStart);
    const end = next < 0 ? parser.input.length : next;
    const value = parser.input.slice(textStart, end);
    const cdataClose = value.indexOf("]]>");
    if (cdataClose >= 0) xmlFail(parser, "INVALID_XML", "Character data may not contain the CDATA closing delimiter ]]>. Use a CDATA section or escape the greater-than sign.", textStart + cdataClose);
    validateXmlEntities(parser, value, textStart);
    children.push({ kind: "text", value });
    xmlNode(parser);
    parser.index = end;
  }
  xmlFail(parser, "INVALID_XML", `Missing closing tag for ${name}.`, start);
}

export interface XmlDocumentModel {
  readonly before: readonly XmlNode[];
  readonly root: XmlElement;
  readonly after: readonly XmlNode[];
}

export function parseXmlDocument(input: string): XmlDocumentModel {
  assertInputSize(input);
  const forbidden = /<!\s*(?:DOCTYPE|ENTITY)\b/iu.exec(input);
  if (forbidden !== null) invalid("XML_EXTERNAL_ENTITY_DISABLED", "DTD and ENTITY declarations are disabled; external entities are never resolved.", lineColumn(input, forbidden.index, "/"));
  const parser: XmlParser = { input, index: 0, nodeCount: 0, path: [] };
  validateXmlCharacters(parser);
  const before: XmlNode[] = [];
  const after: XmlNode[] = [];
  let root: XmlElement | null = null;
  while (parser.index < input.length) {
    const start = parser.index;
    if (/\s/u.test(input[parser.index] ?? "")) {
      while (/\s/u.test(input[parser.index] ?? "")) parser.index += 1;
      const textNode: XmlText = { kind: "text", value: input.slice(start, parser.index) };
      (root === null ? before : after).push(textNode);
      continue;
    }
    let node: XmlNode;
    if (input.startsWith("<!--", parser.index)) node = parseXmlComment(parser);
    else if (input.startsWith("<?", parser.index)) node = parseXmlPi(parser);
    else if (input[parser.index] === "<" && !input.startsWith("</", parser.index) && !input.startsWith("<!", parser.index)) node = parseXmlElement(parser, 0);
    else xmlFail(parser, "INVALID_XML", "Only one root element plus comments or processing instructions is allowed at document level.");
    if (node.kind === "element") {
      if (root !== null) xmlFail(parser, "INVALID_XML", "XML document contains more than one root element.", start);
      root = node;
    } else {
      (root === null ? before : after).push(node);
    }
  }
  if (root === null) invalid("INVALID_XML", "XML document has no root element.", lineColumn(input, 0, "/"));
  return { before, root, after };
}

function xmlSpaceValue(element: XmlElement): string | undefined {
  return element.attributes.find(({ name }) => name === "xml:space")?.value;
}

function effectiveXmlSpace(element: XmlElement, inherited: boolean): boolean {
  const local = xmlSpaceValue(element);
  if (local === "preserve") return true;
  if (local === "default") return false;
  return inherited;
}

function elementHasSensitiveText(element: XmlElement): boolean {
  return element.children.some((child) => child.kind === "cdata" || (child.kind === "text" && child.value.trim() !== ""));
}

function serializeXmlNodeCompact(node: XmlNode, inheritedPreserve = false): string {
  if (node.kind === "text") return node.value;
  if (node.kind === "comment") return `<!--${node.value}-->`;
  if (node.kind === "cdata") return `<![CDATA[${node.value}]]>`;
  if (node.kind === "pi") return `<?${node.target}${node.body}?>`;
  const attributes = node.attributes.map(({ name, value, quote }) => ` ${name}=${quote}${value}${quote}`).join("");
  if (node.children.length === 0) return `<${node.name}${attributes}/>`;
  const preserve = effectiveXmlSpace(node, inheritedPreserve);
  const sensitive = preserve || elementHasSensitiveText(node);
  const children = node.children
    .filter((child) => sensitive || child.kind !== "text" || child.value.trim() !== "")
    .map((child) => serializeXmlNodeCompact(child, preserve))
    .join("");
  return `<${node.name}${attributes}>${children}</${node.name}>`;
}

function serializeXmlNodePretty(node: XmlNode, indent: number, depth: number, inheritedPreserve = false): string {
  const prefix = " ".repeat(indent * depth);
  if (node.kind === "text") return node.value;
  if (node.kind === "comment") return `${prefix}<!--${node.value}-->`;
  if (node.kind === "cdata") return `${prefix}<![CDATA[${node.value}]]>`;
  if (node.kind === "pi") return `${prefix}<?${node.target}${node.body}?>`;
  const attributes = node.attributes.map(({ name, value, quote }) => ` ${name}=${quote}${value}${quote}`).join("");
  if (node.children.length === 0) return `${prefix}<${node.name}${attributes}/>`;
  const preserve = effectiveXmlSpace(node, inheritedPreserve);
  if (preserve || elementHasSensitiveText(node)) return `${prefix}${serializeXmlNodeCompact(node, preserve)}`;
  const significant = node.children.filter((child) => child.kind !== "text" || child.value.trim() !== "");
  const children = significant.map((child) => serializeXmlNodePretty(child, indent, depth + 1, preserve)).join("\n");
  return `${prefix}<${node.name}${attributes}>\n${children}\n${prefix}</${node.name}>`;
}

function serializeXmlDocument(document: XmlDocumentModel, mode: "prettify" | "minify", indent: number): string {
  const peripheral = (nodes: readonly XmlNode[]) => nodes.filter((node) => node.kind !== "text" || node.value.trim() !== "");
  if (mode === "minify") {
    return [...peripheral(document.before), document.root, ...peripheral(document.after)]
      .map((node) => serializeXmlNodeCompact(node))
      .join("");
  }
  return [...peripheral(document.before), document.root, ...peripheral(document.after)]
    .map((node) => serializeXmlNodePretty(node, indent, 0))
    .join("\n");
}

export function xmlOperation(input: string, mode = "prettify", indent = 2): DeveloperWebResult {
  if (mode !== "validate" && mode !== "prettify" && mode !== "minify") invalid("INVALID_MODE", "XML mode must be validate, prettify, or minify.");
  if (!Number.isInteger(indent) || indent < 0 || indent > 10) invalid("INVALID_INDENT", "XML indent must be an integer from 0 through 10.");
  const document = parseXmlDocument(input);
  const base = {
    valid: true,
    mode,
    rootName: document.root.name,
    externalEntities: "disabled",
    whitespacePolicy: "Whitespace-only nodes are removed only outside mixed content and xml:space=preserve; sensitive text is preserved byte-for-byte.",
  };
  if (mode === "validate") return base;
  const output = serializeXmlDocument(document, mode, indent);
  return { ...base, output, inputBytes: new TextEncoder().encode(input).length, outputBytes: new TextEncoder().encode(output).length };
}
