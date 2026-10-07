# 116 — Italian public-holiday authoritative source pack

**What to build:** Replace bare embedded-calendar provenance for Italy with a versioned authoritative national-holiday source pack and explicit validity metadata while keeping deterministic calculation local.

**Traces to:** US-EXP-07, US-EXP-03; AC-07.1

**Constraints:** C-EXP-01, C-EXP-03, C-EXP-06; official/versioned inputs where rules can change; fail closed on unsupported scope.

**Blocked by:** None for the 2026 source pack. Ticket 07 is complete.

**Status:** completed

**Suggested skills:** research-primary-sources → code-tdd

- [x] National fixed and movable holidays expose source/version metadata.
- [x] Easter Monday and the 2026 validity interval are covered deterministically.
- [x] Existing non-Italy project-policy calendars are not silently reclassified as official Italy evidence.

**Verification:** Known holiday years, Easter Monday, weekend cases and stale-year behavior.

**Progress (2026-10-06):** Ticket 116 is `READY` for calendar year 2026. Exact Normattiva HTML bytes are pinned for L. 260/1949 art. 2, L. 54/1977, D.P.R. 792/1985, L. 336/2000 and L. 151/2025. The evidence pack records fixed national non-working dates, the movable Monday after Easter (`2026-04-06`), the new 4 October national holiday effective from 2026, the Rome-only 29 June observance, and explicit exclusions such as 4 November. Every artifact and the evidence snapshot are SHA-256 bound; project-policy calendar fixtures remain separately classified.
