# 10 — Partita IVA checksum + opt-in VIES

**What to build:** Add local formal validation for Italian Partita IVA and an explicitly separate opt-in EU VIES verification mode with source identity, retrieval timestamp, unavailable state, and no conflation between checksum validity and registry existence.

**Traces to:** US-EXP-02, US-EXP-07, US-EXP-09; AC-02.1, AC-02.2, AC-07.2; DEC-EXP-02, DEC-EXP-04; C-EXP-03, C-EXP-05, C-EXP-06

**Constraints:** Network call only after explicit user action; VIES downtime/error is not converted into "invalid VAT number".

**Blocked by:** 07 — Versioned Italy reference-data framework.

**Status:** blocked

- [ ] Local checksum mode works offline and reports exact format/checksum failures.
- [ ] VIES mode displays authority, timestamp, and network boundary before/after execution.
- [ ] Local-valid/VIES-unavailable/VIES-valid/VIES-invalid are distinct states.

**Verification:** Checksum vectors plus mocked VIES success/invalid/unavailable responses and browser proof that local mode performs no network request.

