// Reproducible comparison with the pre-#300 implementation. Run separately:
// node --expose-gc --import tsx scripts/benchmark-text-diff-300.ts legacy sparse
// node --expose-gc --import tsx scripts/benchmark-text-diff-300.ts donor sparse
import { performance } from "node:perf_hooks";
import { diffText, normalizeLineEndings, MAX_DIFF_CELLS } from "../src/engines/text-list";

type Operation = { kind: "equal" | "add" | "remove"; text: string };

function oldDiff(before: string, after: string): Operation[] {
  const tokenize = (text: string) => normalizeLineEndings(text).match(/[^\n]*\n|[^\n]+$/gu) ?? [];
  const left = tokenize(before);
  const right = tokenize(after);
  if ((left.length + 1) * (right.length + 1) > MAX_DIFF_CELLS) throw new Error("DIFF_TOO_LARGE");
  const rows = Array.from({ length: left.length + 1 }, () => new Uint32Array(right.length + 1));
  for (let i = left.length - 1; i >= 0; i -= 1) {
    for (let j = right.length - 1; j >= 0; j -= 1) {
      rows[i]![j] = left[i] === right[j]
        ? 1 + rows[i + 1]![j + 1]!
        : Math.max(rows[i + 1]![j]!, rows[i]![j + 1]!);
    }
  }
  const output: Operation[] = [];
  let i = 0;
  let j = 0;
  while (i < left.length || j < right.length) {
    if (i < left.length && j < right.length && left[i] === right[j]) {
      output.push({ kind: "equal", text: left[i++]! });
      j += 1;
    } else if (i < left.length && (j >= right.length || rows[i + 1]![j]! >= rows[i]![j + 1]!)) {
      output.push({ kind: "remove", text: left[i++]! });
    } else {
      output.push({ kind: "add", text: right[j++]! });
    }
  }
  return output;
}

const [algorithm, scenario] = process.argv.slice(2);
if ((algorithm !== "legacy" && algorithm !== "donor") || !["equal", "sparse", "distinct", "refusal"].includes(scenario ?? "")) {
  throw new Error("usage: benchmark-text-diff-300.ts legacy|donor equal|sparse|distinct|refusal");
}

const length = scenario === "distinct" ? 650 : scenario === "refusal" ? 1001 : 950;
const before = Array.from({ length }, (_, i) => `line-${i}\n`).join("");
const after = Array.from({ length }, (_, i) => (
  scenario === "distinct" ? `other-${i}\n`
    : scenario === "sparse" && i % 95 === 0 ? `changed-${i}\n`
      : `line-${i}\n`
)).join("");
const run = algorithm === "legacy" ? oldDiff : diffText;
const timings: number[] = [];
let operationCount = 0;
let refusal = false;
for (let index = 0; index < 5; index += 1) {
  global.gc?.();
  const started = performance.now();
  try {
    const operations = run(before, after);
    operationCount = operations.length;
    const reconstructedBefore = operations.filter(({ kind }) => kind !== "add").map(({ text }) => text).join("");
    const reconstructedAfter = operations.filter(({ kind }) => kind !== "remove").map(({ text }) => text).join("");
    if (reconstructedBefore !== before || reconstructedAfter !== after) {
      throw new Error(`EDIT_SCRIPT_NOT_REVERSIBLE input=${before.length}/${after.length} reconstructed=${reconstructedBefore.length}/${reconstructedAfter.length} first=${JSON.stringify(operations.slice(0, 4))}`);
    }
  } catch (error) {
    if (!(error instanceof Error) || error.message !== "DIFF_TOO_LARGE") throw error;
    refusal = true;
  }
  timings.push(Number((performance.now() - started).toFixed(3)));
}
console.log(JSON.stringify({
  algorithm, scenario, inputLines: length, outputOperations: operationCount, refusal,
  medianMs: [...timings].sort((a, b) => a - b)[2],
  timingsMs: timings,
  maxRssKb: process.resourceUsage().maxRSS,
  heapUsedMb: Number((process.memoryUsage().heapUsed / 1048576).toFixed(2)),
}));
