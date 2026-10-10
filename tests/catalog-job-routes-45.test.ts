import { describe, expect, it } from "vitest";
import { catalog } from "../src/generated/catalog";
import { searchCatalog } from "../src/generated/search-catalog";
import { groupForCategory, groups, toolsInGroup } from "../src/catalog/groups";
import { buildJobRoutes, discoveryTopics, jobRoutes, nextJobSteps, visualSignatureRoute } from "../src/catalog/job-routes";
import { createSearch } from "../src/search/search";

describe("#45 public discovery", () => {
  it("exposes every real tool through exactly one count-backed manageable public group", () => {
    expect(groups.length).toBeLessThanOrEqual(10);
    expect(new Set(groups.map((group) => group.slug)).size).toBe(groups.length);
    const memberCategories = groups.flatMap((group) => group.memberCategories);
    expect(new Set(memberCategories).size).toBe(memberCategories.length);
    for (const tool of catalog) {
      expect(memberCategories, `unmapped ${tool.category}`).toContain(tool.category);
      expect(groupForCategory(tool.category).memberCategories).toContain(tool.category);
    }
    expect(groups.reduce((sum, group) => sum + toolsInGroup(group).length, 0)).toBe(catalog.length);
  });

  it("builds only real steps; examples have no duplicate jobs or routes", () => {
    const byId = new Map<string, (typeof catalog)[number]>(catalog.map((tool) => [tool.id, tool]));
    expect(byId.size).toBe(catalog.length);
    expect(new Set(catalog.map((tool) => tool.route)).size).toBe(catalog.length);
    expect(discoveryTopics.map((topic) => topic.title)).toEqual([
      "Conversioni e calcoli", "Italia", "Sicurezza e privacy", "Audio e video",
    ]);
    for (const topic of discoveryTopics) {
      expect(topic.tools.length).toBeGreaterThanOrEqual(2);
      for (const tool of topic.tools) expect(byId.get(tool.id)).toBe(tool);
    }
    for (const route of jobRoutes) {
      expect(route.tools.length).toBeGreaterThanOrEqual(2);
      for (const tool of route.tools) expect(byId.get(tool.id)).toBe(tool);
    }
    expect(visualSignatureRoute).toBe("/tools/pdf-watermark/#firma-grafica-visiva");
    expect(byId.get("pdf-watermark")?.route).toBe(visualSignatureRoute.split("/#")[0]);
    expect(() => buildJobRoutes(catalog.filter((tool) => tool.id !== "exif-remover"))).toThrow(/missing catalog tool exif-remover/u);
    expect(() => buildJobRoutes([...catalog, catalog[0]!])).toThrow(/duplicate IDs or paths/u);
  });

  it("offers natural next steps as navigation, including re-inspection after PDF metadata removal", () => {
    expect(nextJobSteps("image-format-conversion").map(({ next }) => next.id)).toEqual(["image-compression"]);
    expect(nextJobSteps("image-compression").map(({ next }) => next.id)).toEqual(["exif-remover"]);
    expect(nextJobSteps("tsv-to-csv").map(({ next }) => next.id)).toEqual(["csv-cleaner"]);
    expect(nextJobSteps("csv-cleaner").map(({ next }) => next.id)).toEqual(["csv-dedupe"]);
    expect(nextJobSteps("pdf-metadata-remover").map(({ next }) => next.id)).toEqual(["pdf-metadata-inspector"]);
    expect(nextJobSteps("exif-remover")).toEqual([]);
    expect(nextJobSteps("missing-tool")).toEqual([]);
  });

  it("ranks specific Italian jobs using the shared canonical search index", () => {
    const search = createSearch(searchCatalog);
    const queries: Record<string, string> = {
      "converti heic": "image-format-conversion",
      "togli exif foto": "exif-remover",
      "rimuovi metadati pdf": "pdf-metadata-remover",
      "tsv csv": "tsv-to-csv",
      "trascrizione sottotitoli": "subtitle-srt-vtt-transform",
      "scadenza passaporto": "italian-document-expiry",
      "controlla iban": "iban-validator",
      "video bitrate": "video-inspector",
    };
    for (const [query, toolId] of Object.entries(queries)) {
      expect(search.query(query, undefined, 10).hits[0]?.id, query).toBe(toolId);
    }
  });
});
