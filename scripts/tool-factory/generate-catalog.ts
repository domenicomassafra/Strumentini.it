import { readFile, readdir, writeFile, mkdir } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import {
  assertGeneratedCatalogCurrent,
  compileFactoryCatalog,
} from "../../src/tool-factory/catalog";
import { renderCatalogSources, type SearchProjectionDecoration } from "../../src/catalog/projections";
import type { FixtureIndex, OracleRegistry } from "../../src/tool-factory/manifest";
import { buildGoldQualityIndex, renderGoldQualitySource } from "../../src/onboarding/quality";
import { contextTagsForTools } from "../../src/onboarding/membership";
import { missingItalianToolCopy } from "../../src/i18n/it/tool-copy";

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
      default?: unknown;
    };
    if (imported.default === undefined) throw new Error(`${manifestPath}: missing default ToolManifest export`);
    manifests.push(imported.default);
  }
  return manifests;
}

async function discoverReceipts(directory: string): Promise<unknown[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const receipts: unknown[] = [];
  for (const entry of entries.toSorted((left, right) => left.name.localeCompare(right.name))) {
    const child = resolve(directory, entry.name);
    if (entry.isDirectory()) receipts.push(...await discoverReceipts(child));
    else if (entry.isFile() && entry.name.endsWith(".json")) {
      try {
        receipts.push({ ...JSON.parse(await readFile(child, "utf8")) as object, receiptPath: relative(root, child) });
      } catch {
        continue;
      }
    }
  }
  return receipts;
}

const registry = JSON.parse(await readFile(resolve(root, "quality/oracles/registry.json"), "utf8")) as OracleRegistry;
const fixtureIndex = JSON.parse(await readFile(resolve(root, "quality/fixtures/index.json"), "utf8")) as FixtureIndex;
const artifacts = compileFactoryCatalog(await discoverManifests(), {
  oracleRegistry: registry,
  fixtureIndex,
  requireOracleBindings: true,
  requireAcceptance: true,
});
const missingItalianCopy = missingItalianToolCopy(artifacts.summaries.map(({ id }) => id));
if (missingItalianCopy.length > 0) {
  throw new Error(`catalogo pubblico senza copia italiana: ${missingItalianCopy.join(", ")}`);
}
const quality = buildGoldQualityIndex(
  await discoverReceipts(resolve(root, "quality/receipts")),
  artifacts.summaries.map(({ id }) => id),
);
const contextTags = contextTagsForTools(artifacts.summaries);
const verifiedToolIds = new Set(quality.index.tools.map(({ toolId }) => toolId));
const searchDecorations = new Map<string, SearchProjectionDecoration>(
  artifacts.summaries.map((tool) => [tool.id, {
    packTags: contextTags.get(tool.id) ?? [],
    roleTags: [],
    quality: verifiedToolIds.has(tool.id) ? "verified" : "checking",
  }]),
);
const sources = renderCatalogSources(artifacts.summaries, artifacts.loaders, searchDecorations);
const generatedPaths = {
  catalog: resolve(root, "src/generated/catalog.ts"),
  loaders: resolve(root, "src/generated/tool-loaders.ts"),
  searchCatalog: resolve(root, "src/generated/search-catalog.ts"),
  workbenchCatalog: resolve(root, "src/generated/workbench-catalog.ts"),
  runtimeToolIndex: resolve(root, "src/generated/runtime-tool-index.ts"),
  handoffCatalog: resolve(root, "src/generated/handoff-catalog.ts"),
};
const qualityPath = resolve(root, "src/generated/quality.ts");
const qualityOutput = renderGoldQualitySource(quality.index);
const outputs = [
  ...Object.entries(sources).map(([key, content]) => [generatedPaths[key as keyof typeof generatedPaths], content] as const),
  [qualityPath, qualityOutput] as const,
];

if (checkOnly) {
  const files = {
    catalog: await readFile(generatedPaths.catalog, "utf8").catch(() => ""),
    loaders: await readFile(generatedPaths.loaders, "utf8").catch(() => ""),
    quality: await readFile(qualityPath, "utf8").catch(() => ""),
  };
  assertGeneratedCatalogCurrent(artifacts, files);
  for (const [key, path] of Object.entries(generatedPaths)) {
    if (key === "catalog" || key === "loaders") continue;
    if (await readFile(path, "utf8").catch(() => "") !== sources[key as keyof typeof sources]) {
      throw new Error(`tool-factory catalog output is stale: ${relative(root, path)}`);
    }
  }
  if (files.quality !== qualityOutput) throw new Error(`factory catalog output is stale: src/generated/quality.ts`);
  console.log(`tool-factory catalog: ${artifacts.summaries.length} tool(s), Gold receipts ${quality.index.tools.length}, outputs current`);
} else {
  for (const [path, content] of outputs) {
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, content, "utf8");
  }
  console.log(`tool-factory catalog: ${artifacts.summaries.length} tool(s), Gold receipts ${quality.index.tools.length}, outputs generated`);
}
