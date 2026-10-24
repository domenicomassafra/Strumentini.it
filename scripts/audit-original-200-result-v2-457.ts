import { readFile, mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { catalog } from "../src/generated/catalog";
import { auditLegacyPrimaryOutputSource } from "../src/quality/legacy-result-primary";
import { resultV2Inventory } from "../src/catalog/result-v2-inventory.generated";

const root = resolve(import.meta.dirname, "..");
const outputRoot = resolve(root, "quality/functional-audit/result-v2-original-200");
const write = process.argv.includes("--write");
const sha = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
const original = JSON.parse(await readFile(resolve(root, "quality/functional-audit/original-200.inventory.json"), "utf8")) as {
  entries: Array<{ toolId: string; category: string; manifestRef: string;
    status: string; fixtureRefs: Array<{ id: string; ref: string }>;
    oracleRef: { entryId: string; ref: string };
    result: { declaration: null | { class: string; capabilities: string[] } } }>;
};
const fixtureIndex = JSON.parse(await readFile(resolve(root, "quality/fixtures/index.json"), "utf8")) as {
  families: Array<{ id: string; path: string }>;
};
const oracleRegistry = JSON.parse(await readFile(resolve(root, "quality/oracles/registry.json"), "utf8")) as {
  entries: Array<{ id: string }>;
};
const loaderSource = await readFile(resolve(root, "src/generated/tool-loaders.ts"), "utf8");
const byCatalog = new Map(catalog.map((tool) => [tool.id, tool]));
const byResult = new Map(resultV2Inventory.map((entry) => [entry.toolId, entry]));
const knownFixture = new Map(fixtureIndex.families.map(({ id, path }) => [id, path]));
const knownOracle = new Set(oracleRegistry.entries.map(({ id }) => id));
const rendererFindings = new Map<string, number>();
const seen = new Set<string>();
const rows: Array<Record<string, unknown> & { category: string; status: string }> = [];

async function present(path: string): Promise<boolean> {
  return readFile(resolve(root, path)).then(() => true, () => false);
}
function check(condition: boolean, reason: string, gaps: string[]): void {
  if (!condition) gaps.push(reason);
}

for (const originalRow of original.entries) {
  const { toolId, category } = originalRow;
  if (!/^[a-z0-9-]+$/u.test(toolId) || seen.has(toolId)) throw new Error("invalid/duplicate original route: " + toolId);
  seen.add(toolId);
  const summary = byCatalog.get(toolId);
  const projection = byResult.get(toolId);
  const gaps: string[] = [];
  check(summary !== undefined, "catalog-missing", gaps);
  check(summary?.category === category, "catalog-category-mismatch", gaps);
  check(projection !== undefined, "result-inventory-missing", gaps);
  check(originalRow.result.declaration !== null, "result-declaration-missing", gaps);
  check(projection?.resultDeclaration.state === "declared", "result-projection-undeclared", gaps);
  check(projection?.resultDeclaration.state === "declared" && projection.resultDeclaration.class === originalRow.result.declaration?.class, "result-class-mismatch", gaps);
  check(projection?.migrationOwner !== null && projection?.migrationOwner !== undefined, "migration-owner-missing", gaps);
  check(originalRow.manifestRef === `src/tools/${toolId}/manifest.ts` && await present(originalRow.manifestRef), "manifest-missing", gaps);
  const pageSourcePath = `src/pages/tools/${toolId}.astro`;
  const pageSource = await readFile(resolve(root, pageSourcePath), "utf8").catch(() => "");
  check(pageSource.includes(`toolId="${toolId}"`) && /client:(?:load|idle|visible)/u.test(pageSource), "consumer-source-missing", gaps);
  const modulePath = `src/tools/${toolId}/module.ts`;
  const lazyImport = `"${toolId}": () => import("../tools/${toolId}/module.ts")`;
  check(loaderSource.includes(lazyImport) && await present(modulePath), "lazy-loader-missing", gaps);
  check(projection !== undefined && await present(projection.rendererSeam.source), "renderer-source-missing", gaps);
  if (projection !== undefined && !rendererFindings.has(projection.rendererSeam.source)) {
    const path = projection.rendererSeam.source;
    const source = await readFile(resolve(root, path), "utf8").catch(() => "");
    rendererFindings.set(path, auditLegacyPrimaryOutputSource(path, source).length);
  }
  check(projection !== undefined && rendererFindings.get(projection.rendererSeam.source) === 0, "legacy-primary-fallback-found", gaps);
  check(originalRow.fixtureRefs.length > 0, "fixture-unbound", gaps);
  for (const fixture of originalRow.fixtureRefs) {
    check(knownFixture.get(fixture.id) === fixture.ref && await present(fixture.ref), "fixture-missing:" + fixture.id, gaps);
  }
  check(knownOracle.has(originalRow.oracleRef.entryId), "oracle-missing", gaps);
  const builtRoute = `dist/tools/${toolId}/index.html`;
  const builtRouteExists = await present(builtRoute);
  const status = gaps.length ? "GAP" : "NO_GO";
  rows.push({
    toolId, category, route: `/tools/${toolId}/`, manifest: originalRow.manifestRef,
    resultV2: {
      declared: projection?.resultDeclaration.state === "declared",
      class: originalRow.result.declaration?.class ?? null,
      renderer: projection?.rendererSeam.component ?? null,
      rendererSource: projection?.rendererSeam.source ?? null,
      migrationOwner: projection?.migrationOwner ?? null,
    },
    engineLazy: {
      engine: summary?.engine ?? null, loader: modulePath,
      declared: loaderSource.includes(lazyImport), executed: false,
    },
    fixtures: originalRow.fixtureRefs,
    oracle: originalRow.oracleRef,
    consumer: { url: `https://strumentini.it/tools/${toolId}/`, source: pageSourcePath, dist: builtRoute, distExists: builtRouteExists, executed: false },
    historicalStatus: originalRow.status,
    status,
    reason: gaps.length ? gaps : ["positive-and-refusal-consumer-unexecuted", "independent-output-parser-unverified"],
  });
}
if (rows.length !== 200 || seen.size !== 200) throw new Error(`expected exact historical denominator 200, got ${rows.length}`);
const byCategory = new Map<string, typeof rows>();
for (const row of rows) byCategory.set(row.category, [...(byCategory.get(row.category) ?? []), row]);
const reports = new Map<string, string>();
for (const [category, entries] of [...byCategory].sort(([a], [b]) => a.localeCompare(b))) {
  for (let start = 0; start < entries.length; start += 8) {
    const content = entries.slice(start, start + 8).map((entry) => JSON.stringify(entry)).join("\n") + "\n";
    if (Buffer.byteLength(content) > 20_000) throw new Error(`${category}: report exceeds 20kB`);
    reports.set(`${category}-${String(1 + start / 8).padStart(2, "0")}.jsonl`, content);
  }
}
const summary = {
  schemaVersion: 1, sha, denominator: 200,
  source: ["quality/functional-audit/original-200.inventory.json", "src/catalog/result-v2-inventory.generated.ts", "src/generated/tool-loaders.ts"],
  outcome: { GAP: rows.filter((row) => row.status === "GAP").length, NO_GO: rows.filter((row) => row.status === "NO_GO").length },
  builtRoutesPresent: rows.filter((row) => (row.consumer as { distExists: boolean }).distExists).length,
  legacyPrimaryRendererFindings: [...rendererFindings.values()].reduce((total, count) => total + count, 0),
  positiveRefusalConsumerProven: 0, independentParserProven: 0,
  files: [...reports.keys()],
  note: "NO_GO denotes unverified runtime, not a broken route. Neither legacy verification nor a dist HTML file certifies a consumer.",
};
reports.set("summary.json", JSON.stringify(summary, null, 2) + "\n");
for (const [filename, content] of reports) {
  const path = resolve(outputRoot, filename);
  if (write) {
    await mkdir(outputRoot, { recursive: true });
    await writeFile(path, content, "utf8");
  } else if (await readFile(path, "utf8").catch(() => "") !== content) {
    throw new Error("stale 200-route evidence: " + filename);
  }
}
console.log("original-200 Result v2 matrix:", JSON.stringify(summary));
