# 04 — Client time and business-math Gold family

**What to build:** Deepen the existing date/time and client-work math modules with Timezone Overlap, Rate Converter, and Margin/Markup Calculator as three independently callable Gold tools that reuse the same visible Work Profile system and exact deterministic rules.

**Traces to:** US-06 / AC-06.4 / US-07 / AC-07.2 / US-11 / AC-11.1 / AC-11.4 / DEC-07 / T02 / T03 / T04

**Constraints:** C-04 / C-05 / C-06 / C-07 / C-09 / C-11 / C-12 / C-13 / C-18 / C-20 / C-21

**Blocked by:** 01 — Gold tracer: Business Day Calculator; 02 — Local Workbench, Work Profile, and portable configuration.

**Status:** complete

- [x] Timezone Overlap uses IANA/Intl-based instant conversion, handles DST gap/overlap fixtures, and can reuse home timezone/working-hours defaults visibly.
- [x] Existing core-engine rate/margin/date behavior and fixtures are mapped into the production seams first; replacement with an exact-decimal dependency or different algorithm requires a measured correctness reason rather than parallel reimplementation.
- [x] Rate Converter covers hour/day/project conversions with explicit dimensional assumptions and exact decimal/rounding fixtures; it never implies live FX.
- [x] Margin/Markup exposes the distinction between margin and markup, visible formulas/assumptions, zero/invalid-denominator handling, and independent hand-worked vectors.
- [x] At least three tools across the Business Day/time/math family demonstrate the same declared-field Work Profile mechanism without receiving unrelated profile state.
- [x] Each tool has its own task-focused route/manifest while sharing deep engines; no duplicated date/math implementation is introduced.
- [x] Each tool reaches Gold with keyboard/mobile acceptance, no open correctness blocker, and a receipt tied to its oracle/behavior version.

**Verification:** Run independent DST/known-instant and business-math vector tests, Work Profile cross-tool integration tests, per-tool Gold certification, mobile/keyboard browser acceptance, and bundle inspection proving shared engines deduplicate and load lazily.

## Completion receipt — 2026-09-23

- `npx vitest run tests/client-time-math-engine.test.ts tests/client-time-math-profile.test.ts tests/client-time-math-runtime.test.ts` — 14/14 PASS.
- `npm test` — 88/88 PASS at closure.
- `npm run check` — 0 errors / 0 warnings / 0 hints.
- `npm run build` — PASS, 15 static pages.
- `npx tsx scripts/gold/client-time-math-certify.ts` — Timezone Overlap 5 exact vectors, Rate Converter 2 exact vectors, Margin/Markup 1 exact vector; all Gold PASS.
- DST gap/overlap rejection and explicit earlier/later fallback disambiguation are tested against IANA/Intl behavior.
- Exact rational decimal arithmetic replaces the spike's binary-float rounding only after the measured `10.075` half-up discrepancy documented in `research/implementation/04-client-time-math-production-seams.md`.
- `npx tsx scripts/gold/client-time-math-bundle.ts` — all three tools import one lazy shared `client-time-math` engine chunk; no route eagerly references it.
- `node scripts/acceptance-client-time-math.mjs` — persisted `Europe/Rome`/`EUR` Work Profile reused across three tools, keyboard/mobile/local-network PASS.
- `npm audit --audit-level=high` — 0 vulnerabilities.
- `git diff --check` — PASS.
