# 09 — IBAN validation and Italian coordinates

**What to build:** Add local IBAN normalization and MOD-97 validation, then parse Italian CIN/ABI/CAB/account segments where structurally applicable, while clearly separating formal validity from account/bank existence.

**Traces to:** US-EXP-02, US-EXP-07, US-EXP-09; AC-02.1, AC-07.1; DEC-EXP-02; C-EXP-03, C-EXP-05, C-EXP-06

**Constraints:** No bank lookup is required for the core tool; user-entered IBAN stays local.

**Blocked by:** 07 — Versioned Italy reference-data framework.

**Status:** completed

- [x] Normalize spaces/case and validate country length/check digits correctly.
- [x] Italian coordinate decomposition is labelled structural, not account verification.
- [x] Exact failing rule is shown on invalid input.
- [x] Known-valid/invalid vectors cover multiple IBAN countries, including Italy.

**Verification:** Standard IBAN/MOD-97 fixture suite, Italian segment cases, and network assertion proving zero requests during local validation.

**Evidence (2026-10-06):** `src/engines/research-reference/index.ts` implements local normalization, fixed-length/BBAN-structure validation for the vendored SWIFT Release 103 subset (DE, ES, FR, GB, IT, NL), streaming MOD-97 and exact `character` / `prefix` / `country` / `length` / `structure` / `checksum` failures. Italy returns CIN, ABI, CAB and account slices with `structuralOnly=true`; all results keep `accountVerified=false`. `quality/oracles/sources.json` binds the format metadata to SWIFT IBAN Registry Release 103 (17 Sep 2026) and an independent BigInt MOD-97 test oracle. `quality/fixtures/iban-formal-validation/vectors.json` includes six official SWIFT electronic-format examples plus invalid derivatives. `tests/iban-validator.test.ts` proves multi-country known answers, Italian decomposition, Result v2 claim separation and zero `fetch` calls. Unsupported country formats fail closed until their current registry row is vendored.
