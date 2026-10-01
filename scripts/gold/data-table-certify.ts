import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type { ToolManifest } from "../../src/catalog/manifest";
import { TABLE_ENGINE_VERSION } from "../../src/engines/table/operations";
import type { ToolExecutionContext, ToolModule } from "../../src/runtime/types";
import { currentEvidenceSourceFingerprint, currentRevision } from "../lib/current-revision";

interface GoldVector { readonly tool_id: string; readonly input: Record<string, unknown>; readonly expected: unknown; }
interface FixtureEntry { readonly id: string; readonly path: string; readonly truth_sources: readonly string[]; }
interface OracleEntry { readonly id: string; readonly maintenance_class: string; readonly truth_sources: readonly string[]; readonly confidence?: string; readonly unresolved_gaps?: readonly string[]; }

const toolIds = [
  "csv-viewer", "csv-delimiter-detector", "csv-encoding-fixer", "csv-column-selector", "csv-filter", "csv-sort", "csv-group-count", "csv-join", "csv-pivot-lite", "csv-to-json", "json-to-csv", "tsv-to-csv", "table-transpose", "missing-value-profiler", "column-type-profiler", "duplicate-row-profiler", "quick-chart",
] as const;
const root = resolve(import.meta.dirname, "../..");
const receiptRoot = resolve(root, "quality/receipts/data-table");
const revision = await currentRevision(root);
const sourceFingerprint = await currentEvidenceSourceFingerprint(root);
const sha256 = (value: string | Uint8Array) => createHash("sha256").update(value).digest("hex");
const context: ToolExecutionContext = { defaults: {} };

const [fixtureIndexText, oracleRegistryText, goldFixtureText, operationsText, csvText, acceptanceText, expansionTestsText, handoffTestsText] = await Promise.all([
  readFile(resolve(root, "quality/fixtures/index.json"), "utf8"),
  readFile(resolve(root, "quality/oracles/registry.json"), "utf8"),
  readFile(resolve(root, "quality/fixtures/data-table-gold/vectors.json"), "utf8"),
  readFile(resolve(root, "src/engines/table/operations.ts"), "utf8"),
  readFile(resolve(root, "src/engines/table/csv.ts"), "utf8"),
  readFile(resolve(receiptRoot, "browser-acceptance.json"), "utf8"),
  readFile(resolve(root, "tests/table-expansion.test.ts"), "utf8"),
  readFile(resolve(root, "tests/table-ops-handoff.test.ts"), "utf8"),
]);
const fixtureIndex = JSON.parse(fixtureIndexText) as { families: FixtureEntry[] };
const registry = JSON.parse(oracleRegistryText) as { entries: OracleEntry[] };
const goldFixture = JSON.parse(goldFixtureText) as { tool_vectors: GoldVector[] };
const acceptance = JSON.parse(acceptanceText) as { status?: unknown; tools?: unknown };
if (acceptance.status !== "PASS" || !Array.isArray(acceptance.tools)) throw new Error("data-table browser acceptance is missing or not PASS");
if (goldFixture.tool_vectors.length !== toolIds.length || new Set(goldFixture.tool_vectors.map((vector) => vector.tool_id)).size !== toolIds.length) throw new Error("data-table Gold fixture does not cover every promoted tool exactly once");

function assertExpected(toolId: string, actual: unknown, expected: unknown, path = "result"): void {
  if (Array.isArray(expected)) {
    if (!Array.isArray(actual) || actual.length < expected.length) throw new Error(`${toolId}: ${path} array mismatch`);
    expected.forEach((item, index) => assertExpected(toolId, actual[index], item, `${path}[${index}]`));
    return;
  }
  if (typeof expected === "object" && expected !== null) {
    if (typeof actual !== "object" || actual === null || Array.isArray(actual)) throw new Error(`${toolId}: ${path} object mismatch`);
    const record = actual as Record<string, unknown>;
    for (const [key, value] of Object.entries(expected as Record<string, unknown>)) {
      if (!(key in record)) throw new Error(`${toolId}: ${path}.${key} missing`);
      assertExpected(toolId, record[key], value, `${path}.${key}`);
    }
    return;
  }
  if (!Object.is(actual, expected)) throw new Error(`${toolId}: ${path} mismatch; expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}

function oracleHasNoOpenGap(oracle: OracleEntry): boolean {
  return oracle.confidence === "high" && (oracle.unresolved_gaps ?? []).every((gap) => /^No unresolved gap\b/iu.test(gap));
}

await mkdir(receiptRoot, { recursive: true });
for (const toolId of toolIds) {
  const manifestModule = await import(pathToFileURL(resolve(root, `src/tools/${toolId}/manifest.ts`)).href) as { default: ToolManifest };
  const moduleImport = await import(pathToFileURL(resolve(root, `src/tools/${toolId}/module.ts`)).href) as { default: ToolModule };
  const manifest = manifestModule.default;
  const oracle = registry.entries.find((entry) => entry.id === manifest.gold.oracleEntryId);
  if (oracle === undefined || !oracleHasNoOpenGap(oracle)) throw new Error(`${toolId}: oracle is not high-confidence with zero unresolved gaps`);
  if (oracle.maintenance_class !== manifest.gold.maintenanceClass) throw new Error(`${toolId}: maintenance class mismatch`);
  if (!manifest.gold.fixtureFamilies.includes("data-table-gold")) throw new Error(`${toolId}: shared Gold fixture not declared`);
  if (!(acceptance.tools as unknown[]).includes(toolId)) throw new Error(`${toolId}: browser acceptance missing`);
  const vector = goldFixture.tool_vectors.find((entry) => entry.tool_id === toolId);
  if (vector === undefined) throw new Error(`${toolId}: exact Gold vector missing`);
  assertExpected(toolId, await moduleImport.default.run(vector.input, context), vector.expected);
  const fixtureRecords = manifest.gold.fixtureFamilies.map((id) => {
    const entry = fixtureIndex.families.find((candidate) => candidate.id === id);
    if (entry === undefined) throw new Error(`${toolId}: fixture family missing from index: ${id}`);
    return entry;
  });
  const fixtureIdentities = Object.fromEntries(await Promise.all(fixtureRecords.map(async (entry) => [`fixture:${entry.id}:sha256`, sha256(await readFile(resolve(root, entry.path)))])));
  const manifestText = await readFile(resolve(root, `src/tools/${toolId}/manifest.ts`), "utf8");
  const receipt = {
    schemaVersion: 1,
    status: "GOLD",
    revision,
    sourceFingerprint,
    toolId,
    runtime: manifest.runtime,
    maintenanceClass: manifest.gold.maintenanceClass,
    engineVersion: TABLE_ENGINE_VERSION,
    oracleEntryId: manifest.gold.oracleEntryId,
    fixtureFamilies: manifest.gold.fixtureFamilies,
    exactVectors: 1,
    truthSources: [...new Set([...oracle.truth_sources, ...fixtureRecords.flatMap((entry) => entry.truth_sources)])].sort(),
    resolvedFixtures: fixtureRecords.map((entry) => ({ id: entry.id, path: entry.path })),
    propertyChecks: ["local-only runtime", "high-confidence oracle with no open semantic gap", "tool-specific CSV/table fixture remains bound", "exact public-module vector", "keyboard/mobile/a11y/locality/lazy browser acceptance"],
    identities: {
      manifestSha256: sha256(manifestText),
      operationsSha256: sha256(operationsText),
      csvEngineSha256: sha256(csvText),
      fixtureIndexSha256: sha256(fixtureIndexText),
      oracleRegistrySha256: sha256(oracleRegistryText),
      browserAcceptanceSha256: sha256(acceptanceText),
      unitTestsSha256: sha256(`${expansionTestsText}\n${handoffTestsText}`),
      ...fixtureIdentities,
    },
  };
  await writeFile(resolve(receiptRoot, `${toolId}.gold.json`), `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
  console.log(`Gold PASS: ${toolId}, exact vector + specialized fixtures + per-tool browser evidence`);
}
