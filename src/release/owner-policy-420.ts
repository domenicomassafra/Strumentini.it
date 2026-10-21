/**
 * Owner release policy 20/10/2026 (Strumentini.it #162/#80).
 *
 * The owner changed the release criterion from per-tool Gold receipts and
 * physical-device receipts to *automatic* evidence:
 *   «pubblica con test automatici verdi» — full suite, browser and simulated
 *   phones green, rollback actually proven; a physical phone is optional after
 *   the release. «basta simulatore ed emulatore» for the mobile lanes.
 *
 * This module never fabricates a receipt. It states which evidence the policy
 * requires, which evidence the owner explicitly waived, and evaluates the
 * receipts that exist. Waived evidence is reported as
 * WAIVED_OWNER_DECISION — never as PASS.
 */
import { createHash } from "node:crypto";
import type { ReleaseFinding } from "./validation";

export const OWNER_RELEASE_POLICY_420 = {
  schemaVersion: 1,
  id: "owner-20261020",
  decidedAt: "2026-10-20",
  statement:
    "Pubblica con test automatici verdi: suite completa, prove browser e telefoni simulati verdi e rollback effettivamente provato prima della pubblicazione. Il telefono fisico è opzionale dopo la release. Se manca anche un gate, mantenere NO_GO e issue aperta.",
  mobileDecision: "basta simulatore ed emulatore",
  requiredGates: ["source", "browser", "simulated-mobile", "rollback"] as const,
  waivedGates: [
    {
      gate: "gold-per-tool",
      replaces: "GOLD_*",
      reason:
        "Per-tool Gold receipts are a manual certification inventory. The owner replaced them as a release criterion with the automatic suite; they stay visible but no longer block promotion.",
    },
    {
      gate: "physical-device",
      replaces: "PHYSICAL_*",
      reason:
        "The owner made a physical phone optional after the release and accepted simulator/emulator evidence for the mobile lanes.",
    },
  ],
  /** Engines the automatic browser matrix must prove on the release commit. */
  requiredBrowserEngines: ["chrome", "chromium", "firefox", "webkit"] as const,
  /** Engines declared by the matrix but unavailable on the running host. */
  optionalBrowserEngines: ["edge"] as const,
} as const;

const digest = (bytes: Uint8Array | string): string => createHash("sha256").update(bytes).digest("hex");
const hex64 = /^[a-f0-9]{64}$/u;
const sha40 = /^[a-f0-9]{40}$/u;

type Record_ = Record<string, unknown>;
const asRecord = (value: unknown): Record_ | undefined =>
  typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record_ : undefined;
const asString = (value: unknown): string | undefined => typeof value === "string" ? value : undefined;

function finding(code: string, severity: ReleaseFinding["severity"], message: string, path?: string): ReleaseFinding {
  return path === undefined ? { code, severity, message } : { code, severity, message, path };
}

export interface OwnerPolicyEvidence {
  readonly revision: string;
  readonly sourceFingerprint: string;
  readonly workingTreeDirty: boolean;
  readonly browserReceipt: unknown;
  readonly browserReceiptPath: string;
  readonly androidReceipt: unknown;
  readonly androidReceiptPath: string;
  readonly iosReceipt: unknown;
  readonly iosReceiptPath: string;
  readonly rollbackReceipt: unknown;
  readonly rollbackReceiptPath: string;
  /** Compiled bytes of the routes each mobile receipt must bind. */
  readonly distPageHashes: Readonly<Record<string, string>>;
}

export interface OwnerPolicyResult {
  readonly status: "PASS" | "NO_GO";
  readonly findings: readonly ReleaseFinding[];
  readonly gates: Readonly<Record<string, "PASS" | "NO_GO">>;
  readonly waived: readonly { readonly gate: string; readonly status: "WAIVED_OWNER_DECISION" }[];
}

/** Fresh browser matrix for the exact release source, all required engines. */
export function validateOwnerBrowserPolicy420(evidence: {
  readonly browser: unknown;
  readonly path: string;
  readonly revision: string;
  readonly sourceFingerprint: string;
}): ReleaseFinding[] {
  const record = asRecord(evidence.browser);
  if (record === undefined) {
    return [finding("POLICY_BROWSER_MISSING", "blocker", "fresh browser matrix receipt is missing", evidence.path)];
  }
  const findings: ReleaseFinding[] = [];
  if (asString(record.revision) !== evidence.revision) {
    findings.push(finding("POLICY_BROWSER_SOURCE_STALE", "blocker", "browser matrix does not target the released revision", evidence.path));
  }
  if (asString(record.sourceFingerprint) !== evidence.sourceFingerprint) {
    findings.push(finding("POLICY_BROWSER_SOURCE_STALE", "blocker", "browser matrix does not target the released source content", evidence.path));
  }
  if (asString(record.generatedAt) === undefined || !Number.isFinite(Date.parse(asString(record.generatedAt) ?? ""))) {
    findings.push(finding("POLICY_BROWSER_TIMESTAMP", "blocker", "browser matrix has no valid generatedAt", evidence.path));
  }
  const matrix = asRecord(record.browserMatrix);
  const engines = matrix === undefined ? undefined : matrix.requestedEngines;
  if (!Array.isArray(engines)) {
    findings.push(finding("POLICY_BROWSER_MATRIX_MISSING", "blocker", "browser matrix has no observed engines", evidence.path));
    return findings;
  }
  const byName = new Map<string, Record_>();
  for (const engine of engines) {
    const item = asRecord(engine);
    const name = item === undefined ? undefined : asString(item.engine);
    if (item === undefined || name === undefined) {
      findings.push(finding("POLICY_BROWSER_ENGINE_MALFORMED", "blocker", "browser matrix contains a malformed engine entry", evidence.path));
      continue;
    }
    byName.set(name, item);
  }
  for (const name of OWNER_RELEASE_POLICY_420.requiredBrowserEngines) {
    const item = byName.get(name);
    if (item === undefined) {
      findings.push(finding("POLICY_BROWSER_ENGINE_MISSING", "blocker", `required browser engine is missing: ${name}`, evidence.path));
      continue;
    }
    if (asString(item.status) !== "PASS") {
      findings.push(finding("POLICY_BROWSER_ENGINE_UNPROVEN", "blocker", `browser engine ${name} is ${asString(item.status) ?? "missing"}`, evidence.path));
      continue;
    }
    for (const route of ["coreRoute", "homeRoute", "directoryRoute"]) {
      if (asString(item[route]) !== "PASS") {
        findings.push(finding("POLICY_BROWSER_ROUTE_UNPROVEN", "blocker", `${name} has no ${route} pass`, evidence.path));
      }
    }
    const mobile = asRecord(item.mobile);
    if (mobile === undefined || mobile.toolOverflow !== false || mobile.homeOverflow !== false || mobile.directoryOverflow !== false) {
      findings.push(finding("POLICY_BROWSER_MOBILE_UNPROVEN", "blocker", `${name} has no clean 390px result`, evidence.path));
    }
    const lazy = asRecord(item.lazy);
    if (lazy === undefined || !Array.isArray(lazy.observedEngineChunk) || lazy.observedEngineChunk.length === 0) {
      findings.push(finding("POLICY_BROWSER_LAZY_UNPROVEN", "blocker", `${name} has no observed lazy engine chunk`, evidence.path));
    }
    const network = asRecord(item.networkPrivacy);
    if (network === undefined || network.externalTaskRequests !== 0 || network.taskContentLeaks !== 0 || network.nonGetTaskRequests !== 0) {
      findings.push(finding("POLICY_BROWSER_NETWORK_UNPROVEN", "blocker", `${name} network/privacy evidence is not clean`, evidence.path));
    }
    if (asRecord(item.performance) === undefined) {
      findings.push(finding("POLICY_BROWSER_PERFORMANCE_MISSING", "blocker", `${name} performance evidence is missing`, evidence.path));
    }
    for (const key of ["consoleErrors", "pageErrors", "failures"]) {
      if (!Array.isArray(item[key]) || (item[key] as unknown[]).length > 0) {
        findings.push(finding("POLICY_BROWSER_ERRORS_UNPROVEN", "blocker", `${name} has ${key}`, evidence.path));
      }
    }
  }
  const inspection = asRecord(record.staticInspection);
  const baseline = inspection === undefined ? undefined : asRecord(inspection.bundleBaseline);
  if (baseline === undefined || asString(baseline.gate) !== "PASS") {
    findings.push(finding("POLICY_BROWSER_BUNDLE_GATE", "blocker", "browser bundle baseline gate is not PASS", evidence.path));
  }
  const acceptance = record.freshAcceptance;
  if (!Array.isArray(acceptance) || acceptance.length === 0) {
    findings.push(finding("POLICY_BROWSER_ACCEPTANCE_MISSING", "blocker", "fresh sibling browser acceptance is missing", evidence.path));
  } else {
    const optional = new Set<string>(OWNER_RELEASE_POLICY_420.optionalBrowserEngines);
    for (const item of acceptance) {
      const entry = asRecord(item);
      const status = asString(entry?.status);
      if (status === "PASS") continue;
      const command = asString(entry?.command) ?? "";
      const optionalEngine = [...optional].some((name) => command.includes(`(${name})`));
      if (status === "UNAVAILABLE" && optionalEngine) continue;
      findings.push(finding("POLICY_BROWSER_ACCEPTANCE_BLOCKED", "blocker", `a fresh browser acceptance is not PASS: ${command}`, evidence.path));
    }
  }
  return findings;
}

/** Android emulator (real AVD + installed Chrome) receipt bound to compiled bytes. */
export function validateOwnerAndroidPolicy420(evidence: {
  readonly receipt: unknown;
  readonly path: string;
  readonly revision: string;
  readonly distPageHashes: Readonly<Record<string, string>>;
}): ReleaseFinding[] {
  const record = asRecord(evidence.receipt);
  if (record === undefined) {
    return [finding("POLICY_MOBILE_ANDROID_MISSING", "blocker", "Android emulator receipt is missing", evidence.path)];
  }
  const findings: ReleaseFinding[] = [];
  if (record.evidenceKind !== "ANDROID_EMULATOR_CHROME_SIMULATED" || record.physicalDeviceObserved !== false) {
    findings.push(finding("POLICY_MOBILE_ANDROID_KIND", "blocker", "Android evidence must be an emulator run, never claimed as physical hardware", evidence.path));
  }
  const build = asRecord(record.build);
  if (build === undefined || asString(build.revision) !== evidence.revision) {
    findings.push(finding("POLICY_MOBILE_ANDROID_SOURCE_STALE", "blocker", "Android emulator receipt does not target the released revision", evidence.path));
  }
  const route = asString(build?.route);
  if (route === undefined || evidence.distPageHashes[route.replace(/^\/+/u, "")] !== asString(build?.htmlSha256)) {
    findings.push(finding("POLICY_MOBILE_ANDROID_SOURCE_STALE", "blocker", "Android emulator receipt does not match the released compiled route bytes", evidence.path));
  }
  const browser = asRecord(record.browser);
  if (browser === undefined || browser.package !== "com.android.chrome" || !/Android.*Chrome\//u.test(asString(browser.userAgent) ?? "")) {
    findings.push(finding("POLICY_MOBILE_ANDROID_BROWSER", "blocker", "Android evidence does not identify installed Chrome on the emulator", evidence.path));
  }
  const operation = asRecord(record.operation);
  if (operation === undefined || operation.androidPickerOpened !== true || operation.fileSelected !== true ||
      operation.resizedInChrome !== true || operation.androidDownloadSaved !== true) {
    findings.push(finding("POLICY_MOBILE_ANDROID_FLOW", "blocker", "Android native picker/resize/download flow is incomplete", evidence.path));
  }
  const negative = asRecord(record.negative);
  if (negative === undefined || negative.pickerCancelledWithoutSelection !== true || negative.corruptJpegRefused !== true || negative.offsiteRequests !== 0) {
    findings.push(finding("POLICY_MOBILE_ANDROID_NEGATIVE", "blocker", "Android negative picker/format/offsite proof is incomplete", evidence.path));
  }
  const output = asRecord(record.output);
  if (output === undefined || output.reopened !== true || output.decoder !== "sharp/libvips" || !hex64.test(asString(output.sha256) ?? "")) {
    findings.push(finding("POLICY_MOBILE_ANDROID_OUTPUT", "blocker", "Android download was not independently reopened", evidence.path));
  }
  return findings;
}

/** iOS simulator / mobile-Safari-class WebKit receipt bound to compiled bytes. */
export function validateOwnerIosPolicy420(evidence: {
  readonly receipt: unknown;
  readonly path: string;
  readonly revision: string;
  readonly distPageHashes: Readonly<Record<string, string>>;
}): ReleaseFinding[] {
  const record = asRecord(evidence.receipt);
  if (record === undefined) {
    return [finding("POLICY_MOBILE_IOS_MISSING", "blocker", "iOS simulator receipt is missing", evidence.path)];
  }
  const findings: ReleaseFinding[] = [];
  if (record.evidenceKind !== "SIMULATED_DESKTOP_WEBKIT_MOBILE" || record.physicalDeviceObserved !== false) {
    findings.push(finding("POLICY_MOBILE_IOS_KIND", "blocker", "iOS evidence must be a simulated run, never claimed as physical hardware", evidence.path));
  }
  const build = asRecord(record.build);
  if (build === undefined || asString(build.revision) !== evidence.revision) {
    findings.push(finding("POLICY_MOBILE_IOS_SOURCE_STALE", "blocker", "iOS simulator receipt does not target the released revision", evidence.path));
  }
  const pages = build === undefined ? undefined : asRecord(build.pages);
  if (pages === undefined || Object.keys(pages).length === 0) {
    findings.push(finding("POLICY_MOBILE_IOS_SOURCE_STALE", "blocker", "iOS simulator receipt carries no compiled page fingerprint", evidence.path));
  } else {
    for (const [route, hash] of Object.entries(pages)) {
      const expected = evidence.distPageHashes[route.replace(/^\/+/u, "")];
      if (typeof hash !== "string" || hash !== expected) {
        findings.push(finding("POLICY_MOBILE_IOS_SOURCE_STALE", "blocker", `iOS simulator receipt does not match the released bytes of ${route}`, evidence.path));
      }
    }
  }
  const routes = record.routes;
  if (!Array.isArray(routes) || routes.length === 0) {
    findings.push(finding("POLICY_MOBILE_IOS_ROUTES", "blocker", "iOS simulator receipt has no route results", evidence.path));
  } else {
    for (const item of routes) {
      const entry = asRecord(item);
      if (asString(entry?.status) !== "PASS") {
        findings.push(finding("POLICY_MOBILE_IOS_ROUTE_BLOCKED", "blocker", `iOS route ${asString(entry?.route) ?? "?"} is not PASS`, evidence.path));
      }
    }
  }
  return findings;
}

/** Validate an observed Cloudflare staging rollback and candidate restoration. */
export function validateOwnerRollbackPolicy420(evidence: {
  readonly receipt: unknown;
  readonly path: string;
  readonly revision: string;
  readonly sourceFingerprint: string;
}): ReleaseFinding[] {
  const record = asRecord(evidence.receipt);
  if (record === undefined) {
    return [finding("POLICY_ROLLBACK_MISSING", "blocker", "real staging rollback receipt is missing", evidence.path)];
  }
  const findings: ReleaseFinding[] = [];
  if (record.schemaVersion !== 1 || record.kind !== "cloudflare-static-assets-rollback" ||
      record.status !== "VERIFIED" || record.externalDeploymentPerformed !== true ||
      record.rollbackVerified !== true || record.environment !== "staging-worker" ||
      record.worker !== "strumentini-328-staging-20261015" ||
      record.origin !== "https://strumentini-328-staging-20261015.massafradomenico4.workers.dev" ||
      record.databaseMigration !== "NONE") {
    findings.push(finding("POLICY_ROLLBACK_UNVERIFIED", "blocker", "staging rollback was not independently observed and verified", evidence.path));
  }
  if (record.currentRevision !== evidence.revision || record.sourceFingerprint !== evidence.sourceFingerprint) {
    findings.push(finding("POLICY_ROLLBACK_SOURCE_STALE", "blocker", "rollback receipt belongs to another release source", evidence.path));
  }
  const observed = asString(record.observedAt);
  if (observed === undefined || !Number.isFinite(Date.parse(observed)) || Date.parse(observed) > Date.now() + 300000) {
    findings.push(finding("POLICY_ROLLBACK_TIMESTAMP", "blocker", "rollback receipt has no valid observation time", evidence.path));
  }
  const previous = asString(record.previousKnownGoodDeploymentId);
  const candidate = asString(record.currentDeploymentId);
  if (!previous || !candidate || previous === candidate ||
      record.rollbackCommand !== "wrangler rollback " + previous + " --config worker/wrangler.staging.jsonc") {
    findings.push(finding("POLICY_ROLLBACK_VERSIONS", "blocker", "rollback target and candidate are not distinct observed versions", evidence.path));
  }
  const observations = asRecord(record.observations);
  const before = asString(observations?.previousHomeSha256);
  const after = asString(observations?.candidateHomeSha256);
  const restoredBefore = asString(observations?.restoredPreviousHomeSha256);
  const restoredAfter = asString(observations?.restoredCandidateHomeSha256);
  if (!hex64.test(before ?? "") || !hex64.test(after ?? "") || before === after ||
      before !== restoredBefore || after !== restoredAfter ||
      observations?.candidateBytesDistinctFromPrevious !== true) {
    findings.push(finding("POLICY_ROLLBACK_RESTORE_UNPROVEN", "blocker", "staging rollback and candidate restore did not preserve their served bytes", evidence.path));
  }
  return findings;
}

/** Aggregates every gate the owner decision requires for this release. */
export function assessOwnerPolicy420(evidence: OwnerPolicyEvidence): OwnerPolicyResult {
  const findings: ReleaseFinding[] = [];
  if (!sha40.test(evidence.revision)) {
    findings.push(finding("POLICY_SOURCE_REVISION", "blocker", "release revision is not a 40-character commit", "git"));
  }
  if (!hex64.test(evidence.sourceFingerprint)) {
    findings.push(finding("POLICY_SOURCE_FINGERPRINT", "blocker", "release source fingerprint is missing", "git"));
  }
  if (evidence.workingTreeDirty) {
    findings.push(finding("POLICY_SOURCE_DIRTY", "blocker", "release evidence was generated from a dirty working tree", "git"));
  }
  findings.push(...validateOwnerBrowserPolicy420({
    browser: evidence.browserReceipt, path: evidence.browserReceiptPath,
    revision: evidence.revision, sourceFingerprint: evidence.sourceFingerprint,
  }));
  findings.push(...validateOwnerAndroidPolicy420({
    receipt: evidence.androidReceipt, path: evidence.androidReceiptPath,
    revision: evidence.revision, distPageHashes: evidence.distPageHashes,
  }));
  findings.push(...validateOwnerIosPolicy420({
    receipt: evidence.iosReceipt, path: evidence.iosReceiptPath,
    revision: evidence.revision, distPageHashes: evidence.distPageHashes,
  }));
  findings.push(...validateOwnerRollbackPolicy420({
    receipt: evidence.rollbackReceipt, path: evidence.rollbackReceiptPath,
    revision: evidence.revision, sourceFingerprint: evidence.sourceFingerprint,
  }));
  const failures = new Set(findings.filter((item) => item.severity === "blocker" || item.severity === "error").map((item) => item.code));
  const gateOf = (prefixes: readonly string[]): "PASS" | "NO_GO" =>
    [...failures].some((code) => prefixes.some((prefix) => code.startsWith(prefix))) ? "NO_GO" : "PASS";
  return {
    status: findings.some((item) => item.severity !== "warning") ? "NO_GO" : "PASS",
    findings,
    gates: {
      source: gateOf(["POLICY_SOURCE_"]),
      browser: gateOf(["POLICY_BROWSER_"]),
      "simulated-mobile": gateOf(["POLICY_MOBILE_"]),
      rollback: gateOf(["POLICY_ROLLBACK_"]),
    },
    waived: OWNER_RELEASE_POLICY_420.waivedGates.map((item) => ({ gate: item.gate, status: "WAIVED_OWNER_DECISION" as const })),
  };
}

/** Byte-level page digest used to bind mobile receipts to the built release. */
export async function distPageHashes420(readPage: (route: string) => Promise<Uint8Array | undefined>): Promise<Record<string, string>> {
  const routes = ["tools/image-resize/", "tools/audio-generator/"];
  const hashes: Record<string, string> = {};
  for (const route of routes) {
    const bytes = await readPage(route);
    if (bytes !== undefined) hashes[route] = digest(bytes);
  }
  return hashes;
}
