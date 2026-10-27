import { existsSync, readFileSync, readdirSync } from "node:fs";
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
const targetCategories = ["date-time", "developer", "documents"] as const;
const expectedCounts = { "date-time": 20, developer: 20, documents: 20 } as const;

const assignmentIndex = functionalAuditAssignmentIndexSchema.parse(JSON.parse(
  readFileSync(resolve(root, "quality/functional-audit/original-200.assignments.json"), "utf8"),
)) as { schemaVersion: 1; assignments: FunctionalAuditAssignment[] };
const originalToolIds = new Set(assignmentIndex.assignments.map(({ toolId }) => toolId));
const originalCatalog = catalog.filter(({ id }) => originalToolIds.has(id));

const rawRecords = readdirSync(resolve(root, "quality/functional-audit/records"))
  .filter((name) => name.endsWith(".json"))
  .toSorted()
  .map((name) => JSON.parse(readFileSync(resolve(root, "quality/functional-audit/records", name), "utf8")) as unknown);
const report = validateFunctionalAuditRecords(originalCatalog, assignmentIndex.assignments, rawRecords);
const records = report.records as readonly FunctionalAuditRecord[];
const scoped = records.filter((record) => targetCategories.includes(record.category as never));

describe("functional audit tranches 287-289", () => {
  it("has exact 20/20 catalog parity for date-time, developer, and documents", () => {
    expect(report.ok, report.issues.join("\n")).toBe(true);
    for (const category of targetCategories) {
      const expected = originalCatalog.filter((tool) => tool.category === category).map((tool) => tool.id).toSorted();
      const actual = scoped.filter((record) => record.category === category).map((record) => record.toolId).toSorted();
      expect(expected).toHaveLength(expectedCounts[category]);
      expect(actual).toEqual(expected);
    }
  });

  it("binds every complete decision to real Gold, unit, and browser evidence", () => {
    for (const record of scoped) {
      for (const evidence of record.evidence) {
        expect(evidence.ref.startsWith("legacy-expansion:") ? /^legacy-expansion:[1-9]\d*$/u.test(evidence.ref) : existsSync(resolve(root, evidence.ref)), `${record.toolId}: missing evidence ${evidence.ref}`).toBe(true);
      }
      for (const child of record.childTickets) {
        expect(child, `${record.toolId}: historical child reference`).toMatch(/^legacy-expansion:[1-9]\d*$/u);
      }
      if (record.decision !== "ALREADY_COMPLETE") continue;
      const quality = record.evidence.find((item) => item.kind === "quality-receipt");
      const unit = record.evidence.find((item) => item.kind === "unit-test");
      const browser = record.evidence.find((item) => item.kind === "browser-acceptance");
      expect(quality, `${record.toolId}: quality receipt`).toBeDefined();
      expect(unit, `${record.toolId}: unit evidence`).toBeDefined();
      expect(browser, `${record.toolId}: browser evidence`).toBeDefined();
      const receipt = JSON.parse(readFileSync(resolve(root, quality!.ref), "utf8")) as { toolId?: unknown; status?: unknown };
      expect(receipt).toMatchObject({ toolId: record.toolId, status: "GOLD" });
      expect(readFileSync(resolve(root, unit!.ref), "utf8").length).toBeGreaterThan(0);
      expect(readFileSync(resolve(root, browser!.ref), "utf8")).toContain(record.toolId);
    }
  });

  it("records the two developer gap closures as targeted upgrades", () => {
    const refused = scoped.filter((record) => record.decision === "REFUSED");
    expect(refused).toEqual([]);
    const upgraded = scoped.filter((record) => record.decision === "UPGRADED");
    expect(upgraded.map((record) => record.toolId).toSorted()).toEqual(["regex-tester", "uuid-generator"]);
    expect(upgraded.find((record) => record.toolId === "regex-tester")?.childTickets).toEqual([
      "legacy-expansion:178",
    ]);
    expect(upgraded.find((record) => record.toolId === "uuid-generator")?.childTickets).toEqual([
      "legacy-expansion:179",
    ]);
    expect(scoped.filter((record) => record.category === "date-time" && record.decision !== "ALREADY_COMPLETE")).toEqual([]);
    expect(scoped.filter((record) => record.category === "documents" && record.decision !== "ALREADY_COMPLETE")).toEqual([]);
  });

  it("keeps document completeness tied to explicitly scoped limits rather than imaginary full-PDF support", () => {
    const documents = scoped.filter((record) => record.category === "documents");
    expect(documents).toHaveLength(20);
    for (const record of documents) {
      expect(record.rationale).toMatch(/truthful product contract|Narrow PDF limits/u);
      expect(record.evidence.some((item) => item.ref === "tests/pdf-document-tools.test.ts")).toBe(true);
    }
    expect(records.find((record) => record.toolId === "pdf-password-check-remove")?.observedFunctionality).toMatch(/non prova a forzare|protetto|bypass/iu);
    expect(records.find((record) => record.toolId === "pdf-to-images")?.observedFunctionality).toMatch(/JPEG incorporati|JPEG/iu);
  });
});
