import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { calculateItalianDocumentExpiry, type ItalianDocumentExpiryInput } from "../src/engines/date-time/italian-document-expiry";
import documentExpiryModule from "../src/tools/italian-document-expiry/module";

const fixtures = JSON.parse(readFileSync(new URL("../quality/fixtures/italian-document-expiry/vectors.json", import.meta.url), "utf8")) as {
  vectors: Array<{ id: string; input: ItalianDocumentExpiryInput; expected: { ageAtIssue: number; expiryDate: string } }>;
};

describe("Italian identity document expiry", () => {
  it.each(fixtures.vectors)("matches official-rule fixture $id", ({ input, expected }) => {
    const result = calculateItalianDocumentExpiry(input);
    expect(result).toMatchObject(expected);
    expect(result.ruleVersion).toBe("2026-10-06.1");
    expect(result.checkedAt).toBe("2026-10-06");
    expect(result.verification).toBe("calculation-only-not-document-verification");
    expect(result.sources.length).toBeGreaterThanOrEqual(1);
  });

  it("refuses unsupported scope and source-ambiguous leap-day boundaries", () => {
    expect(() => calculateItalianDocumentExpiry({ documentType: "driver-license" as never, birthDate: "1990-01-01", issueDate: "2026-10-06" })).toThrow("UNSUPPORTED_DOCUMENT_TYPE");
    expect(() => calculateItalianDocumentExpiry({ documentType: "cie", birthDate: "2000-02-29", issueDate: "2026-10-06" })).toThrow("UNSUPPORTED_LEAP_DAY_BOUNDARY");
    expect(() => calculateItalianDocumentExpiry({ documentType: "passport", birthDate: "1990-01-01", issueDate: "2024-02-29" })).toThrow("UNSUPPORTED_LEAP_DAY_BOUNDARY");
    expect(() => calculateItalianDocumentExpiry({ documentType: "cie", birthDate: "2030-01-01", issueDate: "2026-10-06" })).toThrow("ISSUE_BEFORE_BIRTH");
  });

  it("uses the local tool module without network context", () => {
    const result = documentExpiryModule.run(
      { documentType: "passport", birthDate: "1990-08-20", issueDate: "2026-10-06" },
      { defaults: {} },
    );
    expect(result).toMatchObject({ expiryDate: "2036-10-06", ageAtIssue: 36 });
  });
});
