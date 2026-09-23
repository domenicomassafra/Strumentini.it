import assert from "node:assert/strict";
import {
  findInvisibleCharacters,
  inspectText,
  normalizeWhitespace,
} from "../src/text.ts";

Deno.test("text inspection uses explicit code-point and line semantics", () => {
  assert.deepEqual(inspectText("Café 👩‍💻\r\nline two"), {
    bytes: 27,
    codeUnits: 20,
    codePoints: 18,
    words: 3,
    lines: 2,
  });
  assert.equal(inspectText("").lines, 0);
});

Deno.test("whitespace normalization is Unicode-aware and idempotent", () => {
  const dirty = "  alpha\t beta \r\n gamma\u00a0 delta  ";
  const once = normalizeWhitespace(dirty);
  assert.equal(once, "alpha beta\ngamma delta");
  assert.equal(normalizeWhitespace(once), once);
});

Deno.test("invisible characters report code point and UTF-16 offset", () => {
  assert.deepEqual(findInvisibleCharacters("a\u200Bb\uFEFF"), [
    { codePoint: "U+200B", offset: 1, name: "ZERO WIDTH SPACE" },
    { codePoint: "U+FEFF", offset: 3, name: "ZERO WIDTH NO-BREAK SPACE" },
  ]);
});
