/**
 * #397 new consumer-independent regressions against the ONE canonical offline
 * audit. No parallel authority, source rows, rates or annual claims.
 */
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { readOfficialInput } from "../scripts/lib/read-official-input-500.mjs";
import { auditAnnualOfficialSources397, resolveAnnualOfficialRule397 } from "../scripts/validator/audit-397";
import { ITALY_SOURCE_PACK_DECISIONS } from "../src/reference-data/italy/source-packs";

const root = resolve(import.meta.dirname, "..");
const physical = (path: string) =>
  path.startsWith("quality/reference-data/italy/artifacts/115-administrative-geography/istat-situas-")
    ? Promise.resolve(readOfficialInput(root, path)) : readFile(resolve(root, path));
const corrupt = (pathToCorrupt: string) => auditAnnualOfficialSources397({
  root,
  readBytes: async path => {
    const bytes = await physical(path);
    return path === pathToCorrupt ? Buffer.concat([bytes, Buffer.from("#397-CORRUPTED-TRAILER")]) : bytes;
  },
});

describe("#397 annual primary-source regression matrix (canonical audit only)", () => {
  it("independently rehashes all eight narrow source subsets and their authority/version evidence", async () => {
    const audited = await auditAnnualOfficialSources397({ root });
    expect(audited.mode).toBe("OFFLINE_PINNED_BYTES_ONLY");
    expect(audited.status).toBe("PARTIAL_NO_GO");
    expect(audited.violations).toEqual([]);
    expect(audited.verified.map(item => `${item.ruleId}:${item.taxYear ?? "snapshot"}`)).toEqual([
      "italy.irpef-national-gross:2025", "italy.irpef-national-gross:2026",
      "italy.vat-declared-2025-window:2025", "italy.forfettario-ateco2007-coefficients:2025",
      "italy.inps-gestione-separata:2026", "italy.inps-artigiani-commercianti:2026",
      "italy.inps-agricultural-worker:2026", "italy.istat-current-municipalities:snapshot",
    ]);
    expect(audited.references.map(item => item.ruleId).sort()).toEqual([
      "italy.ade-invoice-stamp-2024", "italy.istat-foreign-reference", "italy.istat-suppressed-reference",
    ]);
    expect(audited.gaps).toHaveLength(5);
    for (const rule of [...audited.verified, ...audited.references]) {
      for (const source of rule.sources) {
        expect(source.checkedHash).toBe(true);
        expect("sha256:" + createHash("sha256").update(await physical(source.path)).digest("hex"))
          .toBe(source.sha256);
      }
    }
    for (const ticket of [115, 117, 118]) {
      const decision = ITALY_SOURCE_PACK_DECISIONS.find(item => item.ticket === ticket)!;
      expect("sha256:" + createHash("sha256")
        .update(await physical(decision.evidenceSnapshot.path)).digest("hex"))
        .toBe(decision.evidenceSnapshot.sha256);
    }
  });

  it("removes only 2026 IRPEF if its amending law is corrupted, retaining authenticated 2025 rules", async () => {
    const law2026 = "quality/reference-data/italy/artifacts/117-fiscal-annual/normattiva-legge-199-2025-consolidated.html";
    const result = await corrupt(law2026);
    expect(result.violations).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "HASH_MISMATCH", path: law2026 }),
    ]));
    expect(resolveAnnualOfficialRule397(result, "italy.irpef-national-gross", "2025-06-30"))
      .toMatchObject({ status: "VERIFIED_SUBSET", record: { taxYear: 2025 } });
    expect(resolveAnnualOfficialRule397(result, "italy.irpef-national-gross", "2026-06-30"))
      .toMatchObject({ status: "GAP", reason: "KNOWN_GAP" });
    expect(resolveAnnualOfficialRule397(result, "italy.forfettario-ateco2007-coefficients", "2025-06-30"))
      .toMatchObject({ status: "VERIFIED_SUBSET" });
    expect(resolveAnnualOfficialRule397(result, "italy.inps-gestione-separata", "2026-06-30"))
      .toMatchObject({ status: "VERIFIED_SUBSET" });
  });

  it("refuses VAT if either of two governing PDFs is damaged, leaving IRPEF and ATECO2007 independent", async () => {
    for (const path of [
      "quality/reference-data/italy/artifacts/117-fiscal-annual/def-dpr633-article16-2016-2026.pdf",
      "quality/reference-data/italy/artifacts/117-fiscal-annual/def-dpr633-tabella-a-2025-12-13-full.pdf",
    ]) {
      const result = await corrupt(path);
      expect(result.violations).toEqual(expect.arrayContaining([expect.objectContaining({ path, code: "HASH_MISMATCH" })]));
      expect(resolveAnnualOfficialRule397(result, "italy.vat-declared-2025-window", "2025-12-13"))
        .toMatchObject({ status: "GAP", reason: "KNOWN_GAP" });
      expect(resolveAnnualOfficialRule397(result, "italy.irpef-national-gross", "2025-12-13"))
        .toMatchObject({ status: "VERIFIED_SUBSET" });
      expect(resolveAnnualOfficialRule397(result, "italy.forfettario-ateco2007-coefficients", "2025-12-13"))
        .toMatchObject({ status: "VERIFIED_SUBSET" });
    }
  });

  it("keeps historical ISTAT and AdE reference-only even when their bytes are valid; corruption removes them", async () => {
    const normal = await auditAnnualOfficialSources397({ root });
    for (const [ruleId, date] of [
      ["italy.ade-invoice-stamp-2024", "2024-06-01"],
      ["italy.istat-suppressed-reference", "1928-01-25"],
      ["italy.istat-foreign-reference", "1995-01-01"],
    ] as const) {
      expect(resolveAnnualOfficialRule397(normal, ruleId, date))
        .toMatchObject({ status: "GAP", reason: "REFERENCE_ONLY" });
    }
    const ade = "quality/reference-data/italy/artifacts/117-fiscal-annual/agenzia-bollo-fatture-2024.html";
    const damaged = await corrupt(ade);
    expect(damaged.violations).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "HASH_MISMATCH", path: ade }),
    ]));
    expect(damaged.references.some(item => item.ruleId === "italy.ade-invoice-stamp-2024")).toBe(false);
    expect(resolveAnnualOfficialRule397(damaged, "italy.ade-invoice-stamp-2024", "2024-06-01"))
      .toMatchObject({ status: "GAP", reason: "KNOWN_GAP" });
    expect(resolveAnnualOfficialRule397(damaged, "italy.irpef-national-gross", "2026-06-01"))
      .toMatchObject({ status: "VERIFIED_SUBSET" });
  });

  it("localizes distinct ISTAT and INPS failures and never carries versions into 2027", async () => {
    const cases = [
      { path: "quality/reference-data/italy/artifacts/115-administrative-geography/istat-elenco-comuni-2026-02-21.xlsx",
        lostRule: "italy.istat-current-municipalities", lostDate: "2026-02-21",
        retainedRule: "italy.inps-agricultural-worker", retainedDate: "2026-08-01" },
      { path: "quality/reference-data/italy/artifacts/129-inps-employee-2026/inps-circolare-43-2026.pdf",
        lostRule: "italy.inps-agricultural-worker", lostDate: "2026-08-01",
        retainedRule: "italy.inps-gestione-separata", retainedDate: "2026-08-01" },
    ];
    for (const item of cases) {
      const result = await corrupt(item.path);
      expect(resolveAnnualOfficialRule397(result, item.lostRule, item.lostDate))
        .toMatchObject({ status: "GAP", reason: "KNOWN_GAP" });
      expect(resolveAnnualOfficialRule397(result, item.retainedRule, item.retainedDate))
        .toMatchObject({ status: "VERIFIED_SUBSET" });
      expect(result.violations).toEqual(expect.arrayContaining([
        expect.objectContaining({ path: item.path, code: "HASH_MISMATCH" }),
      ]));
    }
    const ledger = await auditAnnualOfficialSources397({ root });
    for (const ruleId of [
      "italy.irpef-national-gross", "italy.inps-gestione-separata", "italy.inps-artigiani-commercianti",
      "italy.inps-agricultural-worker", "italy.vat-declared-2025-window",
    ]) {
      expect(resolveAnnualOfficialRule397(ledger, ruleId, "2027-01-01"))
        .toMatchObject({ status: "GAP", reason: "OUT_OF_VALIDITY" });
    }
    expect(resolveAnnualOfficialRule397(ledger, "italy.irpef-national-gross", "2026-02-30"))
      .toMatchObject({ status: "GAP", reason: "INVALID_DATE" });
  });
});
