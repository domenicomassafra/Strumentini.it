import assert from "node:assert/strict";
import { resolveDefaults } from "../src/profile_defaults.ts";

Deno.test("profile resolution follows precedence and returns provenance", () => {
  const result = resolveDefaults(["currency", "locale", "timezone"], {
    explicit: { currency: "EUR" },
    profile: { currency: "USD", locale: "it-IT" },
    toolDefaults: { locale: "en-US", timezone: "Europe/Rome" },
    systemDerived: { timezone: "UTC" },
  });
  assert.deepEqual(result, [
    { field: "currency", value: "EUR", provenance: "explicit" },
    { field: "locale", value: "it-IT", provenance: "profile" },
    { field: "timezone", value: "Europe/Rome", provenance: "tool-default" },
  ]);
});

Deno.test("profile resolution returns requested fields only and deduplicates requests", () => {
  assert.deepEqual(
    resolveDefaults<"locale" | "currency", string>(["locale", "locale"], {
      profile: { locale: "it-IT", currency: "EUR" },
    }),
    [
      { field: "locale", value: "it-IT", provenance: "profile" },
    ],
  );
});

Deno.test("sensitive fields are never injected silently", () => {
  const sensitive = new Set(["hourlyRate"]);
  assert.deepEqual(
    resolveDefaults(["hourlyRate"], {
      profile: { hourlyRate: 100 },
      sensitiveFields: sensitive,
    }),
    [],
  );
  assert.deepEqual(
    resolveDefaults(["hourlyRate"], {
      explicit: { hourlyRate: 120 },
      profile: { hourlyRate: 100 },
      sensitiveFields: sensitive,
    }),
    [
      { field: "hourlyRate", value: 120, provenance: "explicit" },
    ],
  );
});

Deno.test("profile resolution has a deterministic empty-input boundary", () => {
  assert.deepEqual(
    resolveDefaults<"locale", string>([], { profile: { locale: "it-IT" } }),
    [],
  );
});
