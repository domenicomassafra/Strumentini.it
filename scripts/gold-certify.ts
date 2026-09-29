import { createHash } from "node:crypto";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { businessDayManifest } from "../src/tools/business-day/manifest";
import { addBusinessDays, businessDaysBetween, BUSINESS_DAY_ENGINE_VERSION, type DayCode } from "../src/engines/date-time/business-days";
import type { ToolManifest } from "../src/catalog/manifest";
import { currentEvidenceSourceFingerprint, currentRevision } from "./lib/current-revision";

const root = resolve(import.meta.dirname, "..");
const revision = await currentRevision(root);
const sourceFingerprint = await currentEvidenceSourceFingerprint(root);
const sabotageMode = process.argv[process.argv.indexOf("--sabotage") + 1];
const manifest: ToolManifest = sabotageMode === "missing-oracle"
  ? { ...businessDayManifest, gold: { ...businessDayManifest.gold, fixtureFamilies: [] } }
  : sabotageMode === "privacy"
    ? { ...businessDayManifest, runtime: { location: "LOCAL", network: "required" } }
    : businessDayManifest;

function sha256(value: string | Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

const fixtureIndexPath = resolve(root, "quality/fixtures/index.json");
const registryPath = resolve(root, "quality/oracles/registry.json");
const enginePath = resolve(root, "src/engines/date-time/business-days.ts");
const manifestPath = resolve(root, "src/tools/business-day/manifest.ts");
const fixtureIndexText = await readFile(fixtureIndexPath, "utf8");
const registryText = await readFile(registryPath, "utf8");
const engineText = await readFile(enginePath, "utf8");
const manifestText = await readFile(manifestPath, "utf8");
const fixtureIndex = JSON.parse(fixtureIndexText) as {
  schema_version: number;
  families: Array<{ id: string; path: string; truth_sources: string[] }>;
};
const fixtureEntry = fixtureIndex.families.find((entry) => entry.id === "business-days");
if (fixtureEntry === undefined) {
  console.error("business-days fixture is absent from the canonical fixture index");
  process.exit(1);
}
const fixturePath = resolve(root, fixtureEntry.path);
const fixtureText = await readFile(fixturePath, "utf8");
const fixture = JSON.parse(fixtureText) as {
  schema_version: number;
  policy: { working_days: DayCode[] };
  vectors: Array<Record<string, string | number | string[]>>;
};
const registry = JSON.parse(registryText) as {
  schema_version: number;
  entries: Array<{ id: string; candidate: string; truth_sources: string[] }>;
};

const issues: string[] = [];
if (manifest.runtime.location !== "LOCAL" || manifest.runtime.network !== "forbidden") {
  issues.push("LOCAL privacy declaration is missing or contradictory");
}
if (manifest.gold.fixtureFamilies.length === 0) issues.push("required Gold fixture family is missing");
const oracleEntry = registry.entries.find((entry) => entry.id === manifest.gold.oracleEntryId);
if (oracleEntry === undefined) {
  issues.push(`oracle registry entry not found: ${manifest.gold.oracleEntryId}`);
}
if (!manifest.gold.fixtureFamilies.includes(fixtureEntry.id)) issues.push("business-days fixture is not declared");

let exactVectors = 0;
for (const vector of fixture.vectors) {
  const excludedDates = vector.excluded_dates as string[] | undefined;
  const calendar = excludedDates === undefined
    ? { workweek: (vector.working_days as DayCode[] | undefined) ?? fixture.policy.working_days }
    : {
        workweek: (vector.working_days as DayCode[] | undefined) ?? fixture.policy.working_days,
        excludedDates,
      };
  if ("add_business_days" in vector) {
    const actual = addBusinessDays(String(vector.start), Number(vector.add_business_days), {
      ...calendar,
    });
    if (actual !== vector.expected) issues.push(`fixture mismatch: ${JSON.stringify(vector)} -> ${actual}`);
  } else {
    const actual = businessDaysBetween(
      String(vector.start),
      String(vector.business_days_until),
      calendar,
    );
    if (actual !== vector.expected) issues.push(`fixture mismatch: ${JSON.stringify(vector)} -> ${actual}`);
  }
  exactVectors += 1;
}

if (issues.length > 0) {
  console.error(issues.join("\n"));
  process.exit(1);
}

const receipt = {
  schemaVersion: 1,
  toolId: manifest.id,
  status: "GOLD",
  revision,
  sourceFingerprint,
  runtime: manifest.runtime,
  maintenanceClass: manifest.gold.maintenanceClass,
  oracleEntryId: manifest.gold.oracleEntryId,
  fixtureFamilies: manifest.gold.fixtureFamilies,
  exactVectors,
  engineVersion: BUSINESS_DAY_ENGINE_VERSION,
  oracleRegistrySchemaVersion: registry.schema_version,
  fixtureIndexSchemaVersion: fixtureIndex.schema_version,
  fixtureSchemaVersion: fixture.schema_version,
  truthSources: oracleEntry?.truth_sources ?? fixtureEntry.truth_sources,
  resolvedFixtures: [{ id: fixtureEntry.id, path: fixtureEntry.path }],
  identities: {
    manifestSha256: sha256(manifestText),
    engineSha256: sha256(engineText),
    fixtureSha256: sha256(fixtureText),
    fixtureIndexSha256: sha256(fixtureIndexText),
    oracleRegistrySha256: sha256(registryText),
  },
};

await mkdir(resolve(root, "quality/receipts"), { recursive: true });
await writeFile(
  resolve(root, "quality/receipts/business-day.gold.json"),
  `${JSON.stringify(receipt, null, 2)}\n`,
  "utf8",
);
console.log(`Gold PASS: ${manifest.id}, ${exactVectors} independent exact vector(s)`);
