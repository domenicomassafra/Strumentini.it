import { describe, expect, it } from "vitest";
import { selectHomeRecent345 } from "../src/components/home/recent-tools-345";
import type { RecentToolActivity } from "../src/workbench/state";

const catalog = [
  { id: "pdf-merge", route: "/tools/pdf-merge", name: "Unisci PDF", summary: "Combinazione", category: "pdf" },
  { id: "utm-builder", route: "/tools/utm-builder", name: "UTM", summary: "Crea UTM", category: "marketing" },
  { id: "csv-cleaner", route: "/tools/csv-cleaner", name: "CSV", summary: "Pulizia", category: "data" },
  { id: "unsafe", route: "/redirect?payload=secret", name: "Malevolo", summary: "Non fidato", category: "private" },
] as const;
const entry = (toolId: string, lastUsedAt: string, useCount = 1): RecentToolActivity => ({ toolId, lastUsedAt, useCount });

describe("#345 Home recent metadata-only navigation", () => {
  it("orders successful tool metadata by completion time, links to current catalog, and caps links", () => {
    const links = selectHomeRecent345([
      entry("pdf-merge", "2026-10-10T10:00:00.000Z"),
      entry("utm-builder", "2026-10-11T10:00:00.000Z", 3),
      entry("csv-cleaner", "2026-10-09T10:00:00.000Z"),
    ], catalog, 2);
    expect(links.map(({ id, route }) => ({ id, route }))).toEqual([
      { id: "utm-builder", route: "/tools/utm-builder" },
      { id: "pdf-merge", route: "/tools/pdf-merge" },
    ]);
    expect(links[0]?.useCount).toBe(3);
  });

  it("refuses untrusted paths, stale IDs, duplicate tool metadata and invalid dates", () => {
    const links = selectHomeRecent345([
      entry("unsafe", "2026-10-10T11:00:00.000Z"),
      entry("utm-builder", "2026-10-11T11:00:00.000Z"),
      entry("utm-builder", "2026-10-10T11:00:00.000Z"),
      entry("file.pdf", "2026-10-10T11:00:00.000Z"),
      entry("stale-tool", "2026-10-10T11:00:00.000Z"),
      entry("pdf-merge", "bad timestamp"),
      entry("csv-cleaner", "2026-10-10T11:00:00.000Z", -1),
    ], catalog);
    expect(links.map((tool) => tool.id)).toEqual(["utm-builder"]);
    expect(JSON.stringify(links)).not.toMatch(/secret|\.pdf|stale-tool|redirect/u);
  });

  it("does not derive navigation from filenames, values, query strings, input or blob content", () => {
    const output = selectHomeRecent345([
      { ...entry("pdf-merge", "2026-10-10T11:00:00.000Z"), filename: "PRIVATE-REPORT.pdf", value: "SECRET" } as RecentToolActivity,
    ], catalog);
    expect(output).toHaveLength(1);
    expect(output[0]?.route).toBe("/tools/pdf-merge");
    expect(JSON.stringify(output)).not.toMatch(/PRIVATE|SECRET/u);
  });
});
