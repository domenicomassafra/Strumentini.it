import { readFileSync } from "node:fs";
import { convertBibtexToRisForTool, convertRisToBibtexForTool } from "../../../src/tools/ris-bibtex-converter/conversion";

interface ForwardExpected {
  readonly type: string;
  readonly fields: Readonly<Record<string, string>>;
  readonly forbidden_fields?: readonly string[];
  readonly warning_codes?: readonly string[];
  readonly require_loss_warning?: boolean;
}

interface ReverseExpected {
  readonly type: string;
  readonly fields: Readonly<Record<string, readonly string[]>>;
  readonly unknown_fields: readonly string[];
  readonly warning_codes: readonly string[];
}

interface OracleCorpus {
  readonly oracle: { readonly commit: string; readonly files: ReadonlyArray<{ readonly path: string; readonly sha256: string }> };
  readonly ris_to_bibtex: ReadonlyArray<{ readonly id: string; readonly input: string; readonly expected: ForwardExpected }>;
  readonly bibtex_to_ris: ReadonlyArray<{ readonly id: string; readonly input: string; readonly expected: ReverseExpected }>;
}

interface ParsedRisRecord {
  readonly type: string;
  readonly fields: ReadonlyMap<string, readonly string[]>;
}

const corpus = JSON.parse(readFileSync(new URL("./oracle-cross-check.json", import.meta.url), "utf8")) as OracleCorpus;
const issues: string[] = [];

function sameStrings(actual: readonly string[], expected: readonly string[]): boolean {
  return actual.length === expected.length && actual.every((value, index) => value === expected[index]);
}

function parseRisIndependently(text: string): ParsedRisRecord[] {
  const records: ParsedRisRecord[] = [];
  let type = "";
  let fields = new Map<string, string[]>();
  let open = false;
  const flush = (): void => {
    if (!open) return;
    records.push({ type, fields });
    type = "";
    fields = new Map<string, string[]>();
    open = false;
  };
  for (const line of text.replace(/\r\n?/gu, "\n").split("\n")) {
    const match = line.match(/^([A-Z0-9]{2})\s{2}-\s?(.*)$/u);
    if (match === null) continue;
    const tag = match[1] ?? "";
    const value = match[2] ?? "";
    if (tag === "TY") {
      flush();
      type = value.trim();
      open = true;
      continue;
    }
    if (!open) continue;
    if (tag === "ER") {
      flush();
      continue;
    }
    const values = fields.get(tag) ?? [];
    values.push(value.trim());
    fields.set(tag, values);
  }
  flush();
  return records;
}

for (const vector of corpus.ris_to_bibtex) {
  const result = convertRisToBibtexForTool(vector.input);
  const entry = result.entries[0];
  if (entry === undefined) {
    issues.push(`${vector.id}: no BibTeX entry produced`);
    continue;
  }
  if (entry.type !== vector.expected.type) issues.push(`${vector.id}: expected type ${vector.expected.type}, got ${entry.type}`);
  for (const [field, expected] of Object.entries(vector.expected.fields)) {
    if (entry.fields[field] !== expected) issues.push(`${vector.id}: expected ${field}=${JSON.stringify(expected)}, got ${JSON.stringify(entry.fields[field])}`);
  }
  for (const field of vector.expected.forbidden_fields ?? []) {
    if (entry.fields[field] !== undefined) issues.push(`${vector.id}: forbidden field ${field} was emitted as ${JSON.stringify(entry.fields[field])}`);
  }
  const warningCodes = result.warnings.map(({ code }) => code);
  if (vector.expected.warning_codes !== undefined && !sameStrings(warningCodes, vector.expected.warning_codes)) {
    issues.push(`${vector.id}: expected warnings ${JSON.stringify(vector.expected.warning_codes)}, got ${JSON.stringify(warningCodes)}`);
  }
  if (vector.expected.require_loss_warning === true && warningCodes.length === 0) {
    issues.push(`${vector.id}: a declared lossy conversion emitted no warning`);
  }
}

for (const vector of corpus.bibtex_to_ris) {
  const result = convertBibtexToRisForTool(vector.input);
  const records = parseRisIndependently(result.ris);
  const record = records[0];
  if (record === undefined) {
    issues.push(`${vector.id}: no RIS record produced`);
    continue;
  }
  if (record.type !== vector.expected.type) issues.push(`${vector.id}: expected TY ${vector.expected.type}, got ${record.type}`);
  for (const [tag, expected] of Object.entries(vector.expected.fields)) {
    const actual = record.fields.get(tag) ?? [];
    if (!sameStrings(actual, expected)) issues.push(`${vector.id}: expected ${tag}=${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
  const unknown = result.unknownFields[0]?.fields ?? [];
  if (!sameStrings(unknown, vector.expected.unknown_fields)) {
    issues.push(`${vector.id}: expected unknown fields ${JSON.stringify(vector.expected.unknown_fields)}, got ${JSON.stringify(unknown)}`);
  }
  const warningCodes = result.warnings.map(({ code }) => code);
  if (!sameStrings(warningCodes, vector.expected.warning_codes)) {
    issues.push(`${vector.id}: expected warnings ${JSON.stringify(vector.expected.warning_codes)}, got ${JSON.stringify(warningCodes)}`);
  }
}

if (issues.length > 0) {
  console.error(`RIS/BibTeX independent oracle BLOCKED (${issues.length} mismatch(es))`);
  for (const issue of issues) console.error(`- ${issue}`);
  process.exit(1);
}

console.log(`RIS/BibTeX independent oracle PASS: ${corpus.ris_to_bibtex.length + corpus.bibtex_to_ris.length} probes, Zotero ${corpus.oracle.commit}`);
console.log(`Pinned translators: ${corpus.oracle.files.map(({ path, sha256 }) => `${path}=${sha256}`).join(", ")}`);
