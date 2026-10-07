import { afterEach, describe, expect, it, vi } from "vitest";
import { normalizePartitaIva } from "../src/engines/research-reference";
import { buildResearchResultPresentation } from "../src/components/tools/research-knowledge/ResearchResultV2";
import partitaIvaModule from "../src/tools/partita-iva-validator/module";

const ODD_POSITION_LOOKUP = [0, 2, 4, 6, 8, 1, 3, 5, 7, 9] as const;

function independentCheckDigit(firstTen: string): string {
  const total = [...firstTen].reduce((sum, character, index) => {
    const digit = Number(character);
    return sum + (index % 2 === 0 ? digit : ODD_POSITION_LOOKUP[digit]!);
  }, 0);
  return String((10 - (total % 10)) % 10);
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Italian Partita IVA formal validator", () => {
  it("normalizes presentation-only prefix/whitespace and matches an independent checksum path", () => {
    for (const firstTen of ["1234567890", "0001234567", "9876543210", "3141592653"]) {
      const expectedCheckDigit = independentCheckDigit(firstTen);
      const result = normalizePartitaIva(`IT ${firstTen.slice(0, 5)} ${firstTen.slice(5)} ${expectedCheckDigit}`);
      expect(result).toMatchObject({
        kind: "PARTITA_IVA",
        valid: true,
        normalized: `${firstTen}${expectedCheckDigit}`,
        checkDigit: expectedCheckDigit,
        expectedCheckDigit,
        claim: "formal-only",
        registerVerified: false,
      });
    }
  });

  it("identifies character, length and checksum failures precisely", () => {
    expect(normalizePartitaIva("12345A78903")).toMatchObject({ valid: false, failureRule: "character" });
    expect(normalizePartitaIva("1234567890")).toMatchObject({ valid: false, failureRule: "length" });
    expect(normalizePartitaIva("12345678904")).toMatchObject({
      valid: false,
      failureRule: "checksum",
      checkDigit: "4",
      expectedCheckDigit: "3",
    });
  });

  it("performs the tool run with zero network activity and keeps registry existence separate", () => {
    const fetchSpy = vi.fn(() => Promise.reject(new Error("network must not be used")));
    vi.stubGlobal("fetch", fetchSpy);
    const output = partitaIvaModule.run({ value: "IT 12345678903" }, { defaults: {} });

    expect(output).toMatchObject({
      valid: true,
      normalized: "12345678903",
      claim: "formal-only",
      registerVerified: false,
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("states in the Result v2 presentation that formal validity is not registry verification", () => {
    const result = normalizePartitaIva("12345678903");
    const presentation = buildResearchResultPresentation("partita-iva-validator", result);

    expect(presentation.interpretation).toContain("non verifica metadati o registri remoti");
    expect(presentation.summaryRows).toContainEqual({
      label: "Esistenza nel registro verificata",
      value: "No",
    });
  });
});
