import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

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
];

function isEvidenceSource(path: string): boolean {
  if (path.startsWith("quality/receipts/")) return false;
  return evidenceRootFiles.has(path) || evidencePrefixes.some((prefix) => path.startsWith(prefix));
}

/**
 * Fingerprint the source and truth inputs that release evidence certifies.
 * Generated/versioned receipts are deliberately excluded, so the fingerprint
 * stays stable when those receipts are committed and avoids a self-referential
 * "receipt must contain the commit that contains the receipt" cycle.
 */
export async function currentEvidenceSourceFingerprint(root: string): Promise<string> {
  const result = await execFileAsync("git", ["ls-files", "-co", "--exclude-standard", "-z"], {
    cwd: root,
    encoding: "buffer",
    maxBuffer: 16 * 1024 * 1024,
  });
  const paths = result.stdout.toString("utf8").split("\0").filter(Boolean).filter(isEvidenceSource).sort();
  const hash = createHash("sha256");
  for (const path of paths) {
    hash.update(path);
    hash.update("\0");
    try {
      hash.update(await readFile(resolve(root, path)));
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
