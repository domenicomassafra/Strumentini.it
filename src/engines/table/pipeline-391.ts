import { CSV_HARD_FILE_BYTES, parseCsvTable, serializeCsvTable, type CsvTable } from "./csv";
import { assertBoundedTable, filterTable, joinCsvTables, type TableFilterOperator, type TableJoinType } from "./operations";

/** STR-391: versioned local recipe. Inputs are supplied separately and never embedded in the saved recipe. */
export type Pipeline391Step =
  | { readonly kind: "filter"; readonly table: "left" | "right" | "current"; readonly column: number; readonly operator: TableFilterOperator; readonly value: string }
  | { readonly kind: "join"; readonly leftKeyColumns: readonly number[]; readonly rightKeyColumns: readonly number[]; readonly joinType: TableJoinType }
  | { readonly kind: "export"; readonly format: "csv" };

export interface Pipeline391Recipe {
  readonly version: 1;
  readonly steps: readonly Pipeline391Step[];
  readonly expected?: { readonly sourceSha256: Pipeline391Hashes; readonly outputSha256: string };
}

export interface Pipeline391Sources { readonly left: string; readonly right: string }
export interface Pipeline391Hashes { readonly left: string; readonly right: string }
export interface Pipeline391Trace {
  readonly step: number;
  readonly operation: Pipeline391Step["kind"];
  readonly inputRows: number;
  readonly outputRows: number;
  readonly explanation: string;
}
export interface Pipeline391Result {
  readonly output: string;
  readonly outputSha256: string;
  readonly sourceSha256: Pipeline391Hashes;
  readonly trace: readonly Pipeline391Trace[];
}

const FILTER_OPERATORS: readonly TableFilterOperator[] = ["equals", "not-equals", "contains", "not-contains", "starts-with", "ends-with", "empty", "not-empty"];
const JOIN_TYPES: readonly TableJoinType[] = ["inner", "left", "right", "full"];

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function exactKeys(object: Record<string, unknown>, names: readonly string[]): boolean {
  return Object.keys(object).length === names.length && Object.keys(object).every((key) => names.includes(key));
}

function indexes(value: unknown): value is number[] {
  return Array.isArray(value) && value.length > 0 && value.length <= 8
    && value.every((entry) => Number.isInteger(entry) && entry >= 0 && entry < 1_000)
    && new Set(value).size === value.length;
}

/** Parse and fully validate an untrusted downloaded JSON recipe before executing any step. */
export function parsePipeline391Recipe(value: unknown): Pipeline391Recipe {
  if (!record(value) || !exactKeys(value, value.expected === undefined ? ["version", "steps"] : ["version", "steps", "expected"]) || value.version !== 1
    || !Array.isArray(value.steps) || value.steps.length < 2 || value.steps.length > 12) {
    throw new Error("PIPELINE_INVALID_RECIPE");
  }
  const steps: Pipeline391Step[] = [];
  let joined = false;
  for (const candidate of value.steps) {
    if (!record(candidate)) throw new Error("PIPELINE_INVALID_STEP");
    if (candidate.kind === "filter") {
      if (!exactKeys(candidate, ["kind", "table", "column", "operator", "value"])
        || (candidate.table !== "left" && candidate.table !== "right" && candidate.table !== "current")
        || (joined ? candidate.table !== "current" : candidate.table === "current")
        || !Number.isInteger(candidate.column) || (candidate.column as number) < 0 || (candidate.column as number) >= 1_000
        || !FILTER_OPERATORS.includes(candidate.operator as TableFilterOperator)
        || typeof candidate.value !== "string" || candidate.value.length > 200) throw new Error("PIPELINE_INVALID_FILTER");
      steps.push({ kind: "filter", table: candidate.table, column: candidate.column as number, operator: candidate.operator as TableFilterOperator, value: candidate.value });
    } else if (candidate.kind === "join") {
      if (joined || !exactKeys(candidate, ["kind", "leftKeyColumns", "rightKeyColumns", "joinType"])
        || !indexes(candidate.leftKeyColumns) || !indexes(candidate.rightKeyColumns)
        || candidate.leftKeyColumns.length !== candidate.rightKeyColumns.length
        || !JOIN_TYPES.includes(candidate.joinType as TableJoinType)) throw new Error("PIPELINE_INVALID_JOIN");
      steps.push({ kind: "join", leftKeyColumns: [...candidate.leftKeyColumns], rightKeyColumns: [...candidate.rightKeyColumns], joinType: candidate.joinType as TableJoinType });
      joined = true;
    } else if (candidate.kind === "export") {
      if (!joined || !exactKeys(candidate, ["kind", "format"]) || candidate.format !== "csv"
        || steps.length !== value.steps.length - 1) throw new Error("PIPELINE_INVALID_EXPORT");
      steps.push({ kind: "export", format: "csv" });
    } else throw new Error("PIPELINE_INVALID_STEP");
  }
  if (!joined || steps.at(-1)?.kind !== "export") throw new Error("PIPELINE_EXPORT_REQUIRED");
  if (value.expected !== undefined) {
    const proof = value.expected;
    if (!record(proof) || !exactKeys(proof, ["sourceSha256", "outputSha256"])
      || !record(proof.sourceSha256) || !exactKeys(proof.sourceSha256, ["left", "right"])
      || ![proof.sourceSha256.left, proof.sourceSha256.right, proof.outputSha256].every((hash) => typeof hash === "string" && /^[0-9a-f]{64}$/u.test(hash))) {
      throw new Error("PIPELINE_INVALID_HASH_RECEIPT");
    }
    return { version: 1, steps, expected: { sourceSha256: { left: proof.sourceSha256.left as string, right: proof.sourceSha256.right as string }, outputSha256: proof.outputSha256 as string } };
  }
  return { version: 1, steps };
}

export function serializePipeline391Recipe(recipe: Pipeline391Recipe): string {
  return JSON.stringify(parsePipeline391Recipe(recipe), null, 2);
}

async function hashText(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function checkCancel(signal?: AbortSignal): void {
  if (signal?.aborted) throw new DOMException("Pipeline annullata", "AbortError");
}

/** Atomic result: a failed step, bad source hash or cancellation never yields partial CSV. */
export async function runPipeline391(
  recipeInput: unknown,
  sources: Pipeline391Sources,
  options: { readonly signal?: AbortSignal; readonly expectedSourceSha256?: Pipeline391Hashes } = {},
): Promise<Pipeline391Result> {
  const recipe = parsePipeline391Recipe(recipeInput);
  if (typeof sources?.left !== "string" || typeof sources?.right !== "string") throw new Error("PIPELINE_INVALID_SOURCE");
  if (sources.left.length > CSV_HARD_FILE_BYTES || sources.right.length > CSV_HARD_FILE_BYTES) throw new Error("PIPELINE_SOURCE_TOO_LARGE");
  checkCancel(options.signal);
  const sourceSha256 = { left: await hashText(sources.left), right: await hashText(sources.right) };
  checkCancel(options.signal);
  const expectedSources = options.expectedSourceSha256 ?? recipe.expected?.sourceSha256;
  if (expectedSources !== undefined
    && (expectedSources.left !== sourceSha256.left || expectedSources.right !== sourceSha256.right)) {
    throw new Error("PIPELINE_SOURCE_CHANGED");
  }
  let left = assertBoundedTable(parseCsvTable(sources.left));
  let right = assertBoundedTable(parseCsvTable(sources.right));
  let current: CsvTable | null = null;
  const trace: Pipeline391Trace[] = [];
  let output = "";
  for (const [index, step] of recipe.steps.entries()) {
    checkCancel(options.signal);
    if (step.kind === "filter") {
      const input = step.table === "left" ? left : step.table === "right" ? right : current!;
      const result = filterTable(input, { column: step.column, operator: step.operator, value: step.value });
      if (step.table === "left") left = result.table;
      else if (step.table === "right") right = result.table;
      else current = result.table;
      trace.push({ step: index + 1, operation: "filter", inputRows: input.rows.length, outputRows: result.table.rows.length,
        explanation: `Filtro ${step.table} sulla colonna ${step.column + 1} (${step.operator}): ${result.matchedRows} righe conservate, ${result.rejectedRows} escluse.` });
    } else if (step.kind === "join") {
      const result = joinCsvTables(left, right, {
        leftKeyColumns: step.leftKeyColumns, rightKeyColumns: step.rightKeyColumns, joinType: step.joinType,
        caseSensitive: true, nullTokens: ["NULL"], emptyAsNull: true, nullKeyPolicy: "never-match",
      });
      current = result.table;
      trace.push({ step: index + 1, operation: "join", inputRows: left.rows.length + right.rows.length, outputRows: current.rows.length,
        explanation: `Join ${step.joinType} su chiavi esplicite: ${result.matchedRows} corrispondenze; NULL e celle vuote non si associano.` });
    } else {
      output = serializeCsvTable(current!);
      trace.push({ step: index + 1, operation: "export", inputRows: current!.rows.length, outputRows: current!.rows.length,
        explanation: `Esportazione CSV UTF-8 con ${current!.rows.length} righe; originale non modificato.` });
    }
  }
  checkCancel(options.signal);
  const outputSha256 = await hashText(output);
  checkCancel(options.signal);
  if (recipe.expected !== undefined && recipe.expected.outputSha256 !== outputSha256) throw new Error("PIPELINE_REPLAY_HASH_MISMATCH");
  return { output, outputSha256, sourceSha256, trace };
}
