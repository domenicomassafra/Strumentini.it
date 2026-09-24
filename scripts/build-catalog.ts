import { access, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type { ToolManifest } from "../src/catalog/manifest";
import { renderCatalogSources } from "../src/catalog/projections";
import { compileCatalog } from "./lib/catalog-compiler";

const checkOnly = process.argv.includes("--check");
const root = resolve(import.meta.dirname, "..");
const toolsRoot = resolve(root, "src/tools");

async function discoverManifests(): Promise<ToolManifest[]> {
  const entries = await readdir(toolsRoot, { withFileTypes: true });
  const manifests: ToolManifest[] = [];
  for (const entry of entries.toSorted((left, right) => left.name.localeCompare(right.name))) {
    if (!entry.isDirectory()) continue;
    const manifestPath = resolve(toolsRoot, entry.name, "manifest.ts");
    try {
      await access(manifestPath);
    } catch {
      continue;
    }
    const imported = await import(`${pathToFileURL(manifestPath).href}?catalog=${Date.now()}`) as {
      default?: ToolManifest;
    };
    if (imported.default === undefined) {
      throw new Error(`${manifestPath}: manifest.ts must default-export its canonical ToolManifest`);
    }
    manifests.push(imported.default);
  }
  return manifests;
}

const artifacts = compileCatalog(await discoverManifests());
const sources = renderCatalogSources(artifacts.summaries, artifacts.loaders);

const outputs = [
  [resolve(root, "src/generated/catalog.ts"), sources.catalog],
  [resolve(root, "src/generated/tool-loaders.ts"), sources.loaders],
  [resolve(root, "src/generated/search-catalog.ts"), sources.searchCatalog],
  [resolve(root, "src/generated/workbench-catalog.ts"), sources.workbenchCatalog],
  [resolve(root, "src/generated/runtime-tool-index.ts"), sources.runtimeToolIndex],
  [resolve(root, "src/generated/handoff-catalog.ts"), sources.handoffCatalog],
] as const;

for (const [path, content] of outputs) {
  if (checkOnly) {
    const existing = await readFile(path, "utf8").catch(() => "");
    if (existing !== content) {
      console.error(`catalog output is stale: ${path}`);
      process.exitCode = 1;
    }
  } else {
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, content, "utf8");
  }
}

if (process.exitCode !== 1) {
  console.log(`catalog: ${artifacts.summaries.length} tool(s), outputs ${checkOnly ? "current" : "generated"}`);
}
