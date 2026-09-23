import assert from "node:assert/strict";
import {
  base64DecodeBytes,
  base64DecodeUtf8,
  base64EncodeBytes,
  base64EncodeUtf8,
  digestHex,
  verifyDigestHex,
} from "../src/encoding.ts";

Deno.test("Base64 matches RFC-known vectors and UTF-8 round trips", () => {
  assert.equal(base64EncodeBytes(new TextEncoder().encode("foo")), "Zm9v");
  assert.deepEqual([...base64DecodeBytes("AAECA/8=")], [0, 1, 2, 3, 255]);
  const encoded = base64EncodeUtf8("Caffè ☕");
  assert.equal(base64DecodeUtf8(encoded), "Caffè ☕");
});

Deno.test("SHA-256 matches the published abc vector and verification is case-insensitive", async () => {
  const expected =
    "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad";
  assert.equal(await digestHex("abc"), expected);
  assert.equal(await verifyDigestHex("abc", expected.toUpperCase()), true);
  assert.equal(await verifyDigestHex("abd", expected), false);
});

Deno.test("Base64 rejects malformed data and invalid UTF-8 payloads", () => {
  assert.throws(() => base64DecodeBytes("***"), /INVALID_BASE64/);
  assert.throws(() => base64DecodeUtf8("/w=="), /INVALID_UTF8_BASE64/);
});
