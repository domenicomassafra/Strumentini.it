import { readFile, readdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

// The explicit import symbol is required for Astro to discover and hydrate
// each Preact island at build time; runtime-selected components cannot use client:load.
export type RouteWrapperSpec = readonly [id: string, componentModule: string, component: string, style?: "compact" | "compact-spaced"];

function validateRouteSpec(value: unknown): asserts value is RouteWrapperSpec {
  if (!Array.isArray(value) || (value.length !== 3 && value.length !== 4)
    || value.some((part) => typeof part !== "string")
    || (value.length === 4 && !["compact", "compact-spaced"].includes(value[3]))) {
    throw new Error("Route wrapper specification must contain [id, component module, exported symbol]");
  }
  const [id, componentModule, component] = value as string[];
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(id ?? "")
    || !/^\.\.\/\.\.\/components\/tools\/[A-Za-z0-9/_-]+$/u.test(componentModule ?? "")
    || !/^[A-Za-z_$][\w$]*$/u.test(component ?? "")) {
    throw new Error(`Unsafe or malformed route wrapper specification: ${JSON.stringify(value)}`);
  }
}

export function renderRouteWrapper(spec: RouteWrapperSpec): string {
  validateRouteSpec(spec);
  const [id, componentModule, component, style] = spec;
  const frontmatter = `---
import ItalianToolPage from "../../components/tools/shared/ItalianToolPage.astro";
import { ${component} } from "${componentModule}";
---
`;
  if (style === "compact" || style === "compact-spaced") {
    return `${frontmatter}${style === "compact-spaced" ? "\n" : ""}<ItalianToolPage toolId="${id}"><${component} client:load /></ItalianToolPage>\n`;
  }
  return `${frontmatter}
<ItalianToolPage toolId="${id}">
  <${component} client:load />
</ItalianToolPage>
`;
}

export async function readRouteWrapperSpecs(root: string): Promise<readonly RouteWrapperSpec[]> {
  const directory = resolve(root, "src/tool-factory/route-wrapper-specs");
  const files = (await readdir(directory)).filter((file) => /^part-[0-9]+\.json$/u.test(file)).sort();
  if (files.length === 0) throw new Error("No generated tool route specifications found");
  const specs: RouteWrapperSpec[] = [];
  const seen = new Set<string>();
  for (const file of files) {
    const rows: unknown = JSON.parse(await readFile(resolve(directory, file), "utf8"));
    if (!Array.isArray(rows)) throw new Error(`${file}: expected route specification array`);
    for (const row of rows) {
      validateRouteSpec(row);
      if (seen.has(row[0])) throw new Error(`Duplicate generated tool route: ${row[0]}`);
      seen.add(row[0]);
      specs.push(row);
    }
  }
  return specs.sort((left, right) => left[0].localeCompare(right[0]));
}

export async function materializeRouteWrappers(root: string, checkOnly = false): Promise<number> {
  const specs = await readRouteWrapperSpecs(root);
  for (const spec of specs) {
    const path = resolve(root, "src/pages/tools", `${spec[0]}.astro`);
    const expected = renderRouteWrapper(spec);
    const actual = await readFile(path, "utf8").catch(() => null);
    if (actual === expected) continue;
    if (checkOnly) throw new Error(`Generated route is absent or stale: ${spec[0]}.astro`);
    await writeFile(path, expected, "utf8");
  }
  return specs.length;
}
