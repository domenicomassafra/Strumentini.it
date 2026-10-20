import { access, readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { catalog } from "../src/generated/catalog";
import { searchCatalog } from "../src/generated/search-catalog";
import { workbenchCatalog } from "../src/generated/workbench-catalog";
import { curateHomeTools413, EDITORIAL_STARTERS_413 } from "../src/catalog/home-curation-413";

describe("#413 editorial home without hiding any catalog route", () => {
  it("keeps every canonical tool searchable, installable and backed by its own real Astro route", async () => {
    const ids = catalog.map((tool) => tool.id);
    expect(ids).toHaveLength(272); // Source-bound catalog count updated for STR-422 on 2026-10-20; a change requires review.
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(searchCatalog.map((tool) => tool.id))).toEqual(new Set(ids));
    expect(new Set(workbenchCatalog.map((tool) => tool.id))).toEqual(new Set(ids));
    const routes = (await readdir(resolve("src/pages/tools"))).filter((file) => file.endsWith(".astro"));
    for (const tool of catalog) {
      expect(tool.route, `${tool.id} path`).toBe(`/tools/${tool.id}`);
      expect(routes.includes(`${tool.id}.astro`), `${tool.id} published route`).toBe(true);
      await access(resolve(`src/pages/tools/${tool.id}.astro`));
    }
    const directory = await readFile(resolve("src/pages/strumenti.astro"), "utf8");
    expect(directory).toContain("<CatalogDirectory tools={catalog}");
  });

  it("selects eight distinct valid LOCAL published examples, without fabricated popularity claims", async () => {
    const selected = curateHomeTools413(catalog);
    expect(selected.map(({ tool }) => tool.id)).toEqual(EDITORIAL_STARTERS_413.map(({ id }) => id));
    expect(new Set(selected.map(({ tool }) => tool.category)).size).toBeGreaterThanOrEqual(4);
    expect(selected).toHaveLength(8);
    expect(selected.every(({ tool, job }) => tool.runtime.location === "LOCAL" && tool.runtime.network === "forbidden" && job.length > 5)).toBe(true);
    const source = await readFile(resolve("src/components/home/StarterTools.astro"), "utf8");
    expect(source).toContain("curateHomeTools413(catalog)");
    expect(source).toContain("non sono una classifica di popolarità");
  });

  it("fails closed for missing, duped, fabricated, or not-LOCAL editorial jobs instead of silently substituting routes", () => {
    const sample = [...catalog];
    expect(() => curateHomeTools413(sample.filter((tool) => tool.id !== "pdf-merge"))).toThrow("EDITORIAL_TOOL_NOT_CURRENT_LOCAL_ROUTE:pdf-merge");
    expect(() => curateHomeTools413([sample[0]!, ...sample])).toThrow("CATALOG_DUPLICATE_ID");
    expect(() => curateHomeTools413(sample.map((tool) => tool.id === "pdf-merge"
      ? { ...tool, route: "/tools/missing" }
      : tool))).toThrow("EDITORIAL_TOOL_NOT_CURRENT_LOCAL_ROUTE:pdf-merge");
  });
});
