// Reproduce with: npm install --prefix node_modules/str306-donor --no-save --no-package-lock --ignore-scripts microdiff@1.6.0
//                 node --expose-gc --import tsx src/tools/json-structural-diff/donor-comparison-306.mjs
import { performance } from "node:perf_hooks";
import microdiff from "../../../node_modules/str306-donor/node_modules/microdiff/dist/index.js";
import { jsonStructuralDiffOperation } from "../../engines/developer-web/structured-repair.ts";
import { parseJsonWithMetadata } from "../../engines/developer-web/structured-data.ts";

const kindOf = (value) => value === null ? "null" : Array.isArray(value) ? "array" : typeof value;
const pointer = (parts) => parts.map((part) => `/${String(part).replaceAll("~", "~0").replaceAll("/", "~1")}`).join("");

// An intentionally minimal mapping: it cannot supply reorder detection or own-key guarantees.
function normalizeDonor(changes) {
  return changes.map((change) => {
    const previous = kindOf(change.oldValue);
    const next = kindOf(change.value);
    const kind = change.type === "CREATE" ? "add"
      : change.type === "REMOVE" ? "remove"
      : previous === next ? "value" : "type";
    return { kind, path: pointer(change.path), leftType: previous, rightType: next };
  });
}

const cases = [
  ["root primitive", "1", "2"],
  ["root null", "null", "true"],
  ["array reorder", '{"items":[1,2]}', '{"items":[2,1]}'],
  ["nested reorder", '{"a":{"items":[{"x":1},{"x":2}]}}', '{"a":{"items":[{"x":2},{"x":1}]}}'],
  ["typed replacement", '{"value":1}', '{"value":"1"}'],
  ["added inherited-name key", '{}', '{"toString":"present"}'],
  ["removed inherited-name key", '{"constructor":"previous"}', '{}'],
  ["hostile __proto__ add", '{}', '{"__proto__":{"flag":true}}'],
  ["hostile __proto__ removal", '{"__proto__":{"flag":true}}', '{}'],
  ["pointer escaping", '{"a/b":1,"x~y":true}', '{"a/b":2,"x~y":false}'],
  ["nested add/remove", '{"nested":{"before":1}}', '{"nested":{"after":2}}'],
  ["equal", '{"same":[1,null]}', '{"same":[1,null]}'],
];

let divergent = 0;
for (const [name, left, right] of cases) {
  const expected = jsonStructuralDiffOperation(left, right).differences.map(({ kind, path, leftType, rightType }) => ({ kind, path, leftType, rightType }));
  const candidate = normalizeDonor(microdiff(parseJsonWithMetadata(left).value, parseJsonWithMetadata(right).value));
  const normalize = (arr) => arr.map(({ kind, path }) => `${kind}:${path}`).sort();
  const parity = JSON.stringify(normalize(expected)) === JSON.stringify(normalize(candidate));
  if (!parity) divergent++;
  console.log(JSON.stringify({ name, parity, local: expected, donor: candidate }));
}
console.log(`DIFFERENTIAL cases=${cases.length} divergent=${divergent}`);

const manyBefore = JSON.stringify({ a: Array.from({ length: 20_002 }, () => 0) });
const manyAfter = JSON.stringify({ a: Array.from({ length: 20_002 }, () => 1) });
try {
  jsonStructuralDiffOperation(manyBefore, manyAfter);
  console.log("LIMIT local=ACCEPTED_UNEXPECTEDLY");
} catch (error) {
  console.log(`LIMIT local=${error.code ?? error.name}`);
}
console.log(`LIMIT donor_differences=${microdiff(parseJsonWithMetadata(manyBefore).value, parseJsonWithMetadata(manyAfter).value).length}`);

const before = JSON.stringify({ blocks: Array.from({ length: 120 }, (_, i) => ({ id: i, tags: ["a", "b", "c"], payload: { value: i, enabled: true } })) });
const after = JSON.stringify({ blocks: Array.from({ length: 120 }, (_, i) => ({ id: i, tags: ["b", "a", "c"], payload: { value: i + 1, enabled: true } })) });
const iterations = 250;
function benchmark(label, operation) {
  globalThis.gc?.();
  let sampledHeapPeak = process.memoryUsage().heapUsed;
  let sampledRssPeak = process.memoryUsage().rss;
  operation();
  const start = performance.now();
  for (let index = 0; index < iterations; index++) {
    operation();
    if (index % 10 === 0) {
      const memory = process.memoryUsage();
      sampledHeapPeak = Math.max(sampledHeapPeak, memory.heapUsed);
      sampledRssPeak = Math.max(sampledRssPeak, memory.rss);
    }
  }
  console.log(`BENCH ${label} n=${iterations} bytes=${before.length} elapsed_ms=${(performance.now()-start).toFixed(2)} sampled_heap_mib=${(sampledHeapPeak/1048576).toFixed(2)} sampled_rss_mib=${(sampledRssPeak/1048576).toFixed(2)}`);
}
benchmark("local", () => jsonStructuralDiffOperation(before, after));
benchmark("donor+parser+mapper", () => normalizeDonor(microdiff(parseJsonWithMetadata(before).value, parseJsonWithMetadata(after).value)));
