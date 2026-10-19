import {
  MAX_JSON_PATH_MATCHES,
  MAX_TOML_DEPTH,
  MAX_YAML_DEPTH,
  type JsonRecord,
  type DeveloperWebResult,
  assertInputSize,
  developerErrorEnvelope,
  invalid,
} from "./types";

export interface JsonParseResult {
  readonly value: unknown;
  readonly duplicateKeys: string[];
}

interface JsonParser {
  readonly input: string;
  index: number;
  readonly duplicates: string[];
  readonly path: string[];
}

const MAX_JSON_DEPTH = 128;

function defineRecordValue(record: JsonRecord, key: string, value: unknown): void {
  Object.defineProperty(record, key, { configurable: true, enumerable: true, value, writable: true });
}

function jsonFail(parser: JsonParser, message: string): never {
  const prefix = parser.input.slice(0, parser.index);
  const lines = prefix.split("\n");
  const line = lines.length;
  const column = (lines.at(-1)?.length ?? 0) + 1;
  const contextStart = Math.max(0, parser.index - 24);
  const contextEnd = Math.min(parser.input.length, parser.index + 24);
  const context = parser.input.slice(contextStart, contextEnd).replaceAll("\n", "↵");
  invalid("INVALID_JSON", `${message} at character ${parser.index + 1}.`, {
    line,
    column,
    character: parser.index + 1,
    path: parser.path.length === 0 ? "$" : `$.${parser.path.join(".")}`,
    context,
  });
}

function skipJsonWhitespace(parser: JsonParser): void {
  while (/[ \t\r\n]/u.test(parser.input[parser.index] ?? "")) parser.index += 1;
}

function parseJsonString(parser: JsonParser): string {
  const start = parser.index;
  if (parser.input[parser.index] !== "\"") jsonFail(parser, "Expected a string");
  parser.index += 1;
  let output = "";
  while (parser.index < parser.input.length) {
    const character = parser.input[parser.index]!;
    if (character === "\"") {
      parser.index += 1;
      return output;
    }
    if (character === "\\") {
      parser.index += 1;
      const escape = parser.input[parser.index];
      if (escape === undefined) jsonFail(parser, "Unterminated escape");
      const simple: Record<string, string> = { '"': '"', "\\": "\\", "/": "/", b: "\b", f: "\f", n: "\n", r: "\r", t: "\t" };
      if (simple[escape] !== undefined) {
        output += simple[escape];
        parser.index += 1;
        continue;
      }
      if (escape !== "u") jsonFail(parser, "Invalid escape");
      const hex = parser.input.slice(parser.index + 1, parser.index + 5);
      if (!/^[0-9a-fA-F]{4}$/u.test(hex)) jsonFail(parser, "Invalid Unicode escape");
      output += String.fromCharCode(Number.parseInt(hex, 16));
      parser.index += 5;
      continue;
    }
    if (character < " ") jsonFail(parser, "Control character in string");
    output += character;
    parser.index += 1;
  }
  void start;
  jsonFail(parser, "Unterminated string");
}

function parseJsonNumber(parser: JsonParser): number {
  const start = parser.index;
  if (parser.input[parser.index] === "-") parser.index += 1;
  if (parser.input[parser.index] === "0") {
    parser.index += 1;
  } else {
    if (!/[1-9]/u.test(parser.input[parser.index] ?? "")) jsonFail(parser, "Invalid number");
    while (/[0-9]/u.test(parser.input[parser.index] ?? "")) parser.index += 1;
  }
  if (parser.input[parser.index] === ".") {
    parser.index += 1;
    if (!/[0-9]/u.test(parser.input[parser.index] ?? "")) jsonFail(parser, "Invalid fraction");
    while (/[0-9]/u.test(parser.input[parser.index] ?? "")) parser.index += 1;
  }
  if (parser.input[parser.index] === "e" || parser.input[parser.index] === "E") {
    parser.index += 1;
    if (parser.input[parser.index] === "+" || parser.input[parser.index] === "-") parser.index += 1;
    if (!/[0-9]/u.test(parser.input[parser.index] ?? "")) jsonFail(parser, "Invalid exponent");
    while (/[0-9]/u.test(parser.input[parser.index] ?? "")) parser.index += 1;
  }
  const result = Number(parser.input.slice(start, parser.index));
  if (!Number.isFinite(result)) jsonFail(parser, "Number is outside the supported range");
  return result;
}

function parseJsonValue(parser: JsonParser, depth = 0): unknown {
  if (depth > MAX_JSON_DEPTH) invalid("JSON_TOO_DEEP", "JSON nesting exceeds the local safety limit.");
  skipJsonWhitespace(parser);
  const character = parser.input[parser.index];
  if (character === "\"") return parseJsonString(parser);
  if (character === "t" && parser.input.startsWith("true", parser.index)) {
    parser.index += 4;
    return true;
  }
  if (character === "f" && parser.input.startsWith("false", parser.index)) {
    parser.index += 5;
    return false;
  }
  if (character === "n" && parser.input.startsWith("null", parser.index)) {
    parser.index += 4;
    return null;
  }
  if (character === "-" || /[0-9]/u.test(character ?? "")) return parseJsonNumber(parser);
  if (character === "[") {
    parser.index += 1;
    const values: unknown[] = [];
    skipJsonWhitespace(parser);
    if (parser.input[parser.index] === "]") {
      parser.index += 1;
      return values;
    }
    while (true) {
      values.push(parseJsonValue(parser, depth + 1));
      skipJsonWhitespace(parser);
      const separator = parser.input[parser.index];
      if (separator === ",") {
        parser.index += 1;
        continue;
      }
      if (separator === "]") {
        parser.index += 1;
        return values;
      }
      jsonFail(parser, "Expected a comma or closing bracket");
    }
  }
  if (character === "{") {
    parser.index += 1;
    const value: JsonRecord = {};
    const seen = new Set<string>();
    skipJsonWhitespace(parser);
    if (parser.input[parser.index] === "}") {
      parser.index += 1;
      return value;
    }
    while (true) {
      skipJsonWhitespace(parser);
      if (parser.input[parser.index] !== "\"") jsonFail(parser, "Expected an object member name");
      const key = parseJsonString(parser);
      if (seen.has(key)) parser.duplicates.push([...parser.path, key].join("."));
      seen.add(key);
      skipJsonWhitespace(parser);
      if (parser.input[parser.index] !== ":") jsonFail(parser, "Expected a colon after member name");
      parser.index += 1;
      parser.path.push(key);
      defineRecordValue(value, key, parseJsonValue(parser, depth + 1));
      parser.path.pop();
      skipJsonWhitespace(parser);
      const separator = parser.input[parser.index];
      if (separator === ",") {
        parser.index += 1;
        continue;
      }
      if (separator === "}") {
        parser.index += 1;
        return value;
      }
      jsonFail(parser, "Expected a comma or closing brace");
    }
  }
  jsonFail(parser, "Expected a JSON value");
}

export function parseJsonWithMetadata(input: string): JsonParseResult {
  assertInputSize(input);
  const parser: JsonParser = { input, index: 0, duplicates: [], path: [] };
  const value = parseJsonValue(parser, 0);
  skipJsonWhitespace(parser);
  if (parser.index !== input.length) jsonFail(parser, "Unexpected trailing characters");
  return { value, duplicateKeys: [...new Set(parser.duplicates)] };
}

export function validateJson(input: string): { valid: true; value: unknown; duplicateKeys: string[] } | { valid: false; code: string; message: string; diagnostic?: import("./types").DeveloperDiagnostic } {
  try {
    const parsed = parseJsonWithMetadata(input);
    return { valid: true, value: parsed.value, duplicateKeys: parsed.duplicateKeys };
  } catch (error) {
    const envelope = developerErrorEnvelope(error);
    return { valid: false, ...envelope };
  }
}

function sortJsonValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortJsonValue);
  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(Object.entries(value as JsonRecord).sort(([left], [right]) => left.localeCompare(right)).map(([key, child]) => [key, sortJsonValue(child)]));
  }
  return value;
}

export function formatJson(input: string, indent = 2, sortKeys = false): { formatted: string; value: unknown; duplicateKeys: string[] } {
  if (!Number.isInteger(indent) || indent < 0 || indent > 10) invalid("INVALID_INDENT", "JSON indent must be an integer from 0 through 10.");
  const parsed = parseJsonWithMetadata(input);
  const value = sortKeys ? sortJsonValue(parsed.value) : parsed.value;
  const formatted = JSON.stringify(value, null, indent);
  if (formatted === undefined) invalid("INVALID_JSON", "The JSON value cannot be represented.");
  return { formatted, value, duplicateKeys: parsed.duplicateKeys };
}

export function jsonFormatterOperation(input: string, indent = 2, sortKeys = false, mode: "prettify" | "minify" = "prettify"): DeveloperWebResult {
  const result = formatJson(input, mode === "minify" ? 0 : indent, sortKeys);
  const inputBytes = new TextEncoder().encode(input).length;
  const outputBytes = new TextEncoder().encode(result.formatted).length;
  return {
    valid: true,
    mode,
    formatted: result.formatted,
    value: result.value,
    duplicateKeys: result.duplicateKeys,
    inputBytes,
    outputBytes,
    byteDelta: outputBytes - inputBytes,
    warnings: result.duplicateKeys.length === 0 ? [] : ["In presenza di chiavi duplicate, il parser JSON mantiene l'ultimo valore incontrato."],
  } as DeveloperWebResult;
}

export function jsonValidatorOperation(input: string): DeveloperWebResult {
  const result = validateJson(input);
  if (!result.valid) {
    return { valid: false, code: result.code, error: result.message, ...(result.diagnostic === undefined ? {} : { diagnostic: result.diagnostic }) } as DeveloperWebResult;
  }
  return {
    valid: true,
    value: result.value,
    duplicateKeys: result.duplicateKeys,
    warnings: result.duplicateKeys.length === 0 ? [] : ["La grammatica JSON non rifiuta automaticamente i nomi di membro duplicati."],
  } as DeveloperWebResult;
}

function stripYamlComment(text: string): string {
  let quote: "'" | "\"" | null = null;
  let escaped = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index]!;
    if (escaped) {
      escaped = false;
      continue;
    }
    if (quote === "\"" && character === "\\") {
      escaped = true;
      continue;
    }
    if (character === "'" || character === "\"") {
      quote = quote === character ? null : quote ?? character;
      continue;
    }
    if (character === "#" && quote === null && (index === 0 || /\s/u.test(text[index - 1] ?? ""))) return text.slice(0, index).trimEnd();
  }
  return text.trimEnd();
}

interface YamlLine {
  readonly indent: number;
  readonly text: string;
  readonly line: number;
}

function yamlLines(input: string): YamlLine[] {
  assertInputSize(input);
  const lines: YamlLine[] = [];
  for (const [index, raw] of input.replace(/\r\n?/gu, "\n").split("\n").entries()) {
    if (raw.includes("\t") && /^\s*\t/u.test(raw)) invalid("INVALID_YAML", `Tabs cannot be used for YAML indentation on line ${index + 1}.`);
    const withoutComment = stripYamlComment(raw);
    if (withoutComment.trim() === "") continue;
    const indent = withoutComment.length - withoutComment.trimStart().length;
    lines.push({ indent, text: withoutComment.trim(), line: index + 1 });
  }
  return lines;
}

function splitFlow(value: string): string[] {
  const output: string[] = [];
  let start = 0;
  let quote: string | null = null;
  let depth = 0;
  let escaped = false;
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index]!;
    if (escaped) {
      escaped = false;
      continue;
    }
    if (quote === "\"" && character === "\\") {
      escaped = true;
      continue;
    }
    if (character === "'" || character === "\"") {
      quote = quote === character ? null : quote ?? character;
      continue;
    }
    if (quote !== null) continue;
    if (character === "[" || character === "{") depth += 1;
    if (character === "]" || character === "}") depth -= 1;
    if (character === "," && depth === 0) {
      output.push(value.slice(start, index).trim());
      start = index + 1;
    }
  }
  const tail = value.slice(start).trim();
  if (tail !== "" || output.length > 0) output.push(tail);
  if (depth !== 0) invalid("INVALID_YAML", "Unclosed YAML flow collection.");
  return output;
}

function parseYamlScalar(raw: string, anchors: Map<string, unknown>, depth: number): unknown {
  const value = raw.trim();
  if (value === "") return null;
  if (value.startsWith("!")) invalid("UNSUPPORTED_YAML", "YAML tags are not executed or instantiated.");
  if (value.startsWith("*")) {
    const name = value.slice(1);
    if (!anchors.has(name)) invalid("INVALID_YAML", `Unknown YAML alias: ${name}.`);
    return anchors.get(name);
  }
  if (value.startsWith("&")) {
    const match = /^&([^\s]+)\s*(.*)$/u.exec(value);
    if (match === null) invalid("INVALID_YAML", "Invalid YAML anchor.");
    const resolved = parseYamlScalar(match[2] ?? "", anchors, depth);
    anchors.set(match[1]!, resolved);
    return resolved;
  }
  if (value.startsWith("[") || value.startsWith("{")) return parseYamlFlow(value, anchors, depth + 1);
  if ((value.startsWith("\"") && value.endsWith("\"")) || (value.startsWith("'") && value.endsWith("'"))) {
    if (value.startsWith("\"")) {
      try {
        return JSON.parse(value);
      } catch {
        invalid("INVALID_YAML", "Invalid double-quoted YAML scalar.");
      }
    }
    return value.slice(1, -1).replaceAll("''", "'");
  }
  if (/^(?:null|~)$/iu.test(value)) return null;
  if (/^(?:true|false)$/iu.test(value)) return value.toLowerCase() === "true";
  if (/^[+-]?(?:0|[1-9][0-9]*)$/u.test(value)) return Number(value);
  if (/^[+-]?(?:0|[1-9][0-9]*)\.[0-9]+(?:[eE][+-]?[0-9]+)?$/u.test(value)) return Number(value);
  if (/^[-+]?(?:inf|nan)$/iu.test(value)) invalid("UNSUPPORTED_YAML", "YAML infinity and NaN values are not enabled.");
  return value;
}

function parseYamlFlow(value: string, anchors: Map<string, unknown>, depth: number): unknown {
  if (depth > MAX_YAML_DEPTH) invalid("YAML_TOO_DEEP", "YAML nesting exceeds the local safety limit.");
  if (value.startsWith("[")) {
    if (!value.endsWith("]")) invalid("INVALID_YAML", "Unclosed YAML sequence.");
    const body = value.slice(1, -1).trim();
    return body === "" ? [] : splitFlow(body).map((item) => parseYamlScalar(item, anchors, depth + 1));
  }
  if (!value.endsWith("}")) invalid("INVALID_YAML", "Unclosed YAML mapping.");
  const body = value.slice(1, -1).trim();
  const result: JsonRecord = {};
  if (body === "") return result;
  for (const item of splitFlow(body)) {
    const separator = item.indexOf(":");
    if (separator < 0) invalid("INVALID_YAML", "YAML flow mappings require key: value pairs.");
    const key = String(parseYamlScalar(item.slice(0, separator), anchors, depth + 1));
    defineRecordValue(result, key, parseYamlScalar(item.slice(separator + 1), anchors, depth + 1));
  }
  return result;
}

function parseYamlBlock(lines: readonly YamlLine[], start: number, indent: number, anchors: Map<string, unknown>, depth: number): { value: unknown; next: number } {
  if (depth > MAX_YAML_DEPTH) invalid("YAML_TOO_DEEP", "YAML nesting exceeds the local safety limit.");
  if (start >= lines.length) return { value: null, next: start };
  const first = lines[start]!;
  if (first.indent < indent) return { value: null, next: start };
  if (first.text.startsWith("- ") || first.text === "-") {
    const values: unknown[] = [];
    let index = start;
    while (index < lines.length && lines[index]!.indent === indent && (lines[index]!.text.startsWith("- ") || lines[index]!.text === "-")) {
      const line = lines[index]!;
      const rest = line.text === "-" ? "" : line.text.slice(2).trim();
      index += 1;
      if (rest === "") {
        const child = parseYamlBlock(lines, index, index < lines.length ? lines[index]!.indent : indent, anchors, depth + 1);
        values.push(child.value);
        index = child.next;
      } else if (/^[^:]+:\s*(.*)$/u.test(rest) && !rest.startsWith("[") && !rest.startsWith("{")) {
        const separator = rest.indexOf(":");
        const item: JsonRecord = {};
        const key = rest.slice(0, separator).trim();
        const value = rest.slice(separator + 1).trim();
        if (value === "" && index < lines.length && lines[index]!.indent > indent) {
          const child = parseYamlBlock(lines, index, lines[index]!.indent, anchors, depth + 1);
          defineRecordValue(item, key, child.value);
          index = child.next;
        } else {
          defineRecordValue(item, key, value === "" ? null : parseYamlScalar(value, anchors, depth + 1));
        }
        while (index < lines.length && lines[index]!.indent > indent && !lines[index]!.text.startsWith("- ")) {
          const continuation = lines[index]!;
          const continuationSeparator = findYamlMappingSeparator(continuation.text);
          if (continuationSeparator < 0) invalid("INVALID_YAML", `Expected a mapping on line ${continuation.line}.`);
          const continuationKey = continuation.text.slice(0, continuationSeparator).trim();
          const continuationValue = continuation.text.slice(continuationSeparator + 1).trim();
          if (Object.hasOwn(item, continuationKey)) invalid("INVALID_YAML", `Duplicate YAML mapping key: ${continuationKey}.`);
          index += 1;
          if (continuationValue === "" && index < lines.length && lines[index]!.indent > indent) {
            const child = parseYamlBlock(lines, index, lines[index]!.indent, anchors, depth + 1);
            defineRecordValue(item, continuationKey, child.value);
            index = child.next;
          } else {
            defineRecordValue(item, continuationKey, continuationValue === "" ? null : parseYamlScalar(continuationValue, anchors, depth + 1));
          }
        }
        values.push(item);
      } else {
        values.push(parseYamlScalar(rest, anchors, depth + 1));
      }
    }
    return { value: values, next: index };
  }
  const value: JsonRecord = {};
  let index = start;
  while (index < lines.length && lines[index]!.indent === indent) {
    const line = lines[index]!;
    if (line.text.startsWith("- ")) break;
    const separator = findYamlMappingSeparator(line.text);
    if (separator < 0) invalid("INVALID_YAML", `Expected a mapping on line ${line.line}.`);
    const key = String(parseYamlScalar(line.text.slice(0, separator).trim(), anchors, depth + 1));
    if (Object.hasOwn(value, key)) invalid("INVALID_YAML", `Duplicate YAML mapping key: ${key}.`);
    const rest = line.text.slice(separator + 1).trim();
    index += 1;
    if (rest === "") {
      if (index < lines.length && lines[index]!.indent > indent) {
        const child = parseYamlBlock(lines, index, lines[index]!.indent, anchors, depth + 1);
        defineRecordValue(value, key, child.value);
        index = child.next;
      } else {
        defineRecordValue(value, key, null);
      }
    } else {
      defineRecordValue(value, key, parseYamlScalar(rest, anchors, depth + 1));
    }
  }
  return { value, next: index };
}

function findYamlMappingSeparator(text: string): number {
  let quote: string | null = null;
  let escaped = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index]!;
    if (escaped) {
      escaped = false;
      continue;
    }
    if (quote === "\"" && character === "\\") {
      escaped = true;
      continue;
    }
    if (character === "'" || character === "\"") {
      quote = quote === character ? null : quote ?? character;
      continue;
    }
    if (character === ":" && quote === null && (index + 1 === text.length || /\s/u.test(text[index + 1] ?? ""))) return index;
  }
  return -1;
}

export function parseYaml(input: string): { value: unknown; warnings: string[] } {
  const lines = yamlLines(input);
  if (lines.length === 0) return { value: null, warnings: [] };
  const anchors = new Map<string, unknown>();
  const result = parseYamlBlock(lines, 0, lines[0]!.indent, anchors, 0);
  if (result.next !== lines.length) invalid("INVALID_YAML", `Unexpected YAML content on line ${lines[result.next]!.line}.`);
  return { value: result.value, warnings: [] };
}

function yamlNeedsQuotes(value: string): boolean {
  return value === "" || /^[\s>|*&!%@`{}\[\],#?:-]/u.test(value) || /^(?:null|true|false|~|[-+]?[0-9.]+(?:[eE][+-]?[0-9]+)?)$/iu.test(value) || value.includes(": ") || value.includes(" #");
}

function yamlScalar(value: unknown): string {
  if (value === null) return "null";
  if (typeof value === "string") return yamlNeedsQuotes(value) ? JSON.stringify(value) : value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
}

export function formatYaml(value: unknown, indent = 2): string {
  if (!Number.isInteger(indent) || indent < 0 || indent > 8) invalid("INVALID_INDENT", "YAML indent must be an integer from 0 through 8.");
  const emit = (child: unknown, depth: number): string[] => {
    const prefix = " ".repeat(indent * depth);
    if (Array.isArray(child)) {
      if (child.length === 0) return [`${prefix}[]`];
      return child.flatMap((item) => {
        if (item !== null && typeof item === "object") {
          const nested = emit(item, depth + 1);
          const first = nested.shift() ?? `${prefix}  {}`;
          return [`${prefix}- ${first.trimStart()}`, ...nested];
        }
        return [`${prefix}- ${yamlScalar(item)}`];
      });
    }
    if (child !== null && typeof child === "object") {
      const entries = Object.entries(child as JsonRecord);
      if (entries.length === 0) return [`${prefix}{}`];
      return entries.flatMap(([key, item]) => {
        if (item !== null && typeof item === "object") {
          const nested = emit(item, depth + 1);
          if (Array.isArray(item) && item.length === 0) return [`${prefix}${key}: []`];
          if (!Array.isArray(item) && Object.keys(item as JsonRecord).length === 0) return [`${prefix}${key}: {}`];
          return [`${prefix}${key}:`, ...nested];
        }
        return [`${prefix}${key}: ${yamlScalar(item)}`];
      });
    }
    return [`${prefix}${yamlScalar(child)}`];
  };
  return emit(value, 0).join("\n") + "\n";
}

/** Original hand-written formatter: rollback path for the YAML→YAML formatter and the JSON↔YAML converter engine. */
export function legacyYamlFormatterOperation(input: string, indent = 2): DeveloperWebResult {
  const parsed = parseYaml(input);
  const formatted = formatYaml(parsed.value, indent);
  const inputBytes = new TextEncoder().encode(input).byteLength;
  const outputBytes = new TextEncoder().encode(formatted).byteLength;
  return { valid: true, formatted, value: parsed.value, warnings: parsed.warnings, inputBytes, outputBytes,
    savedBytes: inputBytes - outputBytes, savedPercent: inputBytes === 0 ? 0 : Number((100 * (inputBytes - outputBytes) / inputBytes).toFixed(2)) } as DeveloperWebResult;
}

export function jsonYamlConverterOperation(input: string, direction: string, indent = 2): DeveloperWebResult {
  if (direction === "json-to-yaml" || direction === "to-yaml") {
    const json = formatJson(input, 0).value;
    return { valid: true, direction, output: formatYaml(json, indent), value: json } as DeveloperWebResult;
  }
  if (direction === "yaml-to-json" || direction === "to-json") {
    const yaml = parseYaml(input).value;
    const output = JSON.stringify(yaml, null, indent);
    if (output === undefined) invalid("INVALID_YAML", "YAML value cannot be represented as JSON.");
    return { valid: true, direction, output, value: yaml } as DeveloperWebResult;
  }
  invalid("INVALID_CONVERSION", "Direction must be json-to-yaml or yaml-to-json.");
}

function parseTomlKey(raw: string): string {
  const value = raw.trim();
  if ((value.startsWith("\"") && value.endsWith("\"")) || (value.startsWith("'") && value.endsWith("'"))) return value.slice(1, -1);
  if (!/^[A-Za-z0-9_-]+$/u.test(value)) invalid("INVALID_TOML", `Invalid TOML key: ${value}.`);
  return value;
}

function splitTomlTopLevel(input: string, separator: string): string[] {
  const output: string[] = [];
  let start = 0;
  let quote: string | null = null;
  let escaped = false;
  let depth = 0;
  for (let index = 0; index < input.length; index += 1) {
    const character = input[index]!;
    if (escaped) {
      escaped = false;
      continue;
    }
    if (quote === "\"" && character === "\\") {
      escaped = true;
      continue;
    }
    if (character === "\"" || character === "'") {
      quote = quote === character ? null : quote ?? character;
      continue;
    }
    if (quote !== null) continue;
    if (character === "[" || character === "{") depth += 1;
    if (character === "]" || character === "}") depth -= 1;
    if (character === separator && depth === 0) {
      output.push(input.slice(start, index).trim());
      start = index + 1;
    }
  }
  output.push(input.slice(start).trim());
  return output;
}

function parseTomlScalar(raw: string, depth: number): unknown {
  assertInputSize(raw);
  if (depth > MAX_TOML_DEPTH) invalid("TOML_TOO_DEEP", "TOML nesting exceeds the local safety limit.");
  const value = raw.trim();
  if (value === "") return "";
  if (value.startsWith("\"") || value.startsWith("'")) {
    if (value.startsWith("\"")) {
      try {
        return JSON.parse(value);
      } catch {
        invalid("INVALID_TOML", "Invalid TOML basic string.");
      }
    }
    if (!value.endsWith("'")) invalid("INVALID_TOML", "Invalid TOML literal string.");
    return value.slice(1, -1);
  }
  if (value.startsWith("[")) {
    if (!value.endsWith("]")) invalid("INVALID_TOML", "Unclosed TOML array.");
    const body = value.slice(1, -1).trim();
    return body === "" ? [] : splitTomlTopLevel(body, ",").map((item) => parseTomlScalar(item, depth + 1));
  }
  if (value.startsWith("{")) {
    if (!value.endsWith("}")) invalid("INVALID_TOML", "Unclosed TOML inline table.");
    const body = value.slice(1, -1).trim();
    const result: JsonRecord = {};
    if (body === "") return result;
    for (const item of splitTomlTopLevel(body, ",")) {
      const separator = item.indexOf("=");
      if (separator < 0) invalid("INVALID_TOML", "TOML inline tables require key = value pairs.");
      const key = parseTomlKey(item.slice(0, separator));
      if (Object.hasOwn(result, key)) invalid("INVALID_TOML", `Duplicate TOML key: ${key}.`);
      defineRecordValue(result, key, parseTomlScalar(item.slice(separator + 1), depth + 1));
    }
    return result;
  }
  if (/^(?:true|false)$/iu.test(value)) return value.toLowerCase() === "true";
  if (/^[+-]?(?:0|[1-9][0-9_]*)$/u.test(value)) return Number(value.replaceAll("_", ""));
  if (/^[+-]?(?:0|[1-9][0-9_]*)\.[0-9_]+(?:[eE][+-]?[0-9]+)?$/u.test(value)) return Number(value.replaceAll("_", ""));
  if (/^\d{4}-\d{2}-\d{2}(?:[Tt ]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:[Zz]|[+-]\d{2}:\d{2})?)?$/u.test(value)) return value;
  invalid("INVALID_TOML", `Unsupported TOML value: ${value}.`);
}

function assignTomlPath(root: JsonRecord, path: readonly string[], value: unknown, depth = 0): void {
  if (depth > MAX_TOML_DEPTH) invalid("TOML_TOO_DEEP", "TOML nesting exceeds the local safety limit.");
  if (path.length === 0) invalid("INVALID_TOML", "A TOML key path cannot be empty.");
  let target = root;
  for (const key of path.slice(0, -1)) {
    const hasExisting = Object.hasOwn(target, key);
    const existing = hasExisting ? target[key] : undefined;
    if (!hasExisting) {
      const child: JsonRecord = {};
      defineRecordValue(target, key, child);
      target = child;
    } else if (typeof existing === "object" && existing !== null && !Array.isArray(existing)) {
      target = existing as JsonRecord;
    } else {
      invalid("INVALID_TOML", `TOML key path conflicts with a scalar: ${key}.`);
    }
  }
  const key = path[path.length - 1]!;
  if (Object.hasOwn(target, key)) invalid("INVALID_TOML", `Duplicate TOML key: ${key}.`);
  defineRecordValue(target, key, value);
}

function stripTomlComment(text: string): string {
  let quote: string | null = null;
  let escaped = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index]!;
    if (escaped) {
      escaped = false;
      continue;
    }
    if (quote === "\"" && character === "\\") {
      escaped = true;
      continue;
    }
    if (character === "\"" || character === "'") {
      quote = quote === character ? null : quote ?? character;
      continue;
    }
    if (character === "#" && quote === null) return text.slice(0, index).trimEnd();
  }
  return text.trimEnd();
}

export function parseToml(input: string): { value: JsonRecord; warnings: string[] } {
  assertInputSize(input);
  const root: JsonRecord = {};
  let current = root;
  const lines = input.replace(/\r\n?/gu, "\n").split("\n");
  for (const [lineIndex, raw] of lines.entries()) {
    const line = stripTomlComment(raw);
    if (line.trim() === "" || line.trimStart().startsWith("#")) continue;
    if (line.includes("\t")) invalid("INVALID_TOML", `Tabs are not supported in TOML indentation on line ${lineIndex + 1}.`);
    const trimmed = line.trim();
    if (trimmed.startsWith("[")) {
      if (!trimmed.endsWith("]")) invalid("INVALID_TOML", `Invalid TOML table header on line ${lineIndex + 1}.`);
      const isArray = trimmed.startsWith("[[");
      const body = trimmed.slice(isArray ? 2 : 1, -1).trim();
      if (body === "") invalid("INVALID_TOML", "A TOML table header cannot be empty.");
      const path = splitTomlTopLevel(body, ".").map(parseTomlKey);
      let target = root;
      for (const key of path) {
        const hasExisting = Object.hasOwn(target, key);
        const existing = hasExisting ? target[key] : undefined;
        if (!hasExisting) {
          const child: JsonRecord = {};
          defineRecordValue(target, key, isArray ? [child] : child);
          target = child;
        } else if (Array.isArray(existing) && isArray) {
          const child = existing[existing.length - 1];
          if (typeof child !== "object" || child === null) invalid("INVALID_TOML", "TOML array table path is not a table.");
          target = child as JsonRecord;
        } else if (typeof existing === "object" && existing !== null && !Array.isArray(existing)) {
          target = existing as JsonRecord;
        } else {
          invalid("INVALID_TOML", `TOML table path conflicts with a scalar: ${key}.`);
        }
      }
      current = target;
      continue;
    }
    const separator = trimmed.indexOf("=");
    if (separator < 0) invalid("INVALID_TOML", `Expected key = value on line ${lineIndex + 1}.`);
    const keyPath = splitTomlTopLevel(trimmed.slice(0, separator), ".").map(parseTomlKey);
    const value = parseTomlScalar(trimmed.slice(separator + 1), 0);
    assignTomlPath(current, keyPath, value);
  }
  return { value: root, warnings: [] };
}

function formatTomlScalar(value: unknown): string {
  if (typeof value === "string") return JSON.stringify(value);
  if (value === null) return "\"\"";
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return `[${value.map(formatTomlScalar).join(", ")}]`;
  if (typeof value === "object") return `{ ${Object.entries(value as JsonRecord).map(([key, child]) => `${parseTomlKey(key)} = ${formatTomlScalar(child)}`).join(", ")} }`;
  invalid("INVALID_TOML", "A TOML value cannot be represented.");
}

export function formatToml(value: JsonRecord): string {
  const lines: string[] = [];
  const scalars: string[] = [];
  const tables: Array<[string, JsonRecord]> = [];
  for (const [key, child] of Object.entries(value)) {
    if (child !== null && typeof child === "object" && !Array.isArray(child)) tables.push([key, child as JsonRecord]);
    else scalars.push(`${parseTomlKey(key)} = ${formatTomlScalar(child)}`);
  }
  if (scalars.length > 0) lines.push(...scalars);
  for (const [key, table] of tables) {
    if (lines.length > 0) lines.push("");
    lines.push(`[${key}]`);
    for (const [childKey, childValue] of Object.entries(table)) {
      if (childValue !== null && typeof childValue === "object" && !Array.isArray(childValue)) invalid("INVALID_TOML", "Nested TOML tables require explicit table sections.");
      lines.push(`${parseTomlKey(childKey)} = ${formatTomlScalar(childValue)}`);
    }
  }
  return lines.join("\n") + (lines.length > 0 ? "\n" : "");
}

export function tomlFormatterOperation(input: string): DeveloperWebResult {
  const parsed = parseToml(input);
  const formatted = formatToml(parsed.value);
  const inputBytes = new TextEncoder().encode(input).byteLength;
  const outputBytes = new TextEncoder().encode(formatted).byteLength;
  return { valid: true, formatted, value: parsed.value, warnings: parsed.warnings, inputBytes, outputBytes,
    savedBytes: inputBytes - outputBytes, savedPercent: inputBytes === 0 ? 0 : Number((100 * (inputBytes - outputBytes) / inputBytes).toFixed(2)) } as DeveloperWebResult;
}

interface JsonPathToken {
  readonly kind: "key" | "index" | "wildcard" | "descend";
  readonly value?: string | number;
}

function parseJsonPath(path: string): JsonPathToken[] {
  if (path.length > 1_000) invalid("INVALID_JSON_PATH", "JSON path exceeds the local length limit.");
  const trimmed = path.trim();
  if (trimmed === "" || trimmed === "$") return [];
  if (!trimmed.startsWith("$")) invalid("INVALID_JSON_PATH", "JSON path must start with $.");
  const tokens: JsonPathToken[] = [];
  let index = 1;
  while (index < trimmed.length) {
    const character = trimmed[index]!;
    if (character === ".") {
      if (trimmed[index + 1] === ".") {
        index += 2;
        const start = index;
        while (index < trimmed.length && /[A-Za-z0-9_-]/u.test(trimmed[index]!)) index += 1;
        if (start === index) invalid("INVALID_JSON_PATH", "Recursive descent requires a key name.");
        tokens.push({ kind: "descend", value: trimmed.slice(start, index) });
      } else {
        index += 1;
        const start = index;
        while (index < trimmed.length && /[A-Za-z0-9_-]/u.test(trimmed[index]!)) index += 1;
        if (start === index) invalid("INVALID_JSON_PATH", "A dot path segment is required.");
        tokens.push({ kind: "key", value: trimmed.slice(start, index) });
      }
      continue;
    }
    if (character === "[") {
      const end = trimmed.indexOf("]", index + 1);
      if (end < 0) invalid("INVALID_JSON_PATH", "Unclosed JSON path bracket.");
      const segment = trimmed.slice(index + 1, end).trim();
      if (segment === "*") tokens.push({ kind: "wildcard" });
      else if (/^(?:0|[1-9][0-9]*)$/u.test(segment)) tokens.push({ kind: "index", value: Number(segment) });
      else if (/^['"](.*)['"]$/u.test(segment)) tokens.push({ kind: "key", value: segment.slice(1, -1) });
      else invalid("INVALID_JSON_PATH", `Unsupported JSON path selector: ${segment}.`);
      index = end + 1;
      continue;
    }
    invalid("INVALID_JSON_PATH", `Unexpected JSON path character: ${character}.`);
  }
  return tokens;
}

function pathValueLabel(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value;
}

export function queryJsonPath(document: unknown, path: string): { matches: Array<{ path: string; value: unknown }>; normalizedPath: string; warnings: string[] } {
  const tokens = parseJsonPath(path);
  const matches: Array<{ path: string; value: unknown }> = [{ path: "$", value: document }];
  const apply = (current: Array<{ path: string; value: unknown }>, token: JsonPathToken): Array<{ path: string; value: unknown }> => {
    const next: Array<{ path: string; value: unknown }> = [];
    for (const item of current) {
      if (token.kind === "descend") {
        const key = String(token.value);
        const walk = (value: unknown, currentPath: string, depth: number): void => {
          if (depth > 100) invalid("JSON_PATH_TOO_DEEP", "JSON path traversal exceeds the local depth limit.");
          if (Array.isArray(value)) {
            value.forEach((child, childIndex) => walk(child, `${currentPath}[${childIndex}]`, depth + 1));
          } else if (value !== null && typeof value === "object") {
            for (const [childKey, child] of Object.entries(value as JsonRecord)) {
              const childPath = `${currentPath}.${childKey}`;
              if (childKey === key) next.push({ path: childPath, value: child });
              walk(child, childPath, depth + 1);
            }
          }
        };
        walk(item.value, item.path, 0);
      } else if (token.kind === "wildcard") {
        if (Array.isArray(item.value)) item.value.forEach((child, childIndex) => next.push({ path: `${item.path}[${childIndex}]`, value: child }));
        else if (item.value !== null && typeof item.value === "object") for (const [key, child] of Object.entries(item.value as JsonRecord)) next.push({ path: `${item.path}.${key}`, value: child });
      } else if (token.kind === "index") {
        if (Array.isArray(item.value)) {
          const child = item.value[Number(token.value)];
          if (child !== undefined) next.push({ path: `${item.path}[${String(token.value)}]`, value: child });
        }
      } else if (item.value !== null && typeof item.value === "object" && !Array.isArray(item.value)) {
        const key = String(token.value);
        if (Object.hasOwn(item.value as JsonRecord, key)) next.push({ path: `${item.path}.${key}`, value: (item.value as JsonRecord)[key] });
      }
      if (next.length > MAX_JSON_PATH_MATCHES) invalid("JSON_PATH_TOO_LARGE", "JSON path returned too many matches.");
    }
    return next;
  };
  let current = matches;
  for (const token of tokens) current = apply(current, token);
  return {
    matches: current,
    normalizedPath: tokens.map((token) => token.kind === "key" ? `.${String(token.value)}` : token.kind === "index" ? `[${String(token.value)}]` : token.kind === "wildcard" ? "[*]" : `..${String(token.value)}`).join("") || "$",
    warnings: [],
  };
}

export function formatJsonText(input: string, indent = 2): string {
  return formatJson(input, indent).formatted;
}

export function jsonToYaml(input: string, indent = 2): string {
  return jsonYamlConverterOperation(input, "json-to-yaml", indent).output as string;
}

export function yamlToJson(input: string, indent = 2): string {
  return jsonYamlConverterOperation(input, "yaml-to-json", indent).output as string;
}

export function jsonPathOperation(input: string, path: string): DeveloperWebResult {
  const parsed = parseJsonWithMetadata(input);
  const result = queryJsonPath(parsed.value, path);
  return {
    valid: true,
    normalizedPath: result.normalizedPath,
    matches: result.matches,
    matchCount: result.matches.length,
    matchTypes: result.matches.map((match) => pathValueLabel(match.value)),
    warnings: parsed.duplicateKeys.length === 0 ? [] : ["Prima dell'interrogazione, le chiavi JSON duplicate sono state risolte mantenendo l'ultimo valore."],
  } as DeveloperWebResult;
}
