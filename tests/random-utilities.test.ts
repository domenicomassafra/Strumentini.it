import { describe, expect, it } from "vitest";
import type { RandomFill } from "../src/tools/password-pin-passphrase-generator/module";
import {
  createSeededRandomFill,
  drawRandomItems,
  generateCouponCodes,
  generateRandomNumbers,
  splitBalancedTeams,
} from "../src/tools/random-picker-team-coupon-generator/module";

function sequenceFill(values: readonly number[]): RandomFill {
  let index = 0;
  return (buffer) => {
    buffer[0] = values[index] ?? values.at(-1) ?? 0;
    index += 1;
    return buffer;
  };
}

describe("ticket 205 secure random utilities", () => {
  it("reuses rejection sampling for unseeded number selection", () => {
    const result = generateRandomNumbers({ minimum: 10, maximum: 19 }, sequenceFill([0xffffffff, 7]));
    expect(result.values).toEqual([17]);
    expect(result.randomness).toMatchObject({ mode: "secure", secure: true });
  });

  it("routes secure picker, team and coupon choices through the same rejection sampler", () => {
    const picker = drawRandomItems({ items: "A\nB\nC", count: 1 }, sequenceFill([0xffffffff, 1]));
    expect(picker.picks).toEqual([{ sourceIndex: 2, label: "B" }]);
    expect(picker.randomness).toMatchObject({ mode: "secure", secure: true });

    const teams = splitBalancedTeams({ participants: "A\nB\nC", teamCount: 2 }, sequenceFill([0xffffffff, 1, 0, 0]));
    expect(teams.teams.flat()).toEqual(["B", "C", "A"]);
    expect(teams.randomness).toMatchObject({ mode: "secure", secure: true });

    const coupon = generateCouponCodes({ count: 1, length: 4, alphabet: "ABC" }, sequenceFill([0xffffffff, 1, 0, 0, 0]));
    expect(coupon.codes).toEqual(["BAAA"]);
    expect(coupon.randomness).toMatchObject({ mode: "secure", secure: true });
  });

  it("keeps secure random numbers inside bounds and honors unique draws", () => {
    for (let iteration = 0; iteration < 64; iteration += 1) {
      const result = generateRandomNumbers({ minimum: -50, maximum: 50, count: 40, allowDuplicates: false });
      expect(result.values).toHaveLength(40);
      expect(new Set(result.values).size).toBe(40);
      for (const value of result.values) expect(value).toBeGreaterThanOrEqual(-50);
      for (const value of result.values) expect(value).toBeLessThanOrEqual(50);
    }
    expect(() => generateRandomNumbers({ minimum: 1, maximum: 2, count: 3, allowDuplicates: false })).toThrow("RANDOM_UNIQUE_COUNT_EXCEEDS_RANGE");
  });

  it("makes seeded mode reproducible and explicitly non-secure", () => {
    const first = generateRandomNumbers({ minimum: 1, maximum: 1000, count: 20, randomness: "seeded", seed: "fixture-205" });
    const second = generateRandomNumbers({ minimum: 1, maximum: 1000, count: 20, randomness: "seeded", seed: "fixture-205" });
    expect(second.values).toEqual(first.values);
    expect(first.randomness).toMatchObject({ mode: "seeded", secure: false });
    expect(first.randomness.label).toMatch(/NON sicuro/u);
    expect(() => createSeededRandomFill("")).toThrow("SEED_INVALID");
  });

  it("draws list entries without replacement while treating duplicate labels as distinct tickets", () => {
    const result = drawRandomItems({ items: "Ada\nAda\nBruno\nCarla", count: 4, randomness: "seeded", seed: "draw" });
    expect(result.picks).toHaveLength(4);
    expect(new Set(result.picks.map(({ sourceIndex }) => sourceIndex)).size).toBe(4);
    expect(result.picks.filter(({ label }) => label === "Ada")).toHaveLength(2);
    expect(result.duplicateLabelCount).toBe(1);
    expect(result.randomness).toMatchObject({ mode: "seeded", secure: false });
  });

  it("splits unique participants into teams whose sizes differ by at most one", () => {
    const participants = Array.from({ length: 23 }, (_, index) => `Persona ${index + 1}`).join("\n");
    const first = splitBalancedTeams({ participants, teamCount: 5, randomness: "seeded", seed: "teams" });
    const second = splitBalancedTeams({ participants, teamCount: 5, randomness: "seeded", seed: "teams" });
    expect(second.teams).toEqual(first.teams);
    expect(first.teams.flat()).toHaveLength(23);
    expect(new Set(first.teams.flat()).size).toBe(23);
    const sizes = first.teams.map((team) => team.length);
    expect(Math.max(...sizes) - Math.min(...sizes)).toBeLessThanOrEqual(1);
    expect(first.randomness).toMatchObject({ mode: "seeded", secure: false });
    expect(() => splitBalancedTeams({ participants: "Ada\n Ada \nBruno", teamCount: 2 })).toThrow("TEAM_DUPLICATE_PARTICIPANT");
  });

  it("generates unique coupon codes, deduplicates the alphabet deterministically and rejects impossible spaces", () => {
    const first = generateCouponCodes({ count: 50, length: 8, alphabet: "AABC123", prefix: "PROMO-", randomness: "seeded", seed: "coupons" });
    const second = generateCouponCodes({ count: 50, length: 8, alphabet: "AABC123", prefix: "PROMO-", randomness: "seeded", seed: "coupons" });
    expect(second.codes).toEqual(first.codes);
    expect(new Set(first.codes).size).toBe(50);
    expect(first.alphabet).toBe("ABC123");
    expect(first.removedAlphabetDuplicates).toBe(1);
    expect(first.randomness).toMatchObject({ mode: "seeded", secure: false });
    for (const code of first.codes) expect(code).toMatch(/^PROMO-[ABC123]{8}$/u);
    expect(() => generateCouponCodes({ count: 17, length: 4, alphabet: "AB" })).toThrow("COUPON_COUNT_EXCEEDS_SPACE");
    expect(() => generateCouponCodes({ count: 2, length: 4, alphabet: "A" })).toThrow("COUPON_ALPHABET_INVALID");
  });
});
