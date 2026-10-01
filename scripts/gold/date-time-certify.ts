import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type { ToolManifest } from "../../src/catalog/manifest";
import {
  addSubtractDaysManifest,
  ageDateAnniversaryManifest,
  calendarDateListGeneratorManifest,
  dateDifferenceManifest,
  deadlineCountdownManifest,
  decimalHoursConverterManifest,
  durationCalculatorManifest,
  epochBatchConverterManifest,
  icsEventBuilderManifest,
  icsViewerManifest,
  meetingTimePlannerManifest,
  quarterDateMapperManifest,
  recurringDateGeneratorManifest,
  timesheetTotalerManifest,
  timezoneConverterManifest,
  weekNumberConverterManifest,
  workingHoursManifest,
} from "../../src/date-time/manifest";
import { DATE_TIME_ENGINE_VERSION } from "../../src/engines/date-time";
import type { ToolExecutionContext, ToolModule } from "../../src/runtime/types";
import { currentEvidenceSourceFingerprint, currentRevision } from "../lib/current-revision";

interface GoldVector {
  readonly tool_id: string;
  readonly input: Record<string, unknown>;
  readonly expected: unknown;
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

const manifests: readonly ToolManifest[] = [
  dateDifferenceManifest,
  addSubtractDaysManifest,
  workingHoursManifest,
  timezoneConverterManifest,
  meetingTimePlannerManifest,
  durationCalculatorManifest,
  decimalHoursConverterManifest,
  timesheetTotalerManifest,
  weekNumberConverterManifest,
  quarterDateMapperManifest,
  deadlineCountdownManifest,
  recurringDateGeneratorManifest,
  ageDateAnniversaryManifest,
  calendarDateListGeneratorManifest,
  icsEventBuilderManifest,
  icsViewerManifest,
  epochBatchConverterManifest,
];

const root = resolve(import.meta.dirname, "../..");
const receiptRoot = resolve(root, "quality/receipts/date-time");
const revision = await currentRevision(root);
const sourceFingerprint = await currentEvidenceSourceFingerprint(root);
const sha256 = (value: string | Uint8Array) => createHash("sha256").update(value).digest("hex");
const context: ToolExecutionContext = {
  defaults: {
    timezone: { field: "timezone", value: "UTC", provenance: "profile" },
    locale: { field: "locale", value: "it-IT", provenance: "profile" },
  },
};

const [fixtureIndexText, oracleRegistryText, goldFixtureText, engineText, acceptanceText, engineTestsText, moduleTestsText] = await Promise.all([
  readFile(resolve(root, "quality/fixtures/index.json"), "utf8"),
  readFile(resolve(root, "quality/oracles/registry.json"), "utf8"),
  readFile(resolve(root, "quality/fixtures/date-time-gold/vectors.json"), "utf8"),
  readFile(resolve(root, "src/engines/date-time/index.ts"), "utf8"),
  readFile(resolve(receiptRoot, "browser-acceptance.json"), "utf8"),
  readFile(resolve(root, "tests/date-time-engine.test.ts"), "utf8"),
  readFile(resolve(root, "tests/date-time-modules.test.ts"), "utf8"),
]);
const fixtureIndex = JSON.parse(fixtureIndexText) as { families: FixtureEntry[] };
const registry = JSON.parse(oracleRegistryText) as { entries: OracleEntry[] };
const goldFixture = JSON.parse(goldFixtureText) as { tool_vectors: GoldVector[] };
const acceptance = JSON.parse(acceptanceText) as { status?: unknown; tools?: unknown };
if (acceptance.status !== "PASS" || !Array.isArray(acceptance.tools)) throw new Error("date-time browser acceptance is missing or not PASS");
if (goldFixture.tool_vectors.length !== manifests.length || new Set(goldFixture.tool_vectors.map((vector) => vector.tool_id)).size !== manifests.length) {
  throw new Error(`date-time Gold fixture must contain exactly one vector for each of ${manifests.length} promoted tools`);
}

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
  const gaps = oracle.unresolved_gaps ?? [];
  return oracle.confidence === "high" && gaps.every((gap) => /^No unresolved gap\b/iu.test(gap));
}

await mkdir(receiptRoot, { recursive: true });
for (const manifest of manifests) {
  const toolId = manifest.id;
  const oracle = registry.entries.find((entry) => entry.id === manifest.gold.oracleEntryId);
  if (oracle === undefined) throw new Error(`${toolId}: missing oracle ${manifest.gold.oracleEntryId}`);
  if (oracle.maintenance_class !== manifest.gold.maintenanceClass) throw new Error(`${toolId}: maintenance class mismatch`);
  if (!oracleHasNoOpenGap(oracle)) throw new Error(`${toolId}: oracle is not high-confidence with zero unresolved gaps`);
  if (!manifest.gold.fixtureFamilies.includes("date-time-gold")) throw new Error(`${toolId}: shared Gold fixture not declared`);
  if (!(acceptance.tools as unknown[]).includes(toolId)) throw new Error(`${toolId}: browser acceptance missing`);
  const vector = goldFixture.tool_vectors.find((entry) => entry.tool_id === toolId);
  if (vector === undefined) throw new Error(`${toolId}: exact Gold vector missing`);
  const moduleImport = await import(pathToFileURL(resolve(root, `src/tools/${toolId}/module.ts`)).href) as { default: ToolModule };
  assertExpected(toolId, await moduleImport.default.run(vector.input, context), vector.expected);
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
    engineVersion: DATE_TIME_ENGINE_VERSION,
    oracleEntryId: manifest.gold.oracleEntryId,
    fixtureFamilies: manifest.gold.fixtureFamilies,
    exactVectors: 1,
    truthSources: [...new Set([...oracle.truth_sources, ...fixtureRecords.flatMap((entry) => entry.truth_sources)])].sort(),
    resolvedFixtures: fixtureRecords.map((entry) => ({ id: entry.id, path: entry.path })),
    propertyChecks: [
      "local-only runtime",
      "high-confidence oracle with no open semantic gap",
      "specialized arithmetic/timezone/decimal/ICS fixture remains bound",
      "exact public-module vector",
      "keyboard/mobile/a11y/locality/lazy browser acceptance",
    ],
    identities: {
      manifestSha256: sha256(manifestText),
      engineIndexSha256: sha256(engineText),
      fixtureIndexSha256: sha256(fixtureIndexText),
      oracleRegistrySha256: sha256(oracleRegistryText),
      browserAcceptanceSha256: sha256(acceptanceText),
      unitTestsSha256: sha256(`${engineTestsText}\n${moduleTestsText}`),
      ...fixtureIdentities,
    },
  };
  await writeFile(resolve(receiptRoot, `${toolId}.gold.json`), `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
  console.log(`Gold PASS: ${toolId}, exact vector + specialized fixtures + per-tool browser evidence`);
}
