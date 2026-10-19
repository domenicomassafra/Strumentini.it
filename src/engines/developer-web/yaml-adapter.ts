import { MAX_YAML_DEPTH, abortIfNeeded, assertInputSize, invalid, type DeveloperWebResult } from "./types";
import { legacyYamlFormatterOperation } from "./structured-data";

/** yaml@2.9.1 caps anchor expansion; keep the donor default explicit. */
const MAX_YAML_ALIASES = 100;

/** Core YAML 1.2 tags that map to JSON-representable values without a custom constructor. */
const CORE_TAGS: ReadonlySet<string> = new Set([
  "tag:yaml.org,2002:str",
  "tag:yaml.org,2002:int",
  "tag:yaml.org,2002:float",
  "tag:yaml.org,2002:bool",
  "tag:yaml.org,2002:null",
  "tag:yaml.org,2002:map",
  "tag:yaml.org,2002:seq",
]);

interface MinimalNode {
  readonly tag?: string | null;
  readonly items?: readonly unknown[];
  readonly key?: unknown;
  readonly value?: unknown;
}

function defineRecordValue(record: Record<string, unknown>, key: string, value: unknown): void {
  Object.defineProperty(record, key, { configurable: true, enumerable: true, value, writable: true });
}

/**
 * Rejects flow nesting beyond the local safety limit before the donor parses, so a
 * pathological input cannot reach the library recursion first. Comments and quoted
 * scalars are skipped exactly like the YAML lexer would.
 */
function assertBoundedFlowDepth(input: string): void {
  let quote: "'" | "\"" | null = null;
  let comment = false;
  let depth = 0;
  for (let index = 0; index < input.length; index += 1) {
    const character = input[index]!;
    if (comment) {
      if (character === "\n") comment = false;
      continue;
    }
    if (quote === "'") {
      if (character === "'") {
        if (input[index + 1] === "'") index += 1;
        else quote = null;
      }
      continue;
    }
    if (quote === "\"") {
      if (character === "\\") index += 1;
      else if (character === "\"") quote = null;
      continue;
    }
    if (character === "#" && (index === 0 || /\s/u.test(input[index - 1] ?? ""))) {
      comment = true;
      continue;
    }
    if (character === "'" || character === "\"") {
      quote = character;
      continue;
    }
    if (character === "[" || character === "{") {
      depth += 1;
      if (depth > MAX_YAML_DEPTH) invalid("YAML_TOO_DEEP", "YAML nesting exceeds the local safety limit.");
    }
    if (character === "]" || character === "}") depth -= 1;
  }
}

function assertSupportedNodes(node: unknown): void {
  if (node === null || typeof node !== "object") return;
  const candidate = node as MinimalNode;
  if (typeof candidate.tag === "string" && !CORE_TAGS.has(candidate.tag)) {
    invalid("UNSUPPORTED_YAML", `YAML tag ${candidate.tag} is not supported by the local formatter.`);
  }
  if (Array.isArray(candidate.items)) {
    for (const item of candidate.items) {
      if (item === null || typeof item !== "object") continue;
      const pair = item as { key?: unknown; value?: unknown };
      if (Object.hasOwn(pair, "key") || Object.hasOwn(pair, "value")) {
        const key = pair.key;
        if (key !== null && typeof key === "object") {
          const scalarKey = key as MinimalNode;
          if (Array.isArray(scalarKey.items)) invalid("UNSUPPORTED_YAML", "YAML complex mapping keys are not supported by the local formatter.");
          if (scalarKey.value === "<<") invalid("UNSUPPORTED_YAML", "YAML merge keys (<<) are not supported by the local formatter.");
        }
        assertSupportedNodes(key);
        assertSupportedNodes(pair.value);
      } else {
        assertSupportedNodes(item);
      }
    }
    return;
  }
  if (Object.hasOwn(candidate, "value")) assertSupportedNodes(candidate.value);
}

/**
 * Walks the parsed value once, rebuilding plain records with defined own properties
 * so `__proto__`/`constructor` keys cannot reach the prototype chain, and enforces
 * the depth/number contract on the donor result.
 */
function hardenValue(value: unknown, depth = 0): unknown {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) invalid("UNSUPPORTED_YAML", "YAML infinity and NaN values are not enabled.");
    return value;
  }
  if (value === null || typeof value !== "object") return value;
  if (depth > MAX_YAML_DEPTH) invalid("YAML_TOO_DEEP", "YAML nesting exceeds the local safety limit.");
  if (Array.isArray(value)) return value.map((item) => hardenValue(item, depth + 1));
  const output: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) defineRecordValue(output, key, hardenValue(child, depth + 1));
  return output;
}

function describeFirstError(error: { message: string; linePos?: readonly { line: number; col: number }[] }): {
  message: string;
  diagnostic: { line?: number; column?: number };
} {
  const position = error.linePos?.[0];
  return {
    message: error.message.replace(/\s+/gu, " ").trim(),
    diagnostic: position === undefined ? {} : { line: position.line, column: position.col },
  };
}

/**
 * yaml@2.9.1 (ISC) is bundled in a separate chunk and downloaded only on first use.
 * The hand-written formatter stays reachable through `formatYaml`/`parseYaml` for the
 * JSON↔YAML converter and as the indent-0 rollback path.
 */
export async function yamlFormatterOperation(input: string, indent = 2, signal?: AbortSignal): Promise<DeveloperWebResult> {
  assertInputSize(input);
  abortIfNeeded(signal);
  if (!Number.isInteger(indent) || indent < 0 || indent > 8) invalid("INVALID_INDENT", "YAML indent must be an integer from 0 through 8.");
  assertBoundedFlowDepth(input);
  const { parseAllDocuments, stringify } = await import("yaml");
  abortIfNeeded(signal);
  const documents = parseAllDocuments(input, {
    version: "1.2",
    schema: "core",
    strict: true,
    uniqueKeys: true,
    prettyErrors: false,
  });
  if (documents.length > 1) invalid("INVALID_YAML", "Source contains multiple YAML documents; the local formatter accepts exactly one.");
  const document = documents[0];
  const firstError = document?.errors[0];
  if (firstError !== undefined) {
    const described = describeFirstError(firstError);
    invalid("INVALID_YAML", described.message, described.diagnostic);
  }
  let value: unknown = null;
  if (document !== undefined) {
    assertSupportedNodes(document.contents);
    try {
      value = hardenValue(document.toJS({ maxAliasCount: MAX_YAML_ALIASES }));
    } catch (error) {
      if (error instanceof RangeError) invalid("YAML_TOO_DEEP", "YAML nesting exceeds the local safety limit.");
      if (error instanceof Error && /alias/i.test(error.message)) invalid("UNSUPPORTED_YAML", error.message);
      throw error;
    }
  }
  abortIfNeeded(signal);
  const warnings = (document?.warnings ?? []).map((warning) => warning.message.replace(/\s+/gu, " ").trim());
  if (indent === 0) {
    // yaml refuses a zero indent; keep the historical formatter for that legacy option.
    const fallback = legacyYamlFormatterOperation(input, indent);
    return {
      ...fallback,
      warnings: [...warnings, "Con rientro 0 resta attivo il formattatore storico."],
    } as DeveloperWebResult;
  }
  const formatted = stringify(value, {
    indent,
    lineWidth: 0,
    blockQuote: "literal",
    aliasDuplicateObjects: false,
    singleQuote: false,
    version: "1.2",
  });
  abortIfNeeded(signal);
  const inputBytes = new TextEncoder().encode(input).byteLength;
  const outputBytes = new TextEncoder().encode(formatted).byteLength;
  return {
    valid: true,
    formatted,
    value,
    warnings,
    inputBytes,
    outputBytes,
    savedBytes: inputBytes - outputBytes,
    savedPercent: inputBytes === 0 ? 0 : Number(((100 * (inputBytes - outputBytes)) / inputBytes).toFixed(2)),
  } as DeveloperWebResult;
}
