# 10 — Partita IVA checksum + opt-in VIES

**What to build:** Add local formal validation for Italian Partita IVA and an explicitly separate opt-in EU VIES verification mode with source identity, retrieval timestamp, unavailable state, and no conflation between checksum validity and registry existence.

**Traces to:** US-EXP-02, US-EXP-07, US-EXP-09; AC-02.1, AC-02.2, AC-07.2; DEC-EXP-02, DEC-EXP-04; C-EXP-03, C-EXP-05, C-EXP-06

**Constraints:** Network call only after explicit user action; VIES downtime/error is not converted into "invalid VAT number".

**Blocked by:** 123, 124.

**Status:** completed

- [x] Ticket 123 provides offline normalization/checksum validation with distinct character, length and checksum failures and `registerVerified=false`.
- [x] Ticket 124 adds a separately triggered VIES action that discloses the network boundary before execution and shows European Commission/VIES authority plus retrieval timestamp afterward.
- [x] Local-valid, VIES-valid, VIES-invalid and VIES-unavailable remain distinct: remote transport/service failures never overwrite the local checksum result.

**Verification:** `tests/partita-iva-validator.test.ts`, `tests/vies-worker.test.ts`, `tests/reference-result.test.ts` and `scripts/acceptance-partita-iva-vies.mjs` cover local checksum vectors, zero implicit network, mocked VIES valid/invalid/unavailable/fault responses, explicit opt-in POST and rendered authority/timestamp provenance.
