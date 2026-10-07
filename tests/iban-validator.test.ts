import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildResearchResultPresentation } from "../src/components/tools/research-knowledge/ResearchResultV2";
import { normalizeIban } from "../src/engines/research-reference";
import ibanModule from "../src/tools/iban-validator/module";

interface IbanFixtureVector {
  readonly id: string;
  readonly input: string;
  readonly valid: boolean;
  readonly countryCode?: string;
  readonly normalized?: string;
  readonly failureRule?: string;
}

const fixture = JSON.parse(readFileSync(new URL("../quality/fixtures/iban-formal-validation/vectors.json", import.meta.url), "utf8")) as {
  readonly source_release: string;
  readonly vectors: readonly IbanFixtureVector[];
};

export function independentMod97(iban: string): number {
  const normalized = iban.replace(/\s/gu, "").toUpperCase();
  const rearranged = `${normalized.slice(4)}${normalized.slice(0, 4)}`;
  const numeric = [...rearranged]
    .map((character) => /[A-Z]/u.test(character) ? String(character.charCodeAt(0) - 55) : character)
    .join("");
  return Number(BigInt(numeric) % 97n);
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("IBAN formal validator", () => {
  it("accepts SWIFT Release 103 examples across the supported country subset and independently confirms MOD-97", () => {
    expect(fixture.source_release).toContain("Release 103");
    const validVectors = fixture.vectors.filter(({ valid }) => valid);
    expect(validVectors.length).toBeGreaterThanOrEqual(6);

    for (const vector of validVectors) {
      const result = normalizeIban(vector.input);
      expect(result, vector.id).toMatchObject({
        valid: true,
        countryCode: vector.countryCode,
        normalized: vector.normalized,
        mod97Remainder: 1,
        claim: "formal-only",
        accountVerified: false,
        formatAuthority: "SWIFT IBAN Registry Release 103",
      });
      expect(independentMod97(vector.normalized ?? vector.input), vector.id).toBe(1);
    }
  });

  it("reports the exact declared failure rule for invalid fixture vectors", () => {
    for (const vector of fixture.vectors.filter(({ valid }) => !valid)) {
      expect(normalizeIban(vector.input), vector.id).toMatchObject({
        valid: false,
        failureRule: vector.failureRule,
      });
    }
  });

  it("decomposes the Italian BBAN into structural CIN, ABI, CAB and account coordinates", () => {
    expect(normalizeIban("IT60 X054 2811 1010 0000 0123 456")).toMatchObject({
      valid: true,
      countryCode: "IT",
      expectedLength: 27,
      italianCoordinates: {
        cin: "X",
        abi: "05428",
        cab: "11101",
        account: "000000123456",
        structuralOnly: true,
      },
      accountVerified: false,
    });
  });

  it("runs locally with zero network requests", () => {
    const fetchSpy = vi.fn(() => Promise.reject(new Error("network must not be used")));
    vi.stubGlobal("fetch", fetchSpy);
    const output = ibanModule.run({ value: "DE89370400440532013000" }, { defaults: {} });
    expect(output).toMatchObject({ valid: true, countryCode: "DE", accountVerified: false });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("states in Result v2 that formal validity is separate from bank/account existence", () => {
    const result = normalizeIban("IT60X0542811101000000123456");
    const presentation = buildResearchResultPresentation("iban-validator", result);
    expect(presentation.interpretation).toContain("non verifica metadati o registri remoti");
    expect(presentation.summaryRows).toContainEqual({ label: "Esistenza conto verificata", value: "No" });
    expect(presentation.summaryRows).toContainEqual({ label: "ABI strutturale", value: "05428" });
  });
});
