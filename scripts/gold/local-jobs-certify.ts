import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type { ToolManifest } from "../../src/catalog/manifest";
import { FILE_PRIVACY_ENGINE_VERSION } from "../../src/engines/file-privacy";
import { DATE_TIME_ENGINE_VERSION } from "../../src/engines/date-time";
import { TEXT_WRITING_ENGINE_VERSION } from "../../src/engines/text-writing";
import type { ToolExecutionContext } from "../../src/runtime/types";
import { currentEvidenceSourceFingerprint, currentRevision } from "../lib/current-revision";

/**
 * Gold for the local-jobs tranche: four file/privacy tools, four text-writing
 * tools and one date/time tool.
 *
 * The bar is deliberately the strictest one in the repository: a high-confidence
 * oracle whose gaps are closed, an aligned maintenance class, every declared
 * fixture family resolved from the canonical index, the committed fixture
 * vectors replayed through the *public tool module*, and a real browser submit
 * whose rendered output is tool-specific.
 */

const toolIds = [
  "archive-checksum-manifest",
  "batch-rename-preview",
  "folder-compare",
  "metadata-risk-inspector",
  "language-aware-text-statistics",
  "lorem-sample-data-generator",
  "reading-time-estimator",
  "smart-quote-normalizer",
  "public-holiday-lookup",
] as const;

type LocalJobsToolId = (typeof toolIds)[number];

const engineVersionByTool: Readonly<Record<LocalJobsToolId, string>> = {
  "archive-checksum-manifest": FILE_PRIVACY_ENGINE_VERSION,
  "batch-rename-preview": FILE_PRIVACY_ENGINE_VERSION,
  "folder-compare": FILE_PRIVACY_ENGINE_VERSION,
  "metadata-risk-inspector": FILE_PRIVACY_ENGINE_VERSION,
  "language-aware-text-statistics": TEXT_WRITING_ENGINE_VERSION,
  "lorem-sample-data-generator": TEXT_WRITING_ENGINE_VERSION,
  "reading-time-estimator": TEXT_WRITING_ENGINE_VERSION,
  "smart-quote-normalizer": TEXT_WRITING_ENGINE_VERSION,
  "public-holiday-lookup": DATE_TIME_ENGINE_VERSION,
};

const testFilesByEngine: Readonly<Record<string, readonly string[]>> = {
  "file-privacy": ["tests/file-privacy-engine.test.ts", "tests/file-privacy-modules.test.ts"],
  "text-writing": ["tests/text-writing-engine.test.ts", "tests/text-writing-catalog.test.ts"],
  "date-time": ["tests/date-time-engine.test.ts", "tests/date-time-modules.test.ts"],
};

/** The fixture families this tranche introduced; each one must stay bound. */
const trancheFixtureFamilies: Readonly<Record<LocalJobsToolId, readonly string[]>> = {
  "archive-checksum-manifest": ["archive-checksum-manifest"],
  "batch-rename-preview": ["batch-rename-plan"],
  "folder-compare": ["folder-compare-diff"],
  "metadata-risk-inspector": ["metadata-risk-scan"],
  "language-aware-text-statistics": ["text-writing-local-jobs"],
  "lorem-sample-data-generator": ["text-writing-local-jobs"],
  "reading-time-estimator": ["text-writing-local-jobs"],
  "smart-quote-normalizer": ["text-writing-local-jobs"],
  "public-holiday-lookup": ["holiday-calendar"],
};

interface FixtureEntry {
  readonly id: string;
  readonly path: string;
  readonly truth_sources: readonly string[];
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
  readonly optionalAccountProbeFailures?: number;
}

interface ItalianErrorState {
  readonly verified?: boolean;
  readonly reason?: string;
  readonly sample?: string;
}

const root = resolve(import.meta.dirname, "../..");
const receiptRoot = resolve(root, "quality/receipts/local-jobs");
const acceptancePath = resolve(receiptRoot, "browser-acceptance.json");
const acceptanceScriptPath = resolve(root, "scripts/acceptance-local-jobs.mjs");
const revision = await currentRevision(root);
const sourceFingerprint = await currentEvidenceSourceFingerprint(root);
const sha256 = (value: string | Uint8Array) => createHash("sha256").update(value).digest("hex");

if (toolIds.length !== 9 || new Set(toolIds).size !== 9) throw new Error(`local-jobs Gold set must contain exactly 9 unique tools; got ${toolIds.length}`);

const [fixtureIndexText, oracleRegistryText, acceptanceText, acceptanceScriptText, localJobsTestText, italianErrorsText] = await Promise.all([
  readFile(resolve(root, "quality/fixtures/index.json"), "utf8"),
  readFile(resolve(root, "quality/oracles/registry.json"), "utf8"),
  readFile(acceptancePath, "utf8"),
  readFile(acceptanceScriptPath, "utf8"),
  readFile(resolve(root, "tests/local-jobs-fixtures.test.ts"), "utf8"),
  readFile(resolve(root, "src/i18n/it/errors.ts"), "utf8"),
]);
const fixtureIndex = JSON.parse(fixtureIndexText) as { readonly families: readonly FixtureEntry[] };
const oracleRegistry = JSON.parse(oracleRegistryText) as { readonly entries: readonly OracleEntry[] };
const acceptance = JSON.parse(acceptanceText) as {
  readonly status?: unknown;
  readonly tools?: unknown;
  readonly routesChecked?: unknown;
  readonly externalTaskRequests?: unknown;
  readonly nonGetTaskRequests?: unknown;
  readonly taskContentLeaks?: unknown;
  readonly runtimeConsoleErrors?: unknown;
  readonly implementationEager?: unknown;
  readonly lazyImplementationObservedFor?: unknown;
  readonly italianErrorStates?: unknown;
  readonly scriptSha256?: unknown;
  readonly results?: unknown;
};

function isBrowserResult(value: unknown): value is BrowserResult {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const row = value as Partial<BrowserResult>;
  return typeof row.toolId === "string" && typeof row.status === "string" && typeof row.assertion === "string" && typeof row.outputSha256 === "string";
}

const acceptedTools = Array.isArray(acceptance.tools) ? acceptance.tools.filter((value): value is string => typeof value === "string") : [];
const results = Array.isArray(acceptance.results) ? acceptance.results.filter(isBrowserResult) : [];
const italianErrorStates = typeof acceptance.italianErrorStates === "object" && acceptance.italianErrorStates !== null && !Array.isArray(acceptance.italianErrorStates)
  ? acceptance.italianErrorStates as Readonly<Record<string, ItalianErrorState>>
  : {};

if (acceptance.status !== "PASS") throw new Error("local-jobs browser acceptance is missing or not PASS");
if (acceptance.routesChecked !== 9 || acceptedTools.length !== 9 || new Set(acceptedTools).size !== 9) throw new Error("local-jobs browser acceptance must cover exactly 9 unique routes");
if (toolIds.some((id) => !acceptedTools.includes(id)) || acceptedTools.some((id) => !toolIds.includes(id as LocalJobsToolId))) throw new Error("local-jobs browser acceptance tool set does not match the fixed 9-tool Gold set");
if (results.length !== 9 || new Set(results.map(({ toolId }) => toolId)).size !== 9) throw new Error("local-jobs browser acceptance must contain exactly one result per tool");
if (acceptance.externalTaskRequests !== 0 || acceptance.nonGetTaskRequests !== 0 || acceptance.taskContentLeaks !== 0 || acceptance.runtimeConsoleErrors !== 0 || acceptance.implementationEager !== false) throw new Error("local-jobs browser acceptance global locality/runtime contract is incomplete");
if (!Array.isArray(acceptance.lazyImplementationObservedFor) || toolIds.some((id) => !(acceptance.lazyImplementationObservedFor as unknown[]).includes(id))) throw new Error("local-jobs browser acceptance did not observe lazy implementation loading for every tool");
if (acceptance.scriptSha256 !== sha256(acceptanceScriptText)) throw new Error("local-jobs browser acceptance was generated by a different acceptance script revision");

function oracleHasNoOpenGap(oracle: OracleEntry): boolean {
  return oracle.confidence === "high" && (oracle.unresolved_gaps ?? []).every((gap) => /^No unresolved gap\b/iu.test(gap));
}

/**
 * Replays the committed fixture vectors through the public tool module. This is
 * the part the browser cannot prove: the exact bytes and error codes the
 * certification index will point at are executed here, through `module.run`,
 * with the same input shape a user produces.
 */
async function replayFixtureVectors(toolId: LocalJobsToolId, module: { run(input: unknown, context?: ToolExecutionContext, signal?: AbortSignal): Promise<unknown> }): Promise<number> {
  const context: ToolExecutionContext = { defaults: {} };
  const read = async (family: string): Promise<Record<string, never>> => JSON.parse(await readFile(resolve(root, `quality/fixtures/${family}/vectors.json`), "utf8")) as Record<string, never>;
  const fileOf = (declared: { name: string; base64: string; type?: string }): File => {
    const mime = declared.type ?? (/zip$/u.test(declared.name) ? "application/zip" : /\.jpg$/u.test(declared.name) ? "image/jpeg" : /\.png$/u.test(declared.name) ? "image/png" : /\.pdf$/u.test(declared.name) ? "application/pdf" : "text/plain");
    return new File([Buffer.from(declared.base64, "base64")], declared.name, { type: mime });
  };
  const filesOf = (declared: ReadonlyArray<{ name: string; base64: string; type?: string }>): File[] => declared.map(fileOf);
  const code = (run: () => unknown): string => {
    try {
      run();
      return "NO_THROW";
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return typeof (error as { code?: unknown }).code === "string" ? String((error as { code?: unknown }).code) : message.split(":")[0] ?? message;
    }
  };
  const asyncCode = async (run: () => Promise<unknown>): Promise<string> => {
    try {
      await run();
      return "NO_THROW";
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return typeof (error as { code?: unknown }).code === "string" ? String((error as { code?: unknown }).code) : message.split(":")[0] ?? message;
    }
  };
  let replayed = 0;

  if (toolId === "archive-checksum-manifest") {
    const fixture = await read("archive-checksum-manifest");
    for (const vector of fixture.vectors as unknown as Array<{ input: { files: Array<{ name: string; base64: string }> }; expected: Record<string, unknown> }>) {
      const result = await module.run({ files: filesOf(vector.input.files) }, context) as Record<string, unknown>;
      if (result.operation !== vector.expected.operation) throw new Error(`${toolId}: operation identity`);
      if (typeof vector.expected.sha256 === "string" && result.sha256 !== vector.expected.sha256) throw new Error(`${toolId}: archive digest`);
      if (vector.expected.manifest !== undefined && result.manifest !== vector.expected.manifest) throw new Error(`${toolId}: manifest text`);
      if (vector.expected.entryPaths !== undefined && JSON.stringify((result.entries as Array<{ path: string }>).map((entry) => entry.path)) !== JSON.stringify(vector.expected.entryPaths)) throw new Error(`${toolId}: central directory order`);
      replayed += 1;
    }
  }

  if (toolId === "batch-rename-preview") {
    const fixture = await read("batch-rename-plan");
    for (const vector of fixture.vectors as unknown as Array<{ input: { names: string[] }; expected: { renamed: string[]; changedCount: number; collisionCount: number } }>) {
      const result = await module.run(vector.input, context) as { entries: Array<{ renamed: string }>; changedCount: number; collisionCount: number };
      if (JSON.stringify(result.entries.map((entry) => entry.renamed)) !== JSON.stringify(vector.expected.renamed)) throw new Error(`${toolId}: rename plan`);
      if (result.changedCount !== vector.expected.changedCount || result.collisionCount !== vector.expected.collisionCount) throw new Error(`${toolId}: rename counters`);
      replayed += 1;
    }
    for (const vector of fixture.errors as unknown as Array<{ input: unknown; code: string }>) {
      if (await asyncCode(() => module.run(vector.input, context)) !== vector.code) throw new Error(`${toolId}: declared error`);
      replayed += 1;
    }
  }

  if (toolId === "folder-compare") {
    const fixture = await read("folder-compare-diff");
    for (const vector of fixture.vectors as unknown as Array<{ input: { before: Array<{ name: string; base64: string }>; after: Array<{ name: string; base64: string }>; compareHashes: boolean }; expected: Record<string, unknown> }>) {
      const result = await module.run({ before: filesOf(vector.input.before), after: filesOf(vector.input.after), compareHashes: vector.input.compareHashes }, context) as Record<string, unknown>;
      if (result.operation !== vector.expected.operation) throw new Error(`${toolId}: operation identity`);
      for (const key of ["addedCount", "removedCount", "changedCount", "unchangedCount", "comparedBytes"]) {
        if (vector.expected[key] !== undefined && result[key] !== vector.expected[key]) throw new Error(`${toolId}: ${key}`);
      }
      replayed += 1;
    }
    for (const vector of fixture.errors as unknown as Array<{ input: { before: Array<{ name: string; base64: string }>; after: Array<{ name: string; base64: string }> }; code: string }>) {
      if (await asyncCode(() => module.run({ before: filesOf(vector.input.before), after: filesOf(vector.input.after) }, context)) !== vector.code) throw new Error(`${toolId}: declared error`);
      replayed += 1;
    }
  }

  if (toolId === "metadata-risk-inspector") {
    const fixture = await read("metadata-risk-scan");
    for (const vector of fixture.vectors as unknown as Array<{ input: { files: Array<{ name: string; base64: string; type?: string }> }; expected: { detectedMime: string; metadataContainers: string[]; metadataFields: string[]; riskCount: number } }>) {
      const result = await module.run({ files: filesOf(vector.input.files) }, context) as { files: Array<Record<string, unknown>> };
      const row = result.files[0];
      if (row?.detectedMime !== vector.expected.detectedMime) throw new Error(`${toolId}: detected mime`);
      if (JSON.stringify(row?.metadataContainers) !== JSON.stringify(vector.expected.metadataContainers)) throw new Error(`${toolId}: metadata containers`);
      if (JSON.stringify(row?.metadataFields) !== JSON.stringify(vector.expected.metadataFields)) throw new Error(`${toolId}: metadata fields`);
      if (row?.riskCount !== vector.expected.riskCount) throw new Error(`${toolId}: risk count`);
      replayed += 1;
    }
    for (const vector of fixture.errors as unknown as Array<{ input: { files: unknown[] }; code: string }>) {
      if (await asyncCode(() => module.run({ files: vector.input.files }, context)) !== vector.code) throw new Error(`${toolId}: declared error`);
      replayed += 1;
    }
  }

  if (toolId === "language-aware-text-statistics" || toolId === "smart-quote-normalizer" || toolId === "reading-time-estimator" || toolId === "lorem-sample-data-generator") {
    const fixture = await read("text-writing-local-jobs");
    if (toolId === "reading-time-estimator") {
      const section = fixture.reading_time as unknown as { vectors: Array<{ input: unknown; expected: Record<string, unknown> }>; errors: Array<{ input: unknown; code: string }> };
      for (const vector of section.vectors) {
        const result = await module.run(vector.input, context) as Record<string, unknown>;
        for (const [key, value] of Object.entries(vector.expected)) if (result[key] !== value) throw new Error(`${toolId}: ${key}`);
        replayed += 1;
      }
      for (const vector of section.errors) {
        if (code(() => { void module.run(vector.input, context); }) !== vector.code) throw new Error(`${toolId}: declared error`);
        replayed += 1;
      }
    }
    if (toolId === "smart-quote-normalizer") {
      const section = fixture.smart_quotes as unknown as { vectors: Array<{ input: unknown; expected: Record<string, unknown> }>; errors: Array<{ input: unknown; code: string }> };
      for (const vector of section.vectors) {
        const result = await module.run(vector.input, context) as Record<string, unknown>;
        for (const [key, value] of Object.entries(vector.expected)) if (result[key] !== value) throw new Error(`${toolId}: ${key}`);
        replayed += 1;
      }
      for (const vector of section.errors) {
        if (code(() => { void module.run(vector.input, context); }) !== vector.code) throw new Error(`${toolId}: declared error`);
        replayed += 1;
      }
    }
    if (toolId === "lorem-sample-data-generator") {
      const section = fixture.sample_data as unknown as { vectors: Array<{ type: string; count: number; seed: number; data: string; rows: string[] }>; errors: Array<{ input: unknown; code: string }> };
      for (const vector of section.vectors) {
        const result = await module.run({ type: vector.type, count: vector.count, seed: vector.seed }, context) as Record<string, unknown>;
        if (result.data !== vector.data || JSON.stringify(result.rows) !== JSON.stringify(vector.rows)) throw new Error(`${toolId}: deterministic sample data`);
        replayed += 1;
      }
      for (const vector of section.errors) {
        if (code(() => { void module.run(vector.input, context); }) !== vector.code) throw new Error(`${toolId}: declared error`);
        replayed += 1;
      }
    }
    if (toolId === "language-aware-text-statistics") {
      const section = fixture.language_statistics as unknown as { vectors: Array<{ input: unknown; expected: Record<string, unknown> }>; errors: Array<{ input: unknown; code: string }> };
      for (const vector of section.vectors) {
        const result = await module.run(vector.input, context) as Record<string, unknown>;
        if (result.dominantScript !== vector.expected.dominantScript || result.language !== vector.expected.language) throw new Error(`${toolId}: script classification`);
        replayed += 1;
      }
      for (const vector of section.errors) {
        if (code(() => { void module.run(vector.input, context); }) !== vector.code) throw new Error(`${toolId}: declared error`);
        replayed += 1;
      }
    }
  }

  if (toolId === "public-holiday-lookup") {
    const fixture = await read("holiday-calendar");
    for (const vector of fixture.vectors as unknown as Array<{ input: { country: string; year: number }; expected: { country: string; source: string; holidays: Array<Record<string, unknown>> } }>) {
      const result = await module.run(vector.input, context) as { country: string; source: string; holidays: Array<Record<string, unknown>> };
      if (result.country !== vector.expected.country || result.source !== vector.expected.source) throw new Error(`${toolId}: calendar identity`);
      if (JSON.stringify(result.holidays) !== JSON.stringify(vector.expected.holidays)) throw new Error(`${toolId}: published calendar mismatch`);
      if (new Set(result.holidays.map((holiday) => holiday.date)).size !== result.holidays.length) throw new Error(`${toolId}: two holidays share one date`);
      replayed += 1;
    }
    for (const vector of fixture.errors as unknown as Array<{ input: { country: string; year: number }; code: string }>) {
      if (await asyncCode(async () => module.run(vector.input, context)) !== vector.code) throw new Error(`${toolId}: declared error`);
      replayed += 1;
    }
  }

  if (replayed === 0) throw new Error(`${toolId}: no fixture vector was replayed`);
  return replayed;
}

// Nothing is written until every tool has passed, so a failure mid-run can never
// leave a partially rewritten receipt set behind as if it were evidence.
const built: Array<{ toolId: string; receipt: Record<string, unknown> }> = [];

for (const toolId of toolIds) {
  const manifestModule = await import(pathToFileURL(resolve(root, `src/tools/${toolId}/manifest.ts`)).href) as { default: ToolManifest };
  const manifest = manifestModule.default;
  if (manifest.id !== toolId) throw new Error(`${toolId}: imported manifest id is ${manifest.id}`);
  if (manifest.runtime.location !== "LOCAL" || manifest.runtime.network !== "forbidden") throw new Error(`${toolId}: Gold requires LOCAL/network-forbidden runtime`);
  if (manifest.engine !== "file-privacy" && manifest.engine !== "text-writing" && manifest.engine !== "date-time") throw new Error(`${toolId}: unexpected engine ${manifest.engine}`);
  const oracle = oracleRegistry.entries.find(({ id }) => id === manifest.gold.oracleEntryId);
  if (oracle === undefined) throw new Error(`${toolId}: oracle missing: ${manifest.gold.oracleEntryId}`);
  if (!oracleHasNoOpenGap(oracle)) throw new Error(`${toolId}: oracle is not high-confidence with zero unresolved gaps`);
  if (oracle.maintenance_class !== manifest.gold.maintenanceClass) throw new Error(`${toolId}: oracle/manifest maintenance class mismatch`);
  if (manifest.gold.fixtureFamilies.length === 0) throw new Error(`${toolId}: no declared fixture family`);
  for (const required of trancheFixtureFamilies[toolId]) {
    if (!manifest.gold.fixtureFamilies.includes(required)) throw new Error(`${toolId}: tranche fixture family is not declared: ${required}`);
  }
  const fixtures = manifest.gold.fixtureFamilies.map((id) => {
    const entry = fixtureIndex.families.find((candidate) => candidate.id === id);
    if (entry === undefined) throw new Error(`${toolId}: fixture family missing from index: ${id}`);
    return entry;
  });
  // The oracle must bind the family that pins its policy, otherwise the
  // "closed gap" claim is only prose.
  for (const required of trancheFixtureFamilies[toolId]) {
    const family = fixtures.find((entry) => entry.id === required);
    if (family === undefined || !oracle.truth_sources.some((source) => family.truth_sources.includes(source))) throw new Error(`${toolId}: oracle does not share a truth source with ${required}`);
  }
  const browserResult = results.find((result) => result.toolId === toolId);
  if (browserResult === undefined) throw new Error(`${toolId}: browser result missing`);
  if (browserResult.status !== "PASS" || browserResult.assertion.length === 0 || !/^[a-f0-9]{64}$/u.test(browserResult.outputSha256)) throw new Error(`${toolId}: browser semantic assertion evidence is incomplete`);
  if (browserResult.lazyScriptCount < 1 || browserResult.externalTaskRequests !== 0 || browserResult.nonGetTaskRequests !== 0 || browserResult.taskContentLeaks !== 0 || browserResult.runtimeErrors !== 0 || browserResult.horizontalOverflow !== false || browserResult.unlabeledControls !== 0) throw new Error(`${toolId}: browser locality/lazy/mobile/a11y evidence is incomplete`);
  if (browserResult.optionalAccountProbeFailures !== 1) throw new Error(`${toolId}: the optional account probe must be the only tolerated browser failure`);
  const italianError = italianErrorStates[toolId];
  if (italianError === undefined) throw new Error(`${toolId}: Italian error-state evidence missing`);
  if (italianError.verified !== true && (italianError.reason === undefined || italianError.reason.length === 0)) throw new Error(`${toolId}: Italian error state is neither verified nor explained`);
  if (italianError.verified === true && (italianError.sample === undefined || italianError.sample.length === 0)) throw new Error(`${toolId}: verified Italian error state carries no text`);

  const moduleImport = await import(pathToFileURL(resolve(root, `src/tools/${toolId}/module.ts`)).href) as { default: { run(input: unknown, context?: ToolExecutionContext, signal?: AbortSignal): Promise<unknown> } };
  const replayedVectors = await replayFixtureVectors(toolId, moduleImport.default);

  const testFiles = testFilesByEngine[manifest.engine];
  if (testFiles === undefined || testFiles.length === 0) throw new Error(`${toolId}: no engine test authority configured for ${manifest.engine}`);
  const [manifestText, fixtureTexts, testTexts] = await Promise.all([
    readFile(resolve(root, `src/tools/${toolId}/manifest.ts`), "utf8"),
    Promise.all(fixtures.map((entry) => readFile(resolve(root, entry.path), "utf8"))),
    Promise.all(testFiles.map((path) => readFile(resolve(root, path), "utf8"))),
  ]);
  const fixtureIdentities = Object.fromEntries(fixtures.map((entry, index) => [`fixture:${entry.id}:sha256`, sha256(fixtureTexts[index] ?? "")]));
  const receipt = {
    schemaVersion: 1,
    status: "GOLD",
    revision,
    sourceFingerprint,
    toolId,
    runtime: manifest.runtime,
    maintenanceClass: manifest.gold.maintenanceClass,
    engine: manifest.engine,
    engineVersion: engineVersionByTool[toolId],
    oracleEntryId: manifest.gold.oracleEntryId,
    fixtureFamilies: manifest.gold.fixtureFamilies,
    replayedFixtureVectors: replayedVectors,
    truthSources: [...new Set([...oracle.truth_sources, ...fixtures.flatMap((entry) => entry.truth_sources)])].sort(),
    resolvedFixtures: fixtures.map(({ id, path }) => ({ id, path })),
    browserContract: {
      assertion: browserResult.assertion,
      outputSha256: browserResult.outputSha256,
      locality: "zero external/non-GET/task-body requests",
      lazyLoad: "implementation script observed after submit",
      mobile: "390px without horizontal overflow",
      accessibility: "no unlabeled interactive form controls",
      italianErrorState: italianError,
      toleratedFailure: "exactly one /api/auth/session probe, which the optional account Worker owns on a real deployment",
    },
    propertyChecks: [
      "LOCAL/network-forbidden runtime",
      "high-confidence oracle with no open semantic gap, bound to the fixture family that pins its policy",
      "oracle/manifest maintenance class alignment",
      "all declared fixture families resolve from the canonical fixture index",
      "committed fixture vectors replayed through the public tool module, including declared error codes",
      "real route submit produced the tool-specific asserted output",
      "keyboard/mobile/a11y/locality/lazy browser acceptance",
      "Italian error state verified in the browser or explicitly unreachable",
    ],
    identities: {
      manifestSha256: sha256(manifestText),
      fixtureIndexSha256: sha256(fixtureIndexText),
      oracleRegistrySha256: sha256(oracleRegistryText),
      browserAcceptanceSha256: sha256(acceptanceText),
      acceptanceScriptSha256: sha256(acceptanceScriptText),
      unitTestsSha256: sha256(`${testTexts.join("\n")}\n${localJobsTestText}`),
      italianErrorCatalogSha256: sha256(italianErrorsText),
      ...fixtureIdentities,
    },
  };
  built.push({ toolId, receipt });
}

await mkdir(receiptRoot, { recursive: true });
for (const { toolId, receipt } of built) {
  await writeFile(resolve(receiptRoot, `${toolId}.gold.json`), `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
  console.log(`Gold PASS: ${toolId}, ${receipt.replayedFixtureVectors} fixture vector(s) replayed + exact browser assertion + Italian error state`);
}