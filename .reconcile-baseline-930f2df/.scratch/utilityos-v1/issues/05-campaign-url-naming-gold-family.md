# 05 — Campaign URL and naming Gold family

**What to build:** Implement UTM Builder, Tracking Parameter Cleaner, and Campaign Name Builder over one deep URL/campaign module, including explicit saved naming/campaign presets that demonstrate persistent-context value without introducing AI or remote calls.

**Traces to:** US-06 / AC-06.4 / US-07 / AC-07.2 / US-11 / AC-11.1 / AC-11.4 / DEC-07 / T05 / T06 / T07

**Constraints:** C-04 / C-05 / C-06 / C-07 / C-09 / C-11 / C-12 / C-13 / C-19 / C-20 / C-21

**Blocked by:** 01 — Gold tracer: Business Day Calculator; 02 — Local Workbench, Work Profile, and portable configuration.

**Status:** ready-for-agent

- [ ] UTM Builder uses platform URL primitives, preserves non-tracking URL semantics, supports explicit source/medium/campaign inputs, and has canonical URL fixtures.
- [ ] Proven URL/tracking/UTM behavior and fixtures from the completed core-engine spike are promoted into the production seam before new parsing logic is written.
- [ ] Tracking Parameter Cleaner has an explicit keep/drop policy, preserves unrelated/repeated query parameters correctly, is idempotent, and exposes exactly what changed.
- [ ] Campaign Name Builder supports a small user-defined naming schema/preset with preview and never imposes an opaque global convention.
- [ ] Relevant presets/defaults show provenance and can be overridden without silently rewriting the stored value during the task.
- [ ] URL/campaign operations share one deep module and focused manifests/routes; no separate parser implementation is copied per tool.
- [ ] All three tools reach Gold with Unicode/encoding/invalid-URL edge coverage, LOCAL network assertions, keyboard/mobile acceptance, and independent expected results.

**Verification:** Run canonical URL/UTM/encoding fixtures, cleaner idempotence/property tests, naming-schema fixtures, Work Profile/preset browser flows, per-tool Gold certification, and a LOCAL network assertion.
