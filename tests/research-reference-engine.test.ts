import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { normalizeDoi, normalizeIsbn } from "../src/engines/research-reference";
import { cleanResearchUrl } from "../src/engines/research-knowledge";
import doiIsbnModule from "../src/tools/doi-isbn-normalizer/module";

const doiFixtures = JSON.parse(
  readFileSync(new URL("../quality/fixtures/doi/vectors.json", import.meta.url), "utf8"),
) as { vectors: Array<{ input: string; normalized: string; url: string }> };

const isbnFixtures = JSON.parse(
  readFileSync(new URL("../quality/fixtures/isbn/vectors.json", import.meta.url), "utf8"),
) as {
  vectors: Array<{
    input: string;
    kind: "ISBN-10" | "ISBN-13";
    digits?: string;
    valid: boolean;
    isbn13?: string;
    reason?: string;
  }>;
};

describe("research-reference engine seam", () => {
  it("matches independent DOI vectors without resolving metadata", () => {
    for (const vector of doiFixtures.vectors) {
      expect(normalizeDoi(vector.input)).toEqual({
        kind: "DOI",
        valid: true,
        normalized: vector.normalized,
        url: vector.url,
      });
    }
  });

  it("redacts credentials from research URL outputs", () => {
    const result = cleanResearchUrl("https://user:pass@example.org/paper?utm_source=x");
    expect(result.url).toBe("https://example.org/paper");
    expect(JSON.stringify(result)).not.toContain("pass");
  });

  it("rejects DOI inputs outside the declared deterministic syntax", () => {
    expect(normalizeDoi("https://example.com/10.1000/182")).toMatchObject({ valid: false });
    expect(normalizeDoi("10.12/nope")).toMatchObject({ valid: false });
    expect(normalizeDoi("10.1000/line\nbreak")).toMatchObject({ valid: false });
    expect(normalizeDoi("doi:")).toMatchObject({ valid: false });
  });

  it("matches ISBN-10/13 fixtures and check-digit conversion", () => {
    for (const vector of isbnFixtures.vectors) {
      expect(normalizeIsbn(vector.input)).toMatchObject({
        kind: vector.kind,
        valid: vector.valid,
        ...(vector.digits === undefined ? {} : { digits: vector.digits }),
        ...(vector.isbn13 === undefined ? {} : { isbn13: vector.isbn13 }),
        ...(vector.reason === undefined ? {} : { reason: vector.reason }),
      });
    }
  });

  it("accepts ISBN labels and ISBN-10 X while rejecting bad structure/prefix", () => {
    expect(normalizeIsbn("ISBN 0-8044-2957-X")).toMatchObject({
      kind: "ISBN-10",
      digits: "080442957X",
      valid: true,
      isbn13: "9780804429573",
    });
    expect(normalizeIsbn("979-10-90636-07-1")).toMatchObject({ kind: "ISBN-13", valid: true });
    expect(normalizeIsbn("9770306406157")).toMatchObject({ kind: "ISBN-13", valid: false });
    expect(normalizeIsbn("03064061X2")).toMatchObject({ kind: "ISBN-10", valid: false });
  });
});

describe("research-reference public tool seam", () => {
  it("normalizes DOI and ISBN through one local tool module", () => {
    expect(doiIsbnModule.run({ kind: "doi", value: " doi:10.1000/182 " }, { defaults: {} }))
      .toMatchObject({ kind: "DOI", valid: true, normalized: "10.1000/182" });
    expect(doiIsbnModule.run({ kind: "isbn", value: "0-306-40615-2" }, { defaults: {} }))
      .toMatchObject({ kind: "ISBN-10", valid: true, digits: "0306406152" });
  });

  it("fails closed on unknown identifier kinds", () => {
    expect(() => doiIsbnModule.run({ kind: "citation", value: "anything" }, { defaults: {} }))
      .toThrow("INVALID_INPUT");
  });
});
