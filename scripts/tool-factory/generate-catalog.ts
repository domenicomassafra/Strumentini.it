import { readFile, readdir, writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import {
  assertGeneratedCatalogCurrent,
  compileFactoryCatalog,
  toLegacyCatalogSummary,
} from "../../src/tool-factory/catalog";
import { renderCatalogSources } from "../../src/catalog/projections";
import type { ToolManifest } from "../../src/catalog/manifest";
import type { FixtureIndex, OracleRegistry } from "../../src/tool-factory/manifest";

const root = resolve(import.meta.dirname, "../..");
const toolsRoot = resolve(root, "src/tools");
const checkOnly = process.argv.includes("--check");

async function discoverManifests(): Promise<unknown[]> {
  const entries = await readdir(toolsRoot, { withFileTypes: true });
  const manifests: unknown[] = [];
  for (const entry of entries.toSorted((left, right) => left.name.localeCompare(right.name))) {
    if (!entry.isDirectory()) continue;
    const manifestPath = resolve(toolsRoot, entry.name, "manifest.ts");
    try {
      await readFile(manifestPath, "utf8");
    } catch {
      continue;
    }
    const imported = await import(`${pathToFileURL(manifestPath).href}?factory=${Date.now()}`) as {
      default?: ToolManifest;
    };
    if (imported.default === undefined) throw new Error(`${manifestPath}: missing default ToolManifest export`);
    manifests.push(imported.default);
  }
  return manifests;
}

const registry = JSON.parse(await readFile(resolve(root, "quality/oracles/registry.json"), "utf8")) as OracleRegistry;
const fixtureIndex = JSON.parse(await readFile(resolve(root, "quality/fixtures/index.json"), "utf8")) as FixtureIndex;
const artifacts = compileFactoryCatalog(await discoverManifests(), {
  oracleRegistry: registry,
  fixtureIndex,
  requireOracleBindings: true,
  requireAcceptance: true,
});
const legacySummaries = artifacts.summaries.map(toLegacyCatalogSummary);
const sources = renderCatalogSources(legacySummaries, artifacts.loaders);
const generatedPaths = {
  catalog: resolve(root, "src/generated/catalog.ts"),
  loaders: resolve(root, "src/generated/tool-loaders.ts"),
  searchCatalog: resolve(root, "src/generated/search-catalog.ts"),
  workbenchCatalog: resolve(root, "src/generated/workbench-catalog.ts"),
  runtimeToolIndex: resolve(root, "src/generated/runtime-tool-index.ts"),
  handoffCatalog: resolve(root, "src/generated/handoff-catalog.ts"),
};
const outputs = Object.entries(sources).map(([key, content]) => [generatedPaths[key as keyof typeof generatedPaths], content] as const);

if (checkOnly) {
  const files = {
    catalog: await readFile(generatedPaths.catalog, "utf8").catch(() => ""),
    loaders: await readFile(generatedPaths.loaders, "utf8").catch(() => ""),
  };
  assertGeneratedCatalogCurrent(artifacts, files);
  for (const [key, path] of Object.entries(generatedPaths)) {
    if (key === "catalog" || key === "loaders") continue;
    if (await readFile(path, "utf8").catch(() => "") !== sources[key as keyof typeof sources]) {
      throw new Error(`tool-factory catalog output is stale: ${path}`);
    }
  }
  console.log(`tool-factory catalog: ${artifacts.summaries.length} tool(s), outputs current`);
} else {
  for (const [path, content] of outputs) {
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, content, "utf8");
  }
  console.log(`tool-factory catalog: ${artifacts.summaries.length} tool(s), outputs generated`);
}
