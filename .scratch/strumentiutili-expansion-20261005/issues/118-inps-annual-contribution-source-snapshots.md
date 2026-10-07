# 118 — INPS annual contribution source snapshots

**What to build:** Create versioned official INPS contribution packs for supported employee, artigiani/commercianti and Gestione Separata calculations with year, rate basis, minimum/maximum/threshold metadata and coverage limits.

**Traces to:** US-EXP-02, US-EXP-07; AC-02.2, AC-07.1

**Constraints:** C-EXP-01, C-EXP-03, C-EXP-06; official/versioned inputs where rules can change; fail closed on unsupported scope.

**Blocked by:** None for the explicitly supported 2026 Gestione Separata professional, artigiani/commercianti, and bounded agricultural-worker OTD/OTI employee profiles. Cross-sector/general employee modeling remains unsupported. Ticket 07 is complete.

**Status:** completed

**Suggested skills:** research-primary-sources → code-typescript → code-tdd

- [x] Every supported INPS regime/year cites the governing official publication.
- [x] Thresholds/rates and supported profile assumptions are machine-readable.
- [x] Unsupported management/profile/year remains explicit and cannot inherit another profile's values.

**Verification:** 2026 official-source snapshot plus threshold edge fixtures.

**Progress (2026-10-07):** Exact official INPS source bytes are vendored and SHA-256 bound for Circolare n. 8 del 03-02-2026 (Gestione Separata), Circolare n. 14 del 09-02-2026 (artigiani/commercianti), Circolare n. 43 del 07-04-2026 (agricultural workers), and the official 2026 employee-minimum news page. `quality/reference-data/italy/118-inps-annual-evidence.json` records the bounded machine-readable snapshot. The agricultural subset keeps 30.50% total and 8.84% worker shares as direct Circular 43 facts, derives 21.66% employer share arithmetically, pins €58.13/€8.94 minima, and uses €56,224 only as the v1 fail-closed upper boundary before the source-reported additional 1% rule. The page's €122,295 annual base maximum is reference-only in this v1. Cross-sector employee modeling, higher employee bases, industrial agricultural employers, reductions, NASpI, INAIL and LOAgri remain outside the normalized subset.
