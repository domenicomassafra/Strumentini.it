import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

/** Changing this scope intentionally invalidates all earlier Gold/source receipts. */
export const EVIDENCE_SOURCE_SCOPE_VERSION = "canonical-global-sha256-v2" as const;

export async function currentRevision(root: string): Promise<string> {
  const result = await execFileAsync("git", ["rev-parse", "HEAD"], { cwd: root });
  return result.stdout.trim();
}

const evidenceRootFiles = new Set([
  "astro.config.mjs",
  "package-lock.json",
  "package.json",
  "tsconfig.json",
  "wrangler.jsonc",
]);
const evidencePrefixes = [
  "public/",
  "quality/fixtures/",
  "quality/oracles/",
  "scripts/",
  "src/",
  "tests/",
  // Wrangler's API Worker and its D1 migrations affect the deployed release.
  // Both must invalidate evidence when changed, including imported helpers and
  // SQL added after the last receipt. All current consumers compare one global
  // digest; per-route fingerprints require a future receipt schema and scope
  // resolver, never an exemption that leaves backend claims apparently fresh.
  "worker/",
];

// The public Gold index's JSON value is derived from current receipts. In the
// search index ONLY the verified/checking labels depend on those same receipts.
// Preserve generated code/boilerplate and search metadata under the digest.
const derivedGoldIndex = "src/generated/quality.ts";
const generatedSearchIndex = "src/generated/search-catalog.ts";

function isEvidenceSource(path: string): boolean {
  if (path.startsWith("quality/receipts/")) return false;
  return evidenceRootFiles.has(path) || evidencePrefixes.some((prefix) => path.startsWith(prefix));
}

function sourceContentForDigest(path: string, bytes: Buffer): string | Buffer {
  if (path === generatedSearchIndex) {
    return bytes.toString("utf8").replace(/"quality":"(?:verified|checking)"/gu, '"quality":"checking"');
  }
  if (path !== derivedGoldIndex) return bytes;
  const source = bytes.toString("utf8");
  const marker = "export const qualityIndex = ";
  const suffix = " as const satisfies GoldQualityIndex;";
  const start = source.indexOf(marker);
  const valueStart = start + marker.length;
  const end = source.indexOf(suffix, valueStart);
  if (start < 0 || end < 0 || source.indexOf(marker, valueStart) !== -1) return source;
  try {
    const value = JSON.parse(source.slice(valueStart, end)) as Record<string, unknown>;
    if (value?.schemaVersion !== 1 || !Array.isArray(value.tools)) return source;
  } catch {
    // Do not normalize malformed or executable code in place of the JSON index.
    return source;
  }
  return source.slice(0, valueStart) + "<receipt-derived-Gold-index>" + source.slice(end);
}

/**
 * Fingerprint the source and truth inputs that release evidence certifies.
 * Receipts are excluded; only the Gold JSON payload and derived Gold search
 * labels are neutralized. Generated module code remains hashed. The explicit
 * version/domain separator invalidates older receipts while retaining all
 * independently authored code, backend, migrations, assets and oracle inputs.
 */
export async function currentEvidenceSourceFingerprint(root: string): Promise<string> {
  const result = await execFileAsync("git", ["ls-files", "-co", "--exclude-standard", "-z"], {
    cwd: root,
    encoding: "buffer",
    maxBuffer: 16 * 1024 * 1024,
  });
  const paths = result.stdout.toString("utf8").split("\0").filter(Boolean).filter(isEvidenceSource).sort();
  const hash = createHash("sha256");
  hash.update(EVIDENCE_SOURCE_SCOPE_VERSION);
  hash.update("\0");
  for (const path of paths) {
    hash.update(path);
    hash.update("\0");
    try {
      const content = await readFile(resolve(root, path));
      hash.update(sourceContentForDigest(path, content));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      // `git ls-files` also reports tracked paths deleted in the working tree.
      // Keep the deletion in the fingerprint instead of failing or silently
      // hashing the previous committed contents.
      hash.update("<deleted>");
    }
    hash.update("\0");
  }
  return hash.digest("hex");
}
