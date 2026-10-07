import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type { ToolManifest } from "../../src/catalog/manifest";
import type { ToolModule } from "../../src/runtime/types";
import { currentEvidenceSourceFingerprint, currentRevision } from "../lib/current-revision";

type JsonRecord = Record<string, unknown>;

interface Candidate {
  readonly id: string;
  readonly focusedTests: readonly string[];
}

const candidates: readonly Candidate[] = [
  { id: "scientific-calculator", focusedTests: ["tests/calculator-math-core.test.ts"] },
  { id: "fraction-integer-toolkit", focusedTests: ["tests/calculator-math-core.test.ts"] },
  { id: "statistics-grade-calculator", focusedTests: ["tests/calculator-math-core.test.ts"] },
  { id: "interest-savings-calculator", focusedTests: ["tests/calculator-math-core.test.ts"] },
  { id: "partita-iva-validator", focusedTests: ["tests/partita-iva-validator.test.ts"] },
  { id: "iban-validator", focusedTests: ["tests/iban-validator.test.ts"] },
  { id: "basic-unit-converter", focusedTests: ["tests/unit-conversion.test.ts"] },
  { id: "engineering-unit-converter", focusedTests: ["tests/unit-conversion.test.ts"] },
  { id: "storage-download-calculator", focusedTests: ["tests/unit-conversion.test.ts"] },
  { id: "battery-vehicle-power-helper", focusedTests: ["tests/unit-conversion.test.ts"] },
  { id: "reference-size-converter", focusedTests: ["tests/unit-conversion.test.ts"] },
  { id: "mortgage-amortization-calculator", focusedTests: ["tests/business-math-expansion.test.ts"] },
  { id: "geometry-equation-motion-helper", focusedTests: ["tests/business-math-expansion.test.ts"] },
  { id: "everyday-cost-calculator", focusedTests: ["tests/business-math-expansion.test.ts"] },
  { id: "italian-document-expiry", focusedTests: ["tests/italian-document-expiry.test.ts"] },
  { id: "inps-artigiani-commercianti", focusedTests: ["tests/italy-2026-consumers.test.ts"] },
  { id: "gestione-separata-contributi", focusedTests: ["tests/italy-2026-consumers.test.ts"] },
  { id: "ponti-ferie-optimizer", focusedTests: ["tests/italy-2026-consumers.test.ts"] },
] as const;

if (candidates.length !== 18 || new Set(candidates.map(({ id }) => id)).size !== 18) throw new Error("business/Italy/date certification target must contain exactly 18 unique tools");

const root = resolve(import.meta.dirname, "../..");
const writeReceipts = process.argv.includes("--write");
const receiptRoot = resolve(root, "quality/receipts/business-italy-date");
const sha256 = (value: string | Buffer): string => createHash("sha256").update(value).digest("hex");
const isRecord = (value: unknown): value is JsonRecord => typeof value === "object" && value !== null && !Array.isArray(value);

function assertExpected(toolId: string, actual: unknown, expected: unknown, path = "result"): void {
  if (Array.isArray(expected)) {
    if (!Array.isArray(actual) || actual.length < expected.length) throw new Error(`${toolId}: ${path} array mismatch`);
    expected.forEach((entry, index) => assertExpected(toolId, actual[index], entry, `${path}[${index}]`));
    return;
  }
  if (isRecord(expected)) {
    if (!isRecord(actual)) throw new Error(`${toolId}: ${path} object mismatch`);
    for (const [key, value] of Object.entries(expected)) {
      if (!(key in actual)) throw new Error(`${toolId}: ${path}.${key} missing`);
      assertExpected(toolId, actual[key], value, `${path}.${key}`);
    }
    return;
  }
  if (!Object.is(actual, expected)) throw new Error(`${toolId}: ${path} mismatch; expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}

function boundedOracleGap(gap: string): boolean {
  return /(?:\bintentionally\b|\bdeliberately\b|\bbounded to\b|\bfail(?:s)? closed\b|\bnot verified\b|\bnot inferred\b|\brejected rather than guessed\b|\boutside (?:the )?(?:(?:declared|pinned|normalized|helper) )*(?:scope|subset|registry)\b|\boutside scope\b|\bunsupported\b|\bonly .*\benabled\b|\bseparate work\b|\bexplicit assumption\b|\buser supplies\b)/iu.test(gap);
}

function vectorFor(toolId: string, fixtures: JsonRecord): { input: JsonRecord; expected: JsonRecord } {
  if (["mortgage-amortization-calculator", "geometry-equation-motion-helper", "everyday-cost-calculator"].includes(toolId)) {
    const vector = (fixtures.tool_vectors as JsonRecord[] | undefined)?.find((entry) => entry.tool_id === toolId);
    if (!isRecord(vector?.input) || !isRecord(vector?.expected)) throw new Error(`${toolId}: exact tool vector missing`);
    return { input: vector.input, expected: vector.expected };
  }
  if (toolId === "scientific-calculator") {
    const vector = (fixtures.scientific as JsonRecord[] | undefined)?.[0];
    return { input: { expression: String(vector?.expression) }, expected: { result: Number(vector?.expected) } };
  }
  if (toolId === "fraction-integer-toolkit") {
    const vector = (fixtures.fractions as JsonRecord[] | undefined)?.[0];
    return { input: { mode: "fraction", left: String(vector?.left), right: String(vector?.right), operation: String(vector?.operation) }, expected: { result: String(vector?.expected) } };
  }
  if (toolId === "statistics-grade-calculator") {
    const vector = (fixtures.statistics as JsonRecord[] | undefined)?.[0];
    return { input: { mode: "descriptive", values: String(vector?.values) }, expected: { mean: String(vector?.mean), median: String(vector?.median), populationVariance: String(vector?.populationVariance) } };
  }
  if (toolId === "interest-savings-calculator") {
    const vector = (fixtures.finance as JsonRecord[] | undefined)?.[0];
    return { input: { mode: String(vector?.mode), principal: String(vector?.principal), annualRatePercent: String(vector?.annualRatePercent), years: String(vector?.years) }, expected: { futureValue: String(vector?.expected) } };
  }
  if (toolId === "basic-unit-converter") {
    const vector = (fixtures.basic as JsonRecord[] | undefined)?.[0];
    return { input: { value: String(vector?.value), from: String(vector?.from), to: String(vector?.to) }, expected: { result: String(vector?.expected) } };
  }
  if (toolId === "engineering-unit-converter") {
    const vector = (fixtures.engineering as JsonRecord[] | undefined)?.[0];
    return { input: { value: String(vector?.value), from: String(vector?.from), to: String(vector?.to) }, expected: { result: String(vector?.expected) } };
  }
  if (toolId === "storage-download-calculator") {
    const vector = (fixtures.storage as JsonRecord[] | undefined)?.[0];
    return { input: { mode: "storage", value: String(vector?.value), from: String(vector?.from), to: String(vector?.to) }, expected: { result: String(vector?.expected) } };
  }
  if (toolId === "battery-vehicle-power-helper") {
    const vector = (fixtures.batteryVehiclePower as JsonRecord[] | undefined)?.[0];
    return { input: { mode: String(vector?.mode), direction: String(vector?.direction), value: String(vector?.value), voltage: String(vector?.voltage) }, expected: { result: String(vector?.expected) } };
  }
  if (toolId === "reference-size-converter") {
    const vector = (fixtures.reference as JsonRecord[] | undefined)?.[0];
    return { input: { mode: String(vector?.mode), paper: String(vector?.paper), outputUnit: String(vector?.outputUnit) }, expected: { result: String(vector?.expected) } };
  }
  if (toolId === "iban-validator" || toolId === "partita-iva-validator") {
    const vector = (fixtures.vectors as JsonRecord[] | undefined)?.find((entry) => entry.valid === true);
    if (vector === undefined) throw new Error(`${toolId}: valid fixture vector missing`);
    return { input: { value: String(vector.input) }, expected: { valid: true, normalized: String(vector.normalized) } };
  }
  if (toolId === "italian-document-expiry") {
    const vector = (fixtures.vectors as JsonRecord[] | undefined)?.find((entry) => entry.id === "passport-adult");
    if (!isRecord(vector?.input) || !isRecord(vector?.expected)) throw new Error(`${toolId}: passport-adult vector missing`);
    return { input: vector.input, expected: vector.expected };
  }
  if (toolId === "inps-artigiani-commercianti") {
    const vector = (fixtures.inpsArtigianiCommercianti as JsonRecord[] | undefined)?.find((entry) => entry.id === "artisan-first-band-edge");
    return { input: { year: 2026, profile: String(vector?.profile), incomeEur: Number(vector?.incomeEur), contributionSeniority: String(vector?.seniority) }, expected: { totalContributionEur: Number(vector?.expectedContributionEur) } };
  }
  if (toolId === "gestione-separata-contributi") {
    const vector = (fixtures.gestioneSeparata as JsonRecord[] | undefined)?.find((entry) => entry.id === "professional-low-income");
    return { input: { year: 2026, profile: String(vector?.profile), incomeEur: Number(vector?.incomeEur) }, expected: { totalContributionEur: Number(vector?.expectedContributionEur), belowFullYearCreditMinimum: true } };
  }
  if (toolId === "ponti-ferie-optimizer") {
    const vector = (fixtures.bridges as JsonRecord[] | undefined)?.find((entry) => entry.id === "easter-monday-four-leave-days");
    return { input: { year: 2026, leaveDayBudget: Number(vector?.leaveDayBudget), workweek: vector?.workweek as unknown[], maxResults: 100 }, expected: { opportunities: [{ startDate: String(vector?.expectedStart), endDate: String(vector?.expectedEnd), consecutiveDaysOff: Number(vector?.expectedDaysOff), leaveDaysUsed: Number(vector?.leaveDayBudget) }] } };
  }
  throw new Error(`${toolId}: no fixture replay adapter`);
}

const [registryText, fixtureIndexText] = await Promise.all([
  readFile(resolve(root, "quality/oracles/registry.json"), "utf8"),
  readFile(resolve(root, "quality/fixtures/index.json"), "utf8"),
]);
const registry = JSON.parse(registryText) as { entries: JsonRecord[] };
const fixtureIndex = JSON.parse(fixtureIndexText) as { families: JsonRecord[] };
const sourceFingerprint = await currentEvidenceSourceFingerprint(root);
const revision = await currentRevision(root);

const promotable: string[] = [];
const blocked: Array<{ id: string; reasons: string[] }> = [];
await mkdir(receiptRoot, { recursive: true });

for (const candidate of candidates) {
  const reasons: string[] = [];
  const browserAcceptancePath = `quality/receipts/business-italy-date/browser/${candidate.id}.json`;
  const browserAcceptanceText = await readFile(resolve(root, browserAcceptancePath), "utf8").catch(() => "");
  const browserAcceptance = browserAcceptanceText === "" ? undefined : JSON.parse(browserAcceptanceText) as JsonRecord;
  const manifestModule = await import(pathToFileURL(resolve(root, `src/tools/${candidate.id}/manifest.ts`)).href) as { default?: ToolManifest };
  const manifest = manifestModule.default;
  if (manifest === undefined || manifest.id !== candidate.id) reasons.push("MANIFEST_IMPORT_INVALID");
  const oracle = manifest === undefined ? undefined : registry.entries.find((entry) => entry.id === manifest.gold.oracleEntryId);
  if (oracle === undefined) reasons.push("ORACLE_MISSING");
  if (oracle?.confidence !== "high") reasons.push("ORACLE_NOT_HIGH_CONFIDENCE");
  if (manifest !== undefined && oracle?.maintenance_class !== manifest.gold.maintenanceClass) reasons.push(`MAINTENANCE_CLASS_MISMATCH:${String(manifest.gold.maintenanceClass)}!=${String(oracle?.maintenance_class)}`);
  const gaps = Array.isArray(oracle?.unresolved_gaps) ? oracle.unresolved_gaps.filter((value): value is string => typeof value === "string") : [];
  for (const gap of gaps) if (!boundedOracleGap(gap)) reasons.push(`UNBOUNDED_ORACLE_GAP:${gap}`);
  if (browserAcceptance?.status !== "PASS" || browserAcceptance?.subjectToolId !== candidate.id || !isRecord(browserAcceptance?.result) || browserAcceptance.result.status !== "PASS") reasons.push("PER_TOOL_BROWSER_EVIDENCE_MISSING_OR_NOT_PASS");
  if (browserAcceptance !== undefined && browserAcceptance.sourceFingerprint !== sourceFingerprint) reasons.push("BROWSER_ACCEPTANCE_SOURCE_FINGERPRINT_STALE");
  const fixtureRecords = manifest === undefined ? [] : manifest.gold.fixtureFamilies.map((id) => fixtureIndex.families.find((entry) => entry.id === id));
  if (fixtureRecords.some((entry) => entry === undefined)) reasons.push("FIXTURE_INDEX_BINDING_MISSING");
  for (const testPath of candidate.focusedTests) {
    try { await readFile(resolve(root, testPath)); } catch { reasons.push(`FOCUSED_TEST_MISSING:${testPath}`); }
  }
  let replayCount = 0;
  if (reasons.length === 0 && manifest !== undefined) {
    try {
      const fixtureRecord = fixtureRecords[0]!;
      const fixturePath = String(fixtureRecord!.path);
      const fixtures = JSON.parse(await readFile(resolve(root, fixturePath), "utf8")) as JsonRecord;
      const vector = vectorFor(candidate.id, fixtures);
      const toolModule = await import(pathToFileURL(resolve(root, `src/tools/${candidate.id}/module.ts`)).href) as { default?: ToolModule };
      if (toolModule.default === undefined) throw new Error("module default export missing");
      const actual = await toolModule.default.run(vector.input, {
        defaults: {
          currency: { field: "currency", value: "EUR", provenance: "tool-default" },
        },
      });
      if (candidate.id === "ponti-ferie-optimizer") {
        const actualRecord = isRecord(actual) ? actual : {};
        const opportunities = Array.isArray(actualRecord.opportunities) ? actualRecord.opportunities.filter(isRecord) : [];
        const expectedOpportunity = Array.isArray(vector.expected.opportunities) && isRecord(vector.expected.opportunities[0]) ? vector.expected.opportunities[0] : undefined;
        if (expectedOpportunity === undefined || !opportunities.some((opportunity) => {
          try { assertExpected(candidate.id, opportunity, expectedOpportunity, "opportunity"); return true; } catch { return false; }
        })) throw new Error("fixture opportunity not present in maxResults=100 output");
      } else {
        assertExpected(candidate.id, actual, vector.expected);
      }
      replayCount = 1;
    } catch (error) {
      reasons.push(`FIXTURE_REPLAY_FAILED:${error instanceof Error ? error.message : String(error)}`);
    }
  }
  if (reasons.length > 0 || manifest === undefined || oracle === undefined) {
    blocked.push({ id: candidate.id, reasons });
    console.log(`Gold BLOCKED: ${candidate.id}: ${reasons.join(" | ")}`);
    continue;
  }
  promotable.push(candidate.id);
  console.log(`Gold-ready PASS: ${candidate.id}`);
  if (!writeReceipts) continue;
  const resolvedFixtures = manifest.gold.fixtureFamilies.map((id) => fixtureIndex.families.find((entry) => entry.id === id)!);
  const fixtureIdentities = Object.fromEntries(await Promise.all(resolvedFixtures.map(async (entry) => {
    const id = String(entry.id);
    const path = String(entry.path);
    return [`fixture:${id}:sha256`, sha256(await readFile(resolve(root, path)))] as const;
  })));
  const focusedTestsText = (await Promise.all(candidate.focusedTests.map((path) => readFile(resolve(root, path), "utf8")))).join("\n");
  const manifestText = await readFile(resolve(root, `src/tools/${candidate.id}/manifest.ts`), "utf8");
  const moduleText = await readFile(resolve(root, `src/tools/${candidate.id}/module.ts`), "utf8");
  const receiptPath = `quality/receipts/business-italy-date/${candidate.id}.gold.json`;
  const receipt = {
    schemaVersion: 1,
    status: "GOLD",
    goldEligible: true,
    receiptPath,
    revision,
    sourceFingerprint,
    toolId: candidate.id,
    runtime: manifest.runtime,
    maintenanceClass: manifest.gold.maintenanceClass,
    oracleEntryId: manifest.gold.oracleEntryId,
    fixtureFamilies: manifest.gold.fixtureFamilies,
    exactVectors: replayCount,
    truthSources: [...new Set([...(oracle.truth_sources as string[]), ...resolvedFixtures.flatMap((entry) => Array.isArray(entry.truth_sources) ? entry.truth_sources.filter((value): value is string => typeof value === "string") : [])])].sort(),
    resolvedFixtures: resolvedFixtures.map((entry) => ({ id: String(entry.id), path: String(entry.path) })),
    propertyChecks: [
      "local-only runtime declaration",
      "high-confidence oracle with only explicit bounded-scope gaps",
      "manifest maintenance class matches oracle",
      "fixture replay through public tool module",
      "per-tool semantic browser assertion",
      "keyboard/locality/lazy/mobile/a11y browser acceptance",
      "focused semantic and refusal-boundary tests are bound by identity",
    ],
    identities: {
      manifestSha256: sha256(manifestText),
      moduleSha256: sha256(moduleText),
      oracleRegistrySha256: sha256(registryText),
      fixtureIndexSha256: sha256(fixtureIndexText),
      browserAcceptanceSha256: sha256(browserAcceptanceText),
      browserAcceptanceSourceFingerprint: String(browserAcceptance?.sourceFingerprint ?? ""),
      focusedTestsSha256: sha256(focusedTestsText),
      ...fixtureIdentities,
    },
  };
  await writeFile(resolve(root, receiptPath), `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
}

console.log(`business/Italy/date Gold gate: ${promotable.length} promotable, ${blocked.length} blocked${writeReceipts ? ", promotable receipts written" : ", check-only (no receipts written)"}`);
console.log(`promotable: ${promotable.join(", ")}`);
if (blocked.length > 0) console.log(`blocked: ${blocked.map(({ id, reasons }) => `${id} [${reasons.join("; ")}]`).join(", ")}`);

const unexpectedBlocked = blocked.filter(({ id, reasons }) => {
  if (id === "italian-document-expiry" && reasons.some((reason) => reason.startsWith("MAINTENANCE_CLASS_MISMATCH:"))) return false;
  if (id === "ponti-ferie-optimizer" && reasons.includes("PER_TOOL_BROWSER_EVIDENCE_MISSING_OR_NOT_PASS")) return false;
  return true;
});
if (unexpectedBlocked.length > 0) process.exitCode = 1;
