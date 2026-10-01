import { describe, expect, it } from "vitest";
import { catalog } from "../src/generated/catalog";
import { qualityIndex } from "../src/generated/quality";
import { buildGoldQualityIndex, goldToolIds } from "../src/onboarding/quality";
import { contextTagsForTools } from "../src/onboarding/membership";
import { WORK_CONTEXT_PACKS } from "../src/onboarding/contexts";
import {
  addStarterAlternative,
  findStarterAlternatives,
  recommendStarter,
  resolveStarter,
  toggleStarterTool,
} from "../src/onboarding/recommendations";
import { applyStarterSelection, createDefaultWorkbenchState } from "../src/workbench/state";
import { createDefaultWorkProfile } from "../src/profile/work-profile";

function difference(left: readonly string[], right: readonly string[]): number {
  const rightSet = new Set(right);
  const leftSet = new Set(left);
  return [...leftSet].filter((id) => !rightSet.has(id)).length + [...rightSet].filter((id) => !leftSet.has(id)).length;
}

describe("deterministic onboarding", () => {
  it("keeps the full catalog available while indexing only receipt-backed Gold tools", () => {
    expect(catalog).toHaveLength(200);
    expect(qualityIndex.tools.length).toBeGreaterThan(0);
    expect(qualityIndex.tools.length).toBeLessThan(catalog.length);
    expect(contextTagsForTools(catalog).size).toBe(200);
  });

  it("builds a fail-closed Gold index from quality receipts", () => {
    const result = buildGoldQualityIndex([
      { schemaVersion: 1, toolId: "business-day", status: "GOLD", receiptPath: "quality/business-day.json", oracleEntryId: "cand-083", fixtureFamilies: ["business-days"] },
      { schemaVersion: 1, toolId: "image-resize", status: "PARTIAL", goldEligible: false, receiptPath: "quality/image-resize.json" },
      { schemaVersion: 1, toolId: "business-day", status: "GOLD", receiptPath: "quality/duplicate.json", oracleEntryId: "cand-083", fixtureFamilies: ["business-days"] },
      { schemaVersion: 1, toolId: "csv-cleaner", status: "GOLD", receiptPath: "quality/csv-cleaner.json", oracleEntryId: "cand-022", fixtureFamilies: ["csv-rfc4180"] },
      { schemaVersion: 1, toolId: "not-in-catalog", status: "GOLD", receiptPath: "quality/unknown.json", oracleEntryId: "cand-001", fixtureFamilies: ["list-set-ops"] },
    ], catalog.map(({ id }) => id));
    expect(result.index.tools.map(({ toolId }) => toolId)).toEqual(["csv-cleaner"]);
    expect(result.excludedToolIds).toEqual(["business-day", "image-resize"]);
  });

  it("generates visibly different 10-tool starters for the four primary contexts", () => {
    const primary = WORK_CONTEXT_PACKS.slice(0, 4).map(({ id }) => id);
    const reviews = primary.map((contextId) => resolveStarter({ contextIds: [contextId] }, catalog, qualityIndex));
    const gold = goldToolIds(qualityIndex);
    expect(reviews.every(({ recommendations }) => recommendations.length === 10)).toBe(true);
    expect(reviews.flatMap(({ recommendations }) => recommendations).every(({ tool }) => gold.has(tool.id))).toBe(true);
    expect(reviews.flatMap(({ recommendations }) => recommendations).every(({ reason }) => reason.trim() !== "")).toBe(true);
    for (let left = 0; left < reviews.length; left += 1) {
      for (let right = left + 1; right < reviews.length; right += 1) {
        expect(difference(reviews[left]!.selectedToolIds, reviews[right]!.selectedToolIds)).toBeGreaterThanOrEqual(4);
      }
    }
  });

  it("is stable for repeated resolution and exposes the recommendation seam", () => {
    const input = { contextIds: ["marketing-growth" as const], recurringJobIds: ["build-links" as const] };
    expect(recommendStarter(input, catalog, qualityIndex)).toEqual(recommendStarter(input, catalog, qualityIndex));
    expect(recommendStarter(input, catalog, qualityIndex).every(({ quality }) => quality === "gold")).toBe(true);
    expect(recommendStarter(input, catalog, qualityIndex).some(({ reasonCode }) => reasonCode === "recurring-job")).toBe(true);
    const suppliedGold = catalog.filter(({ id }) => goldToolIds(qualityIndex).has(id));
    expect(recommendStarter("client-services", [], suppliedGold)).toHaveLength(10);
  });

  it("allows editable review changes while keeping manual additions explicit", () => {
    const review = resolveStarter({ contextIds: ["client-services"] }, catalog, qualityIndex);
    const removed = toggleStarterTool(review, review.selectedToolIds[0]!, false);
    expect(removed.selectedToolIds).toHaveLength(9);
    const candidate = catalog.find(({ id }) => id === "archive-checksum-manifest");
    expect(candidate).toBeDefined();
    const added = addStarterAlternative(removed, candidate!, qualityIndex);
    expect(added.selectedToolIds).toContain("archive-checksum-manifest");
    expect(added.recommendations.find(({ tool }) => tool.id === "archive-checksum-manifest")?.reason).toContain("non certificato Gold");
    const alternative = findStarterAlternatives("Checksum", catalog, qualityIndex, added.selectedToolIds, 4);
    expect(alternative.length).toBeGreaterThan(0);
  });

  it("applies an accepted starter set to local Workbench state without an account", () => {
    const state = createDefaultWorkbenchState(createDefaultWorkProfile({ locale: "en-US", timezone: "UTC" }));
    const next = applyStarterSelection(state, ["utm-builder", "csv-cleaner", "csv-cleaner"], createDefaultWorkProfile({ locale: "it-IT", timezone: "Europe/Rome" }), ["marketing-growth", "data-cleanup"]);
    expect(next.installedTools).toEqual(["utm-builder", "csv-cleaner"]);
    expect(next.packs).toEqual(["marketing-growth", "data-cleanup"]);
    expect(next.profile.locale).toBe("it-IT");
  });
});
