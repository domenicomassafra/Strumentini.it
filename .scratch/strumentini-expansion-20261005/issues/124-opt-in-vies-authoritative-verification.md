# 124 — Opt-in VIES authoritative verification

**What to build:** Add explicit user-triggered EU VIES verification after local VAT formal validation, preserving separate local-valid, VIES-valid, VIES-invalid and unavailable states.

**Traces to:** US-EXP-02, US-EXP-07, US-EXP-09; AC-07.2

**Constraints:** C-EXP-01, C-EXP-03, C-EXP-06; official/versioned inputs where rules can change; fail closed on unsupported scope.

**Blocked by:** 80, 123.

**Status:** completed

**Suggested skills:** research-primary-sources → security-audit → code-tdd → qa-browser

- [x] The local Partita IVA tool remains `LOCAL` / `network: forbidden`; VIES is exposed only as a separate button after a successful local checksum result. Browser interception proves zero VIES requests before that click.
- [x] The remote result uses the shared reference/network provenance primitive and shows European Commission / VIES authority, source, retrieval timestamp, network boundary and remote-authoritative validation state.
- [x] SOAP faults, HTTP errors, transport failures and unreadable responses map to `unavailable` with `valid: null`; they never rewrite the already-rendered local checksum truth into a remote-invalid state.

**Verification:** `tests/vies-worker.test.ts` covers VIES valid/invalid/network/fault/malformed-input states using a mocked service adapter. `scripts/acceptance-partita-iva-vies.mjs` intercepts browser networking, proves no implicit VIES request, then observes exactly one explicit POST plus authority/timestamp provenance. Official contract checked 2026-10-06 against the European Commission VIES page and `checkVatService.wsdl` (`checkVat`, countryCode + vatNumber; documented unavailable/timeout faults).
