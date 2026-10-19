// #275 — Node microbenchmark: historical hand-written YAML formatter vs lazily adopted yaml@2.9.1.
//   node --expose-gc --import tsx scripts/benchmark-yaml-275.mjs [iterations]
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { formatYaml, parseYaml } from "../src/engines/developer-web/structured-data.ts";
import { yamlFormatterOperation } from "../src/engines/developer-web/index.ts";

const root = resolve(import.meta.dirname, "..");
const corpus = JSON.parse(await readFile(resolve(root, "quality/fixtures/yaml-275/corpus.json"), "utf8")).fixtures
  .filter((fixture) => fixture.id !== "merge-keys-refused");
const iterations = Number(process.argv[2] ?? 200);
const shared = corpus.filter((fixture) => {
  try {
    formatYaml(parseYaml(fixture.source).value);
    return true;
  } catch {
    return false;
  }
});

async function measure(label, fixtures, run, repeat) {
  if (typeof globalThis.gc === "function") globalThis.gc();
  const baseline = process.memoryUsage().heapUsed;
  let peak = baseline;
  const started = process.hrtime.bigint();
  for (let index = 0; index < repeat; index += 1) {
    for (const source of fixtures) {
      await run(source);
      if (index % 20 === 0) peak = Math.max(peak, process.memoryUsage().heapUsed);
    }
  }
  const elapsedMs = Number(process.hrtime.bigint() - started) / 1e6;
  const operations = repeat * fixtures.length;
  console.log(JSON.stringify({
    implementation: label,
    fixtures: fixtures.length,
    operations,
    elapsedMs: Number(elapsedMs.toFixed(1)),
    microsecondsPerOperation: Number(((elapsedMs * 1000) / operations).toFixed(2)),
    peakHeapDeltaBytes: peak - baseline,
  }));
}

const sources = shared.map((fixture) => fixture.source);
for (const source of sources) await yamlFormatterOperation(source);
await measure("legacy-hand-written", sources, (source) => { formatYaml(parseYaml(source).value); }, iterations);
await measure("yaml-2.9.1-lazy", sources, (source) => yamlFormatterOperation(source), iterations);

function serviceDocument(rows) {
  const body = Array.from({ length: rows }, (_, index) => `  - id: ${index}\n    name: servizio-${index}\n    ports: [80, 443]\n    enabled: ${index % 2 === 0}`).join("\n");
  return `service:\n  name: demo\nworkers:\n${body}\n`;
}
for (const rows of [20, 200, 2000, 12000]) {
  const source = serviceDocument(rows);
  await yamlFormatterOperation(source);
  const legacyStarted = process.hrtime.bigint();
  formatYaml(parseYaml(source).value);
  const legacyMs = Number(process.hrtime.bigint() - legacyStarted) / 1e6;
  const donorStarted = process.hrtime.bigint();
  await yamlFormatterOperation(source);
  const donorMs = Number(process.hrtime.bigint() - donorStarted) / 1e6;
  console.log(JSON.stringify({
    synthetic: `${rows} rows`,
    sourceBytes: new TextEncoder().encode(source).length,
    legacyMs: Number(legacyMs.toFixed(2)),
    donorMs: Number(donorMs.toFixed(2)),
    donorToLegacyRatio: Number((donorMs / legacyMs).toFixed(2)),
  }));
}
