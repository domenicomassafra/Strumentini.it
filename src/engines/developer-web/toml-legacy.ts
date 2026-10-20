/** Preserved bounded TOML subset for offline fallback and rollback. */
import { MAX_TOML_DEPTH, assertInputSize, invalid, type JsonRecord } from "./types";

function defineRecordValue(record: JsonRecord, key: string, value: unknown): void {
  Object.defineProperty(record, key, { configurable: true, enumerable: true, value, writable: true });
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
  // Legacy bounded subset. Since #277 the tool runs the pinned smol-toml donor; this
  // parser stays as the documented rollback and as the offline fallback path.
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
