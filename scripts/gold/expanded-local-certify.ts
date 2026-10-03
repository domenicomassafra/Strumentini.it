import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type { ToolManifest } from "../../src/catalog/manifest";
import { currentEvidenceSourceFingerprint, currentRevision } from "../lib/current-revision";

const toolIds = [
  "aspect-ratio-calculator",
  "batch-checksum-manifest",
  "bulk-domain-extractor",
  "canonical-url-helper",
  "checksum-verifier",
  "clean-zip-creator",
  "client-handoff-index-generator",
  "color-converter",
  "color-picker",
  "contact-sheet-generator",
  "contrast-checker",
  "conversion-rate-scenario",
  "cpa-cpc-cpm-calculator",
  "doi-link-builder",
  "doi-normalizer",
  "domain-subdomain-grouper",
  "dominant-color-extractor",
  "duplicate-file-finder",
  "email-domain-extractor",
  "favicon-app-icon-size-generator",
  "file-list-diff",
  "file-signature-detector",
  "filename-sanitizer",
  "folder-inventory",
  "folder-size-type-summary",
  "image-compare-slider",
  "image-compression",
  "image-crop",
  "image-dimensions-batch-inspector",
  "image-format-conversion",
  "image-metadata-viewer",
  "image-rename-batch-preview",
  "isbn-validator-converter",
  "palette-extractor",
  "perceptual-duplicate-finder",
  "quote-counter",
  "redirect-chain-inspector",
  "research-url-cleaner",
  "roas-calculator",
  "robots-directive-helper",
  "safe-share-checklist",
  "screenshot-border-background-helper",
  "secret-token-pattern-scanner",
  "timeline-sorter",
  "url-bulk-normalizer",
  "utm-parser",
  "zero-byte-orphan-finder",
  "zip-contents-inspector",
  "zip-creator",
] as const;

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
const receiptRoot = resolve(root, "quality/receipts/expanded-local");
const acceptancePath = resolve(receiptRoot, "browser-acceptance.json");
const acceptanceScriptPath = resolve(root, "scripts/acceptance-expanded-local.mjs");
const revision = await currentRevision(root);
const sourceFingerprint = await currentEvidenceSourceFingerprint(root);
const sha256 = (value: string | Uint8Array) => createHash("sha256").update(value).digest("hex");

if (toolIds.length !== 49 || new Set(toolIds).size !== 49) throw new Error(`expanded-local Gold set must contain exactly 49 unique tools; got ${toolIds.length}`);

const [fixtureIndexText, oracleRegistryText, acceptanceText, acceptanceScriptText] = await Promise.all([
  readFile(resolve(root, "quality/fixtures/index.json"), "utf8"),
  readFile(resolve(root, "quality/oracles/registry.json"), "utf8"),
  readFile(acceptancePath, "utf8"),
  readFile(acceptanceScriptPath, "utf8"),
]);
const fixtureIndex = JSON.parse(fixtureIndexText) as { readonly families: readonly FixtureEntry[] };
const oracleRegistry = JSON.parse(oracleRegistryText) as { readonly entries: readonly OracleEntry[] };
const acceptance = JSON.parse(acceptanceText) as BrowserAcceptance;

function isBrowserResult(value: unknown): value is BrowserResult {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const row = value as Partial<BrowserResult>;
  return typeof row.toolId === "string" && typeof row.status === "string" && typeof row.assertion === "string" && typeof row.outputSha256 === "string";
}

const acceptedTools = Array.isArray(acceptance.tools) ? acceptance.tools.filter((value): value is string => typeof value === "string") : [];
const results = Array.isArray(acceptance.results) ? acceptance.results.filter(isBrowserResult) : [];
if (acceptance.status !== "PASS") throw new Error("expanded-local browser acceptance is missing or not PASS");
if (acceptance.routesChecked !== 49 || acceptedTools.length !== 49 || new Set(acceptedTools).size !== 49) throw new Error("expanded-local browser acceptance must cover exactly 49 unique routes");
if (toolIds.some((id) => !acceptedTools.includes(id)) || acceptedTools.some((id) => !toolIds.includes(id as typeof toolIds[number]))) throw new Error("expanded-local browser acceptance tool set does not match the fixed 49-tool Gold set");
if (results.length !== 49 || new Set(results.map(({ toolId }) => toolId)).size !== 49) throw new Error("expanded-local browser acceptance must contain exactly one result per tool");
if (acceptance.externalTaskRequests !== 0 || acceptance.nonGetTaskRequests !== 0 || acceptance.taskContentLeaks !== 0 || acceptance.runtimeConsoleErrors !== 0 || acceptance.implementationEager !== false) throw new Error("expanded-local browser acceptance global locality/runtime contract is incomplete");
if (!Array.isArray(acceptance.lazyImplementationObservedFor) || toolIds.some((id) => !(acceptance.lazyImplementationObservedFor as unknown[]).includes(id))) throw new Error("expanded-local browser acceptance did not observe lazy implementation loading for every tool");
if (acceptance.scriptSha256 !== sha256(acceptanceScriptText)) throw new Error("expanded-local browser acceptance was generated by a different acceptance script revision");

const testFilesByEngine: Readonly<Record<string, readonly string[]>> = {
  "file-privacy": ["tests/file-privacy-engine.test.ts", "tests/file-privacy-modules.test.ts"],
  image: ["tests/image-resize-engine.test.ts", "tests/image-visual-tools.test.ts"],
  "image-visual": ["tests/image-visual-tools.test.ts"],
  "marketing-math": ["tests/url-marketing-tools.test.ts"],
  "research-knowledge": ["tests/research-reference-engine.test.ts"],
  "url-marketing": ["tests/url-marketing-tools.test.ts"],
};

function oracleHasNoOpenGap(oracle: OracleEntry): boolean {
  return oracle.confidence === "high" && (oracle.unresolved_gaps ?? []).every((gap) => /^No unresolved gap\b/iu.test(gap));
}

await mkdir(receiptRoot, { recursive: true });
for (const toolId of toolIds) {
  const manifestModule = await import(pathToFileURL(resolve(root, `src/tools/${toolId}/manifest.ts`)).href) as { default: ToolManifest };
  const manifest = manifestModule.default;
  if (manifest.id !== toolId) throw new Error(`${toolId}: imported manifest id is ${manifest.id}`);
  if (manifest.runtime.location !== "LOCAL" || manifest.runtime.network !== "forbidden") throw new Error(`${toolId}: Gold requires LOCAL/network-forbidden runtime`);
  const oracle = oracleRegistry.entries.find(({ id }) => id === manifest.gold.oracleEntryId);
  if (oracle === undefined) throw new Error(`${toolId}: oracle missing: ${manifest.gold.oracleEntryId}`);
  if (!oracleHasNoOpenGap(oracle)) throw new Error(`${toolId}: oracle is not high-confidence with zero unresolved gaps`);
  if (oracle.maintenance_class !== manifest.gold.maintenanceClass) throw new Error(`${toolId}: oracle/manifest maintenance class mismatch`);
  if (manifest.gold.fixtureFamilies.length === 0) throw new Error(`${toolId}: no declared fixture family`);
  const fixtures = manifest.gold.fixtureFamilies.map((id) => {
    const entry = fixtureIndex.families.find((candidate) => candidate.id === id);
    if (entry === undefined) throw new Error(`${toolId}: fixture family missing from index: ${id}`);
    return entry;
  });
  const browserResult = results.find((result) => result.toolId === toolId);
  if (browserResult === undefined) throw new Error(`${toolId}: browser result missing`);
  if (browserResult.status !== "PASS" || browserResult.assertion.length === 0 || !/^[a-f0-9]{64}$/u.test(browserResult.outputSha256)) throw new Error(`${toolId}: browser semantic assertion evidence is incomplete`);
  if (browserResult.lazyScriptCount < 1 || browserResult.externalTaskRequests !== 0 || browserResult.nonGetTaskRequests !== 0 || browserResult.taskContentLeaks !== 0 || browserResult.runtimeErrors !== 0 || browserResult.horizontalOverflow !== false || browserResult.unlabeledControls !== 0) throw new Error(`${toolId}: browser locality/lazy/mobile/a11y evidence is incomplete`);

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
    oracleEntryId: manifest.gold.oracleEntryId,
    fixtureFamilies: manifest.gold.fixtureFamilies,
    truthSources: [...new Set([...oracle.truth_sources, ...fixtures.flatMap((entry) => entry.truth_sources)])].sort(),
    resolvedFixtures: fixtures.map(({ id, path }) => ({ id, path })),
    browserContract: {
      assertion: browserResult.assertion,
      outputSha256: browserResult.outputSha256,
      locality: "zero external/non-GET/task-body requests",
      lazyLoad: "implementation script observed after submit",
      mobile: "390px without horizontal overflow",
      accessibility: "no unlabeled interactive form controls",
    },
    propertyChecks: [
      "LOCAL/network-forbidden runtime",
      "high-confidence oracle with no open semantic gap",
      "oracle/manifest maintenance class alignment",
      "all declared fixture families resolve from the canonical fixture index",
      "real route submit produced the tool-specific asserted output",
      "keyboard/mobile/a11y/locality/lazy browser acceptance",
    ],
    identities: {
      manifestSha256: sha256(manifestText),
      fixtureIndexSha256: sha256(fixtureIndexText),
      oracleRegistrySha256: sha256(oracleRegistryText),
      browserAcceptanceSha256: sha256(acceptanceText),
      acceptanceScriptSha256: sha256(acceptanceScriptText),
      unitTestsSha256: sha256(testTexts.join("\n")),
      ...fixtureIdentities,
    },
  };
  await writeFile(resolve(receiptRoot, `${toolId}.gold.json`), `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
  console.log(`Gold PASS: ${toolId}, oracle/fixtures + exact browser assertion + locality/lazy/mobile/a11y`);
}
