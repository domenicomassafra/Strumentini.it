import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type { ToolManifest } from "../../src/catalog/manifest";
import {
  RESEARCH_KNOWLEDGE_CHECKSUM_ALGORITHM,
  RESEARCH_KNOWLEDGE_ENGINE_VERSION,
  sha256HexUtf8,
} from "../../src/engines/research-knowledge";
import bibtexDeduplicator from "../../src/tools/bibtex-deduplicator/module";
import bibtexFormatter from "../../src/tools/bibtex-formatter/module";
import citationDeduplicator from "../../src/tools/citation-deduplicator/module";
import citationKeyGenerator from "../../src/tools/citation-key-generator/module";
import dateSourceNormalizer from "../../src/tools/date-source-normalizer/module";
import domainFrequencyCounter from "../../src/tools/domain-frequency-counter/module";
import evidenceTableBuilder from "../../src/tools/evidence-table-builder/module";
import notesDeduplicator from "../../src/tools/notes-deduplicator/module";
import pdfPageCitationHelper from "../../src/tools/pdf-page-citation-helper/module";
import readingListDeduplicator from "../../src/tools/reading-list-deduplicator/module";
import referenceListSorter from "../../src/tools/reference-list-sorter/module";
import researchPackManifest from "../../src/tools/research-pack-manifest/module";
import risBibtexConverter from "../../src/tools/ris-bibtex-converter/module";
import vocabularyFrequencyAnalyzer from "../../src/tools/vocabulary-frequency-analyzer/module";
import { currentEvidenceSourceFingerprint, currentRevision } from "../lib/current-revision";

/**
 * The research-knowledge Gold set is the 14 tools whose oracle entry, fixture
 * families, real browser acceptance and unit tests now all exist, with a
 * high-confidence oracle and no unresolved gap. It is fixed here on purpose: a
 * tool joins only by being added to this list together with its own evidence.
 */
const tools = [
  { id: "bibtex-deduplicator", run: (input: unknown) => bibtexDeduplicator.run(input, { defaults: {} }) },
  { id: "bibtex-formatter", run: (input: unknown) => bibtexFormatter.run(input, { defaults: {} }) },
  { id: "citation-deduplicator", run: (input: unknown) => citationDeduplicator.run(input, { defaults: {} }) },
  { id: "citation-key-generator", run: (input: unknown) => citationKeyGenerator.run(input, { defaults: {} }) },
  { id: "date-source-normalizer", run: (input: unknown) => dateSourceNormalizer.run(input, { defaults: {} }) },
  { id: "domain-frequency-counter", run: (input: unknown) => domainFrequencyCounter.run(input, { defaults: {} }) },
  { id: "evidence-table-builder", run: (input: unknown) => evidenceTableBuilder.run(input, { defaults: {} }) },
  { id: "notes-deduplicator", run: (input: unknown) => notesDeduplicator.run(input, { defaults: {} }) },
  { id: "pdf-page-citation-helper", run: (input: unknown) => pdfPageCitationHelper.run(input, { defaults: {} }) },
  { id: "reading-list-deduplicator", run: (input: unknown) => readingListDeduplicator.run(input, { defaults: {} }) },
  { id: "reference-list-sorter", run: (input: unknown) => referenceListSorter.run(input, { defaults: {} }) },
  { id: "research-pack-manifest", run: (input: unknown) => researchPackManifest.run(input, { defaults: {} }) },
  { id: "ris-bibtex-converter", run: (input: unknown) => risBibtexConverter.run(input, { defaults: {} }) },
  { id: "vocabulary-frequency-analyzer", run: (input: unknown) => vocabularyFrequencyAnalyzer.run(input, { defaults: {} }) },
] as const;

const enginePath = "src/engines/research-knowledge/index.ts";
const unitTestPaths = [
  "tests/research-knowledge-engine.test.ts",
  "tests/research-reference-engine.test.ts",
] as const;

interface FixtureEntry {
  readonly id: string;
  readonly path: string;
  readonly truth_sources: readonly string[];
  readonly provenance: { readonly kind: string; readonly license_or_rights: string };
}

interface OracleEntry {
  readonly id: string;
  readonly candidate: string;
  readonly maintenance_class: string;
  readonly truth_sources: readonly string[];
  readonly confidence?: string;
  readonly unresolved_gaps?: readonly string[];
}

interface BrowserResult {
  readonly toolId: string;
  readonly status: string;
  readonly assertion: string;
  readonly outputSha256: string;
  readonly lazyScriptCount: number;
  readonly externalTaskRequests: number;
  readonly nonGetTaskRequests: number;
  readonly taskContentLeaks: number;
  readonly runtimeErrors: number;
  readonly horizontalOverflow: boolean;
  readonly unlabeledControls: number;
  readonly publicErrorCopy: string;
  readonly boundaryState: string;
}

interface BrowserAcceptance {
  readonly status?: unknown;
  readonly tools?: unknown;
  readonly routesChecked?: unknown;
  readonly externalTaskRequests?: unknown;
  readonly nonGetTaskRequests?: unknown;
  readonly taskContentLeaks?: unknown;
  readonly runtimeConsoleErrors?: unknown;
  readonly implementationEager?: unknown;
  readonly lazyImplementationObservedFor?: unknown;
  readonly scriptSha256?: unknown;
  readonly results?: unknown;
}

const root = resolve(import.meta.dirname, "../..");
const receiptRoot = resolve(root, "quality/receipts/research-knowledge");
const acceptancePath = resolve(receiptRoot, "browser-acceptance.json");
const acceptanceScriptPath = resolve(root, "scripts/acceptance-research-knowledge.mjs");
const revision = await currentRevision(root);
const sourceFingerprint = await currentEvidenceSourceFingerprint(root);
const sha256 = (value: string | Uint8Array): string => createHash("sha256").update(value).digest("hex");

if (tools.length !== 14 || new Set(tools.map(({ id }) => id)).size !== 14) {
  throw new Error(`research-knowledge Gold set must contain exactly 14 unique tools; got ${tools.length}`);
}

const [engineText, fixtureIndexText, oracleRegistryText, acceptanceText, acceptanceScriptText, ...unitTestTexts] = await Promise.all([
  readFile(resolve(root, enginePath), "utf8"),
  readFile(resolve(root, "quality/fixtures/index.json"), "utf8"),
  readFile(resolve(root, "quality/oracles/registry.json"), "utf8"),
  readFile(acceptancePath, "utf8"),
  readFile(acceptanceScriptPath, "utf8"),
  ...unitTestPaths.map((path) => readFile(resolve(root, path), "utf8")),
]);

const fixtureIndex = JSON.parse(fixtureIndexText) as { readonly schema_version: number; readonly families: readonly FixtureEntry[] };
const oracleRegistry = JSON.parse(oracleRegistryText) as { readonly schema_version: number; readonly entries: readonly OracleEntry[] };
const acceptance = JSON.parse(acceptanceText) as BrowserAcceptance;

function isBrowserResult(value: unknown): value is BrowserResult {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const row = value as Partial<BrowserResult>;
  return typeof row.toolId === "string" && typeof row.status === "string" && typeof row.assertion === "string" && typeof row.outputSha256 === "string";
}

const toolIds = tools.map(({ id }) => id);
const acceptedTools = Array.isArray(acceptance.tools) ? acceptance.tools.filter((value): value is string => typeof value === "string") : [];
const results = Array.isArray(acceptance.results) ? acceptance.results.filter(isBrowserResult) : [];

const issues: string[] = [];
const acceptedRouteCount = 14;
if (acceptance.status !== "PASS") issues.push("research-knowledge browser acceptance is missing or not PASS");
if (acceptance.routesChecked !== acceptedRouteCount || acceptedTools.length !== acceptedRouteCount || new Set(acceptedTools).size !== acceptedRouteCount) issues.push(`research-knowledge browser acceptance must cover exactly ${acceptedRouteCount} unique routes`);
if (toolIds.some((id) => !acceptedTools.includes(id))) issues.push("research-knowledge browser acceptance does not cover every Gold tool");
if (acceptedTools.some((id) => !toolIds.includes(id as (typeof toolIds)[number]))) issues.push("research-knowledge browser acceptance covers a route outside the Gold set");
if (results.length !== acceptedRouteCount || new Set(results.map(({ toolId }) => toolId)).size !== acceptedRouteCount) issues.push("research-knowledge browser acceptance must contain exactly one result per accepted route");
if (acceptance.externalTaskRequests !== 0 || acceptance.nonGetTaskRequests !== 0 || acceptance.taskContentLeaks !== 0 || acceptance.runtimeConsoleErrors !== 0 || acceptance.implementationEager !== false) issues.push("research-knowledge browser acceptance global locality/runtime contract is incomplete");
if (!Array.isArray(acceptance.lazyImplementationObservedFor) || toolIds.some((id) => !(acceptance.lazyImplementationObservedFor as unknown[]).includes(id))) issues.push("research-knowledge browser acceptance did not observe lazy implementation loading for every tool");
if (acceptance.scriptSha256 !== sha256(acceptanceScriptText)) issues.push("research-knowledge browser acceptance was generated by a different acceptance script revision");

function oracleHasNoOpenGap(oracle: OracleEntry): boolean {
  return oracle.confidence === "high" && (oracle.unresolved_gaps ?? []).every((gap) => /^No unresolved gap\b/iu.test(gap));
}

/**
 * Determinism is re-proved here on the committed source: the same input must
 * produce byte-identical output twice, and an aborted run must produce nothing.
 */
async function proveDeterminism(id: string, run: (input: unknown) => unknown, input: unknown): Promise<void> {
  const first = JSON.stringify(run(input));
  const second = JSON.stringify(run(input));
  if (first !== second) issues.push(`${id}: two identical runs produced different output`);
  const controller = new AbortController();
  controller.abort();
  const manifestModule = await import(pathToFileURL(resolve(root, `src/tools/${id}/module.ts`)).href) as { default: { run(input: unknown, context: unknown, signal?: AbortSignal): unknown } };
  try {
    manifestModule.default.run(input, { defaults: {} }, controller.signal);
    issues.push(`${id}: an aborted run produced a result instead of stopping`);
  } catch (error) {
    if (!(error instanceof Error) || error.name !== "AbortError") issues.push(`${id}: an aborted run failed with ${String(error)}`);
  }
}

const determinismInputs: Readonly<Record<string, unknown>> = {
  "bibtex-formatter": { text: "@article{a, year = {2026}, title = {T}, author = {Ada Rossi}}" },
  "bibtex-deduplicator": { text: "@article{a, title = {A}, doi = {10.1000/182}}\n@article{b, title = {B}, doi = {doi:10.1000/182}}" },
  "citation-deduplicator": { records: [{ title: "A", doi: "10.1000/1" }, { title: "B", doi: "doi:10.1000/1" }], mode: "identifier" },
  "citation-key-generator": { records: [{ author: "Smith, Ada", title: "Deep Learning", year: "2026" }, { author: "Ada Smith", title: "Deep Learning", year: "2026" }] },
  "date-source-normalizer": { value: "24 settembre 2026" },
  "domain-frequency-counter": { urls: "https://example.org/a\nnot a url" },
  "evidence-table-builder": { records: [{ title: "A", url: "https://example.org/a" }, { foo: 1 }] },
  "notes-deduplicator": { notes: "prima\nPRIMA\nseconda" },
  "pdf-page-citation-helper": { author: "A. Rossi", title: "Uno studio", year: "2026", pages: "12--15", style: "mla" },
  "reading-list-deduplicator": { records: [{ isbn: "0-306-40615-2" }, { isbn: "978-0-306-40615-7" }] },
  "reference-list-sorter": { records: [{ title: "Zeta", author: "Ada Rossi", year: "2020" }, { title: "Alfa", author: "Ada Smith", year: "2019" }], order: "author" },
  "research-pack-manifest": { name: "Ricerca di base", tools: "quote-counter\ndoi-normalizer\nquote-counter" },
  "ris-bibtex-converter": { direction: "ris-to-bibtex", text: "TY  - JOUR\nTI  - Determinism\nA1  - Alpha, Alice\nAU  - Beta, Bob\nDA  - 2026/10/05\nER  - \n" },
  "vocabulary-frequency-analyzer": { text: "il gatto e il cane con una casa per la città" },
};

await mkdir(receiptRoot, { recursive: true });
for (const { id, run } of tools) {
  const manifestModule = await import(pathToFileURL(resolve(root, `src/tools/${id}/manifest.ts`)).href) as { default: ToolManifest };
  const manifest = manifestModule.default;
  if (manifest.id !== id) throw new Error(`${id}: imported manifest id is ${manifest.id}`);
  if (manifest.category !== "research") issues.push(`${id}: unexpected category ${manifest.category}`);
  if (manifest.runtime.location !== "LOCAL" || manifest.runtime.network !== "forbidden") issues.push(`${id}: Gold requires LOCAL/network-forbidden runtime`);
  if (manifest.engine !== "research-knowledge") issues.push(`${id}: unexpected engine ${manifest.engine}`);
  const oracle = oracleRegistry.entries.find(({ id: entryId }) => entryId === manifest.gold.oracleEntryId);
  if (oracle === undefined) {
    issues.push(`${id}: oracle missing: ${manifest.gold.oracleEntryId}`);
    continue;
  }
  if (!oracleHasNoOpenGap(oracle)) issues.push(`${id}: oracle is not high-confidence with zero unresolved gaps`);
  if (oracle.maintenance_class !== manifest.gold.maintenanceClass) issues.push(`${id}: oracle/manifest maintenance class mismatch`);
  if (manifest.gold.fixtureFamilies.length === 0) issues.push(`${id}: no declared fixture family`);
  const fixtures = manifest.gold.fixtureFamilies.map((familyId) => {
    const entry = fixtureIndex.families.find((candidate) => candidate.id === familyId);
    if (entry === undefined) {
      issues.push(`${id}: fixture family missing from index: ${familyId}`);
      return undefined;
    }
    return entry;
  }).filter((entry): entry is FixtureEntry => entry !== undefined);
  if (fixtures.length !== manifest.gold.fixtureFamilies.length) continue;

  const browserResult = results.find((result) => result.toolId === id);
  if (browserResult === undefined) {
    issues.push(`${id}: browser result missing`);
    continue;
  }
  if (browserResult.status !== "PASS" || browserResult.assertion.length === 0 || !/^[a-f0-9]{64}$/u.test(browserResult.outputSha256)) issues.push(`${id}: browser semantic assertion evidence is incomplete`);
  if (browserResult.lazyScriptCount < 1 || browserResult.externalTaskRequests !== 0 || browserResult.nonGetTaskRequests !== 0 || browserResult.taskContentLeaks !== 0 || browserResult.runtimeErrors !== 0 || browserResult.horizontalOverflow !== false || browserResult.unlabeledControls !== 0) issues.push(`${id}: browser locality/lazy/mobile/a11y evidence is incomplete`);
  if (browserResult.publicErrorCopy !== "it") issues.push(`${id}: browser evidence does not cover the public Italian error state`);

  await proveDeterminism(id, run, determinismInputs[id]);

  const [manifestText, ...fixtureTexts] = await Promise.all([
    readFile(resolve(root, `src/tools/${id}/manifest.ts`), "utf8"),
    ...fixtures.map((entry) => readFile(resolve(root, entry.path), "utf8")),
  ]);
  const converterEvidencePaths = id === "ris-bibtex-converter" ? [
    "src/tools/ris-bibtex-converter/module.ts",
    "src/tools/ris-bibtex-converter/conversion.ts",
    "quality/fixtures/research-ris-bibtex-conversion/ORACLE.md",
    "quality/fixtures/research-ris-bibtex-conversion/oracle-cross-check.json",
    "quality/fixtures/research-ris-bibtex-conversion/verify-oracle.ts",
  ] : [];
  const converterEvidenceIdentities = Object.fromEntries(await Promise.all(converterEvidencePaths.map(async (path) => [
    `evidence:${path}:sha256`,
    sha256(await readFile(resolve(root, path), "utf8")),
  ])));
  const fixtureIdentities = Object.fromEntries(fixtures.map((entry, index) => [`fixture:${entry.id}:sha256`, sha256(fixtureTexts[index] ?? "")]));
  const resolvedFixtures = await Promise.all(fixtures.map(async (entry) => {
    const text = await readFile(resolve(root, entry.path), "utf8");
    return {
      id: entry.id,
      path: entry.path,
      sha256: sha256(text),
      provenance: entry.provenance.kind,
      license_or_rights: entry.provenance.license_or_rights,
      schemaVersion: (JSON.parse(text) as { readonly schema_version?: number }).schema_version ?? null,
    };
  }));
  const receipt = {
    schemaVersion: 1,
    status: "GOLD",
    revision,
    sourceFingerprint,
    toolId: id,
    runtime: manifest.runtime,
    maintenanceClass: manifest.gold.maintenanceClass,
    engine: manifest.engine,
    engineVersion: RESEARCH_KNOWLEDGE_ENGINE_VERSION,
    oracleEntryId: manifest.gold.oracleEntryId,
    oracleConfidence: oracle.confidence ?? null,
    fixtureFamilies: manifest.gold.fixtureFamilies,
    truthSources: [...new Set([...oracle.truth_sources, ...fixtures.flatMap((entry) => entry.truth_sources)])].sort(),
    resolvedFixtures,
    checksumAlgorithm: RESEARCH_KNOWLEDGE_CHECKSUM_ALGORITHM,
    browserContract: {
      assertion: browserResult.assertion,
      outputSha256: browserResult.outputSha256,
      locality: "zero external/non-GET/task-body requests",
      lazyLoad: "implementation script observed after submit",
      mobile: "390px without horizontal overflow",
      accessibility: "no unlabeled interactive form controls",
      publicErrorState: browserResult.boundaryState,
    },
    determinism: "two identical runs produced byte-identical output and an aborted run produced nothing",
    propertyChecks: [
      "LOCAL/network-forbidden runtime",
      "high-confidence oracle with no open semantic gap",
      "oracle/manifest maintenance class alignment",
      "every declared fixture family resolves from the canonical fixture index with recorded provenance",
      "family unit tests cover the hand-worked vectors, the adversarial cases and the Italian public copy",
      "real route submit produced the tool-specific asserted output",
      "keyboard/mobile/a11y/locality/lazy browser acceptance plus the declared boundary state",
      "repeat-run determinism and abort propagation re-proved on the committed source",
    ],
    identities: {
      manifestSha256: sha256(manifestText),
      engineSha256: sha256(engineText),
      fixtureIndexSha256: sha256(fixtureIndexText),
      oracleRegistrySha256: sha256(oracleRegistryText),
      browserAcceptanceSha256: sha256(acceptanceText),
      acceptanceScriptSha256: sha256(acceptanceScriptText),
      unitTestsSha256: sha256(unitTestTexts.join("\n")),
      ...converterEvidenceIdentities,
      ...fixtureIdentities,
    },
  };
  await writeFile(resolve(receiptRoot, `${id}.gold.json`), `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
  console.log(`Gold PASS: ${id}, oracle/fixtures + exact browser assertion + locality/lazy/mobile/a11y/Italian-error + determinism`);
}

// The research engine exposes SHA-256 for the pack manifest; the digest itself is
// proved against the repository's published NIST known-answer vectors.
const sha2Fixture = fixtureIndex.families.find((entry) => entry.id === "sha2-known-answers");
if (sha2Fixture === undefined) issues.push("sha2-known-answers fixture family is missing from the canonical index");
else {
  const vectors = (JSON.parse(await readFile(resolve(root, sha2Fixture.path), "utf8")) as { readonly vectors: ReadonlyArray<{ algorithm: string; input_utf8: string; digest_hex: string }> }).vectors;
  for (const vector of vectors.filter((entry) => entry.algorithm === "SHA-256")) {
    if (sha256HexUtf8(vector.input_utf8) !== vector.digest_hex) issues.push(`SHA-256 known answer mismatch for ${JSON.stringify(vector.input_utf8)}`);
  }
}

if (issues.length > 0) {
  console.error(issues.join("\n"));
  process.exit(1);
}

console.log(`research-knowledge Gold set: ${tools.length} tool(s) certified; every accepted route is bound to a high-confidence oracle with no open gap.`);
