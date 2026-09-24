import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { dedupeCsvTable, mapCsvColumns, parseCsvTable, parseCsvText } from "../../src/engines/table/csv";
import { csvColumnMapManifest } from "../../src/tools/csv-column-map/manifest";
import { csvDedupeManifest } from "../../src/tools/csv-dedupe/manifest";
import { currentRevision } from "../lib/current-revision";

const root = resolve(import.meta.dirname, "../..");
const revision = await currentRevision(root);
const receiptRoot = resolve(root, "quality/receipts/table-ops");
const indexText = await readFile(resolve(root, "quality/fixtures/index.json"), "utf8");
const registryText = await readFile(resolve(root, "quality/oracles/registry.json"), "utf8");
const engineText = await readFile(resolve(root, "src/engines/table/csv.ts"), "utf8");
const fixtureText = await readFile(resolve(root, "quality/fixtures/csv-table-ops/vectors.json"), "utf8");
const fixture = JSON.parse(fixtureText) as {
  schema_version: number;
  dedupe: Array<{ input:string; mode:"whole-row"|"key-columns"; key_columns?:number[]; expected:string; removed_rows:number }>;
  column_map: Array<{ input:string; mapping:Array<{source_index:number;output_name:string}>; expected:string; filled_missing_cells?:number }>;
};
const index = JSON.parse(indexText) as { schema_version:number; families:Array<{id:string;path:string;truth_sources:string[]}> };
const registry = JSON.parse(registryText) as { schema_version:number; entries:Array<{id:string;truth_sources:string[]}> };
const sha = (value:string) => createHash("sha256").update(value).digest("hex");

for (const vector of fixture.dedupe) {
  const options = { mode: vector.mode, ...(vector.key_columns === undefined ? {} : { keyColumns: vector.key_columns }) };
  const result = dedupeCsvTable(parseCsvTable(vector.input), options);
  if (result.output !== vector.expected || result.removedRows !== vector.removed_rows) throw new Error(`dedupe fixture mismatch: ${vector.input}`);
  const repeated = dedupeCsvTable(parseCsvTable(result.output), options);
  if (repeated.output !== result.output) throw new Error("dedupe idempotence mismatch");
  parseCsvText(result.output);
}

for (const vector of fixture.column_map) {
  const result = mapCsvColumns(
    parseCsvTable(vector.input),
    vector.mapping.map((entry) => ({ sourceIndex: entry.source_index, outputName: entry.output_name })),
  );
  if (result.output !== vector.expected || result.filledMissingCells !== (vector.filled_missing_cells ?? 0)) {
    throw new Error(`column-map fixture mismatch: ${vector.input}`);
  }
  parseCsvText(result.output);
}

function fixtureIndexEntry(id:string) {
  const entry = index.families.find((candidate) => candidate.id === id);
  if (entry === undefined) throw new Error(`${id} fixture index entry missing`);
  return entry;
}
const fixtureEntry = fixtureIndexEntry("csv-table-ops");
const rfcEntry = fixtureIndexEntry("csv-rfc4180");

function oracle(id:string) {
  const entry = registry.entries.find((candidate) => candidate.id === id);
  if (entry === undefined) throw new Error(`oracle missing: ${id}`);
  return entry;
}

await mkdir(receiptRoot, { recursive:true });

async function certify(options: {
  manifest: typeof csvDedupeManifest | typeof csvColumnMapManifest;
  exactVectors: number;
  oracleIds: string[];
  properties: string[];
}) {
  if (options.manifest.runtime.location !== "LOCAL" || options.manifest.runtime.network !== "forbidden") throw new Error(`${options.manifest.id}: privacy policy mismatch`);
  const oracleEntries = options.oracleIds.map(oracle);
  const rfcText = await readFile(resolve(root, rfcEntry.path), "utf8");
  const receipt = {
    schemaVersion: 1,
    status: "GOLD",
    revision,
    toolId: options.manifest.id,
    runtime: options.manifest.runtime,
    engineVersion: "1",
    oracleEntryId: options.manifest.gold.oracleEntryId,
    oracleEntryIds: options.oracleIds,
    fixtureFamilies: options.manifest.gold.fixtureFamilies,
    exactVectors: options.exactVectors,
    properties: options.properties,
    independentValidation: "Every produced CSV is reparsed through the pinned production parser; expected outputs remain hand-authored literals.",
    truthSources: [...new Set([...fixtureEntry.truth_sources, ...rfcEntry.truth_sources, ...oracleEntries.flatMap((entry) => entry.truth_sources)])].sort(),
    identities: {
      engineSha256: sha(engineText),
      fixtureSha256: sha(fixtureText),
      rfcFixtureSha256: sha(rfcText),
      fixtureIndexSha256: sha(indexText),
      oracleRegistrySha256: sha(registryText),
    },
  };
  await writeFile(resolve(receiptRoot, `${options.manifest.id}.gold.json`), `${JSON.stringify(receipt, null, 2)}\n`);
  console.log(`Gold PASS: ${options.manifest.id}, ${options.exactVectors} exact vector(s)`);
}

await certify({
  manifest: csvDedupeManifest,
  exactVectors: fixture.dedupe.length,
  oracleIds: ["cand-025"],
  properties: ["stable first occurrence", "idempotent under same rule", "empty all-key rows stay distinct", "duplicate headers addressed by index"],
});
await certify({
  manifest: csvColumnMapManifest,
  exactVectors: fixture.column_map.length,
  oracleIds: ["cand-027", "cand-026"],
  properties: ["source-index mapping", "unique output headers", "explicit dropped columns", "ragged selected cells become disclosed blanks"],
});
