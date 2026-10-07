# 106 — Expanded directory and category scalability UX gate

**What to build:** Test the catalogue UI against a synthetic expanded inventory so pagination, facets, real counts, card density and 390px behavior remain usable before hundreds of real routes are added.

**Traces to:** US-EXP-10

**Constraints:** C-EXP-04, C-EXP-08; synthetic entries are test-only and never ship.

**Blocked by:** 104 — Canonical job identity and duplicate-route policy.

**Status:** completed

**Suggested skills:** design-system → interaction-design → qa-browser → browser-performance-benchmark

- [x] Filters remain URL-restorable and counts are generated from the tested inventory.
- [x] No horizontal overflow or unusable card density at 390px.
- [x] Client-side catalogue/search payload remains lazy and within recorded budget.

**Verification:** Synthetic expanded-catalog discovery acceptance and performance baseline.

**Evidence:** With ticket 104 complete, `node scripts/acceptance-directory.mjs` freshly builds a test-only 264-tool fixture from the current catalogue plus 64 deterministic synthetic entries and passes facet/count parity, grouped view, 11-page pagination, keyboard focus, reload/back restoration, 390px single-column/no-overflow checks, and lazy payload gates with zero eager tool chunks. The recorded budgets remain 524288 HTML bytes and 196608 initial script bytes. `npx tsc --noEmit` and scoped diff-check pass.
