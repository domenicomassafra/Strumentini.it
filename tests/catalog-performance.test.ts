import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { projectCatalog } from "../src/catalog/projections";
import type { ToolSummary } from "../src/catalog/manifest";

function generatedSource(name: string): Promise<string> {
  return readFile(new URL(`../src/generated/${name}`, import.meta.url), "utf8");
}

function generatedArray(text: string, name: string): unknown[] {
  const marker = `export const ${name} = `;
  const start = text.indexOf(marker);
  const end = text.indexOf(" as const", start + marker.length);
  if (start < 0 || end < 0) throw new Error(`Missing generated export: ${name}`);
  return JSON.parse(text.slice(start + marker.length, end)) as unknown[];
}

function source(relative: string): Promise<string> {
  return readFile(new URL(`../${relative}`, import.meta.url), "utf8");
}

/**
 * The code that actually ships to the browser. An Astro frontmatter import of
 * the full catalog costs nothing — it runs at build time — so the rule is about
 * the `<script>` blocks and about client components, not about the page file.
 */
function clientScripts(astroSource: string): string {
  return [...astroSource.matchAll(/<script(?![^>]*type="application\/(?:json|ld\+json)")[^>]*>([\s\S]*?)<\/script>/gu)]
    .map((match) => match[1]!)
    .join("\n");
}

describe("200-tool catalog performance boundaries", () => {
  it("keeps generated projections aligned without shipping full manifest metadata", async () => {
    const [fullText, searchText, workbenchText, runtimeText, handoffText] = await Promise.all([
      generatedSource("catalog.ts"),
      generatedSource("search-catalog.ts"),
      generatedSource("workbench-catalog.ts"),
      generatedSource("runtime-tool-index.ts"),
      generatedSource("handoff-catalog.ts"),
    ]);
    const summaries = generatedArray(fullText, "catalog") as ToolSummary[];
    const search = generatedArray(searchText, "searchCatalog") as Record<string, unknown>[];
    const workbench = generatedArray(workbenchText, "workbenchCatalog") as Record<string, unknown>[];
    const runtime = generatedArray(runtimeText, "runtimeToolIndex") as Record<string, unknown>[];
    const handoff = generatedArray(handoffText, "handoffCatalog") as Record<string, unknown>[];

    expect(summaries).toHaveLength(200);
    expect(search).toHaveLength(200);
    expect(workbench).toHaveLength(200);
    expect(runtime).toHaveLength(200);
    expect(handoff.length).toBeGreaterThan(0);
    expect(Object.keys(search[0] ?? {})).not.toContain("gold");
    expect(Object.keys(search[0] ?? {})).not.toContain("profileFields");
    expect(Object.keys(workbench[0] ?? {})).not.toContain("gold");
    expect(Object.keys(workbench[0] ?? {})).not.toContain("aliases");
    expect(Object.keys(runtime[0] ?? {})).toEqual(["id", "route", "name", "category", "profileFields"]);
    expect(handoff.every((tool) => typeof tool.handoff === "object")).toBe(true);
    expect(search.every((tool) => tool.quality === "verified" || tool.quality === "checking")).toBe(true);

    const projections = projectCatalog(summaries);
    expect(projections.search).toHaveLength(200);
    expect(projections.runtime).toHaveLength(200);
    expect(Buffer.byteLength(searchText)).toBeLessThan(Buffer.byteLength(fullText));
    expect(Buffer.byteLength(runtimeText)).toBeLessThan(Buffer.byteLength(searchText));
  });

  it("keeps the full catalog out of every client entry point", async () => {
    const [
      globalSearch,
      area,
      search,
      recent,
      home,
      cleaner,
      runtime,
    ] = await Promise.all([
      source("src/components/search/GlobalSearch.astro"),
      source("src/pages/preferiti.astro"),
      source("src/pages/cerca.astro"),
      source("src/components/home/RecentTools.astro"),
      source("src/pages/index.astro"),
      source("src/components/tools/csv-cleaner/CsvCleanerTool.tsx"),
      source("src/runtime/tool-runtime.ts"),
    ]);

    const paletteScript = clientScripts(globalSearch);
    expect(paletteScript).toContain('import("../../generated/search-catalog")');
    expect(paletteScript).not.toContain("generated/catalog");

    for (const [label, astroSource] of [["preferiti", area], ["cerca", search], ["home-recent", recent]] as const) {
      const script = clientScripts(astroSource);
      expect(script, `${label} imports the full catalog into the client`).not.toContain("generated/catalog");
    }
    expect(clientScripts(area)).toMatch(/import\("\.\.?\/(?:\.\.\/)?generated\/workbench-catalog"\)/u);
    expect(clientScripts(recent)).toMatch(/import\("\.\.?\/(?:\.\.\/)?generated\/workbench-catalog"\)/u);
    expect(clientScripts(search)).toMatch(/import\("\.\.?\/(?:\.\.\/)?generated\/search-catalog"\)/u);

    // The homepage renders the catalog on the server; its client code ships none of it.
    expect(clientScripts(home).trim()).toBe("");

    expect(cleaner).toContain("generated/handoff-catalog");
    expect(cleaner).not.toContain("generated/catalog");
    expect(runtime).toContain("generated/runtime-tool-index");
    expect(runtime).toContain('import("./registry")');
    expect(runtime).not.toMatch(/^import (?!type\b).*from "\.\/registry"/mu);
  });
});
