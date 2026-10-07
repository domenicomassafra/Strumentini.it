# 90 — Migrate calculator and marketing bespoke results to Result v2

**What to build:** Migrate current calculator/marketing components outside BusinessMathTool/DateTimeOperation to the same answer-first Result v2 contract without introducing bespoke result families.

**Traces to:** US-EXP-01; AC-01.1, AC-01.2

**Constraints:** C-EXP-01, C-EXP-03, C-EXP-09; preserve current formulas/routes.

**Blocked by:** 81, 82, 85.

**Status:** completed

**Suggested skills:** code-module-design → design-impeccable → code-tdd → qa-browser

- [x] All ledger-owned bespoke ids are migrated with semantic declarations and shared Result v2 contracts, including later browser-native audio utilities that do not fit a shared calculator/date-time renderer.
- [x] Calculator/scenario outputs use answer-first primary, interpretation, breakdown, assumptions and provenance; text outputs use bounded selectable output plus counts.
- [x] No duplicate Result v2 component family appears; the migrated renderers reuse the shared primitives/actions and existing semantic classes.

**Verification:** Migration ledger closes assigned ids; current marketing/business tests and mobile exemplars pass.

**Verified:** original ledger owners `business-day`, `campaign-name`, `conversion-rate-scenario`, `cpa-cpc-cpm-calculator`, `margin-markup`, `rate-converter`, `roas-calculator`, `timezone-overlap`, `tracking-cleaner`, `utm-builder` plus later bespoke `browser-audio` and `barcode-linear-v1` renderers project `resultDeclaration.state=declared` under owner 90. These later bespoke tools keep their purpose-specific interaction UIs while participating in the same manifest-level Result v2 inventory contract instead of creating one-off migration families. Owned legacy-primary findings remain zero for the original migrated surfaces; focused family tests cover the additional renderers.
