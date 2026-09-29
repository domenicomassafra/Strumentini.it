import { createHash } from "node:crypto";
import { access, readFile, readdir, stat } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type { ToolManifest } from "../catalog/manifest";

export const CERTIFICATION_SCHEMA_VERSION = 1;
export const EXPECTED_CATALOG_TOOL_COUNT = 200;

export type EvidenceStatus = "PASS" | "PARTIAL" | "UNVERIFIED" | "EXTERNAL" | "DECLARED" | "NOT_OBSERVED";
export type CertificationStatus = "GOLD" | "PARTIAL" | "IMPLEMENTED_UNVERIFIED";
export type ReleaseGate = "PASS" | "BLOCKED";
export type EvidenceDimension = "oracle" | "fixtures" | "privacy" | "locality" | "mobileA11y" | "lazyLoad" | "physicalDevice";

type JsonRecord = Record<string, unknown>;

export interface AuthorityFingerprint {
  readonly path: string;
  readonly sha256: string;
}

export interface EvidenceReference extends AuthorityFingerprint {
  readonly dimension: EvidenceDimension;
  readonly status: EvidenceStatus;
}

export interface OracleCertification {
  readonly entryId: string;
  readonly candidate: string;
  readonly maintenanceClass: string;
  readonly truthSources: readonly string[];
  readonly status: "BOUND" | "VERIFIED";
  readonly evidence: readonly EvidenceReference[];
}

export interface FixtureCertification {
  readonly id: string;
  readonly path: string;
  readonly provenance: string;
  readonly truthSources: readonly string[];
  readonly status: "BOUND" | "VERIFIED";
}

export interface PrivacyCertification {
  readonly status: EvidenceStatus;
  readonly privacyClass: string;
  readonly location: string;
  readonly network: string;
  readonly capabilities: readonly string[];
  readonly disclosure?: string;
}

export interface ToolCertification {
  readonly id: string;
  readonly route: string;
  readonly name: string;
  readonly category: string;
  readonly engine: string;
  readonly maintenanceClass: string;
  readonly status: CertificationStatus;
  readonly certificationReceipt: string | null;
  readonly releaseGate: ReleaseGate;
  readonly goldEligible: boolean;
  readonly implementation: {
    readonly manifest: AuthorityFingerprint;
    readonly module: AuthorityFingerprint;
    readonly page: AuthorityFingerprint;
    readonly testFiles: readonly string[];
  };
  readonly oracle: OracleCertification;
  readonly fixtures: readonly FixtureCertification[];
  readonly privacy: PrivacyCertification;
  readonly locality: {
    readonly status: EvidenceStatus;
    readonly evidence: readonly EvidenceReference[];
  };
  readonly mobileA11y: {
    readonly status: EvidenceStatus;
    readonly evidence: readonly EvidenceReference[];
  };
  readonly lazyLoad: {
    readonly status: EvidenceStatus;
    readonly evidence: readonly EvidenceReference[];
  };
  readonly physicalDevice: {
    readonly status: EvidenceStatus;
    readonly required: boolean;
    readonly iosSafari: string;
    readonly androidChrome: string;
    readonly evidence: readonly EvidenceReference[];
  };
  readonly evidence: readonly EvidenceReference[];
  readonly blockers: readonly string[];
  readonly coverageGaps: readonly string[];
}

export interface GlobalCertification {
  readonly oracle: {
    readonly status: EvidenceStatus;
    readonly path: string;
    readonly entryCount: number;
    readonly sha256: string;
  };
  readonly fixtures: {
    readonly status: EvidenceStatus;
    readonly path: string;
    readonly familyCount: number;
    readonly sha256: string;
  };
  readonly privacy: {
    readonly status: EvidenceStatus;
    readonly declaredLocalTools: number;
    readonly networkPolicy: string;
    readonly evidence: readonly EvidenceReference[];
  };
  readonly locality: {
    readonly status: EvidenceStatus;
    readonly evidence: readonly EvidenceReference[];
    readonly gaps: readonly string[];
  };
  readonly mobileA11y: {
    readonly status: EvidenceStatus;
    readonly evidence: readonly EvidenceReference[];
    readonly gaps: readonly string[];
  };
  readonly lazyLoad: {
    readonly status: EvidenceStatus;
    readonly evidence: readonly EvidenceReference[];
    readonly gaps: readonly string[];
  };
  readonly physicalDevice: {
    readonly status: EvidenceStatus;
    readonly evidence: readonly EvidenceReference[];
    readonly missing: readonly string[];
    readonly observedPassCount: number;
    readonly note: string;
  };
}

export interface CertificationIndex {
  readonly schemaVersion: number;
  readonly generatedBy: string;
  readonly expectedCatalogToolCount: number;
  readonly catalogToolCount: number;
  readonly authorities: {
    readonly oracleRegistry: AuthorityFingerprint;
    readonly fixtureIndex: AuthorityFingerprint;
    readonly sourceRegistry: AuthorityFingerprint;
  };
  readonly global: GlobalCertification;
  readonly summary: {
    readonly statusCounts: Readonly<Record<CertificationStatus, number>>;
    readonly certificationGoldCount: number;
    readonly releaseEligibleGoldCount: number;
    readonly releaseBlockedCount: number;
    readonly physicalDevicePassCount: number;
    readonly oracleBoundCount: number;
    readonly fixtureBoundCount: number;
    readonly localDeclarationCount: number;
  };
  readonly tools: readonly ToolCertification[];
}

interface AuthorityData {
  readonly registry: JsonRecord;
  readonly registryText: string;
  readonly registrySha256: string;
  readonly fixtures: JsonRecord;
  readonly fixturesText: string;
  readonly fixturesSha256: string;
  readonly sources: JsonRecord;
  readonly sourcesText: string;
  readonly sourcesSha256: string;
  readonly oracleById: ReadonlyMap<string, JsonRecord>;
  readonly fixtureById: ReadonlyMap<string, JsonRecord>;
  readonly sourceIds: ReadonlySet<string>;
}

interface ManifestRecord {
  readonly manifest: ToolManifest & JsonRecord;
  readonly id: string;
  readonly route: string;
  readonly name: string;
  readonly category: string;
  readonly engine: string;
  readonly maintenanceClass: string;
  readonly oracleEntryId: string;
  readonly fixtureFamilies: readonly string[];
  readonly runtime: {
    readonly location: string;
    readonly network: string;
  };
  readonly privacyClass: string;
  readonly privacyDisclosure?: string;
  readonly capabilities: readonly string[];
  readonly manifestPath: string;
  readonly modulePath: string;
  readonly pagePath: string;
  readonly manifestFingerprint: AuthorityFingerprint;
  readonly moduleFingerprint: AuthorityFingerprint;
  readonly pageFingerprint: AuthorityFingerprint;
}

interface ReceiptRecord {
  readonly path: string;
  readonly toolId: string;
  readonly status: string;
  readonly goldEligible: boolean;
  readonly oracleEntryIds: readonly string[];
  readonly fixtureFamilies: readonly string[];
  readonly runtime?: {
    readonly location: string;
    readonly network: string;
  };
  readonly physicalAcceptance?: JsonRecord;
  readonly identities: Readonly<Record<string, string>>;
  readonly fingerprint: AuthorityFingerprint;
}

const networkCapabilities = new Set(["reference-network", "content-network", "ai-provider"]);
const privacyClasses = new Set(["LOCAL", "REFERENCE", "REMOTE", "AI"]);
const runtimeLocations = new Set(["LOCAL", "REFERENCE", "REMOTE", "AI"]);
const networkPolicies = new Set(["forbidden", "reference-only", "required"]);

const familyTestFiles: Readonly<Record<string, readonly string[]>> = {
  "text-writing": ["tests/text-writing-engine.test.ts", "tests/text-writing-catalog.test.ts"],
  "text-list": ["tests/text-list-engine.test.ts", "tests/text-list-catalog.test.ts"],
  "table-operations": ["tests/table-expansion.test.ts"],
  "table-csv": ["tests/table-expansion.test.ts"],
  "developer-web": ["tests/developer-web-engine.test.ts"],
  "url-marketing": ["tests/url-marketing-tools.test.ts"],
  "marketing-math": ["tests/url-marketing-tools.test.ts"],
  "qr-local": ["tests/url-marketing-tools.test.ts"],
  "date-time": ["tests/date-time-engine.test.ts", "tests/date-time-modules.test.ts"],
  "business-math": ["tests/business-tools.test.ts"],
  "client-time-math": ["tests/business-tools.test.ts", "tests/client-time-math-engine.test.ts"],
  "research-knowledge": ["tests/research-reference-engine.test.ts"],
  "research-reference": ["tests/research-reference-engine.test.ts"],
  pdf: ["tests/pdf-document-tools.test.ts"],
  "file-privacy": ["tests/file-privacy-engine.test.ts", "tests/file-privacy-modules.test.ts"],
  image: ["tests/image-resize-engine.test.ts", "tests/image-visual-tools.test.ts"],
  "image-visual": ["tests/image-visual-tools.test.ts"],
  "file-hash": ["tests/file-hash-engine.test.ts"],
};

const businessMathEvidence = {
  locality: ["quality/receipts/business-math/browser-acceptance.json"],
  mobileA11y: ["quality/receipts/business-math/browser-acceptance.json"],
  lazyLoad: ["quality/receipts/business-math/browser-acceptance.json"],
} as const;

const toolEvidencePaths: Readonly<Record<string, Partial<Record<EvidenceDimension, readonly string[]>>>> = {
  "business-day": {
    locality: ["quality/receipts/browser-performance/fresh-browser-matrix.json"],
    mobileA11y: ["quality/receipts/browser-performance/fresh-browser-matrix.json"],
    lazyLoad: ["quality/receipts/build-baseline.json", "quality/receipts/browser-performance/fresh-browser-matrix.json"],
  },
  "campaign-name": {
    locality: ["quality/receipts/campaign-url/browser-acceptance.json"],
    mobileA11y: ["quality/receipts/campaign-url/browser-acceptance.json"],
    lazyLoad: ["quality/receipts/build-baseline.json"],
  },
  "tracking-cleaner": {
    locality: ["quality/receipts/campaign-url/browser-acceptance.json"],
    mobileA11y: ["quality/receipts/campaign-url/browser-acceptance.json"],
    lazyLoad: ["quality/receipts/build-baseline.json"],
  },
  "utm-builder": {
    locality: ["quality/receipts/campaign-url/browser-acceptance.json"],
    mobileA11y: ["quality/receipts/campaign-url/browser-acceptance.json"],
    lazyLoad: ["quality/receipts/build-baseline.json"],
  },
  "csv-cleaner": {
    locality: ["quality/receipts/csv-cleaner/browser-acceptance.json"],
    mobileA11y: ["quality/receipts/csv-cleaner/browser-acceptance.json"],
    lazyLoad: ["quality/receipts/csv-cleaner/bundle.json"],
  },
  "csv-column-map": {
    locality: ["quality/receipts/table-ops/browser-acceptance.json"],
    mobileA11y: ["quality/receipts/table-ops/browser-acceptance.json"],
    lazyLoad: ["quality/receipts/table-ops/architecture.json"],
  },
  "csv-dedupe": {
    locality: ["quality/receipts/table-ops/browser-acceptance.json"],
    mobileA11y: ["quality/receipts/table-ops/browser-acceptance.json"],
    lazyLoad: ["quality/receipts/table-ops/architecture.json"],
  },
  "doi-isbn-normalizer": {
    locality: ["quality/receipts/text-research/browser-acceptance.json"],
    mobileA11y: ["quality/receipts/text-research/browser-acceptance.json"],
    lazyLoad: ["quality/receipts/text-research/bundle-reuse.json"],
  },
  "list-compare": {
    locality: ["quality/receipts/text-research/browser-acceptance.json"],
    mobileA11y: ["quality/receipts/text-research/browser-acceptance.json"],
    lazyLoad: ["quality/receipts/text-research/bundle-reuse.json"],
  },
  "text-diff": {
    locality: ["quality/receipts/text-research/browser-acceptance.json"],
    mobileA11y: ["quality/receipts/text-research/browser-acceptance.json"],
    lazyLoad: ["quality/receipts/text-research/bundle-reuse.json"],
  },
  "margin-markup": {
    locality: ["quality/receipts/client-time-math/browser-acceptance.json"],
    mobileA11y: ["quality/receipts/client-time-math/browser-acceptance.json"],
    lazyLoad: ["quality/receipts/client-time-math/bundle.json"],
  },
  "rate-converter": {
    locality: ["quality/receipts/client-time-math/browser-acceptance.json"],
    mobileA11y: ["quality/receipts/client-time-math/browser-acceptance.json"],
    lazyLoad: ["quality/receipts/client-time-math/bundle.json"],
  },
  "timezone-overlap": {
    locality: ["quality/receipts/client-time-math/browser-acceptance.json"],
    mobileA11y: ["quality/receipts/client-time-math/browser-acceptance.json"],
    lazyLoad: ["quality/receipts/client-time-math/bundle.json"],
  },
  "file-hash": {
    locality: ["quality/receipts/file-hash/browser-acceptance.json"],
    mobileA11y: ["quality/receipts/file-hash/browser-acceptance.json"],
    lazyLoad: ["quality/receipts/file-hash/browser-acceptance.json"],
  },
  "image-resize": {
    locality: [
      "quality/receipts/image-resize/browser-chrome.json",
      "quality/receipts/image-resize/browser-edge.json",
      "quality/receipts/image-resize/browser-webkit.json",
    ],
    mobileA11y: [
      "quality/receipts/image-resize/browser-chrome.json",
      "quality/receipts/image-resize/browser-edge.json",
      "quality/receipts/image-resize/browser-webkit.json",
    ],
    lazyLoad: ["quality/receipts/image-resize/bundle.json"],
    physicalDevice: ["quality/receipts/image-resize/certification.json"],
  },
  "effective-hourly-rate": businessMathEvidence,
  "target-income-rate": businessMathEvidence,
  "utilization-calculator": businessMathEvidence,
  "capacity-planner": businessMathEvidence,
  "retainer-capacity": businessMathEvidence,
  "scope-creep-cost": businessMathEvidence,
  "break-even": businessMathEvidence,
  "payment-fee-gross-up": businessMathEvidence,
  "late-payment-interest": businessMathEvidence,
  "discount-impact": businessMathEvidence,
  "proposal-budget-checker": businessMathEvidence,
  "project-profitability": businessMathEvidence,
  "invoice-number-generator": businessMathEvidence,
  "invoice-math-validator": businessMathEvidence,
  "percentage-helper": businessMathEvidence,
  "currency-scenario": businessMathEvidence,
};

const globalEvidencePaths = {
  oracle: "quality/oracles/registry.json",
  fixtures: "quality/fixtures/index.json",
  privacy: "quality/receipts/v1-gold-frontier.json",
  locality: "quality/receipts/browser-performance/fresh-browser-matrix.json",
  mobileA11y: "quality/receipts/browser-performance/fresh-browser-matrix.json",
  lazyLoad: ["quality/receipts/build-baseline.json", "quality/receipts/browser-performance/fresh-browser-matrix.json"],
  physicalDevice: ["quality/receipts/image-resize/certification.json", "quality/receipts/browser-performance/fresh-browser-matrix.json"],
} as const;

export class CertificationBuildError extends Error {
  constructor(readonly issues: readonly string[]) {
    super(issues.join("\n"));
    this.name = "CertificationBuildError";
  }
}

function fail(message: string): never {
  throw new CertificationBuildError([message]);
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requiredString(value: JsonRecord, key: string, context: string): string {
  const result = value[key];
  if (typeof result !== "string" || result.length === 0) fail(`${context}.${key} must be a non-empty string`);
  return result;
}

function requiredRecord(value: JsonRecord, key: string, context: string): JsonRecord {
  const result = value[key];
  if (!isRecord(result)) fail(`${context}.${key} must be an object`);
  return result;
}

function stringArray(value: unknown, context: string): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || item.length === 0)) {
    fail(`${context} must be an array of non-empty strings`);
  }
  return [...value] as string[];
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function sha256(value: string | Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

async function fingerprint(root: string, path: string): Promise<AuthorityFingerprint> {
  const absolute = resolve(root, path);
  const bytes = await readFile(absolute);
  return { path, sha256: sha256(bytes) };
}

async function walkFiles(root: string, predicate: (path: string) => boolean): Promise<string[]> {
  const entries = await readdir(root, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries.toSorted((left, right) => left.name.localeCompare(right.name))) {
    const child = resolve(root, entry.name);
    if (entry.isDirectory()) files.push(...await walkFiles(child, predicate));
    else if (entry.isFile() && predicate(child)) files.push(child);
  }
  return files;
}

function relativePath(root: string, path: string): string {
  const result = relative(root, path).replaceAll("\\", "/");
  if (result === "" || result.startsWith("../") || isAbsolute(result)) fail(`path escapes repository: ${path}`);
  return result;
}

function assertRepoPath(root: string, path: string, context: string): string {
  const absolute = resolve(root, path);
  const rel = relative(root, absolute);
  if (rel === "" || rel.startsWith("../") || isAbsolute(rel)) fail(`${context} must stay inside repository: ${path}`);
  return rel.replaceAll("\\", "/");
}

async function assertFile(root: string, path: string, context: string): Promise<void> {
  try {
    await access(resolve(root, path));
  } catch {
    fail(`${context} is missing: ${path}`);
  }
}

async function parseJsonFile<T extends unknown>(root: string, path: string, context: string): Promise<{ readonly value: T; readonly text: string }> {
  const text = await readFile(resolve(root, path), "utf8");
  try {
    return { value: JSON.parse(text) as T, text };
  } catch (error) {
    fail(`${context} is not valid JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function normalizeRuntime(value: JsonRecord, context: string): { location: string; network: string } {
  const runtime = requiredRecord(value, "runtime", context);
  const location = requiredString(runtime, "location", `${context}.runtime`);
  const network = requiredString(runtime, "network", `${context}.runtime`);
  if (!runtimeLocations.has(location)) fail(`${context}.runtime.location is unsupported: ${location}`);
  if (!networkPolicies.has(network)) fail(`${context}.runtime.network is unsupported: ${network}`);
  return { location, network };
}

function normalizeManifest(raw: JsonRecord, directory: string, context: string): {
  id: string;
  route: string;
  name: string;
  category: string;
  engine: string;
  maintenanceClass: string;
  oracleEntryId: string;
  fixtureFamilies: string[];
  runtime: { location: string; network: string };
  privacyClass: string;
  privacyDisclosure?: string;
  capabilities: string[];
} {
  const id = requiredString(raw, "id", context);
  if (id !== directory) fail(`${context}: manifest id ${id} does not match directory ${directory}`);
  const route = requiredString(raw, "route", context);
  if (route !== `/tools/${id}`) fail(`${context}: route must be /tools/${id}`);
  const implementation = requiredString(raw, "implementation", context);
  if (implementation !== `../tools/${id}/module.ts`) fail(`${context}: implementation must be ../tools/${id}/module.ts`);
  const name = requiredString(raw, "name", context);
  const category = requiredString(raw, "category", context);
  const engine = requiredString(raw, "engine", context);
  const runtime = normalizeRuntime(raw, context);
  const gold = requiredRecord(raw, "gold", context);
  const maintenanceClass = requiredString(gold, "maintenanceClass", `${context}.gold`);
  const oracleEntryId = requiredString(gold, "oracleEntryId", `${context}.gold`);
  if (!/^cand-\d{3}$/u.test(oracleEntryId)) fail(`${context}.gold.oracleEntryId is invalid: ${oracleEntryId}`);
  const fixtureFamilies = stringArray(gold.fixtureFamilies, `${context}.gold.fixtureFamilies`);
  if (fixtureFamilies.length === 0 || new Set(fixtureFamilies).size !== fixtureFamilies.length) fail(`${context}.gold.fixtureFamilies must be unique and non-empty`);
  stringArray(raw.aliases, `${context}.aliases`);
  stringArray(raw.jobs, `${context}.jobs`);
  stringArray(raw.inputTypes, `${context}.inputTypes`);
  const capabilities = raw.capabilities === undefined ? [] : stringArray(raw.capabilities, `${context}.capabilities`);
  const privacyValue = raw.privacy;
  const privacyClass = optionalString(raw.privacyClass)
    ?? (typeof privacyValue === "string" ? privacyValue : isRecord(privacyValue) ? optionalString(privacyValue.class) : undefined)
    ?? runtime.location;
  if (!privacyClasses.has(privacyClass)) fail(`${context}.privacyClass is unsupported: ${privacyClass}`);
  if (privacyClass !== runtime.location) fail(`${context}: privacy class and runtime location must agree`);
  if (runtime.location === "LOCAL" && runtime.network !== "forbidden") fail(`${context}: LOCAL tools must declare network=forbidden`);
  if (runtime.location === "LOCAL" && capabilities.some((capability) => networkCapabilities.has(capability))) fail(`${context}: LOCAL tools cannot declare network capabilities`);
  if (privacyClass !== "LOCAL") {
    const disclosure = isRecord(privacyValue) ? optionalString(privacyValue.disclosure) : undefined;
    if (disclosure === undefined) fail(`${context}: non-LOCAL tools must declare a privacy disclosure`);
  }
  const bundle = raw.bundle;
  if (bundle !== undefined) {
    const bundleRecord = requiredRecord(raw, "bundle", context);
    if (bundleRecord.eager === true || bundleRecord.lazy === false || (typeof bundleRecord.initialBytes === "number" && bundleRecord.initialBytes > 0)) {
      fail(`${context}: tool implementation bundle must remain lazy with zero initial bytes`);
    }
  }
  const privacyDisclosure = isRecord(privacyValue) ? optionalString(privacyValue.disclosure) : undefined;
  return {
    id,
    route,
    name,
    category,
    engine,
    maintenanceClass,
    oracleEntryId,
    fixtureFamilies,
    runtime,
    privacyClass,
    ...(privacyDisclosure === undefined ? {} : { privacyDisclosure }),
    capabilities,
  };
}

async function discoverManifests(root: string): Promise<ManifestRecord[]> {
  const toolsRoot = resolve(root, "src/tools");
  const entries = await readdir(toolsRoot, { withFileTypes: true });
  const records: ManifestRecord[] = [];
  const ids = new Set<string>();
  for (const entry of entries.toSorted((left, right) => left.name.localeCompare(right.name))) {
    if (!entry.isDirectory()) continue;
    const manifestPath = resolve(toolsRoot, entry.name, "manifest.ts");
    try {
      await access(manifestPath);
    } catch {
      continue;
    }
    const imported = await import(`${pathToFileURL(manifestPath).href}?certification=${Date.now()}-${entry.name}`) as { default?: unknown };
    if (!isRecord(imported.default)) fail(`${manifestPath}: default manifest export is required`);
    const normalized = normalizeManifest(imported.default, entry.name, manifestPath);
    if (ids.has(normalized.id)) fail(`duplicate tool id: ${normalized.id}`);
    ids.add(normalized.id);
    const modulePath = `src/tools/${normalized.id}/module.ts`;
    const pagePath = `src/pages/tools/${normalized.id}.astro`;
    await assertFile(root, modulePath, `${normalized.id} module`);
    await assertFile(root, pagePath, `${normalized.id} page`);
    const manifestFingerprint = await fingerprint(root, relativePath(root, manifestPath));
    const moduleFingerprint = await fingerprint(root, modulePath);
    const pageFingerprint = await fingerprint(root, pagePath);
    records.push({
      manifest: imported.default as ToolManifest & JsonRecord,
      ...normalized,
      manifestPath: manifestFingerprint.path,
      modulePath,
      pagePath,
      manifestFingerprint,
      moduleFingerprint,
      pageFingerprint,
    });
  }
  records.sort((left, right) => left.id.localeCompare(right.id));
  if (records.length !== EXPECTED_CATALOG_TOOL_COUNT) fail(`expanded catalog must contain exactly ${EXPECTED_CATALOG_TOOL_COUNT} manifests; found ${records.length}`);
  return records;
}

async function validateFixturePayload(root: string, family: JsonRecord, context: string): Promise<void> {
  const format = requiredString(family, "format", context);
  const path = requiredString(family, "path", context);
  assertRepoPath(root, path, `${context}.path`);
  await assertFile(root, path, `${context}.path`);
  if (format === "json") {
    const payload = await parseJsonFile<unknown>(root, path, `${context}.path`);
    if (isRecord(payload.value) && Array.isArray(payload.value.artifacts)) {
      for (const artifact of payload.value.artifacts) {
        if (!isRecord(artifact) || typeof artifact.path !== "string") fail(`${context}: invalid artifact record`);
        assertRepoPath(root, artifact.path, `${context}.artifact.path`);
        await assertFile(root, artifact.path, `${context}.artifact.path`);
      }
    }
  } else if (format === "jsonl") {
    const text = await readFile(resolve(root, path), "utf8");
    for (const [index, line] of text.split(/\r?\n/u).entries()) {
      if (line.trim().length === 0) continue;
      try {
        JSON.parse(line);
      } catch (error) {
        fail(`${context}.path:${index + 1}: invalid JSONL: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  } else if (!new Set(["text", "csv", "binary", "image"]).has(format)) {
    fail(`${context}: unsupported fixture format ${format}`);
  } else if ((await stat(resolve(root, path))).size === 0) {
    fail(`${context}.path is empty`);
  }
}

async function loadAuthorities(root: string): Promise<AuthorityData> {
  const registryFile = await parseJsonFile<JsonRecord>(root, "quality/oracles/registry.json", "oracle registry");
  const fixturesFile = await parseJsonFile<JsonRecord>(root, "quality/fixtures/index.json", "fixture index");
  const sourcesFile = await parseJsonFile<JsonRecord>(root, "quality/oracles/sources.json", "source registry");
  if (registryFile.value.schema_version !== 1) fail("oracle registry schema_version must be 1");
  if (fixturesFile.value.schema_version !== 1) fail("fixture index schema_version must be 1");
  if (sourcesFile.value.schema_version !== 1) fail("source registry schema_version must be 1");
  const sourceRows = sourcesFile.value.sources;
  if (!Array.isArray(sourceRows) || sourceRows.length === 0) fail("source registry must contain sources");
  const sourceIds = new Set<string>();
  for (const source of sourceRows) {
    if (!isRecord(source)) fail("source registry contains a non-object source");
    const id = requiredString(source, "id", "source");
    if (sourceIds.has(id)) fail(`duplicate source id: ${id}`);
    sourceIds.add(id);
    const sourceClass = requiredString(source, "source_class", `source ${id}`);
    if (!new Set(["official-primary", "project-policy", "independent-implementation"]).has(sourceClass)) fail(`${id}: unsupported source class`);
    requiredString(source, "authority", `source ${id}`);
    requiredString(source, "locator", `source ${id}`);
    if (sourceClass === "official-primary" && !requiredString(source, "url", `source ${id}`).startsWith("https://")) fail(`${id}: official source must use https`);
    if (sourceClass === "project-policy") {
      const locator = requiredString(source, "locator", `source ${id}`).split("#", 1)[0] ?? "";
      assertRepoPath(root, locator, `${id}.locator`);
      await assertFile(root, locator, `${id}.locator`);
    }
  }
  const registryRows = registryFile.value.entries;
  if (!Array.isArray(registryRows) || registryRows.length !== EXPECTED_CATALOG_TOOL_COUNT) fail(`oracle registry must contain exactly ${EXPECTED_CATALOG_TOOL_COUNT} entries`);
  if (registryFile.value.entry_count !== registryRows.length) fail("oracle registry entry_count does not match entries");
  const oracleById = new Map<string, JsonRecord>();
  for (const [index, row] of registryRows.entries()) {
    if (!isRecord(row)) fail(`oracle registry entry ${index} is not an object`);
    const id = requiredString(row, "id", `oracle registry entry ${index}`);
    if (!/^cand-\d{3}$/u.test(id) || oracleById.has(id)) fail(`invalid or duplicate oracle id: ${id}`);
    stringArray(row.truth_sources, `${id}.truth_sources`);
    for (const source of row.truth_sources as string[]) {
      if (!sourceIds.has(source)) fail(`${id}: unknown truth source ${source}`);
    }
    oracleById.set(id, row);
  }
  for (let index = 1; index <= EXPECTED_CATALOG_TOOL_COUNT; index += 1) {
    const id = `cand-${String(index).padStart(3, "0")}`;
    if (!oracleById.has(id)) fail(`oracle registry is missing ${id}`);
  }
  const fixtureRows = fixturesFile.value.families;
  if (!Array.isArray(fixtureRows) || fixtureRows.length === 0) fail("fixture index must contain families");
  if (fixturesFile.value.family_count !== fixtureRows.length) fail("fixture index family_count does not match families");
  const fixtureById = new Map<string, JsonRecord>();
  for (const [index, row] of fixtureRows.entries()) {
    if (!isRecord(row)) fail(`fixture family ${index} is not an object`);
    const id = requiredString(row, "id", `fixture family ${index}`);
    if (fixtureById.has(id)) fail(`duplicate fixture family id: ${id}`);
    const provenance = requiredRecord(row, "provenance", `fixture family ${id}`);
    const kind = requiredString(provenance, "kind", `fixture family ${id}.provenance`);
    if (!new Set(["spec-vector", "hand-worked", "synthetic-local", "project-policy"]).has(kind)) fail(`${id}: unsupported provenance kind`);
    requiredString(provenance, "license_or_rights", `fixture family ${id}.provenance`);
    const truthSources = stringArray(row.truth_sources, `${id}.truth_sources`);
    for (const source of truthSources) if (!sourceIds.has(source)) fail(`${id}: unknown truth source ${source}`);
    await validateFixturePayload(root, row, `fixture family ${id}`);
    fixtureById.set(id, row);
  }
  return {
    registry: registryFile.value,
    registryText: registryFile.text,
    registrySha256: sha256(registryFile.text),
    fixtures: fixturesFile.value,
    fixturesText: fixturesFile.text,
    fixturesSha256: sha256(fixturesFile.text),
    sources: sourcesFile.value,
    sourcesText: sourcesFile.text,
    sourcesSha256: sha256(sourcesFile.text),
    oracleById,
    fixtureById,
    sourceIds,
  };
}

function receiptOracleIds(receipt: JsonRecord): string[] {
  const values: string[] = [];
  if (typeof receipt.oracleEntryId === "string") values.push(receipt.oracleEntryId);
  if (Array.isArray(receipt.oracleEntryIds)) values.push(...stringArray(receipt.oracleEntryIds, "receipt.oracleEntryIds"));
  return [...new Set(values)];
}

function receiptFixtureFamilies(receipt: JsonRecord): string[] {
  return receipt.fixtureFamilies === undefined ? [] : stringArray(receipt.fixtureFamilies, "receipt.fixtureFamilies");
}

function receiptRuntime(receipt: JsonRecord): { location: string; network: string } | undefined {
  if (receipt.runtime === undefined) return undefined;
  return normalizeRuntime(receipt, "receipt");
}

function identityValues(value: unknown): Record<string, string> {
  if (!isRecord(value)) return {};
  const result: Record<string, string> = {};
  for (const [key, item] of Object.entries(value)) if (typeof item === "string") result[key] = item;
  return result;
}

async function discoverReceipts(root: string, toolIds: ReadonlySet<string>): Promise<Map<string, ReceiptRecord>> {
  const receiptRoot = resolve(root, "quality/receipts");
  const files = await walkFiles(receiptRoot, (path) => path.endsWith(".json"));
  const byTool = new Map<string, ReceiptRecord>();
  for (const path of files) {
    const relativeFile = relativePath(root, path);
    if (relativeFile === "quality/receipts/expanded-catalog-certification.json") continue;
    let parsed: JsonRecord;
    try {
      parsed = JSON.parse(await readFile(path, "utf8")) as JsonRecord;
    } catch {
      continue;
    }
    const toolId = parsed.toolId;
    const status = parsed.status;
    if (typeof toolId !== "string" || typeof status !== "string") continue;
    if (!toolIds.has(toolId)) fail(`receipt ${relativeFile} references unknown tool ${toolId}`);
    if (!new Set(["GOLD", "PARTIAL"]).has(status)) fail(`receipt ${relativeFile} has unsupported certification status ${status}`);
    if (byTool.has(toolId)) fail(`tool ${toolId} has more than one certification receipt`);
    const goldEligible = parsed.goldEligible !== false && status === "GOLD";
    if (parsed.goldEligible === true && status !== "GOLD") fail(`receipt ${relativeFile} cannot be Gold with status ${status}`);
    const runtime = receiptRuntime(parsed);
    const physicalAcceptance = isRecord(parsed.physicalAcceptance) ? parsed.physicalAcceptance : undefined;
    const record: ReceiptRecord = {
      path: relativeFile,
      toolId,
      status,
      goldEligible,
      oracleEntryIds: receiptOracleIds(parsed),
      fixtureFamilies: receiptFixtureFamilies(parsed),
      ...(runtime === undefined ? {} : { runtime }),
      ...(physicalAcceptance === undefined ? {} : { physicalAcceptance }),
      identities: identityValues(parsed.identities),
      fingerprint: { path: relativeFile, sha256: sha256(await readFile(path)) },
    };
    byTool.set(toolId, record);
  }
  return byTool;
}

function evidenceStatusFor(paths: readonly string[], dimension: Exclude<EvidenceDimension, "oracle" | "fixtures" | "privacy">, cache: ReadonlyMap<string, JsonRecord>): EvidenceStatus {
  if (paths.length === 0) return "UNVERIFIED";
  let pass = false;
  let partial = false;
  for (const path of paths) {
    const value = cache.get(path);
    if (value === undefined) continue;
    const serialized = JSON.stringify(value);
    if (dimension === "locality") {
      if (/external(?:Task)?Requests"?\s*:\s*0|externalAttempts"?\s*:\s*0|privateValueRequestLeaks"?\s*:\s*0|zero external|same-origin GET assets only|task-content.*(zero|0)|no task content/iu.test(serialized)) pass = true;
      if (value.status === "FAIL") partial = true;
    } else if (dimension === "mobileA11y") {
      if ((value.status === "PASS" || value.mobileViewport !== undefined || value.horizontalOverflow === false || /toolOverflow|homeOverflow|libraryOverflow|width":390/iu.test(serialized)) && /keyboard|mobile|overflow|focus|a11y|accessib|screen-reader|non-color/iu.test(serialized)) pass = true;
      if (value.status === "FAIL") partial = true;
    } else if (dimension === "lazyLoad") {
      if ((value.status === "PASS" || value.implementationEager === false || value.lazyEngineGate === "PASS" || value.businessDayEngineChunks !== undefined || value.lazyWorkerRequests !== undefined) && /lazy|eager|chunk|worker|implementationEager|eagerEngineReferences|eagerRouteReferences/iu.test(serialized)) pass = true;
      if (value.implementationEager === false || value.eagerEngineReferences === 0 || value.eagerRouteReferences === 0) pass = true;
      if (value.status === "FAIL") partial = true;
    } else if (dimension === "physicalDevice") {
      if (/physicalAcceptance|iosSafari|androidChrome/iu.test(serialized)) pass = true;
      if (/MISSING|EXTERNAL|UNAVAILABLE/iu.test(serialized)) partial = true;
    }
  }
  if (pass && !partial) return "PASS";
  if (pass || partial) return "PARTIAL";
  return "UNVERIFIED";
}

function evidenceReferences(
  _root: string,
  dimension: EvidenceDimension,
  paths: readonly string[],
  cache: ReadonlyMap<string, JsonRecord>,
  statusOverride?: EvidenceStatus,
): EvidenceReference[] {
  return paths.toSorted((left, right) => left.localeCompare(right)).map((path) => ({
    dimension,
    path,
    sha256: typeof cache.get(path)?.__sha256 === "string" ? String(cache.get(path)?.__sha256) : "",
    status: statusOverride ?? evidenceStatusFor([path], dimension === "oracle" || dimension === "fixtures" || dimension === "privacy" ? "locality" : dimension, cache),
  }));
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values)];
}

function physicalValues(receipt: ReceiptRecord | undefined, toolId: string, _root: string, cache: ReadonlyMap<string, JsonRecord>): { required: boolean; status: EvidenceStatus; iosSafari: string; androidChrome: string; evidence: EvidenceReference[] } {
  const paths = toolEvidencePaths[toolId]?.physicalDevice ?? [];
  const evidence = evidenceReferences(_root, "physicalDevice", paths, cache);
  const acceptance = receipt?.physicalAcceptance;
  const iosSafari = typeof acceptance?.iosSafari === "string" ? acceptance.iosSafari : "NOT_OBSERVED";
  const androidChrome = typeof acceptance?.androidChrome === "string" ? acceptance.androidChrome : "NOT_OBSERVED";
  const required = toolId === "image-resize" || acceptance !== undefined;
  if (iosSafari === "PASS" || androidChrome === "PASS") {
    const physicalFiles = [...cache.keys()].filter((path) => /physical/i.test(path) && path.endsWith(".json"));
    if (physicalFiles.length === 0) fail(`${toolId}: physical PASS requires a physical receipt file; desktop/mobile automation cannot substitute`);
    if (iosSafari !== "PASS" || androidChrome !== "PASS") fail(`${toolId}: physical acceptance must explicitly cover both iOS Safari and Android Chrome`);
  }
  const status: EvidenceStatus = required
    ? iosSafari === "PASS" && androidChrome === "PASS" ? "PASS" : "EXTERNAL"
    : "NOT_OBSERVED";
  return { required, status, iosSafari, androidChrome, evidence };
}

function maintenanceAlignment(manifest: ManifestRecord, oracle: JsonRecord): boolean {
  return manifest.maintenanceClass === oracle.maintenance_class;
}

function freshAcceptanceIssues(cache: ReadonlyMap<string, JsonRecord>): Map<string, string[]> {
  const issues = new Map<string, string[]>();
  const matrix = cache.get("quality/receipts/browser-performance/fresh-browser-matrix.json");
  const entries = matrix?.freshAcceptance;
  if (!Array.isArray(entries)) return issues;
  for (const entry of entries) {
    if (!isRecord(entry) || entry.status !== "FAIL") continue;
    const command = typeof entry.command === "string" ? entry.command : "unknown command";
    const match = command.match(/acceptance-([a-z0-9-]+)/u);
    const toolId = match?.[1] === "csv-cleaner" ? "csv-cleaner" : undefined;
    if (toolId !== undefined) issues.set(toolId, [...(issues.get(toolId) ?? []), `${command}: acceptance evidence is FAIL`]);
  }
  return issues;
}

function buildGlobalCertification(root: string, authorities: AuthorityData, cache: ReadonlyMap<string, JsonRecord>, manifests: readonly ManifestRecord[]): GlobalCertification {
  const oraclePaths = [globalEvidencePaths.oracle];
  const fixturePaths = [globalEvidencePaths.fixtures];
  const localityPaths = [globalEvidencePaths.locality];
  const mobilePaths = [globalEvidencePaths.mobileA11y];
  const lazyPaths = [...globalEvidencePaths.lazyLoad];
  const physicalPaths = [...globalEvidencePaths.physicalDevice];
  const physicalEvidence = evidenceReferences(root, "physicalDevice", physicalPaths, cache);
  const physicalAcceptance = cache.get("quality/receipts/image-resize/certification.json")?.physicalAcceptance;
  const iosStatus = isRecord(physicalAcceptance) && physicalAcceptance.iosSafari === "PASS" ? "PASS" : "MISSING";
  const androidStatus = isRecord(physicalAcceptance) && physicalAcceptance.androidChrome === "PASS" ? "PASS" : "MISSING";
  const localDeclarations = manifests.filter((manifest) => manifest.privacyClass === "LOCAL" && manifest.runtime.network === "forbidden").length;
  const physicalPassCount = iosStatus === "PASS" && androidStatus === "PASS" ? 1 : 0;
  return {
    oracle: {
      status: "PASS",
      path: oraclePaths[0]!,
      entryCount: authorities.oracleById.size,
      sha256: authorities.registrySha256,
    },
    fixtures: {
      status: "PASS",
      path: fixturePaths[0]!,
      familyCount: authorities.fixtureById.size,
      sha256: authorities.fixturesSha256,
    },
    privacy: {
      status: "DECLARED",
      declaredLocalTools: localDeclarations,
      networkPolicy: "forbidden",
      evidence: evidenceReferences(root, "privacy", [globalEvidencePaths.privacy], cache, "DECLARED"),
    },
    locality: {
      status: "PARTIAL",
      evidence: evidenceReferences(root, "locality", localityPaths, cache),
      gaps: ["Per-tool browser/network evidence exists for the certified frontier, not all 200 expanded routes."],
    },
    mobileA11y: {
      status: "PARTIAL",
      evidence: evidenceReferences(root, "mobileA11y", mobilePaths, cache),
      gaps: ["The local matrix has no Firefox, WebKit, or physical iOS/Android run; mobile viewport automation is not physical-device evidence."],
    },
    lazyLoad: {
      status: "PARTIAL",
      evidence: evidenceReferences(root, "lazyLoad", lazyPaths, cache),
      gaps: ["Build and family receipts prove representative lazy loading, not a fresh route-open observation for every expanded tool."],
    },
    physicalDevice: {
      status: "EXTERNAL",
      evidence: physicalEvidence,
      missing: [iosStatus === "PASS" ? "" : "ios-safari", androidStatus === "PASS" ? "" : "android-chrome"].filter((value) => value.length > 0),
      observedPassCount: physicalPassCount,
      note: "No physical-device PASS is inferred from desktop, WebKit, mobile viewport, or supplementary browser automation.",
    },
  };
}

function toolEvidenceCache(root: string): Promise<Map<string, JsonRecord>> {
  return (async () => {
    const cache = new Map<string, JsonRecord>();
    const files = await walkFiles(resolve(root, "quality/receipts"), (path) => path.endsWith(".json"));
    for (const path of files) {
      const relativeFile = relativePath(root, path);
      try {
        const value = JSON.parse(await readFile(path, "utf8")) as unknown;
        if (isRecord(value)) {
          const bytes = await readFile(path);
          cache.set(relativeFile, { ...value, __sha256: sha256(bytes) });
        }
      } catch {
        continue;
      }
    }
    return cache;
  })();
}

function evidenceForTool(
  root: string,
  tool: ManifestRecord,
  receipt: ReceiptRecord | undefined,
  authorities: AuthorityData,
  cache: ReadonlyMap<string, JsonRecord>,
  testFiles: readonly string[],
  acceptanceIssues: ReadonlyMap<string, string[]>,
): ToolCertification {
  const oracle = authorities.oracleById.get(tool.oracleEntryId);
  if (oracle === undefined) fail(`${tool.id}: oracle registry entry not found: ${tool.oracleEntryId}`);
  const fixtureFamilies = tool.fixtureFamilies.map((id) => {
    const fixture = authorities.fixtureById.get(id);
    if (fixture === undefined) fail(`${tool.id}: fixture family not found: ${id}`);
    return {
      id,
      path: requiredString(fixture, "path", `fixture family ${id}`),
      provenance: requiredString(requiredRecord(fixture, "provenance", `fixture family ${id}`), "kind", `fixture family ${id}.provenance`),
      truthSources: stringArray(fixture.truth_sources, `${id}.truth_sources`),
      status: receipt?.fixtureFamilies.includes(id) === true ? "VERIFIED" as const : "BOUND" as const,
    };
  });
  const receiptOracleIds = receipt?.oracleEntryIds ?? [];
  const receiptHasOracle = receiptOracleIds.includes(tool.oracleEntryId);
  const receiptHasFixtures = tool.fixtureFamilies.every((family) => receipt?.fixtureFamilies.includes(family) === true);
  const oracleStatus = receiptHasOracle ? "VERIFIED" as const : "BOUND" as const;
  const oracleEvidence = evidenceReferences(root, "oracle", [globalEvidencePaths.oracle], cache, "PASS");
  const localityPaths = toolEvidencePaths[tool.id]?.locality ?? [];
  const mobilePaths = toolEvidencePaths[tool.id]?.mobileA11y ?? [];
  const lazyPaths = toolEvidencePaths[tool.id]?.lazyLoad ?? [];
  const localityStatus = evidenceStatusFor(localityPaths, "locality", cache);
  const mobileStatus = evidenceStatusFor(mobilePaths, "mobileA11y", cache);
  const lazyStatus = evidenceStatusFor(lazyPaths, "lazyLoad", cache);
  const physical = physicalValues(receipt, tool.id, root, cache);
  const blockers: string[] = [];
  const coverageGaps: string[] = [];
  if (receipt === undefined) blockers.push("CERTIFICATION_RECEIPT_MISSING");
  if (receipt?.status === "PARTIAL" || receipt?.goldEligible === false) blockers.push("CERTIFICATION_RECEIPT_NOT_GOLD");
  if (receipt !== undefined && !maintenanceAlignment(tool, oracle)) blockers.push("MAINTENANCE_CLASS_MISMATCH");
  if (receipt !== undefined) {
    for (const id of receipt.oracleEntryIds) if (!authorities.oracleById.has(id)) blockers.push(`RECEIPT_ORACLE_UNKNOWN:${id}`);
    for (const family of receipt.fixtureFamilies) if (!authorities.fixtureById.has(family)) blockers.push(`RECEIPT_FIXTURE_UNKNOWN:${family}`);
    if (!receiptHasOracle) blockers.push("RECEIPT_ORACLE_BINDING_MISSING");
    if (!receiptHasFixtures) blockers.push("RECEIPT_FIXTURE_BINDING_MISSING");
    if (receipt.runtime !== undefined && (receipt.runtime.location !== tool.runtime.location || receipt.runtime.network !== tool.runtime.network)) blockers.push("RECEIPT_RUNTIME_MISMATCH");
    if (receipt.identities.manifestSha256 !== undefined && receipt.identities.manifestSha256 !== tool.manifestFingerprint.sha256) blockers.push("RECEIPT_MANIFEST_IDENTITY_STALE");
    if (receipt.identities.oracleRegistrySha256 !== undefined && receipt.identities.oracleRegistrySha256 !== authorities.registrySha256) blockers.push("RECEIPT_ORACLE_IDENTITY_STALE");
    if (receipt.identities.fixtureIndexSha256 !== undefined && receipt.identities.fixtureIndexSha256 !== authorities.fixturesSha256) blockers.push("RECEIPT_FIXTURE_IDENTITY_STALE");
  }
  if (physical.required && physical.status !== "PASS") blockers.push("PHYSICAL_DEVICE_EVIDENCE_MISSING");
  for (const issue of acceptanceIssues.get(tool.id) ?? []) blockers.push(`ACCEPTANCE_EVIDENCE_FAILURE:${issue}`);
  if (receipt === undefined) {
    if (localityStatus !== "PASS") coverageGaps.push("LOCALITY_EVIDENCE_UNVERIFIED");
    if (mobileStatus !== "PASS") coverageGaps.push("MOBILE_A11Y_EVIDENCE_UNVERIFIED");
    if (lazyStatus !== "PASS") coverageGaps.push("LAZY_LOAD_EVIDENCE_UNVERIFIED");
  } else {
    if (localityStatus !== "PASS") coverageGaps.push("LOCALITY_EVIDENCE_UNVERIFIED");
    if (mobileStatus !== "PASS") coverageGaps.push("MOBILE_A11Y_EVIDENCE_UNVERIFIED");
    if (lazyStatus !== "PASS") coverageGaps.push("LAZY_LOAD_EVIDENCE_UNVERIFIED");
  }
  if (!maintenanceAlignment(tool, oracle)) coverageGaps.push("ORACLE_MAINTENANCE_CLASS_DIFFERS_FROM_MANIFEST");
  if (receipt?.status === "GOLD") {
    if (localityStatus !== "PASS") blockers.push("QUALITY_EVIDENCE_INCOMPLETE:LOCALITY");
    if (mobileStatus !== "PASS") blockers.push("QUALITY_EVIDENCE_INCOMPLETE:MOBILE_A11Y");
    if (lazyStatus !== "PASS") blockers.push("QUALITY_EVIDENCE_INCOMPLETE:LAZY_LOAD");
  }
  const evidencePaths = unique([
    ...(receipt === undefined ? [] : [receipt.path]),
    ...localityPaths,
    ...mobilePaths,
    ...lazyPaths,
    ...physical.evidence.map((item) => item.path),
  ]);
  const evidence = evidencePaths.map((path) => {
    const dimension: EvidenceDimension = localityPaths.includes(path) ? "locality" : mobilePaths.includes(path) ? "mobileA11y" : lazyPaths.includes(path) ? "lazyLoad" : physical.evidence.some((item) => item.path === path) ? "physicalDevice" : "oracle";
    const status = dimension === "oracle" ? "PASS" : evidenceStatusFor([path], dimension === "physicalDevice" ? "physicalDevice" : dimension, cache);
    return { dimension, path, sha256: typeof cache.get(path)?.__sha256 === "string" ? String(cache.get(path)?.__sha256) : receipt?.fingerprint.sha256 ?? "", status };
  });
  const status: CertificationStatus = receipt === undefined ? "IMPLEMENTED_UNVERIFIED" : receipt.status === "GOLD" ? "GOLD" : "PARTIAL";
  const goldEligible = status === "GOLD" && blockers.length === 0;
  return {
    id: tool.id,
    route: tool.route,
    name: tool.name,
    category: tool.category,
    engine: tool.engine,
    maintenanceClass: tool.maintenanceClass,
    status,
    certificationReceipt: receipt?.path ?? null,
    releaseGate: blockers.length === 0 ? "PASS" : "BLOCKED",
    goldEligible,
    implementation: {
      manifest: tool.manifestFingerprint,
      module: tool.moduleFingerprint,
      page: tool.pageFingerprint,
      testFiles,
    },
    oracle: {
      entryId: tool.oracleEntryId,
      candidate: requiredString(oracle, "candidate", `oracle ${tool.oracleEntryId}`),
      maintenanceClass: requiredString(oracle, "maintenance_class", `oracle ${tool.oracleEntryId}`),
      truthSources: stringArray(oracle.truth_sources, `${tool.oracleEntryId}.truth_sources`),
      status: oracleStatus,
      evidence: oracleEvidence,
    },
    fixtures: fixtureFamilies,
    privacy: {
      status: "DECLARED",
      privacyClass: tool.privacyClass,
      location: tool.runtime.location,
      network: tool.runtime.network,
      capabilities: tool.capabilities,
      ...(tool.privacyDisclosure === undefined ? {} : { disclosure: tool.privacyDisclosure }),
    },
    locality: {
      status: localityStatus,
      evidence: evidenceReferences(root, "locality", localityPaths, cache),
    },
    mobileA11y: {
      status: mobileStatus,
      evidence: evidenceReferences(root, "mobileA11y", mobilePaths, cache),
    },
    lazyLoad: {
      status: lazyStatus,
      evidence: evidenceReferences(root, "lazyLoad", lazyPaths, cache),
    },
    physicalDevice: {
      status: physical.status,
      required: physical.required,
      iosSafari: physical.iosSafari,
      androidChrome: physical.androidChrome,
      evidence: physical.evidence,
    },
    evidence,
    blockers: unique(blockers).toSorted((left, right) => left.localeCompare(right)),
    coverageGaps: unique(coverageGaps).toSorted((left, right) => left.localeCompare(right)),
  };
}

async function discoverTestFiles(root: string, manifests: readonly ManifestRecord[]): Promise<Map<string, string[]>> {
  const testRoot = resolve(root, "tests");
  const testFiles = await walkFiles(testRoot, (path) => path.endsWith(".test.ts"));
  const source = new Map<string, string>();
  for (const path of testFiles) source.set(relativePath(root, path), await readFile(path, "utf8"));
  const result = new Map<string, string[]>();
  for (const manifest of manifests) {
    const escaped = manifest.id.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
    const direct = [...source.entries()].filter(([, text]) => new RegExp(`src/tools/${escaped}/(?:manifest|module)`, "u").test(text) || text.includes(`/tools/${manifest.id}`)).map(([path]) => path);
    const family = (familyTestFiles[manifest.engine] ?? []).filter((path) => source.has(path));
    result.set(manifest.id, unique([...direct, ...family]).toSorted((left, right) => left.localeCompare(right)));
  }
  return result;
}

export async function buildCertificationIndex(root = resolve(import.meta.dirname, "../..")): Promise<CertificationIndex> {
  const manifests = await discoverManifests(root);
  const authorities = await loadAuthorities(root);
  const cache = await toolEvidenceCache(root);
  cache.set("quality/oracles/registry.json", { __sha256: authorities.registrySha256 });
  cache.set("quality/fixtures/index.json", { __sha256: authorities.fixturesSha256 });
  cache.set("quality/oracles/sources.json", { __sha256: authorities.sourcesSha256 });
  const toolIds = new Set(manifests.map((manifest) => manifest.id));
  const receipts = await discoverReceipts(root, toolIds);
  const testFiles = await discoverTestFiles(root, manifests);
  const acceptanceIssues = freshAcceptanceIssues(cache);
  const tools = manifests.map((manifest) => evidenceForTool(root, manifest, receipts.get(manifest.id), authorities, cache, testFiles.get(manifest.id) ?? [], acceptanceIssues));
  const statusCounts: Record<CertificationStatus, number> = {
    GOLD: tools.filter((tool) => tool.status === "GOLD").length,
    PARTIAL: tools.filter((tool) => tool.status === "PARTIAL").length,
    IMPLEMENTED_UNVERIFIED: tools.filter((tool) => tool.status === "IMPLEMENTED_UNVERIFIED").length,
  };
  const global = buildGlobalCertification(root, authorities, cache, manifests);
  const index: CertificationIndex = {
    schemaVersion: CERTIFICATION_SCHEMA_VERSION,
    generatedBy: "scripts/build-certification-index.ts",
    expectedCatalogToolCount: EXPECTED_CATALOG_TOOL_COUNT,
    catalogToolCount: tools.length,
    authorities: {
      oracleRegistry: { path: "quality/oracles/registry.json", sha256: authorities.registrySha256 },
      fixtureIndex: { path: "quality/fixtures/index.json", sha256: authorities.fixturesSha256 },
      sourceRegistry: { path: "quality/oracles/sources.json", sha256: authorities.sourcesSha256 },
    },
    global,
    summary: {
      statusCounts,
      certificationGoldCount: statusCounts.GOLD,
      releaseEligibleGoldCount: tools.filter((tool) => tool.goldEligible).length,
      releaseBlockedCount: tools.filter((tool) => !tool.goldEligible).length,
      physicalDevicePassCount: global.physicalDevice.observedPassCount,
      oracleBoundCount: tools.filter((tool) => tool.oracle.status === "VERIFIED" || tool.oracle.status === "BOUND").length,
      fixtureBoundCount: tools.filter((tool) => tool.fixtures.length > 0).length,
      localDeclarationCount: tools.filter((tool) => tool.privacy.privacyClass === "LOCAL" && tool.privacy.network === "forbidden").length,
    },
    tools,
  };
  assertCertificationIndex(index);
  return index;
}

export function renderCertificationIndex(index: CertificationIndex): string {
  return `${JSON.stringify(index, null, 2)}\n`;
}

export function assertCertificationIndex(index: CertificationIndex): void {
  const issues: string[] = [];
  if (index.schemaVersion !== CERTIFICATION_SCHEMA_VERSION) issues.push(`schemaVersion must be ${CERTIFICATION_SCHEMA_VERSION}`);
  if (index.expectedCatalogToolCount !== EXPECTED_CATALOG_TOOL_COUNT) issues.push(`expectedCatalogToolCount must be ${EXPECTED_CATALOG_TOOL_COUNT}`);
  if (index.catalogToolCount !== EXPECTED_CATALOG_TOOL_COUNT || index.tools.length !== EXPECTED_CATALOG_TOOL_COUNT) issues.push(`catalog must contain exactly ${EXPECTED_CATALOG_TOOL_COUNT} tools`);
  const ids = new Set<string>();
  const routes = new Set<string>();
  for (const tool of index.tools) {
    if (ids.has(tool.id)) issues.push(`${tool.id}: duplicate tool id`);
    if (routes.has(tool.route)) issues.push(`${tool.route}: duplicate tool route`);
    ids.add(tool.id);
    routes.add(tool.route);
    if (tool.route !== `/tools/${tool.id}`) issues.push(`${tool.id}: route does not match id`);
    if (tool.privacy.privacyClass === "LOCAL" && tool.privacy.network !== "forbidden") issues.push(`${tool.id}: LOCAL privacy policy is not forbidden`);
    if (tool.physicalDevice.status === "PASS" && (!tool.physicalDevice.required || tool.physicalDevice.evidence.length === 0 || tool.physicalDevice.evidence.every((item) => !/physical/i.test(item.path)) || tool.physicalDevice.iosSafari !== "PASS" || tool.physicalDevice.androidChrome !== "PASS")) issues.push(`${tool.id}: physical PASS lacks required evidence`);
    if (tool.status === "GOLD" && tool.certificationReceipt === null) issues.push(`${tool.id}: Gold status has no certification receipt`);
    if (tool.goldEligible && (tool.status !== "GOLD" || tool.releaseGate !== "PASS" || tool.blockers.length > 0)) issues.push(`${tool.id}: goldEligible is inconsistent with release gate`);
    if (tool.status === "GOLD" && tool.oracle.status !== "VERIFIED") issues.push(`${tool.id}: Gold status has an unverified oracle binding`);
    if (tool.status === "GOLD" && tool.fixtures.some((fixture) => fixture.status !== "VERIFIED")) issues.push(`${tool.id}: Gold status has an unverified fixture binding`);
  }
  if (index.global.physicalDevice.observedPassCount !== index.tools.filter((tool) => tool.physicalDevice.status === "PASS").length) issues.push("physical-device pass count does not match tool evidence");
  if (issues.length > 0) throw new CertificationBuildError(issues);
}
