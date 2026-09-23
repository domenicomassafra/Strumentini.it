import assert from "node:assert/strict";
import { buildUtmUrl, parseUtmUrl } from "../src/utm.ts";

Deno.test("UTM builder replaces campaign fields without deleting ordinary query params", () => {
  const built = buildUtmUrl("https://example.com/landing?id=4&utm_source=old", {
    source: "newsletter",
    medium: "email",
    campaign: "fall launch",
    content: "hero",
  });
  assert.equal(
    built,
    "https://example.com/landing?id=4&utm_source=newsletter&utm_medium=email&utm_campaign=fall+launch&utm_content=hero",
  );
});

Deno.test("UTM parse returns only present canonical fields", () => {
  assert.deepEqual(
    parseUtmUrl(
      "https://e.test/?utm_source=a&utm_medium=b&utm_campaign=c&utm_term=x",
    ),
    {
      source: "a",
      medium: "b",
      campaign: "c",
      term: "x",
    },
  );
});

Deno.test("UTM builder rejects missing required values", () => {
  assert.throws(
    () =>
      buildUtmUrl("https://e.test/", {
        source: "",
        medium: "email",
        campaign: "x",
      }),
    /UTM_REQUIRED/,
  );
});

Deno.test("UTM values preserve Unicode through URL encoding", () => {
  const built = buildUtmUrl("https://e.test/", {
    source: "caffè",
    medium: "social",
    campaign: "autunno ☕",
  });
  assert.deepEqual(parseUtmUrl(built), {
    source: "caffè",
    medium: "social",
    campaign: "autunno ☕",
  });
});
