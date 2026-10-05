# 63 — Upgrade existing marketing/URL functionality

**What to build:** Deepen current UTM, tracking cleaner, campaign naming, URL compare/normalize, meta/Open Graph previews, social limits, robots/canonical/redirect/domain tools with bulk modes, preview realism, platform presets and direct handoffs while preserving deterministic local processing where possible.

**Traces to:** US-EXP-01, US-EXP-05; AC-01.1, AC-05.1; DEC-EXP-01, DEC-EXP-03; C-EXP-03, C-EXP-04, C-EXP-09

**Constraints:** Platform limits/presets with changing external values need version/source metadata; previews are approximations, not guarantees of a platform render.

**Blocked by:** 01, 02, 42.

**Status:** blocked

- [ ] UTM builder/parser/cleaner can round-trip, bulk-process and copy/export without losing non-tracking query parameters.
- [ ] Meta/Open Graph/social previews label platform/viewport assumptions and update preset data from one authority.
- [ ] Redirect/reference-network tools clearly separate live network checks from local URL parsing.

**Verification:** Existing Gold plus round-trip/bulk fixtures, network-boundary tests, versioned platform-preset tests and route checklist.

