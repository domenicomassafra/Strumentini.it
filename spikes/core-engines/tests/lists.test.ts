import assert from "node:assert/strict";
import {
  compareLists,
  dedupeLines,
  diffText,
  sortLines,
} from "../src/lists.ts";

Deno.test("list sort is deterministic and does not mutate input", () => {
  const input = ["é", "z", "A", "a"];
  assert.deepEqual(sortLines(input), ["A", "a", "z", "é"]);
  assert.deepEqual(input, ["é", "z", "A", "a"]);
});

Deno.test("dedupe supports explicit normalization and keeps first spelling", () => {
  assert.deepEqual(
    dedupeLines([" café ", "café", "cafe\u0301", "tea"], "trim-nfc"),
    [" café ", "tea"],
  );
});

Deno.test("compareLists emits unique first-seen intersection and differences", () => {
  assert.deepEqual(compareLists(["a", "b", "b", "c"], ["b", "d", "b"]), {
    intersection: ["b"],
    onlyLeft: ["a", "c"],
    onlyRight: ["d"],
  });
});

Deno.test("line diff reconstructs a known insertion/deletion fixture", () => {
  assert.deepEqual(diffText("one\ntwo\nthree", "one\nTWO\nthree\nfour"), [
    { kind: "equal", value: "one" },
    { kind: "remove", value: "two" },
    { kind: "add", value: "TWO" },
    { kind: "equal", value: "three" },
    { kind: "add", value: "four" },
  ]);
});

Deno.test("line diff rejects an input matrix beyond the deterministic memory guard", () => {
  const manyLines = Array.from({ length: 1_001 }, (_, index) => `line-${index}`)
    .join("\n");
  assert.throws(() => diffText(manyLines, manyLines), /DIFF_TOO_LARGE/);
});
