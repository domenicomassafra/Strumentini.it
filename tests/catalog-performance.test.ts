import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { projectCatalog } from "../src/catalog/projections";
import { toolRuntime } from "../src/runtime/tool-runtime";
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
    expect(Object.keys(runtime[0] ?? {})).toEqual(["id", "route", "name", "profileFields"]);
    expect(handoff.every((tool) => typeof tool.handoff === "object")).toBe(true);

    const projections = projectCatalog(summaries);
    expect(projections.search).toHaveLength(200);
    expect(projections.runtime).toHaveLength(200);
    expect(Buffer.byteLength(searchText)).toBeLessThan(Buffer.byteLength(fullText));
    expect(Buffer.byteLength(runtimeText)).toBeLessThan(Buffer.byteLength(searchText));
  });

  it("keeps the runtime index usable without eagerly importing the registry", () => {
    expect(toolRuntime.preflight("business-day")).toMatchObject({ ok: true, tool: { id: "business-day" } });
    expect(toolRuntime.preflight("missing-tool")).toMatchObject({ ok: false, code: "NOT_FOUND" });
  });

  it("keeps table file I/O separate from the Papa Parse engine", async () => {
    const [ioSource, tableComponent, csvComponent] = await Promise.all([
      readFile(new URL("../src/engines/table/io.ts", import.meta.url), "utf8"),
      readFile(new URL("../src/components/tools/table/TableWorkbench.tsx", import.meta.url), "utf8"),
      readFile(new URL("../src/components/tools/csv-dedupe/CsvDedupeTool.tsx", import.meta.url), "utf8"),
    ]);
    expect(ioSource).not.toContain("papaparse");
    expect(tableComponent).toContain("engines/table/io");
    expect(tableComponent).not.toContain("engines/table/operations");
    expect(csvComponent).toContain("engines/table/io");
  });

  it("keeps search and workbench metadata out of the shell document", async () => {
    const [globalSearch, library, workbench, index] = await Promise.all([
      readFile(new URL("../src/components/search/GlobalSearch.astro", import.meta.url), "utf8"),
      readFile(new URL("../src/components/library/LibraryWorkspace.astro", import.meta.url), "utf8"),
      readFile(new URL("../src/components/workbench/Workbench.tsx", import.meta.url), "utf8"),
      readFile(new URL("../src/pages/index.astro", import.meta.url), "utf8"),
    ]);
    expect(globalSearch).toContain("import(\"../../generated/search-catalog\")");
    expect(globalSearch).not.toContain("utilityos-search-catalog");
    expect(library).toContain("import(\"../../generated/search-catalog\")");
    expect(library).toContain("id=\"utilityos-library-catalog\">[]");
    expect(workbench).toContain("import(\"../../generated/workbench-catalog\")");
    expect(index).not.toContain("generated/workbench-catalog");
  });
});
