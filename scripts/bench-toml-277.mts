import { readFile } from "node:fs/promises";
import { performance } from "node:perf_hooks";
import { formatToml, parseToml, tomlFormatterOperation } from "../src/engines/developer-web/structured-data";

const corpus = JSON.parse(await readFile(new URL("../tests/fixtures/toml-277/corpus.json", import.meta.url), "utf8")) as { fixtures: Array<{ id: string; source: string }> };
const input = corpus.fixtures.find((row) => row.id === "tables")!.source;
const runs = 2_000;
const paths = [
  { name: "legacy", run: async () => formatToml(parseToml(input).value) },
  { name: "smol-toml-adapter", run: async () => String((await tomlFormatterOperation(input)).formatted) },
];
for (const path of paths) {
  for (let i = 0; i < 25; i++) await path.run();
  globalThis.gc?.();
  const firstHeap = process.memoryUsage().heapUsed;
  let peakHeap = firstHeap;
  const start = performance.now();
  for (let i = 0; i < runs; i++) {
    await path.run();
    if (i % 25 === 0) peakHeap = Math.max(peakHeap, process.memoryUsage().heapUsed);
  }
  const milliseconds = performance.now() - start;
  process.stdout.write(JSON.stringify({
    name: path.name,
    runs,
    inputBytes: Buffer.byteLength(input),
    msTotal: Number(milliseconds.toFixed(2)),
    msPerOperation: Number((milliseconds / runs).toFixed(4)),
    sampledHeapDeltaBytes: Math.max(0, peakHeap - firstHeap),
  }) + "\n");
}
