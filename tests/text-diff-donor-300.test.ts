import { describe, expect, it } from "vitest";
import { diffText, MAX_DIFF_CELLS, normalizeLineEndings } from "../src/engines/text-list";
import textDiffModule from "../src/tools/text-diff/module";

function tokens(text: string): string[] {
  return normalizeLineEndings(text).match(/[^\n]*\n|[^\n]+$/gu) ?? [];
}

// Independent oracle: the old LCS recurrence measures the minimum edit count,
// without prescribing the tie-breaking positions selected by Myers/jsdiff.
function legacyMinimumEdits(left: string[], right: string[]): number {
  const rows = Array.from({ length: left.length + 1 }, () => new Uint16Array(right.length + 1));
  for (let i = left.length - 1; i >= 0; i -= 1) {
    for (let j = right.length - 1; j >= 0; j -= 1) {
      rows[i]![j] = left[i] === right[j]
        ? 1 + rows[i + 1]![j + 1]!
        : Math.max(rows[i + 1]![j]!, rows[i]![j + 1]!);
    }
  }
  return left.length + right.length - 2 * rows[0]![0]!;
}

describe("diff@9 text-diff adoption (#300)", () => {
  it("keeps independent newline, Unicode, repeated-line and empty-text cases reversible", () => {
    const cases = [
      ["", ""],
      ["", "fine"],
      ["prima\r\nseconda\r", "prima\nterza\n"],
      ["a\na\nb\n", "a\nb\na\n"],
      ["é\n", "e\u0301\n"],
      ["\n\n", "\n"],
      ["tail", "tail\n"],
    ];
    for (const [before, after] of cases) {
      const operations = diffText(before!, after!);
      expect(operations.filter((operation) => operation.kind !== "add").map((op) => op.text).join(""))
        .toBe(normalizeLineEndings(before!));
      expect(operations.filter((operation) => operation.kind !== "remove").map((op) => op.text).join(""))
        .toBe(normalizeLineEndings(after!));
      expect(operations.filter((operation) => operation.kind !== "equal").length)
        .toBe(legacyMinimumEdits(tokens(before!), tokens(after!)));
    }
  });

  it("matches the legacy minimum-edit result across deterministic repeated-token inputs", () => {
    let state = 13;
    const random = () => ((state = (Math.imul(state, 1664525) + 1013904223) >>> 0) / 2 ** 32);
    const alphabet = ["a\n", "b\n", "c\n", "é\n", "\n"];
    for (let sample = 0; sample < 500; sample += 1) {
      const make = () => Array.from({ length: Math.floor(random() * 13) }, () =>
        alphabet[Math.floor(random() * alphabet.length)]).join("");
      const before = make();
      const after = make();
      const operations = diffText(before, after);
      expect(operations.filter(({ kind }) => kind !== "add").map(({ text }) => text).join(""))
        .toBe(before);
      expect(operations.filter(({ kind }) => kind !== "remove").map(({ text }) => text).join(""))
        .toBe(after);
      expect(operations.filter(({ kind }) => kind !== "equal").length)
        .toBe(legacyMinimumEdits(tokens(before), tokens(after)));
      // Within a replacement hunk, removals precede insertions.
      let sawAddition = false;
      for (const { kind } of operations) {
        if (kind === "equal") sawAddition = false;
        else if (kind === "add") sawAddition = true;
        else expect(sawAddition).toBe(false);
      }
    }
  });

  it("keeps the input-size refusal, error envelope, and cancellation", () => {
    const lines = Array.from({ length: 1_001 }, (_, index) => `line-${index}`).join("\n");
    expect(MAX_DIFF_CELLS).toBe(1_000_000);
    expect(() => diffText(lines, lines)).toThrow("DIFF_TOO_LARGE");
    expect(() => textDiffModule.run({ before: lines, after: lines }, { defaults: {} }))
      .toThrow("INVALID_DIFF_TOO_LARGE");
    const controller = new AbortController();
    controller.abort();
    expect(() => textDiffModule.run({ before: "a", after: "b" }, { defaults: {} }, controller.signal))
      .toThrow();
  });

  it("preserves large unrelated text without unbounded donor edit exploration", () => {
    const before = Array.from({ length: 650 }, (_, i) => `before-${i}\n`).join("");
    const after = Array.from({ length: 650 }, (_, i) => `after-${i}\n`).join("");
    const operations = diffText(before, after);
    expect(operations.length).toBe(1300);
    expect(operations.slice(0, 650).every(({ kind }) => kind === "remove")).toBe(true);
    expect(operations.slice(650).every(({ kind }) => kind === "add")).toBe(true);
    expect(operations.filter(({ kind }) => kind !== "add").map(({ text }) => text).join("")).toBe(before);
    expect(operations.filter(({ kind }) => kind !== "remove").map(({ text }) => text).join("")).toBe(after);
  });
});
