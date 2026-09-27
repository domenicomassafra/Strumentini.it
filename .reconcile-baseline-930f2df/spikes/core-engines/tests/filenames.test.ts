import assert from "node:assert/strict";
import { planSanitizedRenames, sanitizeFilename } from "../src/filenames.ts";

Deno.test("filename sanitizer handles separators, controls, reserved names and trailing dots", () => {
  assert.equal(sanitizeFilename("  report:/Q3?.pdf. "), "report__Q3_.pdf");
  assert.equal(sanitizeFilename("CON"), "_CON");
  assert.equal(sanitizeFilename("\u0000\u200B"), "untitled");
});

Deno.test("rename plan avoids case-insensitive collisions with stable suffixes", () => {
  assert.deepEqual(planSanitizedRenames(["a?.txt", "A*.txt", "a_.txt"]), [
    { from: "a?.txt", to: "a_.txt", changed: true },
    { from: "A*.txt", to: "A_ (2).txt", changed: true },
    { from: "a_.txt", to: "a_ (3).txt", changed: true },
  ]);
});

Deno.test("filename sanitizer preserves safe Unicode and handles empty input", () => {
  assert.equal(sanitizeFilename("caffè-☕.txt"), "caffè-☕.txt");
  assert.equal(sanitizeFilename("   "), "untitled");
});
