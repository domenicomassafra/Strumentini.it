import assert from "node:assert/strict";
import { cleanTrackingUrl, normalizeUrl, parseUrl } from "../src/urls.ts";

Deno.test("URL parse preserves repeated query values and Unicode semantics", () => {
  assert.deepEqual(
    parseUrl("https://EXAMPLE.com:443/a%20b?q=one&q=due+parole#frag"),
    {
      href: "https://example.com/a%20b?q=one&q=due+parole#frag",
      origin: "https://example.com",
      pathname: "/a%20b",
      query: [["q", "one"], ["q", "due parole"]],
      hash: "#frag",
    },
  );
});

Deno.test("URL normalization sorts query keys but keeps repeated-key order", () => {
  assert.equal(
    normalizeUrl("HTTPS://Example.COM:443/path?z=9&a=2&a=1#x"),
    "https://example.com/path?a=2&a=1&z=9#x",
  );
});

Deno.test("tracking cleaner removes only known tracking keys and is idempotent", () => {
  const source =
    "https://example.com/p?utm_source=x&id=7&fbclid=abc&custom_click=keep&utm_medium=y";
  const cleaned = cleanTrackingUrl(source);
  assert.equal(cleaned, "https://example.com/p?id=7&custom_click=keep");
  assert.equal(cleanTrackingUrl(cleaned), cleaned);
});

Deno.test("URL parsing decodes Unicode query values and rejects non-URLs", () => {
  assert.deepEqual(parseUrl("https://e.test/?q=caff%C3%A8").query, [[
    "q",
    "caffè",
  ]]);
  assert.throws(() => parseUrl("not a url"), TypeError);
});
