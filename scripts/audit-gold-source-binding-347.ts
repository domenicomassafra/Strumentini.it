/**
 * Ticket #347: read-only audit of the PUBLIC Gold/verified projection.
 *
 * Usage: npx tsx scripts/audit-gold-source-binding-347.ts [--tool=<catalog-id>]
 *
 * The current source identity is the canonical global fingerprint, which
 * includes Worker entrypoints, imported backend helpers and D1 migrations.
 * A GOLD label or generated quality index is never proof by itself.
 * The command emits a proposed safe badge set; it does not modify the UI,
 * regenerate catalog files, issue certification receipts or deploy.
 */
import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { lstat, readFile, readdir, realpath } from "node:fs/promises";
import { relative, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { currentEvidenceSourceFingerprint, EVIDENCE_SOURCE_SCOPE_VERSION } from "./lib/current-revision";
import { inspectReleaseWorkingTree162 } from "./lib/release-evidence-worktree-162";
import { validateGoldReceipts, type ToolCertificationReceipt } from "../src/release/validation";

const execFileAsync = promisify(execFile);
const sha256 = (input: string | Uint8Array) => createHash("sha256").update(input).digest("hex");
const shaPattern = /^[a-f0-9]{64}$/u;
const repository = resolve(import.meta.dirname, "..");

export interface ReceiptEvidence347 {
  readonly path: string;
  readonly sha256: string;
  readonly value: unknown;
}
export interface AuditGoldInput347 {
  readonly sourceFingerprint: string;
  readonly revision: string;
  readonly workingTreeDirty: boolean;
  readonly catalogIds: readonly string[];
  /** Exact projection served to the UI via src/generated/quality.ts. */
  readonly projected: readonly unknown[];
  readonly receipts: readonly ReceiptEvidence347[];
}
export interface BadgeFinding347 {
  readonly toolId: string;
  readonly projected: boolean;
  readonly safeToLabelGold: boolean;
  readonly reasons: readonly string[];
  readonly receiptPath: string | null;
}
export interface AuditGoldResult347 {
  readonly schemaVersion: 1;
  readonly kind: "frontend-backend-gold-source-audit-347";
  readonly status: "PASS" | "NO_GO";
  readonly sourceFingerprint: string;
  readonly revision: string;
  readonly workingTreeDirty: boolean;
  readonly projectedGoldCount: number;
  readonly verifiedGoldCount: number;
  readonly projectedGoldWithoutProof: number;
  readonly safeGoldToolIds: readonly string[];
  readonly findings: readonly BadgeFinding347[];
  readonly scope: {
    readonly frontend: "src/generated/quality.ts";
    readonly backendIncludedInFingerprint: readonly ["worker/", "worker/migrations/"];
    readonly sourceVersion: typeof EVIDENCE_SOURCE_SCOPE_VERSION;
  };
  readonly note: string;
}

function object(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown> : undefined;
}
function nonemptyStrings(value: unknown): value is string[] {
  return Array.isArray(value) && value.length > 0 && value.every((x) => typeof x === "string" && x.trim().length > 0);
}
function validReceiptPath(value: string): boolean {
  return value.startsWith("quality/receipts/") && value.endsWith(".json") &&
    !value.includes("\\") && !value.startsWith("/") && !value.includes("//") &&
    !value.split("/").some((part) => part === "." || part === "..") &&
    !/[\u0000-\u001f\u007f]/u.test(value);
}

/** Guard the two receipt-derived public views against independent tampering. */
export function assertGoldSearchConsistency347(
  catalogIds: readonly string[],
  projected: readonly unknown[],
  search: readonly unknown[],
): void {
  const catalog = new Set(catalogIds);
  const gold = new Set(projected.map((item) => object(item)?.toolId));
  const seen = new Set<string>();
  if (search.length !== catalog.size || catalog.size !== catalogIds.length) {
    throw new Error("search Gold projection inventory mismatch");
  }
  for (const candidate of search) {
    const item = object(candidate);
    const id = item?.id;
    if (typeof id !== "string" || !catalog.has(id) || seen.has(id) ||
        item?.quality !== (gold.has(id) ? "verified" : "checking")) {
      throw new Error("search Gold projection does not match generated Gold receipts");
    }
    seen.add(id);
  }
}

/** Evaluate exactly the IDs a real UI view would have projected as Gold. */
export function auditGoldSourceBinding347(input: AuditGoldInput347): AuditGoldResult347 {
  if (!shaPattern.test(input.sourceFingerprint) || !/^[a-f0-9]{40}$/u.test(input.revision)) {
    throw new Error("cannot audit without a canonical source fingerprint and Git revision");
  }
  const catalog = new Set(input.catalogIds);
  if (!catalog.size || catalog.size !== input.catalogIds.length ||
      input.catalogIds.some((id) => !id || id.trim() !== id)) throw new Error("invalid catalog inventory");
  const projection = new Map<string, Record<string, unknown>[]>();
  for (const item of input.projected) {
    const candidate = object(item);
    if (!candidate || typeof candidate.toolId !== "string" || candidate.toolId.length === 0) {
      throw new Error("malformed UI Gold projection");
    }
    projection.set(candidate.toolId, [...projection.get(candidate.toolId) ?? [], candidate]);
  }
  const receipts = new Map<string, ReceiptEvidence347[]>();
  for (const receipt of input.receipts) {
    if (!validReceiptPath(receipt.path) || !shaPattern.test(receipt.sha256)) throw new Error("invalid receipt inventory path/digest");
    const raw = object(receipt.value);
    if (!raw || typeof raw.toolId !== "string") continue;
    receipts.set(raw.toolId, [...receipts.get(raw.toolId) ?? [], receipt]);
  }
  const findings: BadgeFinding347[] = [];
  const safeGoldToolIds: string[] = [];
  // Include catalog tools without any receipt so a requested no-badge tool is
  // explicitly reported as unverified rather than disappearing from the audit.
  const ids = [...new Set([...catalog, ...projection.keys(), ...receipts.keys()])].sort();
  for (const id of ids) {
    const projected = projection.get(id) ?? [];
    const candidates = receipts.get(id) ?? [];
    const reasons: string[] = [];
    if (!catalog.has(id)) reasons.push("NOT_IN_CATALOG");
    if (projected.length > 1) reasons.push("DUPLICATE_UI_BADGE");
    if (candidates.length > 1) reasons.push("DUPLICATE_CERTIFICATION_RECEIPT");
    const view = projected.length === 1 ? projected[0] : undefined;
    const receipt = candidates.length === 1 ? candidates[0] : undefined;
    const raw = object(receipt?.value);
    if (view && (view.status !== "GOLD" || !validReceiptPath(String(view.receiptPath ?? "")))) reasons.push("UI_BADGE_MALFORMED");
    if (view && (view.sourceFingerprint !== input.sourceFingerprint ||
      !shaPattern.test(String(view.sourceFingerprint ?? "")))) reasons.push("UI_BADGE_SOURCE_UNBOUND");
    if (view && (!receipt || view.receiptPath !== receipt.path)) reasons.push("UI_BADGE_RECEIPT_MISSING");
    if (view && (!receipt || view.receiptSha256 !== receipt.sha256)) reasons.push("UI_BADGE_RECEIPT_HASH_UNBOUND");
    if (!receipt) reasons.push("GOLD_RECEIPT_MISSING");
    if (receipt && (!raw || raw.sourceFingerprint !== input.sourceFingerprint)) reasons.push("GOLD_SOURCE_STALE_OR_UNBOUND");
    if (receipt && raw?.status !== "GOLD") reasons.push("NOT_GOLD");
    if (receipt && raw?.goldEligible === false) reasons.push("NOT_GOLD_ELIGIBLE");
    if (receipt && (!nonemptyStrings(raw?.fixtureFamilies) || !object(raw?.identities) ||
      Object.keys(object(raw.identities) ?? {}).length === 0 ||
      (!nonemptyStrings(raw.oracleEntryIds) && !(typeof raw.oracleEntryId === "string" && raw.oracleEntryId.length > 0)) ||
      raw.schemaVersion !== 1 || raw.runtime === undefined || typeof raw.revision !== "string")) {
      reasons.push("GOLD_EVIDENCE_INCOMPLETE");
    }
    if (view && receipt && raw) {
      const actualOracles = nonemptyStrings(raw.oracleEntryIds) ? raw.oracleEntryIds
        : typeof raw.oracleEntryId === "string" ? [raw.oracleEntryId] : [];
      if (!nonemptyStrings(view.oracleEntryIds) ||
          JSON.stringify(view.oracleEntryIds) !== JSON.stringify(actualOracles) ||
          !nonemptyStrings(view.fixtureFamilies) ||
          JSON.stringify(view.fixtureFamilies) !== JSON.stringify(raw.fixtureFamilies)) {
        reasons.push("UI_BADGE_PROOF_MISMATCH");
      }
      // Keep the release canonical validator as the single rule for receipt strength.
      const canonical = validateGoldReceipts(
        [{ id, route: `/tools/${id}` }],
        [raw as unknown as ToolCertificationReceipt],
        input.revision,
        input.sourceFingerprint,
      );
      reasons.push(...canonical.map((item) => item.code));
    }
    // Projecting an absent badge is not an error; a valid receipt alone cannot
    // silently turn into a public Gold claim until the UI projection is bound.
    const safe = projected.length === 1 && reasons.length === 0 && !input.workingTreeDirty;
    if (safe) safeGoldToolIds.push(id);
    if (projected.length > 0 || reasons.length > 0) findings.push({
      toolId: id, projected: projected.length > 0, safeToLabelGold: safe,
      reasons: [...new Set(reasons)].sort(), receiptPath: receipt?.path ?? null,
    });
  }
  const exaggerated = findings.filter((item) => item.projected && !item.safeToLabelGold).length;
  return {
    schemaVersion: 1,
    kind: "frontend-backend-gold-source-audit-347",
    status: exaggerated > 0 || input.workingTreeDirty ? "NO_GO" : "PASS",
    sourceFingerprint: input.sourceFingerprint,
    revision: input.revision,
    workingTreeDirty: input.workingTreeDirty,
    projectedGoldCount: [...projection.values()].reduce((sum, list) => sum + list.length, 0),
    verifiedGoldCount: safeGoldToolIds.length,
    projectedGoldWithoutProof: exaggerated,
    safeGoldToolIds,
    findings,
    scope: {
      frontend: "src/generated/quality.ts",
      backendIncludedInFingerprint: ["worker/", "worker/migrations/"],
      sourceVersion: EVIDENCE_SOURCE_SCOPE_VERSION,
    },
    note: "Read-only audit. Only source/current-proof-bound badges count; PASS does not certify production or physical acceptance.",
  };
}

async function receiptFiles(directory: string): Promise<string[]> {
  const result: string[] = [];
  async function walk(path: string): Promise<void> {
    const entries = await readdir(path, { withFileTypes: true });
    for (const entry of entries) {
      const file = resolve(path, entry.name);
      if (entry.isDirectory()) await walk(file);
      else if (entry.isFile() && entry.name.endsWith(".json")) result.push(file);
    }
    if (result.length > 10000) throw new Error("receipt inventory limit exceeded");
  }
  await walk(directory);
  return result.sort();
}

/** Inventory receipts without following symlinks or allowing external paths. */
export async function inspectGoldBinding347(root: string): Promise<AuditGoldResult347> {
  const catalogModule = await import(pathToFileURL(resolve(root, "src/generated/catalog.ts")).href) as
    { catalog?: readonly { readonly id: string }[] };
  const qualityModule = await import(pathToFileURL(resolve(root, "src/generated/quality.ts")).href) as
    { qualityIndex?: { tools?: unknown } };
  const searchModule = await import(pathToFileURL(resolve(root, "src/generated/search-catalog.ts")).href) as
    { searchCatalog?: unknown };
  if (!Array.isArray(catalogModule.catalog) || !Array.isArray(qualityModule.qualityIndex?.tools)) {
    throw new Error("generated UI catalog or Gold index not available");
  }
  if (!Array.isArray(searchModule.searchCatalog)) throw new Error("search Gold projection not available");
  assertGoldSearchConsistency347(catalogModule.catalog.map((entry) => entry.id),
    qualityModule.qualityIndex.tools, searchModule.searchCatalog);
  const git = (args: string[]) => execFileAsync("git", args, { cwd: root });
  const revision = (await git(["rev-parse", "HEAD"])).stdout.trim();
  const workingTreeDirty = inspectReleaseWorkingTree162(root).dirty;
  const sourceFingerprint = await currentEvidenceSourceFingerprint(root);
  const dir = resolve(root, "quality/receipts");
  const receipts: ReceiptEvidence347[] = [];
  const realDir = await realpath(dir);
  for (const path of await receiptFiles(dir)) {
    const info = await lstat(path);
    const real = await realpath(path);
    if (!info.isFile() || !real.startsWith(realDir + sep)) throw new Error("unsafe receipt path");
    const content = await readFile(path);
    let value: unknown;
    try { value = JSON.parse(content.toString("utf8")) as unknown; } catch { continue; }
    if (typeof object(value)?.toolId === "string") receipts.push({
      path: relative(root, path).replaceAll("\\", "/"),
      sha256: sha256(content),
      value,
    });
  }
  return auditGoldSourceBinding347({
    revision, sourceFingerprint, workingTreeDirty,
    catalogIds: catalogModule.catalog.map((entry) => entry.id),
    projected: qualityModule.qualityIndex.tools,
    receipts,
  });
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const requested = args.filter((arg) => arg.startsWith("--tool=")).map((arg) => arg.slice("--tool=".length));
  if (args.includes("--help")) {
    console.log("Usage: npx tsx scripts/audit-gold-source-binding-347.ts [--tool=<catalog-id>]");
    return;
  }
  if (args.some((arg) => !arg.startsWith("--tool=")) || requested.length > 1) throw new Error("invalid arguments");
  const result = await inspectGoldBinding347(repository);
  if (requested.length > 0 && !result.findings.some((item) => item.toolId === requested[0])) {
    throw new Error("unknown or unaudited tool id");
  }
  const visible = requested.length > 0
    ? { ...result, safeGoldToolIds: result.safeGoldToolIds.filter((id) => id === requested[0]),
        findings: result.findings.filter((item) => item.toolId === requested[0]) }
    : result;
  console.log(JSON.stringify(visible, null, 2));
  if (result.status !== "PASS") process.exitCode = 2;
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) {
  main().catch((error: unknown) => {
    console.error(JSON.stringify({ status: "NO_GO", error: error instanceof Error ? error.message : String(error) }));
    process.exitCode = 2;
  });
}
