import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { ToolManifest } from "../../src/catalog/manifest";
import { BUSINESS_MATH_ENGINE_VERSION, runBusinessOperation, type BusinessOperation } from "../../src/engines/business-math";
import { breakEvenManifest } from "../../src/tools/break-even/manifest";
import { capacityPlannerManifest } from "../../src/tools/capacity-planner/manifest";
import { currencyScenarioManifest } from "../../src/tools/currency-scenario/manifest";
import { discountImpactManifest } from "../../src/tools/discount-impact/manifest";
import { effectiveHourlyRateManifest } from "../../src/tools/effective-hourly-rate/manifest";
import { invoiceMathValidatorManifest } from "../../src/tools/invoice-math-validator/manifest";
import { invoiceNumberGeneratorManifest } from "../../src/tools/invoice-number-generator/manifest";
import { latePaymentInterestManifest } from "../../src/tools/late-payment-interest/manifest";
import { paymentFeeGrossUpManifest } from "../../src/tools/payment-fee-gross-up/manifest";
import { percentageHelperManifest } from "../../src/tools/percentage-helper/manifest";
import { projectProfitabilityManifest } from "../../src/tools/project-profitability/manifest";
import { proposalBudgetCheckerManifest } from "../../src/tools/proposal-budget-checker/manifest";
import { retainerCapacityManifest } from "../../src/tools/retainer-capacity/manifest";
import { scopeCreepCostManifest } from "../../src/tools/scope-creep-cost/manifest";
import { targetIncomeRateManifest } from "../../src/tools/target-income-rate/manifest";
import { utilizationCalculatorManifest } from "../../src/tools/utilization-calculator/manifest";
import { currentEvidenceSourceFingerprint, currentRevision } from "../lib/current-revision";

interface ToolVector {
  readonly tool_id: string;
  readonly operation: BusinessOperation;
  readonly input: Record<string, unknown>;
  readonly expected: Record<string, unknown>;
}

interface FixtureFile {
  readonly schema_version: number;
  readonly tool_vectors?: readonly ToolVector[];
}

interface FixtureIndexEntry {
  readonly id: string;
  readonly path: string;
  readonly truth_sources: readonly string[];
}

interface OracleEntry {
  readonly id: string;
  readonly maintenance_class: string;
  readonly truth_sources: readonly string[];
}

const root = resolve(import.meta.dirname, "../..");
const receiptRoot = resolve(root, "quality/receipts/business-math");
const revision = await currentRevision(root);
const sourceFingerprint = await currentEvidenceSourceFingerprint(root);
const sha256 = (value: string | Uint8Array) => createHash("sha256").update(value).digest("hex");

const manifests: readonly ToolManifest[] = [
  effectiveHourlyRateManifest,
  targetIncomeRateManifest,
  utilizationCalculatorManifest,
  capacityPlannerManifest,
  retainerCapacityManifest,
  scopeCreepCostManifest,
  breakEvenManifest,
  paymentFeeGrossUpManifest,
  latePaymentInterestManifest,
  discountImpactManifest,
  proposalBudgetCheckerManifest,
  projectProfitabilityManifest,
  invoiceNumberGeneratorManifest,
  invoiceMathValidatorManifest,
  percentageHelperManifest,
  currencyScenarioManifest,
];

const fixtureIndexText = await readFile(resolve(root, "quality/fixtures/index.json"), "utf8");
const oracleRegistryText = await readFile(resolve(root, "quality/oracles/registry.json"), "utf8");
const engineText = await readFile(resolve(root, "src/engines/business-math/index.ts"), "utf8");
const browserAcceptanceText = await readFile(resolve(receiptRoot, "browser-acceptance.json"), "utf8");
const unitTestsText = await readFile(resolve(root, "tests/business-tools.test.ts"), "utf8");
const fixtureIndex = JSON.parse(fixtureIndexText) as { schema_version: number; families: FixtureIndexEntry[] };
const oracleRegistry = JSON.parse(oracleRegistryText) as { schema_version: number; entries: OracleEntry[] };
const browserAcceptance = JSON.parse(browserAcceptanceText) as { status?: unknown; tools?: unknown };

if (browserAcceptance.status !== "PASS" || !Array.isArray(browserAcceptance.tools)) {
  throw new Error("business-math browser acceptance is missing or not PASS");
}

const fixtureCache = new Map<string, { entry: FixtureIndexEntry; text: string; value: FixtureFile }>();
for (const familyId of [...new Set(manifests.flatMap((manifest) => manifest.gold.fixtureFamilies))]) {
  const entry = fixtureIndex.families.find((candidate) => candidate.id === familyId);
  if (entry === undefined) throw new Error(`fixture family missing from index: ${familyId}`);
  const text = await readFile(resolve(root, entry.path), "utf8");
  fixtureCache.set(familyId, { entry, text, value: JSON.parse(text) as FixtureFile });
}

function assertExpected(toolId: string, actual: unknown, expected: Record<string, unknown>) {
  if (typeof actual !== "object" || actual === null || Array.isArray(actual)) throw new Error(`${toolId}: engine result is not an object`);
  const record = actual as Record<string, unknown>;
  for (const [key, expectedValue] of Object.entries(expected)) {
    if (JSON.stringify(record[key]) !== JSON.stringify(expectedValue)) {
      throw new Error(`${toolId}: fixture mismatch for ${key}: expected ${JSON.stringify(expectedValue)}, got ${JSON.stringify(record[key])}`);
    }
  }
}

await mkdir(receiptRoot, { recursive: true });
for (const manifest of manifests) {
  if (manifest.runtime.location !== "LOCAL" || manifest.runtime.network !== "forbidden") throw new Error(`${manifest.id}: Gold requires LOCAL/network-forbidden runtime`);
  const oracle = oracleRegistry.entries.find((entry) => entry.id === manifest.gold.oracleEntryId);
  if (oracle === undefined) throw new Error(`${manifest.id}: oracle missing: ${manifest.gold.oracleEntryId}`);
  if (oracle.maintenance_class !== manifest.gold.maintenanceClass) throw new Error(`${manifest.id}: oracle/manifest maintenance class mismatch`);
  if (!(browserAcceptance.tools as unknown[]).includes(manifest.id)) throw new Error(`${manifest.id}: browser acceptance does not cover tool`);
  const candidateVectors = manifest.gold.fixtureFamilies.flatMap((familyId) => fixtureCache.get(familyId)?.value.tool_vectors ?? []);
  const vector = candidateVectors.find((item) => item.tool_id === manifest.id);
  if (vector === undefined) throw new Error(`${manifest.id}: no independent tool vector in declared fixture families`);
  assertExpected(manifest.id, runBusinessOperation(vector.operation, vector.input), vector.expected);
  const manifestText = await readFile(resolve(root, `src/tools/${manifest.id}/manifest.ts`), "utf8");
  const fixtureIdentities = Object.fromEntries(manifest.gold.fixtureFamilies.map((familyId) => {
    const fixture = fixtureCache.get(familyId);
    if (fixture === undefined) throw new Error(`${manifest.id}: fixture cache missing ${familyId}`);
    return [`fixture:${familyId}:sha256`, sha256(fixture.text)];
  }));
  const truthSources = [...new Set([
    ...oracle.truth_sources,
    ...manifest.gold.fixtureFamilies.flatMap((familyId) => fixtureCache.get(familyId)?.entry.truth_sources ?? []),
  ])].sort();
  const receipt = {
    schemaVersion: 1,
    status: "GOLD",
    revision,
    sourceFingerprint,
    toolId: manifest.id,
    runtime: manifest.runtime,
    maintenanceClass: manifest.gold.maintenanceClass,
    engineVersion: BUSINESS_MATH_ENGINE_VERSION,
    oracleEntryId: manifest.gold.oracleEntryId,
    fixtureFamilies: manifest.gold.fixtureFamilies,
    exactVectors: 1,
    propertyChecks: ["exact decimal arithmetic", "final-only half-up rounding where declared", "invalid denominators remain typed errors"],
    truthSources,
    resolvedFixtures: manifest.gold.fixtureFamilies.map((familyId) => {
      const fixture = fixtureCache.get(familyId)!;
      return { id: familyId, path: fixture.entry.path };
    }),
    identities: {
      manifestSha256: sha256(manifestText),
      engineSha256: sha256(engineText),
      fixtureIndexSha256: sha256(fixtureIndexText),
      oracleRegistrySha256: sha256(oracleRegistryText),
      browserAcceptanceSha256: sha256(browserAcceptanceText),
      unitTestsSha256: sha256(unitTestsText),
      ...fixtureIdentities,
    },
  };
  await writeFile(resolve(receiptRoot, `${manifest.id}.gold.json`), `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
  console.log(`Gold PASS: ${manifest.id}, 1 exact independent vector + browser/locality/lazy evidence`);
}
