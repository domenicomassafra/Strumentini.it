import { access, mkdir, writeFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import {
  parseToolManifest,
  type FactoryToolManifest,
  type PrivacyClass,
} from "./manifest";

export interface ToolScaffoldSpec {
  readonly id: string;
  readonly name: string;
  readonly summary: string;
  readonly category: string;
  readonly engine: string;
  readonly jobs: readonly string[];
  readonly aliases?: readonly string[];
  readonly keywords?: readonly string[];
  readonly inputTypes?: readonly string[];
  readonly packIds?: readonly string[];
  readonly roleTags?: readonly string[];
  readonly profileFields?: FactoryToolManifest["profileFields"];
  readonly handoff?: FactoryToolManifest["handoff"];
  readonly gold: FactoryToolManifest["gold"];
  readonly runtime?: FactoryToolManifest["runtime"];
  readonly privacyClass?: PrivacyClass;
  readonly capabilities?: FactoryToolManifest["capabilities"];
  readonly version?: string;
  readonly deterministic?: boolean;
  readonly dependencies?: FactoryToolManifest["dependencies"];
  readonly lazyDependencies?: FactoryToolManifest["lazyDependencies"];
  readonly bundle?: FactoryToolManifest["bundle"];
  readonly offline?: FactoryToolManifest["offline"];
  readonly acceptance?: FactoryToolManifest["acceptance"];
  readonly clientDirective?: "load" | "idle" | "visible";
}

export interface ToolScaffoldFile {
  readonly path: string;
  readonly content: string;
}

export interface ToolScaffoldResult {
  readonly manifest: FactoryToolManifest;
  readonly files: readonly ToolScaffoldFile[];
}

export interface WriteScaffoldOptions {
  readonly root?: string;
  readonly force?: boolean;
}

function pascalCase(id: string): string {
  return id.split("-").map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`).join("");
}

function html(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function expression(value: string): string {
  return JSON.stringify(value);
}

function createManifest(spec: ToolScaffoldSpec): FactoryToolManifest {
  const privacyClass = spec.privacyClass ?? "LOCAL";
  const runtime = spec.runtime ?? {
    location: privacyClass,
    network: privacyClass === "LOCAL" ? "forbidden" as const : privacyClass === "REFERENCE" ? "reference-only" as const : "required" as const,
  };
  const component = `${pascalCase(spec.id)}Tool`;
  const page = { component, clientDirective: spec.clientDirective ?? "load" as const };
  const raw = {
    id: spec.id,
    route: `/tools/${spec.id}`,
    name: spec.name,
    summary: spec.summary,
    aliases: spec.aliases ?? [],
    keywords: spec.keywords ?? [],
    jobs: spec.jobs,
    category: spec.category,
    inputTypes: spec.inputTypes ?? ["text"],
    packIds: spec.packIds ?? [],
    roleTags: spec.roleTags ?? [],
    implementation: `../tools/${spec.id}/module.ts`,
    engine: spec.engine,
    runtime,
    privacyClass,
    ...(privacyClass === "LOCAL" ? {} : { privacy: { class: privacyClass, disclosure: `This tool uses ${privacyClass.toLowerCase()} data handling.` } }),
    capabilities: spec.capabilities ?? [],
    profileFields: spec.profileFields ?? [],
    ...(spec.handoff === undefined ? {} : { handoff: spec.handoff }),
    gold: spec.gold,
    version: spec.version ?? "0.1.0",
    deterministic: spec.deterministic ?? true,
    dependencies: spec.dependencies ?? [],
    lazyDependencies: spec.lazyDependencies ?? [],
    bundle: spec.bundle ?? { eager: false, lazy: true, initialBytes: 0, maxBytes: 250_000 },
    offline: spec.offline ?? (privacyClass === "LOCAL" ? "FULL" : "SHELL_ONLY"),
    acceptance: spec.acceptance ?? {
      independentOracle: true,
      fixtureFamilies: spec.gold.fixtureFamilies,
      privacy: true,
      accessibility: true,
      bundle: true,
    },
    page,
  };
  return parseToolManifest(raw);
}

function renderManifest(manifest: FactoryToolManifest): string {
  return `import type { FactoryToolManifest } from "../../tool-factory/manifest";\n\n` +
    `export const ${manifest.id.replaceAll("-", "_")}Manifest = ${JSON.stringify(manifest, null, 2)} as const satisfies FactoryToolManifest;\n\n` +
    `export default ${manifest.id.replaceAll("-", "_")}Manifest;\n`;
}

function renderModule(manifest: FactoryToolManifest): string {
  return `import type { ToolModule } from "../../runtime/types";\n\n` +
    `const module: ToolModule = {\n` +
    `  run(_input, _context, signal): unknown {\n` +
    `    if (signal?.aborted) throw new DOMException("Operazione annullata", "AbortError");\n` +
    `    throw new Error("TOOL_IMPLEMENTATION_REQUIRED: ${manifest.id}");\n` +
    `  },\n` +
    `};\n\n` +
    `export default module;\n`;
}

function renderComponent(manifest: FactoryToolManifest): string {
  const component = manifest.page?.component ?? `${pascalCase(manifest.id)}Tool`;
  return `export function ${component}() {\n` +
    `  return <div class="tool-operation" aria-busy="true"><p role="status">Implementazione di ${html(manifest.name)} non ancora disponibile.</p></div>;\n` +
    `}\n`;
}

function renderPage(manifest: FactoryToolManifest): string {
  const component = manifest.page?.component ?? `${pascalCase(manifest.id)}Tool`;
  const directive = manifest.page?.clientDirective ?? "load";
  return `---\n` +
    `import ItalianToolPage from "../../components/tools/shared/ItalianToolPage.astro";\n` +
    `import { ${component} } from "../../components/tools/${component}";\n` +
    `---\n` +
    `<ItalianToolPage toolId="${manifest.id}">\n` +
    `  <${component} client:${directive} />\n` +
    `</ItalianToolPage>\n`;
}

function renderContractTest(manifest: FactoryToolManifest): string {
  return `import { describe, expect, test } from "vitest";\n` +
    `import manifest from "../../src/tools/${manifest.id}/manifest";\n` +
    `import { parseToolManifest } from "../../src/tool-factory";\n\n` +
    `describe("${manifest.name} factory contract", () => {\n` +
    `  test("canonical manifest remains parseable", () => {\n` +
    `    expect(parseToolManifest(manifest).route).toBe(${expression(manifest.route)});\n` +
    `  });\n` +
    `  test.todo("Add public behavior cases for ${html(manifest.name)}");\n` +
    `});\n`;
}

function renderGoldTest(manifest: FactoryToolManifest): string {
  return `import { describe, test } from "vitest";\n` +
    `import manifest from "../../src/tools/${manifest.id}/manifest";\n\n` +
    `describe("${manifest.name} independent Gold tests", () => {\n` +
    `  test.todo("Add exact vectors for ${manifest.gold.fixtureFamilies.join(", ")} before certification");\n` +
    `  test.todo("Bind oracle ${manifest.gold.oracleEntryId} to the tool implementation");\n` +
    `  void manifest;\n` +
    `});\n`;
}

export function createToolScaffold(spec: ToolScaffoldSpec): ToolScaffoldResult {
  const manifest = createManifest(spec);
  const component = manifest.page?.component ?? `${pascalCase(manifest.id)}Tool`;
  return {
    manifest,
    files: [
      { path: `src/tools/${manifest.id}/manifest.ts`, content: renderManifest(manifest) },
      { path: `src/tools/${manifest.id}/module.ts`, content: renderModule(manifest) },
      { path: `src/components/tools/${component}.tsx`, content: renderComponent(manifest) },
      { path: `src/pages/tools/${manifest.id}.astro`, content: renderPage(manifest) },
      { path: `tests/tool-factory/${manifest.id}.test.ts`, content: renderContractTest(manifest) },
      { path: `tests/tool-factory/${manifest.id}.gold.test.ts`, content: renderGoldTest(manifest) },
    ],
  };
}

export const scaffoldTool = createToolScaffold;
export const createScaffold = createToolScaffold;
export const renderToolPage = renderPage;

function isWithinRoot(root: string, path: string): boolean {
  const relativePath = relative(root, path);
  return relativePath === "" || (!relativePath.startsWith("..") && !relativePath.startsWith("/"));
}

export async function writeToolScaffold(
  result: ToolScaffoldResult,
  options: WriteScaffoldOptions = {},
): Promise<void> {
  const root = resolve(options.root ?? process.cwd());
  const existing: string[] = [];
  for (const file of result.files) {
    const target = resolve(root, file.path);
    if (!isWithinRoot(root, target)) throw new Error(`scaffold path escapes project root: ${file.path}`);
    try {
      await access(target);
      existing.push(file.path);
    } catch {
      continue;
    }
  }
  if (existing.length > 0 && options.force !== true) {
    throw new Error(`scaffold refused to overwrite existing files: ${existing.join(", ")}`);
  }
  for (const file of result.files) {
    const target = resolve(root, file.path);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, file.content, "utf8");
  }
}
