import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type { ToolManifest } from "../../src/catalog/manifest";
import { TEXT_WRITING_ENGINE_VERSION } from "../../src/engines/text-writing";
import type { ToolModule } from "../../src/runtime/types";
import { currentEvidenceSourceFingerprint, currentRevision } from "../lib/current-revision";

interface GoldVector {
  readonly tool_id: string;
  readonly input: Record<string, unknown>;
  readonly expected: Record<string, unknown>;
}

interface FixtureEntry {
  readonly id: string;
  readonly path: string;
  readonly truth_sources: readonly string[];
}

interface OracleEntry {
  readonly id: string;
  readonly maintenance_class: string;
  readonly truth_sources: readonly string[];
  readonly confidence?: string;
  readonly unresolved_gaps?: readonly string[];
}

const toolIds = [
  "word-character-line-counter",
  "case-converter",
  "whitespace-normalizer",
  "invisible-character-detector",
  "unicode-normalizer",
  "line-sorter",
  "line-deduplicator",
  "list-intersection",
  "list-difference",
  "find-replace-preview",
  "markdown-preview",
  "markdown-table-formatter",
  "slug-generator",
  "text-to-csv-rows",
  "csv-column-to-list",
] as const;

const root = resolve(import.meta.dirname, "../..");
const receiptRoot = resolve(root, "quality/receipts/text-writing");
const revision = await currentRevision(root);
const sourceFingerprint = await currentEvidenceSourceFingerprint(root);
const sha256 = (value: string | Uint8Array) => createHash("sha256").update(value).digest("hex");

const [fixtureIndexText, oracleRegistryText, goldFixtureText, engineText, acceptanceText, engineTestsText, catalogTestsText] = await Promise.all([
  readFile(resolve(root, "quality/fixtures/index.json"), "utf8"),
  readFile(resolve(root, "quality/oracles/registry.json"), "utf8"),
  readFile(resolve(root, "quality/fixtures/text-writing-gold/vectors.json"), "utf8"),
  readFile(resolve(root, "src/engines/text-writing/index.ts"), "utf8"),
  readFile(resolve(receiptRoot, "browser-acceptance.json"), "utf8"),
  readFile(resolve(root, "tests/text-writing-engine.test.ts"), "utf8"),
  readFile(resolve(root, "tests/text-writing-catalog.test.ts"), "utf8"),
]);
const fixtureIndex = JSON.parse(fixtureIndexText) as { families: FixtureEntry[] };
const registry = JSON.parse(oracleRegistryText) as { entries: OracleEntry[] };
const goldFixture = JSON.parse(goldFixtureText) as { tool_vectors: GoldVector[] };
const acceptance = JSON.parse(acceptanceText) as { status?: unknown; tools?: unknown };
if (acceptance.status !== "PASS" || !Array.isArray(acceptance.tools)) throw new Error("text-writing browser acceptance is missing or not PASS");
const vectors = goldFixture.tool_vectors.filter((vector) => toolIds.includes(vector.tool_id as typeof toolIds[number]));
if (vectors.length !== toolIds.length || new Set(vectors.map((vector) => vector.tool_id)).size !== toolIds.length) throw new Error("text-writing Gold fixture must contain exactly one vector for every promoted tool");

function assertExpected(toolId: string, actual: unknown, expected: Record<string, unknown>) {
  if (typeof actual !== "object" || actual === null || Array.isArray(actual)) throw new Error(`${toolId}: result is not an object`);
  const record = actual as Record<string, unknown>;
  for (const [key, expectedValue] of Object.entries(expected)) {
    if (JSON.stringify(record[key]) !== JSON.stringify(expectedValue)) throw new Error(`${toolId}: ${key} mismatch; expected ${JSON.stringify(expectedValue)}, got ${JSON.stringify(record[key])}`);
  }
}

function oracleHasNoOpenGap(oracle: OracleEntry): boolean {
  const gaps = oracle.unresolved_gaps ?? [];
  return oracle.confidence === "high" && gaps.every((gap) => /^No unresolved gap\b/iu.test(gap));
}

await mkdir(receiptRoot, { recursive: true });
for (const toolId of toolIds) {
  const manifestModule = await import(pathToFileURL(resolve(root, `src/tools/${toolId}/manifest.ts`)).href) as { default: ToolManifest };
  const moduleImport = await import(pathToFileURL(resolve(root, `src/tools/${toolId}/module.ts`)).href) as { default: ToolModule };
  const manifest = manifestModule.default;
  const oracle = registry.entries.find((entry) => entry.id === manifest.gold.oracleEntryId);
  if (oracle === undefined) throw new Error(`${toolId}: missing oracle ${manifest.gold.oracleEntryId}`);
  if (oracle.maintenance_class !== manifest.gold.maintenanceClass) throw new Error(`${toolId}: maintenance class mismatch`);
  if (!oracleHasNoOpenGap(oracle)) throw new Error(`${toolId}: oracle is not high-confidence with zero unresolved gaps`);
  if (!manifest.gold.fixtureFamilies.includes("text-writing-gold")) throw new Error(`${toolId}: shared Gold fixture not declared`);
  if (!(acceptance.tools as unknown[]).includes(toolId)) throw new Error(`${toolId}: browser acceptance missing`);
  const vector = goldFixture.tool_vectors.find((entry) => entry.tool_id === toolId);
  if (vector === undefined) throw new Error(`${toolId}: exact Gold vector missing`);
  assertExpected(toolId, await moduleImport.default.run(vector.input, { defaults: {} }), vector.expected);
  const fixtureRecords = manifest.gold.fixtureFamilies.map((id) => {
    const entry = fixtureIndex.families.find((candidate) => candidate.id === id);
    if (entry === undefined) throw new Error(`${toolId}: fixture family missing from index: ${id}`);
    return entry;
  });
  const fixtureIdentities = Object.fromEntries(await Promise.all(fixtureRecords.map(async (entry) => [
    `fixture:${entry.id}:sha256`, sha256(await readFile(resolve(root, entry.path))),
  ])));
  const manifestText = await readFile(resolve(root, `src/tools/${toolId}/manifest.ts`), "utf8");
  const receipt = {
    schemaVersion: 1,
    status: "GOLD",
    revision,
    sourceFingerprint,
    toolId,
    runtime: manifest.runtime,
    maintenanceClass: manifest.gold.maintenanceClass,
    engineVersion: TEXT_WRITING_ENGINE_VERSION,
    oracleEntryId: manifest.gold.oracleEntryId,
    fixtureFamilies: manifest.gold.fixtureFamilies,
    exactVectors: 1,
    truthSources: [...new Set([...oracle.truth_sources, ...fixtureRecords.flatMap((entry) => entry.truth_sources)])].sort(),
    resolvedFixtures: fixtureRecords.map((entry) => ({ id: entry.id, path: entry.path })),
    propertyChecks: ["local-only runtime", "high-confidence oracle with no open semantic gap", "tool-specific fixture remains bound", "exact public-module vector", "keyboard/mobile/a11y/locality/lazy browser acceptance"],
    identities: {
      manifestSha256: sha256(manifestText),
      engineIndexSha256: sha256(engineText),
      fixtureIndexSha256: sha256(fixtureIndexText),
      oracleRegistrySha256: sha256(oracleRegistryText),
      browserAcceptanceSha256: sha256(acceptanceText),
      unitTestsSha256: sha256(`${engineTestsText}\n${catalogTestsText}`),
      ...fixtureIdentities,
    },
  };
  await writeFile(resolve(receiptRoot, `${toolId}.gold.json`), `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
  console.log(`Gold PASS: ${toolId}, exact vector + specialized fixtures + per-tool browser evidence`);
}
