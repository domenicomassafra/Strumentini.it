/** Reproducible #301 local benchmark: npx tsx scripts/benchmark-html-entity-301.ts */
import { performance } from "node:perf_hooks";
import { htmlEntityOperation } from "../src/engines/developer-web";

const fixtures = [
  { label: "encode-64k", input: "<Caffè & ©> ' ".repeat(4_096), mode: "encode" },
  { label: "decode-64k", input: "&copy; &euro; &NotEqualTilde; ".repeat(2_200), mode: "decode" },
  { label: "decode-1m", input: "&copy;".repeat(166_666), mode: "decode" },
] as const;

const summary = (values: number[]) => {
  const sorted = values.toSorted((a, b) => a - b);
  return { medianMs: Number(sorted[Math.floor(sorted.length / 2)]!.toFixed(3)), p95Ms: Number(sorted[Math.ceil(sorted.length * 0.95) - 1]!.toFixed(3)) };
};

for (const { label, input, mode } of fixtures) {
  const runs = label === "decode-1m" ? 3 : 12;
  const elapsed: number[] = [];
  let maxHeapAfterCall = 0;
  let maxRssAfterCall = 0;
  for (let index = 0; index < runs; index += 1) {
    const start = performance.now();
    await htmlEntityOperation(input, mode);
    elapsed.push(performance.now() - start);
    const memory = process.memoryUsage();
    maxHeapAfterCall = Math.max(maxHeapAfterCall, memory.heapUsed);
    maxRssAfterCall = Math.max(maxRssAfterCall, memory.rss);
  }
  const stats = [{ name: "he-2.0.0", ...summary(elapsed), sampledHeapAfterCallsMiB: Number((maxHeapAfterCall / 1_048_576).toFixed(2)), sampledRssAfterCallsMiB: Number((maxRssAfterCall / 1_048_576).toFixed(2)) }];
  console.log(JSON.stringify({ label, characters: input.length, runs, stats }));
}
