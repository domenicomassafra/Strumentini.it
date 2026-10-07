import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { ITALIAN_PASSPHRASE_WORDLIST } from "../src/reference-data/italian-passphrase-v1";
import {
  generateItalianPassphrase,
  generatePassword,
  generatePin,
  unbiasedRandomIndex,
  type RandomFill,
} from "../src/tools/password-pin-passphrase-generator/module";
import { estimatePasswordStrength, PASSWORD_STRENGTH_MAX_LENGTH } from "../src/tools/password-strength-estimator/module";

function sequenceFill(values: readonly number[]): RandomFill {
  let index = 0;
  return (buffer) => {
    buffer[0] = values[index] ?? values.at(-1) ?? 0;
    index += 1;
    return buffer;
  };
}

describe("secure password, PIN and Italian passphrase generator", () => {
  it("rejects the modulo-bias tail before mapping to an index", () => {
    const fill = sequenceFill([0xffffffff, 7]);
    expect(unbiasedRandomIndex(10, fill)).toBe(7);
  });

  it("honors requested password sets, length, PIN digits and passphrase words", () => {
    for (let iteration = 0; iteration < 64; iteration += 1) {
      const password = generatePassword({ length: 32, lowercase: true, uppercase: true, digits: true, symbols: true });
      expect(password).toHaveLength(32);
      expect(password).toMatch(/[a-z]/u);
      expect(password).toMatch(/[A-Z]/u);
      expect(password).toMatch(/[0-9]/u);
      expect(password).toMatch(/[^A-Za-z0-9]/u);

      const pin = generatePin(12);
      expect(pin).toMatch(/^\d{12}$/u);

      const words = generateItalianPassphrase(7, "-").split("-");
      expect(words).toHaveLength(7);
      for (const word of words) expect(ITALIAN_PASSPHRASE_WORDLIST.words).toContain(word);
    }
  });

  it("publishes a stable, unique and locally-provenanced wordlist", () => {
    expect(ITALIAN_PASSPHRASE_WORDLIST.id).toBe("it-passphrase-2026-10-v1");
    expect(ITALIAN_PASSPHRASE_WORDLIST.version).toBe("1.0.0");
    expect(new Set(ITALIAN_PASSPHRASE_WORDLIST.words).size).toBe(ITALIAN_PASSPHRASE_WORDLIST.words.length);
    expect(ITALIAN_PASSPHRASE_WORDLIST.provenance).toMatch(/locale|Strumentini/iu);
  });
});

describe("explainable password strength estimator", () => {
  it("is deterministic and explains repeated/common patterns and length effects", async () => {
    const fixture = JSON.parse(await readFile(resolve("quality/fixtures/password-security/vectors.json"), "utf8")) as {
      vectors: Array<{ password: string; expected_factor_codes: string[]; expected_min_score?: number; expected_max_score?: number }>;
    };
    for (const vector of fixture.vectors) {
      const first = estimatePasswordStrength(vector.password);
      expect(estimatePasswordStrength(vector.password)).toEqual(first);
      for (const code of vector.expected_factor_codes) expect(first.factors.map(({ code: factorCode }) => factorCode)).toContain(code);
      if (vector.expected_min_score !== undefined) expect(first.score).toBeGreaterThanOrEqual(vector.expected_min_score);
      if (vector.expected_max_score !== undefined) expect(first.score).toBeLessThanOrEqual(vector.expected_max_score);
    }
  });

  it("rewards additional length for otherwise comparable non-patterned values", () => {
    const short = estimatePasswordStrength("Q7!mR2@z");
    const medium = estimatePasswordStrength("Q7!mR2@zV4#t");
    const long = estimatePasswordStrength("Q7!mR2@zV4#tN6$pK9&x");
    expect(medium.score).toBeGreaterThanOrEqual(short.score);
    expect(long.score).toBeGreaterThanOrEqual(medium.score);
  });

  it("does not reward password composition classes by themselves", () => {
    const lowercase = estimatePasswordStrength("mzrptkvnqwhsldy");
    const mixed = estimatePasswordStrength("Mz7!tK9@nQ2#sLd");
    expect(lowercase.length).toBe(mixed.length);
    expect(lowercase.score).toBe(mixed.score);
    expect(mixed.factors.find(({ code }) => code === "classes")?.detail).toMatch(/non aggiunge né sottrae punti/iu);
  });

  it("counts Unicode code points rather than UTF-16 code units at the local bound", () => {
    const emoji = "🙂".repeat(PASSWORD_STRENGTH_MAX_LENGTH);
    expect(emoji.length).toBe(PASSWORD_STRENGTH_MAX_LENGTH * 2);
    expect(estimatePasswordStrength(emoji).length).toBe(PASSWORD_STRENGTH_MAX_LENGTH);
    expect(() => estimatePasswordStrength(`${emoji}a`)).toThrow("PASSWORD_TOO_LONG");
    expect(estimatePasswordStrength("a".repeat(PASSWORD_STRENGTH_MAX_LENGTH)).length).toBe(PASSWORD_STRENGTH_MAX_LENGTH);
    expect(() => estimatePasswordStrength("a".repeat(PASSWORD_STRENGTH_MAX_LENGTH + 1))).toThrow("PASSWORD_TOO_LONG");
  });

  it("states the offline limits without breach-presence claims", () => {
    const result = estimatePasswordStrength("Q7!mR2@zV4#tN6$pK9&x");
    const copy = [...result.limitations, ...result.factors.map(({ detail }) => detail)].join(" ");
    expect(copy).toContain("Non consulta database di password violate");
    expect(copy).toContain("non afferma che la password sia presente o assente");
    expect(copy).toContain("non sostituisce una blocklist");
    expect(copy).toContain("Non normalizza Unicode");
  });
});
