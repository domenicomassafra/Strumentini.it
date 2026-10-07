# 132 — Gestione Separata contribution calculator

**What to build:** Implement the supported Gestione Separata profile/rate model from versioned INPS sources with explicit profession/coverage assumptions.

**Traces to:** US-EXP-02, US-EXP-07; AC-02.2, AC-07.1

**Constraints:** C-EXP-01, C-EXP-03, C-EXP-06; official/versioned inputs where rules can change; fail closed on unsupported scope.

**Blocked by:** None for the two professional profiles normalized by ticket 118.

**Status:** completed — bounded 2026 public calculator

**Suggested skills:** research-primary-sources → code-module-design → code-tdd

- [x] Only sourced supported profile options appear.
- [x] Rate/base/ceiling logic is visible in breakdown.
- [x] Unsupported insurance/pension combinations fail explicitly.

**Verification:** Official-source examples and ceiling/rate boundaries.

**Progress (2026-10-06):** `calculateGestioneSeparataContribution` supports only the two professional profiles normalized from INPS Circular 8/2026: 26.07% for a professional without other mandatory pension coverage and 24% for a professional pensioner/with other mandatory pension coverage. The result exposes actual contribution base, €122,295 ceiling, excluded income above the ceiling, rate/components, source provenance and the €18,808 minimum-income threshold for full-year contribution credit. That €18,808 value is deliberately not used as a contribution floor. Parasubordinate and special-sector profiles fail explicitly. The public LOCAL route `/tools/gestione-separata-contributi/` is bound to `cand-257` and `italy-2026-consumers`; focused tests and the shared 390px browser receipt pass with zero task-data network requests and no overflow.
