# 121 — Codice Fiscale formal validate and generate engine

**What to build:** Implement local formal validation and generation from declared personal fields, using official month/sex/date/checksum rules and the versioned geography pack; result must say it is not official assignment.

**Traces to:** US-EXP-02, US-EXP-07; AC-02.1, AC-07.1

**Constraints:** C-EXP-01, C-EXP-03, C-EXP-06; official/versioned inputs where rules can change; fail closed on unsupported scope.

**Blocked by:** 70, 115.

**Status:** blocked

**Suggested skills:** research-primary-sources → code-module-design → code-tdd

- [x] Checksum and encoded date/sex/month rules are deterministic for the supported formal 16-character schema.
- [ ] Birth municipality/foreign state resolves through versioned source data.
- [x] Malformed/impossible inputs return precise reason and no identity claim in the standalone engine.

**Verification:** Checksum parity, leap-day, foreign-birth and malformed fixture corpus.

**2026-10-10 dependency-first #121 implementation, source-only:** `src/engines/italy/codice-fiscale-121.ts` implements the exact DM Finanze 23 dicembre 1976 artt. 3–7 positional checksum, surname/name consonants with unsupported-script refusal, birth date/month/day/sex encoding, formal 16-character validation including supported omocodia, leap-day and malformed-data refusals. `generateCodiceFiscale121` uses `lookupItalianGeography115` and emits an explicitly **unassigned local candidate** only when the municipality code and requested birth date are verified by the same **2026-02-21** ISTAT current snapshot. Historical/suppressed/foreign code candidates are recognized but generation refuses when exact date validity is not proven (`GEOGRAPHY_TEMPORAL_UNVERIFIED`); an official `ND` returns `GEOGRAPHY_CODE_UNAVAILABLE` without successor substitution. The 1900–2099 formal century range is declared, with no inferred identity or agency assignment. Shared `tests/codice-fiscale-121-122.test.ts` covers formal checksum fixture `RSSMRA80A01H501U`, generation `RSSMRA26B21H501N`, named-field encoding, malformed/geography failures, dates, 128 omocodia variants and source-only no-network. `tests/codice-fiscale-121-122.browser.mjs` exercises real Chromium at 390px. **2/3 checklist AC implemented**; the municipality/foreign historical date-valid lookup remains only partial because #115 has no complete lifespan intervals and 23 uncoded foreign/16 uncoded suppressed identities. Ticket status/dependencies unchanged, no official-assignment or public release claim. Normative source: https://def.finanze.it/DocTribFrontend/getAttoNormativoDetail.do?ACTION=getSommario&id=%7B8D93A450-E5FE-47FC-A6F0-F938769051BF%7D .

**2026-10-10 ANPR supplementary source-only evidence:** New separate `src/engines/italy/codice-fiscale-121-anpr.ts` provides `verifyCodiceFiscaleBirthPlace121` for exact-ISTAT/date administrative evidence from the 2023 official ANPR archive. Filago `016828` on 1928-01-25 now has dated, source-pinned `D588`; unverified codes/dates/foreign states fail closed, and output always `assignedByAgency:false`. The original `generateCodiceFiscale121` is **unchanged**, so the public route has not gained blanket historical generation and the full #121 AC remains blocked by incomplete #115. `tests/italy-anpr-historical-115-121-122.test.ts` proves the new bounded adapter.
