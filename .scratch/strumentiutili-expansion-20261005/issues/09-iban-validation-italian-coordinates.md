# 09 — IBAN validation and Italian coordinates

**What to build:** Add local IBAN normalization and MOD-97 validation, then parse Italian CIN/ABI/CAB/account segments where structurally applicable, while clearly separating formal validity from account/bank existence.

**Traces to:** US-EXP-02, US-EXP-07, US-EXP-09; AC-02.1, AC-07.1; DEC-EXP-02; C-EXP-03, C-EXP-05, C-EXP-06

**Constraints:** No bank lookup is required for the core tool; user-entered IBAN stays local.

**Blocked by:** 07 — Versioned Italy reference-data framework.

**Status:** blocked

- [ ] Normalize spaces/case and validate country length/check digits correctly.
- [ ] Italian coordinate decomposition is labelled structural, not account verification.
- [ ] Exact failing rule is shown on invalid input.
- [ ] Known-valid/invalid vectors cover multiple IBAN countries, including Italy.

**Verification:** Standard IBAN/MOD-97 fixture suite, Italian segment cases, and network assertion proving zero requests during local validation.

