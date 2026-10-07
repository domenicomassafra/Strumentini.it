# 123 — Partita IVA local formal validator

**What to build:** Implement Italian P.IVA normalization and checksum with exact failing rule; explicitly distinguish formal validity from business/register existence.

**Traces to:** US-EXP-02, US-EXP-07, US-EXP-09; AC-02.1, AC-07.2

**Constraints:** C-EXP-01, C-EXP-03, C-EXP-06; official/versioned inputs where rules can change; fail closed on unsupported scope.

**Blocked by:** 70, 07.

**Status:** completed

**Suggested skills:** research-primary-sources → code-tdd

- [x] Formatting/checksum validation works with zero network.
- [x] Result says what formal validity does and does not prove.
- [x] Invalid input identifies length/character/checksum failure precisely.

**Verification:** Independent valid/invalid vectors and network-zero assertion.

**Evidence (2026-10-06):** `src/engines/research-reference/index.ts` implements the deterministic 11-digit formal checksum and returns exact `character`, `length` or `checksum` failure rules. `src/tools/partita-iva-validator/manifest.ts` declares `LOCAL` + `network: forbidden`; the shared Result v2 validator explicitly says formal validity does not verify a business or remote registry, while the result records `registerVerified=false`. `quality/fixtures/italian-vat-number/vectors.json` contains synthetic valid/invalid vectors with no registry claim. `tests/partita-iva-validator.test.ts` independently recomputes check digits through a positional lookup table and spies on `fetch`, proving zero network calls during a tool run.
