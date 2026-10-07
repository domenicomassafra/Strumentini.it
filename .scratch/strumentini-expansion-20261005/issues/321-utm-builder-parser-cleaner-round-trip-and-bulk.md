# 321 — UTM builder parser cleaner round-trip and bulk

**What to build:** Deepen UTM/tracking tools with bulk mode and exact build→parse→clean round-trip that preserves non-tracking query parameters and explicitly defines duplicate keys.

**Traces to:** US-EXP-10

**Constraints:** C-EXP-01, C-EXP-04, C-EXP-05, C-EXP-09; extend existing shared engines/workspaces and avoid duplicate public routes for mere modes.

**Blocked by:** 99 — Migrate URL marketing QR and bespoke results to Result v2.

**Status:** completed

**Suggested skills:** code-module-design → code-tdd → inclusive-design

- [x] Non-tracking parameters survive cleaning, including raw query encoding/order and repeated non-tracking keys.
- [x] UTM keys/values round-trip under the documented URLSearchParams encoding policy and duplicate-key policy.
- [x] Bulk failures isolate per URL with stable source index/row metadata.

**Verification:** tests/url-marketing-upgrades.test.ts, tests/campaign-url-engine.test.ts, and tests/url-marketing-tools.test.ts cover query order, raw encoding, duplicate UTM keys, Unicode and isolated bulk failures; scripts/acceptance-url-marketing-upgrades.mjs exercises the real UTM builder component at 390px.

**Evidence:** Shared implementation stays on the existing campaign-url engine and the canonical utm-builder, utm-parser, and tracking-cleaner routes; no mode-only route was added.
