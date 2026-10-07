# 311 — Astronomy and location-dependent date feasibility

**What to build:** Decide whether seasons/sunrise/sunset/moon-phase jobs can be maintained locally with explicit timezone/location/data/algorithm provenance; implement none in this spike.

**Traces to:** US-EXP-03, US-EXP-07

**Constraints:** C-EXP-02, C-EXP-03, C-EXP-06; feasibility only.

**Blocked by:** 07 — Versioned Italy reference-data framework.

**Status:** completed

**Suggested skills:** research-primary-sources → plan-tickets

- [x] `research/lanes/13-astronomy-location-date-feasibility.md` records required inputs, authority/algorithm needs and accuracy/model boundaries for seasons, sunrise/sunset/twilight and moon-phase jobs.
- [x] The evidence note documents coordinate privacy, URL/history/telemetry avoidance and the explicit-consent boundary for any future remote reference call.
- [x] All candidate routes are **REFUSED for this tranche**: NOAA's published solar implementation is explicitly unmaintained, while the authoritative USNO services located are remote and no versioned local ephemeris/algorithm pack is vendored. No guessed astronomy route is shipped.

**Verification:** Primary-source review checked 2026-10-06 against NOAA/GML Solar Calculation Details and the USNO Astronomical Applications Data Services/API documentation. The note records their supported inputs/service ranges and NOAA's published accuracy caveats/reopen criteria.
