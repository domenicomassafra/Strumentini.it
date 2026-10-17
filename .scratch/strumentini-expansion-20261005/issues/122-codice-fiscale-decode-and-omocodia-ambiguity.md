MIGRATO su GitHub Issues il 17/10/2026: https://github.com/domenicomassafra/strumentini-it/issues?q=is%3Aissue. Non aggiornare più questo file.

# 122 — Codice Fiscale decode and omocodia ambiguity

**What to build:** Add decoding of encoded facts and municipality/foreign candidates while preserving omocodia ambiguity instead of inventing a unique real-world identity.

**Traces to:** US-EXP-02, US-EXP-07; AC-02.1

**Constraints:** C-EXP-01, C-EXP-03, C-EXP-06; official/versioned inputs where rules can change; fail closed on unsupported scope.

**Blocked by:** 121 — Codice Fiscale formal validate and generate engine.

**Status:** blocked

**Suggested skills:** research-primary-sources → code-tdd → inclusive-design

- [x] Decoder exposes only encoded/formally derivable tokens, sex/month/day, year suffix, and 1900/2000 century hypotheses (never personal identity).
- [x] Seven permitted omocodia substitution slots are decoded explicitly; canonical formal code is distinguished from the potentially allocated omocode.
- [x] Available historical municipality candidates preserve exact #115 original source/version, ISTAT identifier, change event, and temporal uncertainty; missing codes remain absent.

**Verification:** Omocode-position, impossible-date and historical-municipality cases.

**2026-10-10 dependency-first #122 implementation, source-only:** `src/engines/italy/codice-fiscale-122.ts` decodes fully formal #121 validated 16-character personal codes without asserting identity or uniqueness. All 128 legal seven-position omocodia masks roundtrip through the official checksum to the canonical formal code, recording each position/digit/letter; illegal positions refuse. Year encodes only two digits, so 1900/2000 candidates and Gregorian leap-date filtering are explicit rather than guessing birth century. Offline reverse lookups enumerate candidate names and ISTAT IDs from source-bound #115 current/suppressed/foreign tables, preserving provenance, version and event history; every historical/foreign match is marked **NOT_PROVEN_FOR_BIRTH_DATE**, unknown Belfiore codes as `UNKNOWN_CODE`. New Vitest and real Chromium source-only proof are in `tests/codice-fiscale-121-122.test.ts` and `tests/codice-fiscale-121-122.browser.mjs`; no outbound requests. The 3 technical checklist bullets are satisfied **for source-proven partial records**; full production readiness remains blocked by #121 geography temporal validity and #115 gaps, and there is no UI or route. No ticket state/dependency edits.

**2026-10-10 supplemental historical candidate decoder:** `src/engines/italy/codice-fiscale-122-anpr.ts` uses existing formal decode and appends *date-scoped* ANPR municipality candidates for each remaining 1900/2000 birth-century hypothesis, with exact ISTAT ID, original source row, administrative interval and archived version. Explicit `identityConfirmed:false` / `officialAssignment:false` remain unchanged; the unsupported future year and missing foreign codes stay unverified. Separate Vitest covers Filago 1928 candidate without implying 2028 or unique identity. Existing #122 source and public UI are unchanged, and complete #115 dependency is still blocked.

## 2026-10-10 owner planning reconciliation

**Original status and all historical acceptance criteria stay unchanged and OPEN.** New planning crosswalk: #397.

**Next actionable AC:** Verify the original outstanding requirements and dated source evidence before closing. The original acceptance cannot be transferred or marked implemented merely because a new child was planned. Verify actual current source, output, negative cases and physical device when required; retain all gates and source-year/fidelity/security limits.
