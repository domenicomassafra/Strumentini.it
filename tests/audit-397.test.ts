import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  auditAnnualOfficialSources397, resolveAnnualOfficialRule397,
  validOfficialEvidence397, inspectOfficialSnapshotPath397,
} from "../scripts/validator/audit-397";

const root = resolve(import.meta.dirname, "..");
const pinned = (path: string) => readFile(resolve(root, path));

describe("ticket #397 offline source-year ledger (official snapshots only)", () => {
  it("binds independent primary-source bytes/URLs and bounded annual subpacks across three authorities", async () => {
    const result = await auditAnnualOfficialSources397({ root });
    expect(result.status).toBe("PARTIAL_NO_GO");
    expect(result.verified.length).toBeGreaterThanOrEqual(6);
    expect(result.gaps.map(({ ruleId }) => ruleId)).toEqual(expect.arrayContaining([
      "italy.annual-full-fiscal", "italy.istat-historical-birth-date", "italy.inps-general-employee",
    ]));
    const sourceReviewDates = new Map<string, string>();
    for (const name of ["115-administrative-geography", "117-fiscal-annual", "118-inps-annual"]) {
      const evidence = JSON.parse((await pinned(`quality/reference-data/italy/${name}-evidence.json`)).toString("utf8"));
      for (const source of [...evidence.artifacts, ...(evidence.frozenOfficialBulkArtifacts ?? [])]) {
        sourceReviewDates.set(source.path, evidence.checkedAt);
      }
    }
    for (const rule of result.verified) {
      expect(rule.sources.length).toBeGreaterThan(0);
      for (const source of rule.sources) {
        const bytes = await pinned(source.path);
        expect(source.sha256).toBe("sha256:" + createHash("sha256").update(bytes).digest("hex"));
        expect(source.url).toMatch(/^https:\/\//u);
        expect(source.checkedHash).toBe(true);
        expect(source.manifestCheckedAt).toBe(sourceReviewDates.get(source.path) ?? null);
        expect(source.manifestIndex).toBe("MATCHED");
        expect(source.liveUrlCheck).toBe("NOT_RUN");
      }
    }
    expect(result.verified.find(({ ruleId }) => ruleId === "italy.vat-declared-2025-window")?.sources)
      .toEqual([expect.objectContaining({ manifestCheckedAt: "2026-10-09", manifestIndex: "MATCHED", checkedHash: true }),
        expect.objectContaining({ manifestCheckedAt: "2026-10-09", manifestIndex: "MATCHED", checkedHash: true })]);
    expect(resolveAnnualOfficialRule397(result, "italy.irpef-national-gross", "2026-07-01")).toMatchObject({
      status: "VERIFIED_SUBSET", record: { taxYear: 2026, validFrom: "2026-01-01", validTo: "2026-12-31" },
    });
    expect(resolveAnnualOfficialRule397(result, "italy.inps-gestione-separata", "2026-05-01").status).toBe("VERIFIED_SUBSET");
    expect(resolveAnnualOfficialRule397(result, "italy.istat-current-municipalities", "2026-02-21").status).toBe("VERIFIED_SUBSET");
    expect(result.references.find(({ ruleId }) => ruleId === "italy.ade-invoice-stamp-2024")).toMatchObject({
      authority: "Agenzia delle Entrate", validFrom: null, validTo: null,
      sources: [expect.objectContaining({ liveUrlCheck: "NOT_RUN" })],
    });
    for (const reference of result.references) for (const source of reference.sources) {
      expect(source.manifestCheckedAt).toBe(sourceReviewDates.get(source.path) ?? null);
      expect(source.manifestIndex).toBe(sourceReviewDates.has(source.path) ? "MATCHED" : "UNLISTED");
      expect(source.liveUrlCheck).toBe("NOT_RUN");
    }
  });

  it("fails closed when physical INPS snapshot bytes are mutated, even if metadata advertises a matching URL", async () => {
    const target = "quality/reference-data/italy/artifacts/118-inps-2026/inps-circolare-14-2026.pdf";
    const result = await auditAnnualOfficialSources397({
      root,
      readBytes: async path => path === target ? Buffer.concat([await pinned(path), Buffer.from("TAMPER")]) : pinned(path),
    });
    expect(result.status).toBe("PARTIAL_NO_GO");
    expect(result.violations).toEqual(expect.arrayContaining([expect.objectContaining({
      code: "HASH_MISMATCH", path: target,
    })]));
    expect(resolveAnnualOfficialRule397(result, "italy.inps-artigiani-commercianti", "2026-06-01").status).toBe("GAP");
    expect(resolveAnnualOfficialRule397(result, "italy.inps-gestione-separata", "2026-06-01").status).toBe("VERIFIED_SUBSET");
  });

  it("rejects mutated evidence manifest itself rather than trusting its child artifact hashes", async () => {
    const evidence = "quality/reference-data/italy/117-fiscal-annual-evidence.json";
    const result = await auditAnnualOfficialSources397({
      root,
      readBytes: async path => path === evidence ? Buffer.concat([await pinned(path), Buffer.from("\n ")]) : pinned(path),
    });
    expect(result.violations).toEqual(expect.arrayContaining([expect.objectContaining({
      code: "HASH_MISMATCH", path: evidence,
    })]));
    expect(resolveAnnualOfficialRule397(result, "italy.irpef-national-gross", "2026-07-01").status).toBe("GAP");
    expect(resolveAnnualOfficialRule397(result, "italy.inps-artigiani-commercianti", "2026-07-01").status).toBe("VERIFIED_SUBSET");
  });

  it("rejects wrong tax year, expired date, unknown unsourced and ISTAT history overclaims", async () => {
    const ledger = await auditAnnualOfficialSources397({ root });
    for (const [ruleId, date, reason] of [
      ["italy.irpef-national-gross", "2027-01-01", "OUT_OF_VALIDITY"],
      ["italy.vat-declared-2025-window", "2025-12-12", "OUT_OF_VALIDITY"],
      ["italy.vat-declared-2025-window", "2026-01-01", "OUT_OF_VALIDITY"],
      ["italy.istat-current-municipalities", "2026-02-22", "OUT_OF_VALIDITY"],
      ["italy.ade-invoice-stamp-2024", "2024-06-01", "REFERENCE_ONLY"],
      ["italy.istat-historical-birth-date", "2026-01-01", "KNOWN_GAP"],
      ["italy.inps-general-employee", "2026-01-01", "KNOWN_GAP"],
      ["italy.unknown-tax-rule", "2026-01-01", "UNKNOWN_UNSOURCED"],
    ] as const) expect(resolveAnnualOfficialRule397(ledger, ruleId, date)).toMatchObject({
      status: "GAP", reason,
    });
    expect(resolveAnnualOfficialRule397(ledger, "italy.irpef-national-gross", "2026-02-30").status).toBe("GAP");
  });

  it("refuses ambiguous overlapping verified records instead of picking newest", async () => {
    const ledger = await auditAnnualOfficialSources397({ root });
    const first = ledger.verified.find(record => record.ruleId === "italy.irpef-national-gross" && record.taxYear === 2026)!;
    expect(first).toBeDefined();
    const duplicate = { ...first, scope: first.scope + " - contradictory version" };
    const tampered = { ...ledger, verified: [...ledger.verified, duplicate] };
    expect(resolveAnnualOfficialRule397(tampered, first.ruleId, "2026-04-01")).toMatchObject({
      status: "GAP", reason: "AMBIGUOUS_OVERLAP",
    });
  });

  it("authenticates the EXACT evidence bytes later parsed, without a second-read TOCTOU window", async () => {
    const evidence = "quality/reference-data/italy/117-fiscal-annual-evidence.json";
    let reads = 0;
    const result = await auditAnnualOfficialSources397({
      root,
      readBytes: async path => {
        if (path === evidence && ++reads > 1) return Buffer.from('{"ticket":117,"datasetId":"italy-fiscal-annual","checkedAt":"2026-10-09","artifacts":[]}');
        return pinned(path);
      },
    });
    expect(reads).toBe(1);
    expect(resolveAnnualOfficialRule397(result, "italy.irpef-national-gross", "2026-03-01").status).toBe("VERIFIED_SUBSET");
  });

  it("refuses over-budget snapshots without reading them into normative coverage", async () => {
    const target = "quality/reference-data/italy/artifacts/118-inps-2026/inps-circolare-8-2026.pdf";
    const result = await auditAnnualOfficialSources397({
      root,
      readBytes: async path => path === target ? Buffer.alloc(16 * 1024 * 1024 + 1, 0) : pinned(path),
    });
    expect(result.violations).toEqual(expect.arrayContaining([expect.objectContaining({ code: "UNSAFE_PATH", path: target })]));
    expect(resolveAnnualOfficialRule397(result, "italy.inps-gestione-separata", "2026-08-01").status).toBe("GAP");
    expect(resolveAnnualOfficialRule397(result, "italy.inps-artigiani-commercianti", "2026-08-01").status).toBe("VERIFIED_SUBSET");
  });

  it("fails closed on malformed artifact fields and ambiguous duplicate manifest entries", () => {
    const artifact = { authority: "INPS", title: "Circolare", url: "https://www.inps.it/a.pdf",
      path: "quality/reference-data/italy/artifacts/118-inps-2026/inps-circolare-8-2026.pdf",
      sha256: "sha256:" + "a".repeat(64) };
    const evidence = { ticket: 118, datasetId: "inps-contributions-annual", checkedAt: "2026-10-07", artifacts: [artifact] };
    expect(validOfficialEvidence397(evidence, 118, "inps-contributions-annual", "2026-10-07")).toBe(true);
    expect(validOfficialEvidence397({ ...evidence, artifacts: [{ ...artifact, path: null }] }, 118, "inps-contributions-annual", "2026-10-07")).toBe(false);
    expect(validOfficialEvidence397({ ...evidence, artifacts: [{ ...artifact, url: "https://evil.example/a.pdf" }] }, 118, "inps-contributions-annual", "2026-10-07")).toBe(false);
    expect(validOfficialEvidence397({ ...evidence, artifacts: [artifact, { ...artifact }] }, 118, "inps-contributions-annual", "2026-10-07")).toBe(false);
    expect(validOfficialEvidence397({ ...evidence, artifacts: [{ ...artifact, path: "../outside" }] }, 118, "inps-contributions-annual", "2026-10-07")).toBe(false);
    expect(validOfficialEvidence397({ ...evidence, artifacts: [null] }, 118, "inps-contributions-annual", "2026-10-07")).toBe(false);
  });

  it("rejects a symlinked ancestor within the nominal official artifact directory", async () => {
    const temp = await mkdtemp(join(tmpdir(), "audit-397-"));
    try {
      const official = join(temp, "quality/reference-data/italy");
      const outside = join(temp, "outside");
      await mkdir(official, { recursive: true });
      await mkdir(outside);
      await writeFile(join(outside, "fabricated.pdf"), Buffer.from("%PDF-fabricated"));
      await symlink(outside, join(official, "artifacts"));
      expect(await inspectOfficialSnapshotPath397(temp,
        "quality/reference-data/italy/artifacts/fabricated.pdf")).toBe(false);
      expect(await inspectOfficialSnapshotPath397(temp, null)).toBe(false);
      expect(await inspectOfficialSnapshotPath397(temp, "../../../etc/passwd")).toBe(false);
    } finally { await rm(temp, { recursive: true, force: true }); }
  });
});
