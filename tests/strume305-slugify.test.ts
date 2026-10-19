import { describe, expect, it } from "vitest";
import { generateSlug } from "../src/engines/text-writing";
import { generateDonorSlug } from "../src/tools/slug-generator/donor";
import slugModule from "../src/tools/slug-generator/module";

const baseline = [
  "  Café déjà vu / notes ", "È già l’ora d’andare", "coöperate São Paulo",
  "fooBar APISection", "one & two + three", "Alice's Book", "e\u0301tude",
  "東京 日本語", "你好 世界", "Привет мир", "Γειά σου Κόσμε",
  "مرحبا بالعالم", "नमस्ते दुनिया", "hello 世界", "👩‍💻 test",
];

describe("#305 pinned slugify donor / old-contract differential", () => {
  it.each(baseline)("retains old-contract fixtures for %s", (text) => {
    for (const separator of ["-", "_"] as const) {
      for (const lowercase of [true, false]) {
        for (const maxLength of [0, 1, 5, 12, 64]) {
          const input = { text, separator, lowercase, maxLength };
          expect(generateDonorSlug(input), JSON.stringify(input)).toEqual(generateSlug(input));
        }
      }
    }
  });

  it.each([
    ["Straße", "strasse"], ["Ærø", "aero"], ["cœur", "coeur"],
    ["smørrebrød", "smorrebrod"], ["Łódź", "lodz"],
  ])("improves independent Latin transliteration for %s", (text, expected) => {
    expect(generateDonorSlug({ text }).slug).toBe(expected);
    expect(generateDonorSlug({ text, lowercase: false, separator: "_" }).separator).toBe("_");
  });

  it("truncates by codepoint after transliteration and keeps the v1 envelope", () => {
    expect(generateDonorSlug({ text: "Straße & Café", maxLength: 6 })).toMatchObject({
      slug: "strass", text: "strass", truncated: true, separator: "-", engineVersion: "text-writing-v1",
    });
  });

  it("preserves refusals, input-size bounds and pre-cancel behavior", () => {
    for (const input of [{ text: 4 }, { text: "a", separator: "." }, { text: "a", maxLength: -1 }, { text: "a", lowercase: "yes" }, { text: "x".repeat(2 * 1024 * 1024 + 1) }]) {
      expect(() => generateDonorSlug(input)).toThrow();
    }
    expect(() => slugModule.run({ text: "A" }, { defaults: {} }, AbortSignal.abort())).toThrow(/Operation cancelled/u);
  });
});
