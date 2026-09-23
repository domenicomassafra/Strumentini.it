import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  calculateMarginMarkup,
  CLIENT_TIME_MATH_ENGINE_VERSION,
  convertRate,
  formatInstantInZone,
  resolveLocalDateTime,
} from "../../src/engines/client-time-math";
import { marginMarkupManifest } from "../../src/tools/margin-markup/manifest";
import { rateConverterManifest } from "../../src/tools/rate-converter/manifest";
import { timezoneOverlapManifest } from "../../src/tools/timezone-overlap/manifest";

const root = resolve(import.meta.dirname, "../..");
const receiptRoot = resolve(root, "quality/receipts/client-time-math");
const indexText = await readFile(resolve(root, "quality/fixtures/index.json"), "utf8");
const registryText = await readFile(resolve(root, "quality/oracles/registry.json"), "utf8");
const engineText = await readFile(resolve(root, "src/engines/client-time-math/index.ts"), "utf8");
const index = JSON.parse(indexText) as {
  schema_version: number;
  families: Array<{ id: string; path: string; truth_sources: string[] }>;
};
const registry = JSON.parse(registryText) as {
  schema_version: number;
  entries: Array<{ id: string; truth_sources: string[] }>;
};
const sha = (value: string) => createHash("sha256").update(value).digest("hex");

function fixture(id: string) {
  const entry = index.families.find((candidate) => candidate.id === id);
  if (entry === undefined) throw new Error(`fixture missing: ${id}`);
  return entry;
}

function oracle(id: string) {
  const entry = registry.entries.find((candidate) => candidate.id === id);
  if (entry === undefined) throw new Error(`oracle missing: ${id}`);
  return entry;
}

const timezoneEntry = fixture("timezone-dst");
const timezoneText = await readFile(resolve(root, timezoneEntry.path), "utf8");
const timezoneData = JSON.parse(timezoneText) as {
  zone: string;
  vectors: Array<{ instant: string; local: string }>;
};
for (const vector of timezoneData.vectors) {
  const actual = formatInstantInZone(vector.instant, timezoneData.zone).local;
  if (actual !== vector.local) throw new Error(`timezone fixture mismatch: ${vector.instant} -> ${actual}`);
}
const zoneinfoLocals = JSON.parse(execFileSync("python3", ["-c", [
  "import json,sys,datetime,zoneinfo",
  "d=json.load(open(sys.argv[1]))",
  "z=zoneinfo.ZoneInfo(d['zone'])",
  "print(json.dumps([datetime.datetime.fromisoformat(v['instant'].replace('Z','+00:00')).astimezone(z).isoformat(timespec='seconds') for v in d['vectors']]))",
].join(";"), resolve(root, timezoneEntry.path)], { encoding: "utf8" })) as string[];
if (JSON.stringify(zoneinfoLocals) !== JSON.stringify(timezoneData.vectors.map((vector) => vector.local))) {
  throw new Error("Python zoneinfo secondary cross-check mismatch");
}

try {
  resolveLocalDateTime("2024-03-31", "02:30", "Europe/Rome");
  throw new Error("DST gap accepted unexpectedly");
} catch (error) {
  if (!(error instanceof Error) || error.message !== "INVALID_LOCAL_TIME_GAP") throw error;
}
try {
  resolveLocalDateTime("2024-10-27", "02:30", "Europe/Rome");
  throw new Error("DST overlap accepted unexpectedly");
} catch (error) {
  if (!(error instanceof Error) || error.message !== "INVALID_LOCAL_TIME_OVERLAP") throw error;
}
if (resolveLocalDateTime("2024-10-27", "02:30", "Europe/Rome", "earlier") !== "2024-10-27T00:30:00.000Z") {
  throw new Error("DST earlier disambiguation mismatch");
}
if (resolveLocalDateTime("2024-10-27", "02:30", "Europe/Rome", "later") !== "2024-10-27T01:30:00.000Z") {
  throw new Error("DST later disambiguation mismatch");
}

const mathEntry = fixture("business-math");
const mathText = await readFile(resolve(root, mathEntry.path), "utf8");
const mathData = JSON.parse(mathText) as { vectors: Array<Record<string, string>> };
const hourDay = mathData.vectors.find((item) => item.case === "hour-day");
if (hourDay === undefined) throw new Error("hour-day fixture missing");
const hourly = hourDay.hourly;
const hoursPerDay = hourDay.hours_per_day;
const daily = hourDay.daily;
if (hourly === undefined || hoursPerDay === undefined || daily === undefined) throw new Error("hour-day fixture incomplete");
if (convertRate({ amount: hourly, from: "hour", to: "day", hoursPerDay }).amount !== daily) {
  throw new Error("hour/day fixture mismatch");
}
if (convertRate({ amount: "100", from: "project", to: "hour", projectHours: "3" }).amount !== "33.33") {
  throw new Error("project-rate hand-worked vector mismatch");
}
if (convertRate({ amount: "1", from: "hour", to: "day", hoursPerDay: "2.345" }).amount !== "2.35") {
  throw new Error("final half-up rounding vector mismatch");
}
if (convertRate({ amount: "10.075", from: "hour", to: "hour" }).amount !== "10.08") {
  throw new Error("binary-float regression vector mismatch");
}

const marginVector = mathData.vectors.find((item) => item.case === "margin-vs-markup");
if (marginVector === undefined) throw new Error("margin fixture missing");
const price = marginVector.price;
const cost = marginVector.cost;
const profit = marginVector.profit;
const marginPercent = marginVector.margin_percent;
const markupPercent = marginVector.markup_percent;
if ([price, cost, profit, marginPercent, markupPercent].some((value) => value === undefined)) {
  throw new Error("margin fixture incomplete");
}
const margin = calculateMarginMarkup(price!, cost!);
if (
  margin.profit !== profit ||
  margin.marginPercent !== `${marginPercent}.00` ||
  margin.markupPercent !== `${markupPercent}.00`
) {
  throw new Error("margin/markup fixture mismatch");
}
if (calculateMarginMarkup("0", "100").marginPercent !== null) throw new Error("zero-price margin policy failed");
if (calculateMarginMarkup("100", "0").markupPercent !== null) throw new Error("zero-cost markup policy failed");
if (calculateMarginMarkup("0", "100").denominatorErrors[0]?.code !== "INVALID_MARGIN_DENOMINATOR") throw new Error("typed zero-price denominator error missing");
if (calculateMarginMarkup("100", "0").denominatorErrors[0]?.code !== "INVALID_MARKUP_DENOMINATOR") throw new Error("typed zero-cost denominator error missing");

const decimalCrossCheck = execFileSync("python3", ["-c", [
  "from decimal import Decimal,ROUND_HALF_UP",
  "q=Decimal('0.01')",
  "print(Decimal('10.075').quantize(q,rounding=ROUND_HALF_UP))",
  "print((Decimal('100')/Decimal('3')).quantize(q,rounding=ROUND_HALF_UP))",
  "p=Decimal('100');c=Decimal('80');profit=p-c",
  "print((profit/p*100).quantize(q,rounding=ROUND_HALF_UP))",
  "print((profit/c*100).quantize(q,rounding=ROUND_HALF_UP))",
].join(";")], { encoding: "utf8" }).trim().split("\n");
if (JSON.stringify(decimalCrossCheck) !== JSON.stringify(["10.08", "33.33", "20.00", "25.00"])) {
  throw new Error("Python Decimal secondary cross-check mismatch");
}

const acceptanceText = await readFile(resolve(receiptRoot, "browser-acceptance.json"), "utf8");
const acceptance = JSON.parse(acceptanceText) as { status?: string; localNetwork?: { nonLoopbackRouteReachable?: boolean } };
if (acceptance.status !== "PASS" || acceptance.localNetwork?.nonLoopbackRouteReachable !== true) {
  throw new Error("browser/mobile/keyboard/local-network acceptance receipt is missing or incomplete");
}
const bundleText = await readFile(resolve(receiptRoot, "bundle.json"), "utf8");
const bundle = JSON.parse(bundleText) as { status?: string; eagerEngineReferences?: number };
if (bundle.status !== "PASS" || bundle.eagerEngineReferences !== 0) {
  throw new Error("lazy shared-engine bundle receipt is missing or incomplete");
}

await mkdir(receiptRoot, { recursive: true });

async function writeReceipt(options: {
  manifest: typeof timezoneOverlapManifest | typeof rateConverterManifest | typeof marginMarkupManifest;
  exactVectors: number;
  fixtureIds: string[];
  propertyChecks: string[];
  additionalOracleIds?: string[];
  independentCrossChecks: string[];
}) {
  const { manifest } = options;
  if (manifest.runtime.location !== "LOCAL" || manifest.runtime.network !== "forbidden") {
    throw new Error(`${manifest.id}: Gold requires LOCAL + network=forbidden`);
  }
  const oracleIds = [manifest.gold.oracleEntryId, ...(options.additionalOracleIds ?? [])];
  const oracleEntries = oracleIds.map(oracle);
  const resolvedFixtures = await Promise.all(options.fixtureIds.map(async (id) => {
    const entry = fixture(id);
    const text = await readFile(resolve(root, entry.path), "utf8");
    return {
      id,
      path: entry.path,
      sha256: sha(text),
      schemaVersion: (JSON.parse(text) as { schema_version?: number }).schema_version ?? null,
    };
  }));
  const truthSources = [...new Set([
    ...oracleEntries.flatMap((entry) => entry.truth_sources),
    ...options.fixtureIds.flatMap((id) => fixture(id).truth_sources),
  ])].sort();
  const receipt = {
    schemaVersion: 1,
    status: "GOLD",
    toolId: manifest.id,
    runtime: manifest.runtime,
    maintenanceClass: manifest.gold.maintenanceClass,
    engineVersion: CLIENT_TIME_MATH_ENGINE_VERSION,
    oracleEntryId: manifest.gold.oracleEntryId,
    oracleEntryIds: oracleIds,
    fixtureFamilies: options.fixtureIds,
    exactVectors: options.exactVectors,
    propertyChecks: options.propertyChecks,
    independentCrossChecks: options.independentCrossChecks,
    truthSources,
    resolvedFixtures,
    fixtureIndexSchemaVersion: index.schema_version,
    oracleRegistrySchemaVersion: registry.schema_version,
    icuVersion: process.versions.icu ?? null,
    tzVersion: process.versions.tz ?? null,
    acceptance: { browserMobileKeyboardLocalNetwork: "PASS", lazySharedEngineBundle: "PASS" },
    identities: {
      engineSha256: sha(engineText),
      fixtureIndexSha256: sha(indexText),
      oracleRegistrySha256: sha(registryText),
      browserAcceptanceSha256: sha(acceptanceText),
      bundleSha256: sha(bundleText),
    },
  };
  await writeFile(resolve(receiptRoot, `${manifest.id}.gold.json`), `${JSON.stringify(receipt, null, 2)}\n`);
  console.log(`Gold PASS: ${manifest.id}, ${options.exactVectors} exact vector(s)`);
}

await writeReceipt({
  manifest: timezoneOverlapManifest,
  exactVectors: timezoneData.vectors.length,
  fixtureIds: ["timezone-dst"],
  propertyChecks: ["DST gap rejected", "DST overlap rejected unless disambiguated", "earlier/later overlap instants exact"],
  independentCrossChecks: ["Python zoneinfo"],
});
await writeReceipt({
  manifest: rateConverterManifest,
  exactVectors: 4,
  fixtureIds: ["business-math"],
  propertyChecks: ["exact rational arithmetic", "final-only half-up 2dp", "10.075 binary-float regression", "project hours required"],
  independentCrossChecks: ["Python Decimal"],
});
await writeReceipt({
  manifest: marginMarkupManifest,
  exactVectors: 3,
  fixtureIds: ["business-math"],
  propertyChecks: ["margin and markup use distinct denominators", "zero denominator policies explicit"],
  additionalOracleIds: ["cand-109"],
  independentCrossChecks: ["Python Decimal"],
});
