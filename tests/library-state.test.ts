import { describe, expect, it } from "vitest";
import { filterLibrary, pageLibrary, parseLibraryState, serializeLibraryState } from "../src/library/library";
import type { SearchToolMetadata } from "../src/search/types";

function tool(index: number): SearchToolMetadata {
  return {
    id: `tool-${index}`,
    route: `/tools/tool-${index}`,
    name: `Tool ${String(index).padStart(3, "0")}`,
    summary: `Fixture tool ${index}`,
    aliases: [],
    jobs: index % 2 === 0 ? ["compare text"] : ["calculate dates"],
    category: index % 2 === 0 ? "text" : "date-time",
    inputTypes: [index % 2 === 0 ? "text" : "date"],
    engine: "fixture",
    runtime: { location: "LOCAL", network: "forbidden" },
    quality: index % 3 === 0 ? "verified" : "checking",
    packTags: index % 5 === 0 ? ["research"] : [],
    roleTags: index % 7 === 0 ? ["researcher"] : [],
  };
}

describe("library state seam", () => {
  it("round-trips URL-addressable query and filters", () => {
    const state = {
      q: "compare text",
      category: "text",
      tag: "research",
      input: "text",
      runtime: "LOCAL" as const,
      installed: "installed" as const,
      quality: "verified" as const,
      page: 3,
    };

    expect(parseLibraryState(serializeLibraryState(state))).toEqual(state);
  });

  it("filters metadata without requiring tool implementations", () => {
    const catalog = Array.from({ length: 20 }, (_, index) => tool(index));
    const filtered = filterLibrary(catalog, {
      q: "compare text",
      category: "text",
      tag: "research",
      input: "text",
      runtime: "LOCAL",
      installed: "installed",
      quality: "checking",
      page: 1,
    }, { installedToolIds: ["tool-0", "tool-5", "tool-10"] });

    expect(filtered.map((entry) => entry.id)).toEqual(["tool-10"]);
  });

  it("bounds a generated 500-tool fixture to at most 50 rendered rows per page", () => {
    const catalog = Array.from({ length: 500 }, (_, index) => tool(index));
    const page = pageLibrary(catalog, 7);

    expect(page.total).toBe(500);
    expect(page.totalPages).toBe(10);
    expect(page.items).toHaveLength(50);
    expect(page.items[0]?.id).toBe("tool-300");
    expect(page.items[49]?.id).toBe("tool-349");
  });
});
