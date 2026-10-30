import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  ANPR_HISTORICAL_115_METADATA,
  lookupAnprHistoricalMunicipality115,
  findAnprHistoricalBelfiore115,
} from "../src/reference-data/italy/geography-115-anpr-history";
import { verifyCodiceFiscaleBirthPlace121 } from "../src/engines/italy/codice-fiscale-121-anpr";
import { decodeCodiceFiscaleWithAnpr122 } from "../src/engines/italy/codice-fiscale-122-anpr";
import { codiceFiscaleChecksum121 } from "../src/engines/italy/codice-fiscale-121";
import frozen from "../src/reference-data/italy/geography-115.snapshot.json";
import { readOfficialInput } from "../scripts/lib/read-official-input-500.mjs";

const root = resolve(import.meta.dirname, "..");

describe("#115 ANPR historical additional official source, time-bounded and fail-closed", () => {
  it("hash-pins government ANPR 19,352 CSV rows and CC-BY legend, with a 2023 source bound", async () => {
    expect(ANPR_HISTORICAL_115_METADATA.rows).toBe(19352);
    expect(ANPR_HISTORICAL_115_METADATA.lastRepoCommitAt).toBe("2023-10-03");
    expect(ANPR_HISTORICAL_115_METADATA.coverageUpperBound).toBe("2023-10-03");
    for (const { path, sha256 } of ANPR_HISTORICAL_115_METADATA.artifacts) {
      const bytes = readOfficialInput(root, path);
      expect(`sha256:${createHash("sha256").update(bytes).digest("hex")}`).toBe(sha256);
    }
  });

  it("official ANPR uniquely identifies Filago's missing SITUAS code D588 with its own date interval", () => {
    const lastDate = lookupAnprHistoricalMunicipality115("016828", "1928-01-25");
    expect(lastDate).toMatchObject({
      status: "OFFICIAL_ADMINISTRATIVE_INTERVAL_MATCH", source: "ANPR_OFFICIAL_ARCHIVE_2023_10_03",
      candidates: [{ istatCode: "016828", name: "FILAGO", belfiore: "D588", validFrom: "1861-03-17", validTo: "1928-01-25" }],
    });
    expect(lookupAnprHistoricalMunicipality115("016828", "1928-01-26").status).toBe("NO_MATCH_FOR_DATE");
    expect(frozen.suppressed.find((row) => row.istatCode === "016828")!.belfiore).toBeNull();
    expect(findAnprHistoricalBelfiore115("D588", "1928-01-25").candidates).toEqual(expect.arrayContaining([
      expect.objectContaining({ istatCode: "016828", validTo: "1928-01-25" }),
    ]));
  });

  it("never fills remaining 13 ND or two absent municipality identities by name/successor", () => {
    for (const [istat, day] of [["021090", "1950-01-01"], ["001815", "1920-01-01"], ["003809", "1900-01-01"]] as const) {
      expect(lookupAnprHistoricalMunicipality115(istat, day)).toMatchObject({
        status: "OFFICIAL_CODE_UNAVAILABLE", candidates: [expect.objectContaining({ belfiore: null })],
      });
    }
    expect(lookupAnprHistoricalMunicipality115("012891", "1868-01-01").status).toBe("NOT_IN_ANPR_ARCHIVE");
    expect(lookupAnprHistoricalMunicipality115("027810", "1867-01-01").status).toBe("NOT_IN_ANPR_ARCHIVE");
    expect(lookupAnprHistoricalMunicipality115("016828", "2026-02-21").status).toBe("DATE_AFTER_ARCHIVE");
    expect(lookupAnprHistoricalMunicipality115("016828", "1999-02-29").status).toBe("INVALID_DATE");
  });

  it("only ascribes code to the exact official ISTAT identity and interval, not generic name", () => {
    const row = lookupAnprHistoricalMunicipality115("016828", "1901-04-07");
    expect(row.candidates).toHaveLength(1);
    expect(row.candidates[0]).toHaveProperty("sourceRow");
    expect(row.dateValidity).toBe("ANPR_ADMINISTRATIVE_RECORD_ONLY");
    expect(row.officialFiscalAssignment).toBe(false);
    expect(lookupAnprHistoricalMunicipality115("foo", "1901-04-07").status).toBe("INVALID_IDENTIFIER");
  });

  it("#121 source-only temporal birthplace evidence is not mistaken for an official CF assignment", () => {
    expect(verifyCodiceFiscaleBirthPlace121({ kind: "suppressed", istatCode: "016828", birthDate: "1928-01-25" }))
      .toMatchObject({ status: "HISTORICAL_ADMINISTRATIVE_CODE_VERIFIED", belfiore: "D588", assignedByAgency: false });
    expect(verifyCodiceFiscaleBirthPlace121({ kind: "suppressed", istatCode: "001815", birthDate: "1928-01-25" }))
      .toMatchObject({ status: "REFUSED_UNVERIFIED_GEOGRAPHY", assignedByAgency: false });
    expect(verifyCodiceFiscaleBirthPlace121({ kind: "foreign", istatCode: "804", birthDate: "1960-05-12" }))
      .toMatchObject({ status: "REFUSED_UNVERIFIED_GEOGRAPHY", assignedByAgency: false });
  });

  it("#122 historical reverse decoding adds dated candidates but never infers unique identity", () => {
    const base = "RSSMRA28A25D588";
    const decoded = decodeCodiceFiscaleWithAnpr122(base + codiceFiscaleChecksum121(base));
    expect(decoded).toMatchObject({ status: "DECODED_WITH_ANPR_CANDIDATES", identityConfirmed: false });
    if (decoded.status !== "DECODED_WITH_ANPR_CANDIDATES") throw new Error("Unexpected decode result");
    expect(decoded.dateScopedCandidates).toEqual(expect.arrayContaining([
      expect.objectContaining({ birthDateHypothesis: "1928-01-25", istatCode: "016828", belfiore: "D588" }),
    ]));
    expect(decoded.dateScopedCandidates.some((entry) => entry.birthDateHypothesis === "2028-01-25")).toBe(false);
    expect(decoded.officialAssignment).toBe(false);
  });
});
