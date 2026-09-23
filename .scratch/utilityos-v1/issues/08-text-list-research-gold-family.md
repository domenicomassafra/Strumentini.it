# 08 — Text/list and research-reference Gold family

**What to build:** Add List Compare/Dedupe, Text Diff, and DOI/ISBN Normalizer as focused Gold tools over small deep text/list and research-reference modules. The slice must give the Research context real deterministic capability without semantic repair, remote metadata lookup, or developer-only positioning.

**Traces to:** US-07 / AC-07.2 / US-11 / AC-11.1 / AC-11.4 / T11 / T12 / T13

**Constraints:** C-04 / C-05 / C-06 / C-09 / C-11 / C-12 / C-13 / C-18 / C-20 / C-21

**Blocked by:** 01 — Gold tracer: Business Day Calculator.

**Status:** complete

- [x] List Compare/Dedupe supports explicit equality/normalization rules, deterministic intersection/difference/dedupe behavior, Unicode/line-ending fixtures, and algebraic/idempotence properties where valid.
- [x] Promote the proven small-text/list behavior and fixtures from the completed core-engine spike; Text Diff preserves the documented 1,000,000-cell LCS guard and fails explicitly above it.
- [x] Text Diff presents additions/removals with visible symbols plus text labels, not color only, and validates known before/after fixtures through the public tool seam.
- [x] DOI/ISBN Normalizer validates/normalizes only deterministic identifier syntax/check-digit behavior it can prove and does not invent missing bibliographic metadata.
- [x] The three tools remain independently searchable/openable while sharing deep reusable primitives rather than duplicating normalization logic.
- [x] Research-facing methodology copy states exactly what is normalized and what is not; there is no semantic “citation repair” claim.
- [x] Each tool reaches Gold with independent vectors/properties, keyboard/mobile acceptance, and LOCAL network assertions.

**Verification:** Run literal Unicode/list/diff fixtures, algebraic/idempotence properties, DOI/ISBN standards/check-digit fixtures, non-color diff accessibility acceptance, LOCAL network inspection, per-tool Gold certification, and bundle checks for shared primitive reuse.

**Closure evidence:** `npm test` 64/64; `npm run check` PASS; `npm run verify:ticket-01` PASS; `scripts/gold/text-research.ts` PASS for all three tools; `scripts/acceptance-text-research.mjs` PASS; `scripts/gold/text-research-bundle.ts` proves List Compare and Text Diff share one lazy `text-list` chunk; scoped `git diff --cached --check` PASS.
