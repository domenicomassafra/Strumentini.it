import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import {
  assertNoLegacyPrimaryOutputs,
  auditLegacyPrimaryOutputSource,
  type LegacyPrimaryFinding,
} from "../src/quality/legacy-result-primary";

const root = resolve(import.meta.dirname, "..");
const toolsRoot = resolve(root, "src/components/tools");
const receiptPath = resolve(root, "quality/receipts/result-v2/legacy-primary-output.json");
const requireZero = process.argv.includes("--require-zero");
const excludedFiles = new Set([
  "src/components/tools/shared/JsonResult.tsx",
  "src/components/tools/shared/ToolResultPanel.tsx",
  "src/components/tools/shared/ResultV2Exemplars.tsx",
]);

async function sourceFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) files.push(...await sourceFiles(path));
    else if (entry.isFile() && /\.(?:tsx|ts)$/u.test(entry.name)) files.push(path);
  }
  return files.toSorted();
}

const findings: LegacyPrimaryFinding[] = [];
for (const path of await sourceFiles(toolsRoot)) {
  const file = relative(root, path);
  if (excludedFiles.has(file)) continue;
  const source = await readFile(path, "utf8");
  findings.push(...auditLegacyPrimaryOutputSource(file, source));
}

const counts = Object.fromEntries(
  ["raw-json-component", "generic-json-primary", "manual-result-panel"].map((pathClass) => [
    pathClass,
    findings.filter((finding) => finding.pathClass === pathClass).length,
  ]),
);
await mkdir(dirname(receiptPath), { recursive: true });
await writeFile(receiptPath, JSON.stringify({
  schemaVersion: 1,
  capturedAt: new Date().toISOString(),
  mode: requireZero ? "require-zero" : "inventory",
  count: findings.length,
  counts,
  findings,
}, null, 2) + "\n", "utf8");

if (requireZero) assertNoLegacyPrimaryOutputs(findings);
console.log("legacy primary-result audit:", findings.length, "finding(s)", JSON.stringify(counts));
