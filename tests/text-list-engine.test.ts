import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  compareLists,
  dedupeLines,
  diffText,
  parseListText,
} from "../src/engines/text-list";
import listCompareModule from "../src/tools/list-compare/module";
import textDiffModule from "../src/tools/text-diff/module";

const listFixtures = JSON.parse(
  readFileSync(new URL("../quality/fixtures/list-set-ops/vectors.json", import.meta.url), "utf8"),
) as {
  vectors: Array<{
    a: string[];
    b: string[];
    dedupe_a?: string[];
    intersection: string[];
    difference_a_minus_b: string[];
  }>;
};

const diffFixtures = JSON.parse(
  readFileSync(new URL("../quality/fixtures/text-diff/vectors.json", import.meta.url), "utf8"),
) as {
  vectors: Array<{
    before: string;
    after: string;
    expected_ops: Array<{ op: "equal" | "delete" | "insert"; text: string }>;
  }>;
};

function applyDiff(operations: ReturnType<typeof diffText>): string {
  return operations
    .filter((operation) => operation.kind !== "remove")
    .map((operation) => operation.text)
    .join("");
}

describe("text-list engine seam", () => {
  it("matches independent list-set fixtures", () => {
    for (const vector of listFixtures.vectors) {
      const comparison = compareLists(vector.a, vector.b, "exact");
      expect(comparison.intersection).toEqual(vector.intersection);
      expect(comparison.onlyLeft).toEqual(vector.difference_a_minus_b);
      if (vector.dedupe_a !== undefined) {
        expect(dedupeLines(vector.a, "exact")).toEqual(vector.dedupe_a);
      }
    }
  });

  it("uses explicit equality modes and keeps the first spelling", () => {
    expect(parseListText(" café \r\ncafe\u0301\r\ntea\r\n")).toEqual([" café ", "cafe\u0301", "tea"]);
    expect(dedupeLines([" café ", "café", "cafe\u0301", "tea"], "trim-nfc")).toEqual([" café ", "tea"]);
    expect(dedupeLines(["é", "e\u0301"], "exact")).toEqual(["é", "e\u0301"]);
  });

  it("satisfies dedupe idempotence and set-style properties", () => {
    const left = ["a", "b", "b", "c", "é", "e\u0301"];
    const right = ["b", "d", "e\u0301"];
    const once = dedupeLines(left, "nfc");
    expect(dedupeLines(once, "nfc")).toEqual(once);

    const forward = compareLists(left, right, "nfc");
    const reverse = compareLists(right, left, "nfc");
    expect(new Set(forward.intersection.map((value) => value.normalize("NFC")))).toEqual(
      new Set(reverse.intersection.map((value) => value.normalize("NFC"))),
    );
    const rightKeys = new Set(right.map((value) => value.normalize("NFC")));
    expect(forward.onlyLeft.every((value) => !rightKeys.has(value.normalize("NFC")))).toBe(true);
  });

  it("matches text-diff literals and reconstructs normalized after text", () => {
    for (const vector of diffFixtures.vectors) {
      const operations = diffText(vector.before, vector.after);
      expect(operations.map(({ kind, text }) => ({
        op: kind === "remove" ? "delete" : kind === "add" ? "insert" : "equal",
        text,
      }))).toEqual(vector.expected_ops);
      expect(applyDiff(operations)).toBe(vector.after.replace(/\r\n|\r/gu, "\n"));
    }
  });

  it("normalizes only line endings for diff content", () => {
    expect(diffText("a\r\nb\r\n", "a\nc\n")).toEqual([
      { kind: "equal", text: "a\n" },
      { kind: "remove", text: "b\n" },
      { kind: "add", text: "c\n" },
    ]);
    expect(diffText("é\n", "e\u0301\n")).toEqual([
      { kind: "remove", text: "é\n" },
      { kind: "add", text: "e\u0301\n" },
    ]);
  });

  it("preserves the bounded LCS safety guard", () => {
    const manyLines = Array.from({ length: 1_001 }, (_, index) => `line-${index}`).join("\n");
    expect(() => diffText(manyLines, manyLines)).toThrow("DIFF_TOO_LARGE");
  });
});

describe("text-list public tool seams", () => {
  it("runs list compare/dedupe through the tool module", () => {
    expect(listCompareModule.run(
      { left: " café \r\ncafe\u0301\r\ntea\r\n", right: "café\nwater\n", equality: "trim-nfc" },
      { defaults: {} },
    )).toMatchObject({
      equality: "trim-nfc",
      leftDeduped: [" café ", "tea"],
      intersection: [" café "],
      onlyLeft: ["tea"],
      onlyRight: ["water"],
    });
  });

  it("maps the LCS guard to recoverable invalid input", () => {
    const manyLines = Array.from({ length: 1_001 }, (_, index) => `line-${index}`).join("\n");
    expect(() => textDiffModule.run({ before: manyLines, after: manyLines }, { defaults: {} }))
      .toThrow("INVALID_DIFF_TOO_LARGE");
  });
});
