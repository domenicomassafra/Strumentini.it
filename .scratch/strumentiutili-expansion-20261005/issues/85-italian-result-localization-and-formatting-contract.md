# 85 — Italian result localization and formatting contract

**What to build:** Centralize Italian display rules for numbers, currencies, dates, units, bytes, counts and result labels while preserving machine payload values separately.

**Traces to:** US-EXP-01; AC-01.2

**Constraints:** C-EXP-03, C-EXP-04, C-EXP-09; no silent locale mutation of downloads.

**Blocked by:** 74 — Answer explanation and provenance result primitives.

**Status:** completed

**Suggested skills:** design-system → inclusive-design → code-typescript → code-tdd

- [x] Italian decimal/date/EUR/byte/plural fixtures are deterministic.
- [x] Long localized labels wrap at narrow widths.
- [x] Machine/download payloads stay locale-independent.

**Verification:** Locale fixtures plus 390px long-label browser cases.

**Evidence:** tests/result-format-it.test.ts covers deterministic Italian numbers/EUR/dates/bytes/counts while preserving machine payloads; the a11y browser gate proves the long Italian label wraps at 390/320px and 200% zoom.
