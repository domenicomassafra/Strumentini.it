import assert from "node:assert/strict";
import { formatJson, validateJson } from "../src/json.ts";

Deno.test("JSON validation uses native grammar with stable result codes", () => {
  assert.deepEqual(validateJson('{"x":1}'), { valid: true });
  assert.deepEqual(validateJson("{x:1}"), {
    valid: false,
    code: "INVALID_JSON",
  });
});

Deno.test("JSON formatting preserves semantics and Unicode", () => {
  const formatted = formatJson('{"emoji":"☕","items":[1,true,null]}');
  assert.equal(
    formatted,
    '{\n  "emoji": "☕",\n  "items": [\n    1,\n    true,\n    null\n  ]\n}',
  );
  assert.deepEqual(JSON.parse(formatted), {
    emoji: "☕",
    items: [1, true, null],
  });
});

Deno.test("invalid JSON formatting exposes a deterministic error code", () => {
  assert.throws(() => formatJson("[1,]"), /INVALID_JSON/);
});
