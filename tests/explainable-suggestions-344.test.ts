import { describe, expect, it } from "vitest";
import { explainableSuggestions344 } from "../src/workbench/explainable-suggestions-344";

const tools = [
  { id: "pdf-merge", name: "Unisci PDF", route: "/tools/pdf-merge", category: "documents" },
  { id: "pdf-to-images", name: "PDF in immagini", route: "/tools/pdf-to-images", category: "documents" },
  { id: "pdf-flatten", name: "Appiattisci PDF", route: "/tools/pdf-flatten", category: "documents" },
  { id: "utm-builder", name: "Link UTM", route: "/tools/utm-builder", category: "marketing" },
  { id: "query-leak", name: "Leak", route: "/tools/query-leak?file=private", category: "documents" },
] as const;
const activity = (toolId: string, useCount = 1, lastUsedAt = "2026-10-11T00:00:00.000Z") => ({ toolId, useCount, lastUsedAt });

describe("#344 explainable, device-only recommendations", () => {
  it("does not invent popularity from catalog order or favorite status when no operation was completed", () => {
    expect(explainableSuggestions344([], [], tools)).toEqual([]);
    expect(explainableSuggestions344(["pdf-merge"], [], tools)).toEqual([]);
    expect(explainableSuggestions344([], [activity("unknown-deleted-tool")], tools)).toEqual([]);
  });

  it("recommends non-installed verified routes from categories of completed tools, with exact transparent reasons", () => {
    const result = explainableSuggestions344(["pdf-merge"], [activity("pdf-merge", 2)], tools);
    expect(result.map(({ tool }) => tool.id)).toEqual(["pdf-flatten", "pdf-to-images"]);
    expect(result.every(({ reason }) => reason.includes("2 operazioni") && reason.includes("questo dispositivo"))).toBe(true);
    expect(JSON.stringify(result)).not.toMatch(/query-leak|private/u);
  });

  it("ranks by bounded successful completions, not visits, favorites or global popularity", () => {
    const result = explainableSuggestions344(["pdf-merge"], [
      activity("pdf-merge", 2), activity("utm-builder", 5),
    ], tools);
    expect(result[0]?.tool.id).toBe("pdf-flatten"); // No uninstalled marketing option is invented.
    expect(result.map(({ tool }) => tool.id)).toEqual(["pdf-flatten", "pdf-to-images"]);
  });

  it("rejects spoofed route, unsafe/duplicate ids, bad time and impossible counters, caps output and is deterministic", () => {
    expect(explainableSuggestions344([], [activity("pdf-merge", 0)], tools)).toEqual([]);
    expect(explainableSuggestions344([], [activity("pdf-merge", 1, "not-a-date")], tools)).toEqual([]);
    expect(explainableSuggestions344([], [activity("pdf-merge", 1)], tools, Number.NaN)).toEqual([]);
    const once = explainableSuggestions344([], [activity("pdf-merge", 2), activity("pdf-merge", 5)], tools, 1);
    expect(once).toHaveLength(1);
    expect(once[0]?.reason).toContain("2 operazioni");
    expect(explainableSuggestions344([], [activity("pdf-merge", 1)], tools)).toEqual(
      explainableSuggestions344([], [activity("pdf-merge", 1)], tools),
    );
  });
});
