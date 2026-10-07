import { execFile } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { candidates } from "./candidates.mjs";

const execFileAsync = promisify(execFile);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = path.resolve(root, "../..");
const outputDir = path.join(repoRoot, "quality/benchmarks/heavy-local-feasibility");
await mkdir(outputDir, { recursive: true });

const unique = [...new Map(candidates.map((candidate) => [`${candidate.package}@${candidate.version}`, candidate])).values()];
const packages = [];
for (const candidate of unique) {
  const { stdout } = await execFileAsync("npm", ["view", `${candidate.package}@${candidate.version}`, "version", "license", "dist.unpackedSize", "dist.integrity", "time.modified", "repository.url", "--json"], { cwd: root, maxBuffer: 4 * 1024 * 1024 });
  const metadata = JSON.parse(stdout);
  packages.push({
    id: candidate.id,
    family: candidate.family,
    package: candidate.package,
    requestedVersion: candidate.version,
    version: metadata.version,
    license: metadata.license ?? null,
    unpackedBytes: metadata["dist.unpackedSize"] ?? null,
    integrity: metadata["dist.integrity"] ?? null,
    modifiedAt: metadata["time.modified"] ?? null,
    repository: metadata["repository.url"] ?? null,
    role: candidate.role,
    decision: candidate.decision,
  });
}

let audit;
try {
  const { stdout } = await execFileAsync("npm", ["audit", "--json"], { cwd: root, maxBuffer: 8 * 1024 * 1024 });
  audit = JSON.parse(stdout);
} catch (error) {
  if (typeof error?.stdout !== "string" || error.stdout.length === 0) throw error;
  audit = JSON.parse(error.stdout);
}

const receipt = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  source: "npm registry exact-version metadata via npm view",
  packages,
};
await writeFile(path.join(outputDir, "package-metadata.json"), `${JSON.stringify(receipt, null, 2)}\n`);
await writeFile(path.join(outputDir, "npm-audit.json"), `${JSON.stringify(audit, null, 2)}\n`);
console.log(JSON.stringify({ outputDir, packageCount: packages.length, vulnerabilities: audit.metadata?.vulnerabilities ?? null }, null, 2));
