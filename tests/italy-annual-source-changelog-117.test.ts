import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  ANNUAL_SOURCE_CHANGE_LOG_117,
  assertAnnualSourceChangeLog117,
  auditAnnualSourceChangeLog117,
  getAnnualSourceChangeEntries117,
} from "../src/reference-data/italy/annual-source-changelog-117";
import type { AnnualSourceChangeEntry117 } from "../src/reference-data/italy/annual-source-changelog-117";
import {
  ANNUAL_FISCAL_REVIEW_OWNER_117,
  ANNUAL_FISCAL_SOURCE_ROWS_117,
  listAnnualFiscalSourceYears117,
} from "../src/reference-data/italy/annual-source-registry-117";

const baseline = (): AnnualSourceChangeEntry117 => {
  const entry = ANNUAL_SOURCE_CHANGE_LOG_117
    .find((row) => row.entryId === "national-irpef-gross-subset:2025:IRPEF-2025-117-v1");
  if (!entry) throw new Error("missing 2025 IRPEF baseline");
  return entry;
};

const retroactiveAmendment = (): AnnualSourceChangeEntry117 => ({
  ...baseline(),
  entryId: "national-irpef-gross-subset:2025:TEST-2025-v2",
  version: "TEST-2025-v2",
  checkedAt: "2026-10-19",
  amendmentKind: "RETROACTIVE_AMENDMENT",
  supersedesRevisionId: "IRPEF-2025-117-v1",
  reviewOwner: "TEST-REVIEWER-ONLY",
  sourceHashes: [`sha256:${"b".repeat(64)}`],
});

describe("STR-409 annual source change log", () => {
  it("records one frozen entry per published revision under the agent owner", () => {
    const published = new Set(ANNUAL_FISCAL_SOURCE_ROWS_117
      .map((row) => `${row.datasetId}:${row.taxYear}:${row.version}`));
    expect(ANNUAL_SOURCE_CHANGE_LOG_117).toHaveLength(5);
    expect(new Set(ANNUAL_SOURCE_CHANGE_LOG_117.map((entry) => entry.entryId))).toEqual(published);
    expect(ANNUAL_FISCAL_REVIEW_OWNER_117.kind).toBe("AGENT_PROCESS");
    expect(ANNUAL_FISCAL_REVIEW_OWNER_117.professionalApproval).toBe("NOT_ATTESTED");
    for (const entry of ANNUAL_SOURCE_CHANGE_LOG_117) {
      expect(Object.isFrozen(entry)).toBe(true);
      expect(Object.isFrozen(entry.sourceUrls)).toBe(true);
      expect(Object.isFrozen(entry.sourceHashes)).toBe(true);
      expect(entry.sourceOwnerId).toBe(ANNUAL_FISCAL_REVIEW_OWNER_117.ownerId);
      expect(entry.checkedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/u);
      expect(entry.sourceHashes.every((hash) => /^sha256:[a-f0-9]{64}$/u.test(hash))).toBe(true);
      expect(entry.sourceUrls.every((url) => url.startsWith("https://"))).toBe(true);
    }
    const order = ANNUAL_SOURCE_CHANGE_LOG_117.map((entry) => entry.checkedAt);
    expect([...order].sort()).toEqual(order);
    expect(listAnnualFiscalSourceYears117()).toEqual([2024, 2025, 2026]);
    expect(getAnnualSourceChangeEntries117(2027)).toEqual([]);
    expect(() => assertAnnualSourceChangeLog117([...ANNUAL_SOURCE_CHANGE_LOG_117, { ...baseline() }]))
      .toThrow(/DUPLICATE/u);
  });

  it("refuses a duplicate baseline, a non-official source and an unknown owner", () => {
    const log = ANNUAL_SOURCE_CHANGE_LOG_117;
    expect(() => assertAnnualSourceChangeLog117([...log, {
      ...baseline(), entryId: "national-irpef-gross-subset:2025:IRPEF-2025-117-v1b", version: "IRPEF-2025-117-v1b",
      checkedAt: "2026-10-19",
    }])).toThrow(/INVALID_BASELINE/u);
    expect(() => assertAnnualSourceChangeLog117([...log, { ...retroactiveAmendment(), sourceUrls: ["https://evil.example/x"] }]))
      .toThrow(/NOT_OFFICIAL/u);
    expect(() => assertAnnualSourceChangeLog117([...log, { ...retroactiveAmendment(), sourceOwnerId: "someone-else" }]))
      .toThrow(/UNKNOWN_OWNER/u);
    expect(() => assertAnnualSourceChangeLog117([...log, { ...retroactiveAmendment(), sourceHashes: ["md5:abc"] }]))
      .toThrow(/INVALID_SOURCE/u);
  });

  it("treats a retroactive amendment as an explicit, sourced and reviewable append", () => {
    const before = JSON.stringify(baseline());
    const amendment = retroactiveAmendment();
    const extended = assertAnnualSourceChangeLog117([...ANNUAL_SOURCE_CHANGE_LOG_117, amendment]);
    expect(JSON.stringify(baseline())).toBe(before);
    expect(extended.at(-1)?.amendmentKind).toBe("RETROACTIVE_AMENDMENT");
    expect(auditAnnualSourceChangeLog117("2026-10-21", extended).retroactiveAmendments).toEqual([amendment.entryId]);

    const log = ANNUAL_SOURCE_CHANGE_LOG_117;
    expect(() => assertAnnualSourceChangeLog117([...log, { ...amendment, supersedesRevisionId: "missing" }]))
      .toThrow(/INVALID_AMENDMENT/u);
    expect(() => assertAnnualSourceChangeLog117([...log, { ...amendment, supersedesRevisionId: null }]))
      .toThrow(/INVALID_AMENDMENT/u);
    expect(() => assertAnnualSourceChangeLog117([...log, { ...amendment, reviewOwner: null }]))
      .toThrow(/INVALID_AMENDMENT/u);
    expect(() => assertAnnualSourceChangeLog117([...log, { ...amendment, sourceHashes: baseline().sourceHashes }]))
      .toThrow(/INVALID_AMENDMENT/u);
    expect(() => assertAnnualSourceChangeLog117([...log, { ...amendment, checkedAt: "2026-10-06" }]))
      .toThrow(/INVALID_AMENDMENT/u);
    expect(() => assertAnnualSourceChangeLog117([...log, { ...amendment, checkedAt: "2026-10-07" }]))
      .toThrow(/NOT_APPEND_ONLY/u);
  });

  it("reports NOT_RUN and NO_GO on the January 1 rollover without inheriting values", () => {
    const today = auditAnnualSourceChangeLog117("2026-10-21");
    expect(today.ok).toBe(true);
    expect(today.currentYear).toBe(2026);
    expect(today.checkedYears).toEqual([2024, 2025, 2026]);
    expect(today.notRunYears).toEqual([]);

    const rollover = auditAnnualSourceChangeLog117("2027-01-01");
    expect(rollover.currentYear).toBe(2027);
    expect(rollover.ok).toBe(false);
    expect(rollover.notRunYears).toEqual([2027]);
    expect(rollover.yearOutcomes.find((row) => row.taxYear === 2027)).toEqual({
      taxYear: 2027, outcome: "NOT_RUN", sourceCheckedAt: null, revisions: [],
    });
    expect(rollover.note).toContain("NOT_RUN");

    const beforeEvidence = auditAnnualSourceChangeLog117("2026-10-05");
    expect(beforeEvidence.ok).toBe(false);
    expect(beforeEvidence.notRunYears).toContain(2026);
    expect(() => auditAnnualSourceChangeLog117("2027-02-30")).toThrow(/INVALID_DATE/u);
  });

  it("exposes the append-only log and the agent owner on the public page", async () => {
    const page = await readFile(resolve(import.meta.dirname, "../src/pages/fonti-fiscali-italia.astro"), "utf8");
    expect(page).toContain("data-annual-changelog117");
    expect(page).toContain("data-annual-owner117");
    expect(page).toContain("data-annual-changelog-audit117");
    expect(page).toContain("supersedesRevisionId");
    expect(page).toContain("Approvazione fiscale");
    expect(page).toContain("non attestata");
  });
});
