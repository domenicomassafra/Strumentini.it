import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { catalog } from "../src/generated/catalog";
import {
  functionalAuditAssignmentIndexSchema,
  validateFunctionalAuditRecords,
  type FunctionalAuditAssignment,
  type FunctionalAuditRecord,
} from "../src/quality/functional-audit";

const root = resolve(import.meta.dirname, "..");
const ownerTicket = ".scratch/strumentini-expansion-20261005/issues/293-existing-marketing-200-audit-tranche.md";
const ticket321 = ".scratch/strumentini-expansion-20261005/issues/321-utm-builder-parser-cleaner-round-trip-and-bulk.md";
const ticket322 = ".scratch/strumentini-expansion-20261005/issues/322-meta-opengraph-and-social-preview-preset-upgrade.md";
const ticket325 = ".scratch/strumentini-expansion-20261005/issues/325-robots-canonical-campaign-and-naming-helper-upgrades.md";

const assignments = functionalAuditAssignmentIndexSchema.parse(JSON.parse(
  readFileSync(resolve(root, "quality/functional-audit/original-200.assignments.json"), "utf8"),
)).assignments as FunctionalAuditAssignment[];

const ownedMarketingIds = new Set(assignments.filter((assignment) => assignment.ownerTicket === ownerTicket).map((assignment) => assignment.toolId));
const marketingIds = catalog
  .filter((tool) => ownedMarketingIds.has(tool.id))
  .map((tool) => tool.id)
  .toSorted();
const rawRecords = marketingIds.map((toolId) => JSON.parse(
  readFileSync(resolve(root, "quality/functional-audit/records", `${toolId}.json`), "utf8"),
) as unknown);
const report = validateFunctionalAuditRecords(catalog, assignments, rawRecords);
const records = report.records as readonly FunctionalAuditRecord[];

const roadmapByTool: Readonly<Record<string, readonly string[]>> = {
  "campaign-name": [ticket325],
  "meta-preview": [ticket322],
  "open-graph-preview": [ticket322],
  "social-character-limit": [ticket322, ticket325],
  "tracking-cleaner": [ticket321],
  "utm-builder": [ticket321],
  "utm-parser": [ticket321],
};

describe("functional audit tranche 293", () => {
  it("has exact 12/12 marketing catalog parity under ticket 293", () => {
    expect(report.ok, report.issues.join("\n")).toBe(true);
    expect(marketingIds).toHaveLength(12);
    expect(records.map((record) => record.toolId).toSorted()).toEqual(marketingIds);
    expect(records.every((record) => record.ownerTicket === ownerTicket)).toBe(true);
  });

  it("uses real Gold, unit and browser evidence for every narrow public job", () => {
    for (const record of records) {
      expect(record.decision, record.toolId).toBe("ALREADY_COMPLETE");
      expect(record.childTickets, record.toolId).toEqual([]);
      const gold = record.evidence.find((item) => item.kind === "quality-receipt");
      const unit = record.evidence.find((item) => item.kind === "unit-test");
      const browser = record.evidence.find((item) => item.kind === "browser-acceptance");
      expect(gold, `${record.toolId}: Gold evidence`).toBeDefined();
      expect(unit, `${record.toolId}: unit evidence`).toBeDefined();
      expect(browser, `${record.toolId}: browser evidence`).toBeDefined();
      for (const evidence of record.evidence) {
        expect(existsSync(resolve(root, evidence.ref)), `${record.toolId}: missing ${evidence.ref}`).toBe(true);
      }
      const goldReceipt = JSON.parse(readFileSync(resolve(root, gold!.ref), "utf8")) as {
        toolId?: unknown;
        status?: unknown;
      };
      expect(goldReceipt).toMatchObject({ toolId: record.toolId, status: "GOLD" });
      expect(readFileSync(resolve(root, browser!.ref), "utf8")).toContain(record.toolId);
    }
  });

  it("traces known additive marketing work to 321/322/325 without duplicating gaps", () => {
    for (const record of records) {
      const roadmapRefs = record.evidence
        .filter((item) => item.kind === "source-contract" && item.ref.includes("/issues/32"))
        .map((item) => item.ref)
        .toSorted();
      expect(roadmapRefs, record.toolId).toEqual([...(roadmapByTool[record.toolId] ?? [])].toSorted());
      expect(roadmapRefs, `${record.toolId}: ticket 323 is web-operations, not marketing`).not.toContain(
        ".scratch/strumentini-expansion-20261005/issues/323-url-normalize-compare-and-bulk-transform-upgrade.md",
      );
      expect(roadmapRefs, `${record.toolId}: ticket 324 is web-operations, not marketing`).not.toContain(
        ".scratch/strumentini-expansion-20261005/issues/324-redirect-chain-and-live-network-diagnostic-upgrade.md",
      );
    }
  });
});
