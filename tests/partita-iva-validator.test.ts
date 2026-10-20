import { afterEach, describe, expect, it, vi } from "vitest";
import { normalizePartitaIva } from "../src/engines/research-reference";
import { buildResearchResultPresentation } from "../src/components/tools/research-knowledge/ResearchResultV2";
import partitaIvaModule from "../src/tools/partita-iva-validator/module";
import { validateEuVat } from "../src/tools/partita-iva-validator/eu-validation";

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

// Independent oracle: python-stdnum 2.2 `stdnum.eu.vat.is_valid`, measured 2026-10-19.
// This LGPL oracle is used for comparison only; it is not a runtime dependency.
const EU_ORACLE_CASES: ReadonlyArray<readonly [string, boolean]> = [
  ["BE0411905847", true], ["BE0897221791", false],
  ["DE136695976", true], ["DE136695977", false],
  ["FR40303265045", true], ["ATU10223006", true],
  ["EL094259216", true], ["ESB99286320", true],
  ["NL004495445B01", true], ["DK13585628", true],
  ["IE6388047V", true], ["PT501964843", true],
  ["SE556016068001", true], ["LU26375245", true],
  ["PL5261040828", true], ["FI09853608", true],
];

describe("EU VAT formal validation with vat-validation", () => {
  it("preserves every Italian output field and rejection rule on native fixtures", () => {
    const samples = ["", "IT", "1234567890", "12345A78903", "12345678904", "IT 12345678903", "IT01114601006"];
    for (let n = 0; n < 100; n += 1) {
      const firstTen = String(n * 9973).padStart(10, "0");
      samples.push(`${firstTen}${independentCheckDigit(firstTen)}`);
      samples.push(`IT ${firstTen}${independentCheckDigit(firstTen)}`);
    }
    for (const sample of samples) {
      expect(validateEuVat(sample)).toMatchObject(normalizePartitaIva(sample));
      expect(validateEuVat(sample).countryCode).toBe("IT");
    }
    // The donor rejects this formally valid synthetic IT checksum: native parity wins.
    expect(validateEuVat("IT 12345678903")).toMatchObject({ valid: true, normalized: "12345678903" });
  });

  it.each(EU_ORACLE_CASES)("matches the independent formal oracle for %s", (value, valid) => {
    expect(validateEuVat(value)).toMatchObject({
      valid, normalized: value, claim: "formal-only", registerVerified: false,
      countryCode: value.slice(0, 2),
    });
  });

  it("reports incomplete, unsupported, malformed and national-rule failures separately", () => {
    expect(validateEuVat("BE")).toMatchObject({ valid: false, failureRule: "incomplete" });
    expect(validateEuVat("BE0411")).toMatchObject({ valid: false, failureRule: "format", formatValid: false });
    expect(validateEuVat("XX0411905847")).toMatchObject({ valid: false, failureRule: "country" });
    expect(validateEuVat("GR094259216")).toMatchObject({ valid: false, failureRule: "country" });
    expect(validateEuVat("BE0411.905.847")).toMatchObject({ valid: false, failureRule: "character" });
    expect(validateEuVat("BE0897221791")).toMatchObject({ valid: false, failureRule: "national-rule", formatValid: true });
    expect(validateEuVat(" be 0411905847 ")).toMatchObject({ valid: true, countryCode: "BE", normalized: "BE0411905847" });
  });

  it("runs a non-Italian VAT entirely offline, without claiming registry verification", () => {
    const fetchSpy = vi.fn(() => Promise.reject(new Error("network must not be used")));
    vi.stubGlobal("fetch", fetchSpy);
    const output = partitaIvaModule.run({ value: "DE136695976" }, { defaults: {} });
    expect(output).toMatchObject({ valid: true, normalized: "DE136695976", registerVerified: false, claim: "formal-only" });
    const presentation = buildResearchResultPresentation("partita-iva-validator", output);
    expect(presentation.interpretation).toContain("non verifica metadati o registri remoti");
    expect(presentation.summaryRows).toContainEqual({ label: "Paese IVA", value: "DE" });
    expect(presentation.summaryRows).toContainEqual({ label: "Esistenza nel registro verificata", value: "No" });
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
