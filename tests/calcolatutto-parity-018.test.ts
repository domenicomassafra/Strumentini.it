import { readFileSync, existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { calcolatuttoParity018 } from "../src/catalog/calcolatutto-parity-018";
import { base64Operation } from "../src/engines/developer-web/encoding-crypto";
import { convertColorLocal } from "../src/engines/image/visual-tools";
import { calculateVat126 } from "../src/engines/italy/vat-126";

describe("STR-018 — 13 calcoli raggiungibili e con prove", () => {
  it("maps exactly the 13 original jobs to concrete routes and checked behavior", () => {
    expect(calcolatuttoParity018).toHaveLength(13);
    expect(new Set(calcolatuttoParity018.map((row) => row.job)).size).toBe(13);
    for (const row of calcolatuttoParity018) {
      const route = row.route.split("#")[0]!;
      expect(existsSync(`src/pages${route.replace(/\/$/u, "")}.astro`), row.job).toBe(true);
      expect(existsSync(row.evidence), row.job).toBe(true);
      if (row.route.includes("#")) {
        const html = readFileSync(`src/pages${route.replace(/\/$/u, "")}.astro`, "utf8");
        expect(html, row.job).toContain(`id="${row.route.split("#")[1]}"`);
      }
    }
  });

  it("proves Base64 Unicode roundtrip, real color components, and VAT addition/scorporo", () => {
    const encoded = base64Operation("Caffè ☕", "encode");
    expect(base64Operation(String(encoded.value), "decode").value).toBe("Caffè ☕");
    expect(convertColorLocal({ color: "rebeccapurple", mode: "named-color" })).toMatchObject({ hex: "#663399", rgb: { r: 102, g: 51, b: 153 } });
    const added = calculateVat126({ operation: "add", amountCents: 10000, rate: { kind: "custom", percent: "22" } });
    expect(added).toMatchObject({ netCents: 10000, vatCents: 2200, grossCents: 12200 });
    expect(calculateVat126({ operation: "scorporo", amountCents: added.grossCents, rate: { kind: "custom", percent: "22" } }).netCents).toBe(10000);
  });
});
