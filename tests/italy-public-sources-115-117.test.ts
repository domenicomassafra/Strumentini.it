import { describe, expect, it } from "vitest";
import { ITALIAN_GEOGRAPHY_115_METADATA, lookupItalianGeography115, searchItalianGeography115 } from "../src/reference-data/italy/geography-115";
import { VERIFIED_IRPEF_EXCERPTS_117, getVerifiedNationalIrpef117, getVerifiedForfettarioCoefficients117 } from "../src/reference-data/italy/fiscal-annual-117";
import { getItalySourcePackDecision } from "../src/reference-data/italy/source-packs";

describe("STR-115/117 public consultability over pinned official data", () => {
  it("searches live ISTAT municipalities by name and code without filling missing historical codes", () => {
    const bari = searchItalianGeography115("current", "Bari");
    expect(bari.some((row) => row.name === "Bari" && row.belfiore !== null)).toBe(true);
    const code = bari.find((row) => row.name === "Bari")!.istatCode;
    expect(lookupItalianGeography115("current", code).status).toBe("CODE_AVAILABLE");
    expect(searchItalianGeography115("current", code).some((row) => row.istatCode === code)).toBe(true);
    expect(ITALIAN_GEOGRAPHY_115_METADATA.coverage.currentMunicipalityRows).toBe(7894);
    expect(ITALIAN_GEOGRAPHY_115_METADATA.coverage.suppressedDistinctMunicipalitiesWithoutCode).toBe(16);
    expect(ITALIAN_GEOGRAPHY_115_METADATA.coverage.foreignRowsWithoutCode).toBe(23);
    expect(searchItalianGeography115("foreign", "fran").length).toBeGreaterThan(0);
    expect(searchItalianGeography115("suppressed", "a")).toEqual([]);
    expect(() => searchItalianGeography115("current", "Bari", 100)).toThrow(/LIMIT/u);
  });

  it("makes tax-year official source URLs and exact IRPEF brackets available without unsupported-year fallback", () => {
    expect(VERIFIED_IRPEF_EXCERPTS_117.map(({taxYear}) => taxYear)).toEqual([2025, 2026]);
    expect(getVerifiedNationalIrpef117(2025).bands[1]?.rateBasisPoints).toBe(3500);
    expect(getVerifiedNationalIrpef117(2026).bands[1]?.rateBasisPoints).toBe(3300);
    expect(getVerifiedForfettarioCoefficients117(2025).rows.length).toBe(9);
    expect(() => getVerifiedForfettarioCoefficients117(2026)).toThrow(/UNSUPPORTED_FISCAL_TAX_YEAR/u);
    expect(() => getVerifiedNationalIrpef117(2027)).toThrow(/UNSUPPORTED_FISCAL_TAX_YEAR/u);
    const geo = getItalySourcePackDecision(115);
    const fiscal = getItalySourcePackDecision(117);
    expect(geo.status).toBe("BLOCKED");
    expect(fiscal.status).toBe("BLOCKED");
    expect(geo.candidateOfficialSources?.every(({url}) => url.startsWith("https://"))).toBe(true);
    expect(fiscal.candidateOfficialSources?.every(({url}) => url.startsWith("https://"))).toBe(true);
  });
});
