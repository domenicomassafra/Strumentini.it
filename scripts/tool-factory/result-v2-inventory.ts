import { readFile, stat } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import type { ResultV2RendererSeam } from "../../src/catalog/projections";

const SHARED_RENDERER_COMPONENTS = [
  "BusinessMathTool",
  "DateTimeOperation",
  "DeveloperWebTool",
  "TextWritingTool",
  "ResearchKnowledgeTool",
  "TableWorkbench",
  "FilePrivacyTool",
  "ImageVisualTool",
  "PdfTool",
] as const;

function repositoryPath(root: string, path: string): string {
  return relative(root, path).replaceAll("\\", "/");
}

function importedFrom(source: string, symbol: string): string | undefined {
  for (const match of source.matchAll(/import\s+\{([^}]+)\}\s+from\s+["']([^"']+)["'];?/gu)) {
    const bindings = match[1]?.split(",").map((binding) => binding.trim()) ?? [];
    if (bindings.some((binding) => {
      const [imported, local = imported] = binding.split(/\s+as\s+/u).map((part) => part.trim());
      return local === symbol;
    })) return match[2];
  }
  for (const match of source.matchAll(/import\s+([A-Za-z_$][\w$]*)\s+from\s+["']([^"']+)["'];?/gu)) {
    if (match[1] === symbol) return match[2];
  }
  return undefined;
}

async function resolveLocalModule(importer: string, specifier: string): Promise<string> {
  if (!specifier.startsWith(".")) throw new Error(`${repositoryPath(process.cwd(), importer)}: renderer import must be local: ${specifier}`);
  const base = resolve(dirname(importer), specifier);
  const candidates = [
    base,
    `${base}.tsx`,
    `${base}.ts`,
    `${base}.astro`,
    `${base}.jsx`,
    `${base}.js`,
    resolve(base, "index.tsx"),
    resolve(base, "index.ts"),
    resolve(base, "index.astro"),
  ];
  for (const candidate of candidates) {
    try {
      if ((await stat(candidate)).isFile()) return candidate;
    } catch {
      continue;
    }
  }
  throw new Error(`${repositoryPath(process.cwd(), importer)}: cannot resolve renderer import ${specifier}`);
}

function pageEntryComponent(source: string, toolId: string): string {
  if (!source.includes(`toolId="${toolId}"`)) throw new Error(`${toolId}: page does not bind ItalianToolPage to its catalog id`);
  const matches = [...source.matchAll(/<([A-Z][A-Za-z0-9]*)\b[^>]*\bclient:(?:load|idle|visible)\b[^>]*\/>/gu)];
  if (matches.length !== 1 || matches[0]?.[1] === undefined) {
    throw new Error(`${toolId}: expected exactly one client renderer component, found ${matches.length}`);
  }
  return matches[0][1];
}

async function rendererSeamForTool(root: string, toolId: string): Promise<ResultV2RendererSeam> {
  const pagePath = resolve(root, "src/pages/tools", `${toolId}.astro`);
  const pageSource = await readFile(pagePath, "utf8").catch(() => {
    throw new Error(`${toolId}: missing page source src/pages/tools/${toolId}.astro`);
  });
  const entryComponent = pageEntryComponent(pageSource, toolId);
  const entryImport = importedFrom(pageSource, entryComponent);
  if (entryImport === undefined) throw new Error(`${toolId}: cannot find import for renderer ${entryComponent}`);
  const entrySourcePath = await resolveLocalModule(pagePath, entryImport);
  const entrySource = await readFile(entrySourcePath, "utf8");

  if ((SHARED_RENDERER_COMPONENTS as readonly string[]).includes(entryComponent)) {
    return {
      toolId,
      kind: "shared",
      component: entryComponent,
      source: repositoryPath(root, entrySourcePath),
    };
  }

  const sharedMatches = SHARED_RENDERER_COMPONENTS.filter((component) => new RegExp(`<${component}\\b`, "u").test(entrySource));
  if (sharedMatches.length > 1) {
    throw new Error(`${toolId}: renderer ${entryComponent} reaches multiple shared seams: ${sharedMatches.join(", ")}`);
  }
  const sharedComponent = sharedMatches[0];
  if (sharedComponent !== undefined) {
    const sharedImport = importedFrom(entrySource, sharedComponent);
    if (sharedImport === undefined) throw new Error(`${toolId}: cannot resolve shared renderer import ${sharedComponent}`);
    const sharedSourcePath = await resolveLocalModule(entrySourcePath, sharedImport);
    return {
      toolId,
      kind: "shared",
      component: sharedComponent,
      source: repositoryPath(root, sharedSourcePath),
    };
  }

  return {
    toolId,
    kind: "bespoke",
    component: entryComponent,
    source: repositoryPath(root, entrySourcePath),
  };
}

export async function discoverResultV2RendererSeams(
  root: string,
  toolIds: readonly string[],
): Promise<readonly ResultV2RendererSeam[]> {
  const seams: ResultV2RendererSeam[] = [];
  for (const toolId of toolIds.toSorted((left, right) => left.localeCompare(right, "it-IT"))) {
    seams.push(await rendererSeamForTool(root, toolId));
  }
  return seams;
}
