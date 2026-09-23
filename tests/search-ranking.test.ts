import { describe, expect, it } from "vitest";
import { createSearch } from "../src/search/search";
import type { SearchToolMetadata } from "../src/search/types";

const tools = [
  {
    id: "business-day",
    route: "/tools/business-day",
    name: "Business Day Calculator",
    summary: "Add or count working days.",
    aliases: ["working day calculator", "workday calculator"],
    jobs: ["add business days", "count working days"],
    category: "date-time",
    inputTypes: ["date", "number"],
    engine: "date-time",
    runtime: { location: "LOCAL", network: "forbidden" },
    packTags: ["operations"],
    roleTags: ["operator"],
  },
  {
    id: "timezone-overlap",
    route: "/tools/timezone-overlap",
    name: "Timezone Overlap",
    summary: "Find overlapping working hours.",
    aliases: ["meeting overlap"],
    jobs: ["compare working hours", "schedule across timezones"],
    category: "date-time",
    inputTypes: ["timezone"],
    engine: "date-time",
    runtime: { location: "LOCAL", network: "forbidden" },
    packTags: ["operations"],
    roleTags: ["researcher"],
  },
  {
    id: "text-diff",
    route: "/tools/text-diff",
    name: "Text Diff",
    summary: "Compare two text blocks.",
    aliases: ["compare text"],
    jobs: ["find text changes"],
    category: "text",
    inputTypes: ["text"],
    engine: "text",
    runtime: { location: "LOCAL", network: "forbidden" },
    packTags: ["research"],
    roleTags: ["researcher"],
  },
] as const satisfies readonly SearchToolMetadata[];

describe("search discovery seam", () => {
  const search = createSearch(tools);

  it("ranks an exact installed match ahead of intent, recent, pack, and catalog matches", () => {
    const result = search.query("business day calculator", {
      installedToolIds: ["business-day"],
      recentToolIds: ["timezone-overlap"],
      installedPackTags: ["research"],
    });

    expect(result.hits[0]).toMatchObject({ id: "business-day", section: "your-tools", match: "exact" });
  });

  it("matches aliases, jobs, category, role/pack tags, input types, and runtime metadata", () => {
    expect(search.query("meeting overlap").hits[0]?.id).toBe("timezone-overlap");
    expect(search.query("find text changes").hits[0]?.id).toBe("text-diff");
    expect(search.query("research").hits.map((hit) => hit.id)).toContain("text-diff");
    expect(search.query("researcher").hits.map((hit) => hit.id)).toEqual(expect.arrayContaining(["timezone-overlap", "text-diff"]));
    expect(search.query("timezone").hits[0]?.id).toBe("timezone-overlap");
    expect(search.query("local").hits).toHaveLength(3);
  });

  it("keeps installed and recent context as caller-supplied data and groups hits without duplicates", () => {
    const result = search.query("working", {
      installedToolIds: ["business-day"],
      recentToolIds: ["business-day", "timezone-overlap"],
    });

    expect(result.sections.map((section) => section.id)).toEqual(["your-tools", "recent", "library"]);
    expect(result.sections[0]?.hits.map((hit) => hit.id)).toEqual(["business-day"]);
    expect(result.sections[1]?.hits.map((hit) => hit.id)).toEqual(["timezone-overlap"]);
    expect(new Set(result.hits.map((hit) => hit.id)).size).toBe(result.hits.length);
  });

  it("returns only metadata-derived close intents for a zero result", () => {
    const result = search.query("workng day calcultor");

    expect(result.hits).toHaveLength(0);
    expect(result.closeIntents).toContain("working day calculator");
    expect(result.closeIntents.length).toBeLessThanOrEqual(4);
  });
});
