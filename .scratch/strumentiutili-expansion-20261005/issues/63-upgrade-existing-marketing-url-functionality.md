# 63 — Upgrade existing marketing/URL functionality

**What to build:** Deepen current UTM, tracking cleaner, campaign naming, URL compare/normalize, meta/Open Graph previews, social limits, robots/canonical/redirect/domain tools with bulk modes, preview realism, platform presets and direct handoffs while preserving deterministic local processing where possible.

**Traces to:** US-EXP-01, US-EXP-05; AC-01.1, AC-05.1; DEC-EXP-01, DEC-EXP-03; C-EXP-03, C-EXP-04, C-EXP-09

**Constraints:** Platform limits/presets with changing external values need version/source metadata; previews are approximations, not guarantees of a platform render.

**Blocked by:** 321, 322, 323, 324, 325.

**Status:** completed

- [x] Tickets 321/323 extend the existing UTM and URL normalize/compare routes with round-trip/bulk processing, per-row isolation, explicit normalization rules and preservation of non-tracking query parameters.
- [x] Ticket 322 centralizes Meta/Open Graph/social preview presets with source/checked-date metadata and labels viewport/platform rendering as an approximation rather than a guarantee.
- [x] Tickets 324/325 separate local syntax/normalization guidance from explicitly triggered reference-network checks, retaining partial redirect evidence, retrieval time and privacy boundaries.

**Verification:** `tests/url-marketing-upgrades.test.ts` plus `scripts/acceptance-url-marketing-upgrades.mjs` pass the round-trip/bulk, versioned preset and network-boundary cases; browser acceptance at 390px observes zero live requests before explicit submit and no horizontal overflow.
