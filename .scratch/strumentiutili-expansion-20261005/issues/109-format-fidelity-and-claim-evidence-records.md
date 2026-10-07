# 109 — Format fidelity and claim evidence records

**What to build:** Define the evidence record consumed by the format matrix for signature/type, fidelity-loss statement, before→after bytes, target-size success and independent reopen/parse proof.

**Traces to:** US-EXP-04; AC-04.2, AC-06.1, AC-09.1

**Constraints:** C-EXP-02, C-EXP-05; route existence alone never counts as IMPLEMENTED.

**Blocked by:** 103, 108.

**Status:** completed

**Suggested skills:** code-architecture-review → code-typescript → code-tdd

- [x] IMPLEMENT rows cannot pass without measured artifact signature/type evidence and a verified download artifact.
- [x] Compression target hit is derived from the final verified artifact byte length only.
- [x] Fidelity/reopen evidence carries a format-specific statement, limitations, independent reopen method and facts.

**Verification:** `tests/format-evidence.test.ts` covers valid evidence, forged/mismatched operation/type, missing independent reopen proof and final-byte target-size truth.
