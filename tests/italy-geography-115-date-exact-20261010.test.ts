import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { lookupItalianMunicipalityAtCertifiedDate115, findItalianMunicipalitiesByBelfioreAtCertifiedDate115, ITALY_SITUAS_EXACT_DATES_115 } from "../src/reference-data/italy/geography-115-date-exact-20261010";
import { codiceFiscaleChecksum121, validateCodiceFiscale121 } from "../src/engines/italy/codice-fiscale-121";
import existing from "../src/reference-data/italy/geography-115.snapshot.json";

const root = resolve(import.meta.dirname, "..");

describe("#115 official day-exact historical municipality snapshots, no interpolated validity", () => {
  it("pins literal official SITUAS raw full snapshot and metadata bytes for 3 report periods", async () => {
    for (const source of ITALY_SITUAS_EXACT_DATES_115.sources) {
      const raw = await readFile(resolve(root, source.path));
      expect(`sha256:${createHash("sha256").update(raw).digest("hex")}`).toBe(source.sha256);
      const parsed = JSON.parse(raw.toString("utf8")) as { resultset: unknown[] };
      expect(parsed.resultset).toHaveLength(source.rows);
    }
    for (const metadata of ITALY_SITUAS_EXACT_DATES_115.metadataSources) {
      const raw = await readFile(resolve(root, metadata.path));
      expect(`sha256:${createHash("sha256").update(raw).digest("hex")}`).toBe(metadata.sha256);
    }
    const output = execFileSync("node", ["scripts/build-italy-geography-115-date-exact-20261010.mjs", "--check"], { cwd: root, encoding: "utf8" });
    expect(output).toMatch(/PASS.*4 snapshot/u);
  });

  it("genuinely unlocks 2025-01-01 codes for municipalities suppressed in February 2026", () => {
    expect(lookupItalianMunicipalityAtCertifiedDate115("024027", "2025-01-01")).toMatchObject({
      status: "ATTESTED_AT_EXACT_DATE", municipality: { name: "Castegnero", belfiore: "C056" },
      verifiedDate: "2025-01-01", sourceReport: 61, dayValidity: "OFFICIAL_SINGLE_DAY_ONLY", officialAssignment: false,
    });
    expect(lookupItalianMunicipalityAtCertifiedDate115("024071", "2026-01-01")).toMatchObject({
      status: "ATTESTED_AT_EXACT_DATE", municipality: { name: "Nanto", belfiore: "F838" },
    });
    expect(existing.suppressed.some((x) => x.istatCode === "024027" && x.changeDate === "2026-02-21")).toBe(true);
    expect(existing.suppressed.some((x) => x.istatCode === "024071" && x.changeDate === "2026-02-21")).toBe(true);
  });

  it("validates correct historic report periods 1900 and 1940 with original row/code", () => {
    expect(lookupItalianMunicipalityAtCertifiedDate115("058091", "1900-01-01")).toMatchObject({
      status: "ATTESTED_AT_EXACT_DATE", municipality: { name: "Roma", belfiore: "H501" }, sourceReport: 51,
    });
    expect(lookupItalianMunicipalityAtCertifiedDate115("058091", "1940-01-01")).toMatchObject({
      status: "ATTESTED_AT_EXACT_DATE", municipality: { name: "Roma", belfiore: "H501" }, sourceReport: 50,
    });
  });

  it("refuses interpolation even one day later, unknown cities, 1900 ND or malformed identifier", () => {
    expect(lookupItalianMunicipalityAtCertifiedDate115("024027", "2025-01-02").status).toBe("DATE_NOT_PINNED");
    expect(lookupItalianMunicipalityAtCertifiedDate115("024027", "2026-02-21").status).toBe("DATE_NOT_PINNED");
    expect(lookupItalianMunicipalityAtCertifiedDate115("016828", "1900-01-01")).toMatchObject({
      status: "OFFICIAL_CODE_UNAVAILABLE", municipality: { belfiore: null, name: "Filago" },
    });
    expect(lookupItalianMunicipalityAtCertifiedDate115("999999", "2025-01-01").status).toBe("NOT_ACTIVE_AT_DATE");
    expect(lookupItalianMunicipalityAtCertifiedDate115("24", "2025-01-01").status).toBe("INVALID_IDENTIFIER");
    expect(lookupItalianMunicipalityAtCertifiedDate115("024027", "not-a-date").status).toBe("INVALID_DATE");
  });

  it("#121/#122 can consume the pinned 2025 Castegnero birth date without an identity or interval claim", () => {
    const source = lookupItalianMunicipalityAtCertifiedDate115("024027", "2025-01-01");
    expect(source.status).toBe("ATTESTED_AT_EXACT_DATE");
    const body = `RSSMRA25A01${source.municipality!.belfiore!}`;
    const formallyValidated = validateCodiceFiscale121(body + codiceFiscaleChecksum121(body));
    expect(formallyValidated).toMatchObject({
      status: "FORMALLY_VALID", belfiore: "C056", identityConfirmed: false, officialAssignment: false,
    });
    expect(findItalianMunicipalitiesByBelfioreAtCertifiedDate115("C056", "2025-01-01")).toMatchObject({
      status: "CANDIDATES_AT_EXACT_DATE", candidates: [expect.objectContaining({ istatCode: "024027" })],
      officialAssignment: false,
    });
    expect(findItalianMunicipalitiesByBelfioreAtCertifiedDate115("C056", "2025-01-02").status).toBe("DATE_NOT_PINNED");
  });
});
