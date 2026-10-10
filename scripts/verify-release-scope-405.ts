/**
 * #405 Read-only scope gate. Usage:
 *   npx tsx scripts/verify-release-scope-405.ts --scope=pdf-rotate
 *   npx tsx scripts/verify-release-scope-405.ts --all
 *
 * Outputs a source-bound evidence manifest on stdout, never edits receipts,
 * invokes Wrangler or certifies physical/staging/deployment observations.
 */
import { createHash } from "node:crypto";
import { copyFile, mkdtemp, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import {
  validateExternalEvidence,
  validateGoldReceipts,
  validateRollbackReceipt,
  type ReleaseCatalogEntry,
  type ReleaseFinding,
  type ToolCertificationReceipt,
} from "../src/release/validation";
import { currentEvidenceSourceFingerprint } from "./lib/current-revision";

const execFileAsync = promisify(execFile);
const digest = (bytes: Uint8Array | string) => createHash("sha256").update(bytes).digest("hex");
const fingerprintPattern = /^[a-f0-9]{64}$/u;
const defaultRoot = resolve(import.meta.dirname, "..");

type GateState = "PASS" | "BLOCKED" | "NOT_RUN";
export type ScopeGate = {
  readonly id: "source" | "gold" | "browser" | "physical" | "rollback" | "cumulative-release" | "staging-canary";
  readonly status: GateState;
  readonly codes: readonly string[];
};
type EvidenceRecord = Record<string, unknown>;
export type ScopeEvidence405 = {
  readonly revision: string;
  readonly sourceFingerprint: string;
  readonly workingTreeDirty: boolean;
  readonly catalog: readonly ReleaseCatalogEntry[];
  readonly requestedIds: readonly string[];
  readonly goldReceipts: readonly ToolCertificationReceipt[];
  readonly browser: unknown;
  readonly physicalReceipts: readonly unknown[];
  readonly rollback: unknown;
  readonly cumulative: unknown;
  readonly staging: unknown;
  readonly distSha256: string | null;
  readonly receiptFiles?: readonly { readonly kind: string; readonly path: string; readonly sha256: string | null }[];
};
export type ScopeAssessment405 = {
  readonly schemaVersion: 1;
  readonly kind: "scope-release-readiness-405";
  readonly decision: "NO_GO" | "EVIDENCE_READY_FOR_REVIEW";
  readonly revision: string;
  readonly sourceFingerprint: string;
  readonly scope: readonly {
    readonly id: string;
    readonly route: string;
    /** Scoped identity anchored to the global source digest (including Worker/D1). */
    readonly scopeFingerprint: string;
  }[];
  /** File hashes are an audit inventory, not proof of external observation. */
  readonly receiptFiles: readonly { readonly kind: string; readonly path: string; readonly sha256: string | null }[];
  readonly gates: readonly ScopeGate[];
  readonly note: string;
};

function record(value: unknown): EvidenceRecord | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as EvidenceRecord : undefined;
}
function hasCode(findings: readonly ReleaseFinding[], prefix: string): string[] {
  return [...new Set(findings.filter((item) => item.code.startsWith(prefix)).map((item) => item.code))].sort();
}
function gate(id: ScopeGate["id"], codes: readonly string[], observed = true): ScopeGate {
  return { id, status: !observed ? "NOT_RUN" : codes.length > 0 ? "BLOCKED" : "PASS", codes };
}
function validSha(value: unknown): value is string {
  return typeof value === "string" && fingerprintPattern.test(value);
}
function checkStagingCanary(value: unknown, fingerprint: string, ids: readonly string[]): string[] {
  const item = record(value);
  if (!item) return ["STAGING_CANARY_NOT_RUN"];
  const codes: string[] = [];
  if (item.schemaVersion !== 1 || item.kind !== "staging-canary-rollback" || item.status !== "PASS" ||
      item.environment !== "staging" || item.externalRunObserved !== true || item.simulated !== false) codes.push("STAGING_CANARY_PROOF_INVALID");
  if (item.sourceFingerprint !== fingerprint) codes.push("STAGING_CANARY_SOURCE_STALE");
  const scopeIds: readonly unknown[] = Array.isArray(item.scopeIds) ? item.scopeIds : [];
  if (!Array.isArray(item.scopeIds) || !ids.every((id) => scopeIds.includes(id))) codes.push("STAGING_CANARY_SCOPE_MISSING");
  if (typeof item.observedAt !== "string" || !Number.isFinite(Date.parse(item.observedAt))) codes.push("STAGING_CANARY_TIMESTAMP_MISSING");
  const checks = record(item.checks);
  if (!checks || ["canaryHealth", "rollbackRestored", "previousVersionAccessible", "candidateRestored",
    "rejectedInput", "oversizeInput", "partialOutput", "cancellation"].some((key) => checks[key] !== "PASS")) {
    codes.push("STAGING_CANARY_CASES_UNPROVEN");
  }
  const rollback = record(item.rollback);
  if (!rollback || !validSha(rollback.beforeSha256) || !validSha(rollback.afterSha256) ||
      rollback.beforeSha256 === rollback.afterSha256 ||
      rollback.restoredSha256 !== rollback.beforeSha256 ||
      typeof rollback.previousVersion !== "string" || rollback.previousVersion.length === 0 ||
      typeof rollback.candidateVersion !== "string" || rollback.candidateVersion.length === 0 ||
      rollback.previousVersion === rollback.candidateVersion) codes.push("STAGING_CANARY_RESTORE_UNPROVEN");
  return codes;
}

/**
 * Uses the canonical validators and independently rejects stale cumulative
 * receipt/build bindings. No user-provided labels can waive any gate.
 */
export function assessReleaseScope405(input: ScopeEvidence405): ScopeAssessment405 {
  const unique = [...new Set(input.requestedIds)];
  if (unique.length === 0 || unique.length !== input.requestedIds.length ||
      input.catalog.some((entry) => !entry.id || !entry.route) ||
      new Set(input.catalog.map((entry) => entry.id)).size !== input.catalog.length ||
      unique.some((id) => !input.catalog.some((entry) => entry.id === id))) {
    throw new Error("scope requires unique, known catalog tool IDs");
  }
  const sourceCodes = [
    ...(!validSha(input.sourceFingerprint) ? ["SOURCE_FINGERPRINT_INVALID"] : []),
    ...(!/^[a-f0-9]{40}$/u.test(input.revision) ? ["SOURCE_REVISION_INVALID"] : []),
    ...(input.workingTreeDirty ? ["SOURCE_WORKTREE_DIRTY"] : []),
  ];
  const selected = input.catalog.filter((entry) => unique.includes(entry.id))
    .sort((a, b) => a.id.localeCompare(b.id));
  const gold = validateGoldReceipts(selected, input.goldReceipts, input.revision, input.sourceFingerprint);
  const external = validateExternalEvidence({
    browser: input.browser, physicalDeviceReceipts: input.physicalReceipts,
  }, input.revision, input.sourceFingerprint);
  const rollback = validateRollbackReceipt(input.rollback, "quality/receipts/release/rollback.json", input.sourceFingerprint);
  const rollbackCodes = [
    ...rollback.map((item) => item.code),
    ...(record(input.rollback)?.status !== "VERIFIED" ? ["ROLLBACK_NOT_VERIFIED"] : []),
  ];
  const cumulative = record(input.cumulative);
  const checks = record(cumulative?.checks);
  const validation = record(cumulative?.validation);
  const assets = record(cumulative?.staticAssets);
  const cumulativeCodes = [
    ...(!cumulative || cumulative.schemaVersion !== 1 || cumulative.kind !== "release-validation" ||
      cumulative.generatedBy !== "scripts/validate-release.ts" ? ["CUMULATIVE_RECEIPT_MISSING"] : []),
    ...(cumulative?.sourceFingerprint !== input.sourceFingerprint ? ["CUMULATIVE_SOURCE_STALE"] : []),
    ...(cumulative?.workingTreeDirty !== false || validation?.status !== "PASS" ||
      checks === undefined || Object.values(checks).length === 0 ||
      Object.values(checks).some((check) => check !== "PASS") ? ["CUMULATIVE_CHECKS_NOT_PASS"] : []),
    ...(assets?.status !== "PASS" || !validSha(assets.contentSha256) ||
      input.distSha256 === null || assets.contentSha256 !== input.distSha256 ? ["CUMULATIVE_ASSETS_STALE"] : []),
    ...(validation?.findings === undefined || !Array.isArray(validation.findings) ||
      validation.findings.length > 0 ? ["CUMULATIVE_FINDINGS_UNVERIFIED"] : []),
  ];
  const gates: ScopeGate[] = [
    gate("source", sourceCodes),
    gate("gold", gold.map((item) => item.code)),
    gate("browser", hasCode(external, "BROWSER_")),
    gate("physical", hasCode(external, "PHYSICAL_")),
    gate("rollback", [...new Set(rollbackCodes)].sort()),
    gate("cumulative-release", cumulativeCodes),
    gate("staging-canary", checkStagingCanary(input.staging, input.sourceFingerprint, unique)),
  ];
  return {
    schemaVersion: 1,
    kind: "scope-release-readiness-405",
    decision: gates.every((item) => item.status === "PASS") ? "EVIDENCE_READY_FOR_REVIEW" : "NO_GO",
    revision: input.revision,
    sourceFingerprint: input.sourceFingerprint,
    scope: selected.map(({ id, route }) => ({
      id, route,
      scopeFingerprint: digest(`strumentini-405-scope\0${input.sourceFingerprint}\0${id}\0${route}`),
    })),
    receiptFiles: input.receiptFiles ?? [],
    gates,
    note: "Receipt validation only. No staging, browser, physical device, deployment or rollback is performed by this command; promotion requires independent approval.",
  };
}

/**
 * Run the fixture drill entirely in our own mkdtemp tree. The previous and
 * candidate bytes represent synthetic versions, not actual deployed releases.
 */
export async function runIsolatedRollbackDrill405(
  fault?: "corrupt-rollback" | "missing-previous" | "cancel-before-rollback",
): Promise<{ readonly status: "PASS" | "FAIL" | "CANCELED"; readonly authority: "LOCAL_FIXTURE_ONLY"; readonly steps: readonly string[] }> {
  const scratch = await mkdtemp(join(tmpdir(), "strumentini-rollback-405-"));
  const steps: string[] = [];
  try {
    const oldVersion = join(scratch, "old.bin");
    const newVersion = join(scratch, "new.bin");
    const active = join(scratch, "active.bin");
    const previous = Buffer.from("405: previous fixture bytes\n");
    const candidate = Buffer.from("405: candidate fixture bytes\n");
    await writeFile(oldVersion, previous, { flag: "wx" });
    await writeFile(newVersion, candidate, { flag: "wx" });
    await copyFile(oldVersion, active);
    if (digest(await readFile(active)) !== digest(previous)) throw new Error("baseline mismatch");
    steps.push("previous-fixture-observed");
    await copyFile(newVersion, active);
    if (digest(await readFile(active)) !== digest(candidate)) throw new Error("canary mismatch");
    steps.push("candidate-fixture-observed");
    if (fault === "cancel-before-rollback") return { status: "CANCELED", authority: "LOCAL_FIXTURE_ONLY", steps };
    if (fault === "missing-previous") await rm(oldVersion);
    try {
      await copyFile(oldVersion, active);
    } catch {
      return { status: "FAIL", authority: "LOCAL_FIXTURE_ONLY", steps };
    }
    if (fault === "corrupt-rollback") await writeFile(active, Buffer.from("corrupted"));
    if (digest(await readFile(active)) !== digest(previous)) return { status: "FAIL", authority: "LOCAL_FIXTURE_ONLY", steps };
    steps.push("previous-fixture-restored");
    await copyFile(newVersion, active);
    if (digest(await readFile(active)) !== digest(candidate)) return { status: "FAIL", authority: "LOCAL_FIXTURE_ONLY", steps };
    steps.push("candidate-fixture-restored");
    return { status: "PASS", authority: "LOCAL_FIXTURE_ONLY", steps };
  } finally {
    await rm(scratch, { recursive: true, force: true });
  }
}

async function walkFiles(dir: string): Promise<string[]> {
  const output: string[] = [];
  async function descend(current: string): Promise<void> {
    const entries = await readdir(current, { withFileTypes: true }).catch((error: NodeJS.ErrnoException) => {
      if (error.code === "ENOENT") return [];
      throw error;
    });
    for (const entry of entries) {
      const path = join(current, entry.name);
      if (entry.isDirectory()) await descend(path);
      else if (entry.isFile()) output.push(path);
    }
    if (output.length > 10000) throw new Error("evidence inventory exceeds safe file limit");
  }
  await descend(dir);
  return output.sort();
}
async function jsonFile(path: string): Promise<{ readonly value: unknown; readonly sha256: string | null }> {
  try {
    const metadata = await stat(path);
    if (!metadata.isFile() || metadata.size > 4_194_304) return { value: undefined, sha256: null };
    const contents = await readFile(path);
    return { value: JSON.parse(contents.toString("utf8")) as unknown, sha256: digest(contents) };
  } catch {
    return { value: undefined, sha256: null };
  }
}
async function currentDistHash(root: string): Promise<string | null> {
  const dist = resolve(root, "dist");
  if (!(await stat(dist).catch(() => undefined))?.isDirectory()) return null;
  const files = await walkFiles(dist);
  if (files.length === 0) return null;
  const hash = createHash("sha256");
  for (const file of files) {
    hash.update(relative(dist, file).replaceAll("\\", "/"));
    hash.update(await readFile(file));
  }
  return hash.digest("hex");
}

export async function inspectCurrentReleaseScope405(root: string, requestedIds: readonly string[]): Promise<ScopeAssessment405> {
  const generated = await import(pathToFileURL(resolve(root, "src/generated/catalog.ts")).href) as { catalog?: ReleaseCatalogEntry[] };
  if (!Array.isArray(generated.catalog) || generated.catalog.length === 0) throw new Error("generated catalog unavailable");
  const revision = (await execFileAsync("git", ["rev-parse", "HEAD"], { cwd: root })).stdout.trim();
  const dirty = (await execFileAsync("git", ["status", "--porcelain"], { cwd: root })).stdout.trim().length > 0;
  const sourceFingerprint = await currentEvidenceSourceFingerprint(root);
  const selectedIds = requestedIds.length === 1 && requestedIds[0] === "*"
    ? generated.catalog.map((entry) => entry.id) : requestedIds;
  const receiptFiles: { kind: string; path: string; sha256: string | null }[] = [];
  const goldPaths = (await walkFiles(resolve(root, "quality/receipts")))
    .filter((path) => path.endsWith(".json") && !path.includes("/release/"));
  const goldReceipts: ToolCertificationReceipt[] = [];
  for (const path of goldPaths) {
    const evidence = await jsonFile(path);
    const candidate = record(evidence.value);
    if (typeof candidate?.toolId === "string" && typeof candidate.status === "string") {
      goldReceipts.push(candidate as unknown as ToolCertificationReceipt);
      if (selectedIds.includes(candidate.toolId)) {
        receiptFiles.push({ kind: "gold", path: relative(root, path).replaceAll("\\", "/"), sha256: evidence.sha256 });
      }
    }
  }
  const receiptPaths = [
    ["browser", "quality/receipts/browser-performance/fresh-browser-matrix.json"],
    ["ios-physical", "quality/receipts/image-resize/ios-safari-physical.json"],
    ["android-physical", "quality/receipts/image-resize/android-chrome-physical.json"],
    ["rollback", "quality/receipts/release/rollback.json"],
    ["cumulative", "quality/receipts/release/validation.json"],
    ["staging", "quality/receipts/release/staging-canary.json"],
  ] as const;
  const [externalReads, distSha256] = await Promise.all([
    Promise.all(receiptPaths.map(async ([kind, path]) => {
      const evidence = await jsonFile(resolve(root, path));
      receiptFiles.push({ kind, path, sha256: evidence.sha256 });
      return evidence.value;
    })),
    currentDistHash(root),
  ]);
  const [browser, ios, android, rollback, cumulative, staging] = externalReads;
  return assessReleaseScope405({
    revision, sourceFingerprint, workingTreeDirty: dirty,
    catalog: generated.catalog,
    requestedIds: selectedIds,
    goldReceipts, browser, physicalReceipts: [ios, android].filter((item) => item !== undefined),
    rollback, cumulative, staging, distSha256,
    receiptFiles: receiptFiles.sort((a, b) => a.path.localeCompare(b.path)),
  });
}

async function cli(): Promise<void> {
  const args = process.argv.slice(2);
  const scopes = args.filter((arg) => arg.startsWith("--scope=")).map((arg) => arg.slice("--scope=".length));
  if (args.includes("--help")) {
    console.log("Usage: npx tsx scripts/verify-release-scope-405.ts --scope=<catalog-id> [--scope=<catalog-id> ...] | --all");
    return;
  }
  if ((scopes.length === 0 && !args.includes("--all")) || (scopes.length > 0 && args.includes("--all")) ||
      args.some((arg) => arg !== "--all" && !arg.startsWith("--scope="))) throw new Error("provide --all or one or more --scope=<catalog-id>");
  const assessment = await inspectCurrentReleaseScope405(defaultRoot, args.includes("--all") ? ["*"] : scopes);
  const drill = await runIsolatedRollbackDrill405();
  console.log(JSON.stringify({
    ...assessment,
    localRollbackDrill: drill,
    simulationIsExternalProof: false,
  }, null, 2));
  if (assessment.decision !== "EVIDENCE_READY_FOR_REVIEW" || drill.status !== "PASS") process.exitCode = 2;
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) {
  cli().catch((error: unknown) => {
    console.error(JSON.stringify({ decision: "NO_GO", reason: error instanceof Error ? error.message : String(error) }));
    process.exitCode = 2;
  });
}
