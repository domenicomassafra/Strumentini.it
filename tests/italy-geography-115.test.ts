import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  ITALIAN_GEOGRAPHY_115_METADATA,
  lookupItalianGeography115,
} from "../src/reference-data/italy/geography-115";
import snapshot from "../src/reference-data/italy/geography-115.snapshot.json";
import { readOfficialInput } from "../scripts/lib/read-official-input-500.mjs";

const root = resolve(import.meta.dirname, "..");
const sha256 = (input: Uint8Array) => `sha256:${createHash("sha256").update(input).digest("hex")}`;

describe("#115 frozen ISTAT/SITUAS administrative geography source pack", () => {
  it("rebuilds exact normalized records from the pinned official workbook and two bulk APIs", () => {
    const receipt = execFileSync(process.execPath, ["scripts/build-italy-geography-115.mjs", "--check"], {
      cwd: root, encoding: "utf8", timeout: 15000,
    });
    expect(receipt).toContain("PASS #115 snapshot reproducible");
  });

  it("checks original official source integrity and measures all 3 source data subsets", async () => {
    for (const source of Object.values(snapshot.sources)) {
      expect(sha256(readOfficialInput(root, source.path))).toBe(source.sha256);
    }
    const suppressed = JSON.parse(readOfficialInput(root, snapshot.sources.suppressed.path).toString("utf8")) as {
      resultset: Array<{ PRO_COM_T: string; COMUNE: string; COD_CATASTO: string }>;
    };
    const foreign = JSON.parse(readOfficialInput(root, snapshot.sources.foreign.path).toString("utf8")) as {
      resultset: Array<{ COD_AT?: string; DENOMINAZIONE_IT: string }>;
    };
    expect(ITALIAN_GEOGRAPHY_115_METADATA.coverage).toMatchObject({
      currentMunicipalityRows: 7894,
      suppressedEventRows: suppressed.resultset.length,
      suppressedRowsWithCode: 2619,
      suppressedRowsWithoutCode: 18,
      suppressedDistinctMunicipalitiesWithoutCode: 16,
      foreignRows: foreign.resultset.length,
      foreignRowsWithCode: 239,
      foreignRowsWithoutCode: 23,
    });
    expect(new Set(suppressed.resultset.filter((r) => r.COD_CATASTO === "ND")
      .map((r) => `${r.PRO_COM_T}:${r.COMUNE}`)).size).toBe(16);
    expect(foreign.resultset.filter((r) => !r.COD_AT?.trim())).toHaveLength(23);
  });

  it("finds official current snapshot municipality by six-digit ISTAT id, without fake historical validity", () => {
    const rome = lookupItalianGeography115("current", "058091");
    expect(rome).toMatchObject({
      status: "CODE_AVAILABLE", dateValidity: "SNAPSHOT_DATE_ONLY",
      candidates: [{ istatCode: "058091", name: "Roma", belfiore: "H501", provenance: "ISTAT_CURRENT_2026_02_21" }],
    });
    expect(ITALIAN_GEOGRAPHY_115_METADATA.currentMunicipalitiesAsOf).toBe("2026-02-21");
    expect(lookupItalianGeography115("current", "5891").status).toBe("INVALID_IDENTIFIER");
    expect(lookupItalianGeography115("current", "999999").status).toBe("NOT_IN_SNAPSHOT");
  });

  it("retains actual suppressed ISTAT identity and event, never substitutes related municipality Belfiore", () => {
    const known = lookupItalianGeography115("suppressed", "024027");
    expect(known).toMatchObject({
      status: "CODE_AVAILABLE", dateValidity: "NOT_VERIFIED",
      candidates: [expect.objectContaining({
        name: "Castegnero", belfiore: "C056", changeDate: "2026-02-21",
        relatedIstatCode: "024129", relatedBelfiore: "M439", provenance: "SITUAS_SUPPRESSED_128",
      })],
    });
    const missing = lookupItalianGeography115("suppressed", "027810");
    expect(missing).toMatchObject({
      status: "OFFICIAL_CODE_UNAVAILABLE", dateValidity: "NOT_VERIFIED",
      candidates: [expect.objectContaining({
        name: "Oriago", belfiore: null, changeDate: "1868-01-01",
        relatedBelfiore: "F229",
      })],
    });
    expect(missing.candidates[0]?.belfiore).not.toBe(missing.candidates[0]?.relatedBelfiore);
  });

  it("keeps multiple official suppressed events instead of silently choosing a single history", () => {
    const id = "001847";
    const result = lookupItalianGeography115("suppressed", id);
    expect(result.candidates).toHaveLength(5);
    expect(result.candidates.every((row) => row.istatCode === id && row.sourceRow !== undefined)).toBe(true);
    expect(result.dateValidity).toBe("NOT_VERIFIED");
  });

  it("maps authoritative foreign code, trims only formatting whitespace, and refuses uncoded history", () => {
    expect(lookupItalianGeography115("foreign", "201")).toMatchObject({
      status: "CODE_AVAILABLE", dateValidity: "NOT_VERIFIED",
      candidates: [{ istatCode: "201", name: "Albania", belfiore: "Z100", provenance: "SITUAS_FOREIGN_469", type: "Stato" }],
    });
    expect(lookupItalianGeography115("foreign", "907")).toMatchObject({
      status: "CODE_AVAILABLE", candidates: [{ belfiore: "Z501", name: "Antille olandesi" }],
    });
    expect(lookupItalianGeography115("foreign", "804")).toMatchObject({
      status: "OFFICIAL_CODE_UNAVAILABLE", candidates: [{ name: "Germania Ovest", belfiore: null, type: "Stato storico" }],
    });
    expect(lookupItalianGeography115("foreign", "80").status).toBe("INVALID_IDENTIFIER");
    expect(lookupItalianGeography115("foreign", "999").status).toBe("NOT_IN_SNAPSHOT");
    expect(ITALIAN_GEOGRAPHY_115_METADATA.foreignStatesFrom).toBe("1990-01-01");
  });

  it("does not share mutable lookup entries with callers", () => {
    const initial = lookupItalianGeography115("current", "058091");
    (initial.candidates as unknown as Array<{ belfiore: string | null }>)[0]!.belfiore = "A000";
    expect(lookupItalianGeography115("current", "058091").candidates[0]?.belfiore).toBe("H501");
  });
});
