import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { oracleAppendOnlyIdentities, oracleIdentityIsCompatible } from "../src/quality/oracle-append-only";

const registry = readFileSync(new URL("../quality/oracles/registry.json", import.meta.url), "utf8");
const oldReceiptHash = "62dd5a3bfcc7f7b35282396110c3123c3b43be5430fd9e0ef3168c178059ebe7";

describe("append-only oracle authority rebind", () => {
  it("reconstructs the original 259-entry registry's byte-identical preimage from the current appended 271-entry authority", () => {
    const identities = oracleAppendOnlyIdentities(registry);
    expect(identities.get(oldReceiptHash)?.size).toBe(259);
    expect(identities.get(createHash("sha256").update(registry).digest("hex"))?.size).toBe(271);
    expect(oracleIdentityIsCompatible(registry, oldReceiptHash, ["cand-001", "cand-259"])).toBe(true);
    expect(oracleIdentityIsCompatible(registry, oldReceiptHash, ["cand-260"])).toBe(false);
    const currentHash = createHash("sha256").update(registry).digest("hex");
    expect(oracleIdentityIsCompatible(registry, currentHash, ["cand-260"])).toBe(true);
    expect(oracleIdentityIsCompatible(registry, oldReceiptHash, ["cand-263"])).toBe(false);
  });

  it("fails closed if historic oracle content, truth sources, formatting or the historic fingerprint are altered", () => {
    const altered = registry.replace('"id": "cand-001"', '"id": "cand-999"');
    const changedHistory = registry.replace('"generated_at": "2026-09-23"', '"generated_at": "2026-09-24"');
    const changedBody = registry.replace('"candidate": "', '"candidate": "tampered ');
    const newOnly = registry.replace('"cand-260"', '"cand-261"');
    for (const candidate of [altered, changedHistory, changedBody, newOnly]) {
      expect(oracleIdentityIsCompatible(candidate, oldReceiptHash, ["cand-001"])).toBe(false);
    }
    expect(oracleIdentityIsCompatible(registry, "0".repeat(64), ["cand-001"])).toBe(false);
  });
});
