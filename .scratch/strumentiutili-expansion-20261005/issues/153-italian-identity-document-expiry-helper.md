# 153 — Italian identity-document expiry helper

**What to build:** Create a bounded expiry-date helper for explicitly supported Italian identity/passport rules with source/version and user-entered issue/birth data; unsupported document types refuse.

**Traces to:** US-EXP-07; AC-07.1

**Constraints:** C-EXP-01, C-EXP-03, C-EXP-06; official/versioned inputs where rules can change; fail closed on unsupported scope.

**Blocked by:** 07 — Versioned Italy reference-data framework.

**Status:** completed

**Suggested skills:** research-primary-sources → code-tdd

- [x] Supported scope is explicit: CIE, temporary CIE for temporary fingerprint-capture impossibility, and ordinary Italian passport. Results expose rule version `2026-10-06.1`, checked date and official source identities.
- [x] Fixtures cover under-3, exact age-3, minor, exact age-18, adult and temporary-CIE boundaries plus passport 3/5/10-year bands; unsupported scope and source-ambiguous leap-day boundaries fail closed.
- [x] Every result is labelled `calculation-only-not-document-verification`; no authenticity, revocation, travel-acceptance or live-registry claim is made.

**Verification:** `tests/italian-document-expiry.test.ts` passes 11 focused cases against `quality/fixtures/italian-document-expiry/vectors.json`; the shared Italy reference-data tests remain green. Oracle cand-240 binds the Ministry of the Interior CIE source and Polizia di Stato passport-validity source checked 2026-10-06.
