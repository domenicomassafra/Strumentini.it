# 242 — PDF protect encrypt and legitimate unlock

**What to build:** Add password protection/encryption and password-supplied decryption/removal only for algorithms the approved PDF stack supports, exposing permission semantics without bypass claims.

**Traces to:** US-EXP-04, US-EXP-09; AC-04.2

**Constraints:** C-EXP-01, C-EXP-04, C-EXP-05, C-EXP-08; local-first, explicit fidelity limits, verified output, lazy heavy dependencies.

**Blocked by:** 103, 269.

**Status:** completed

**Suggested skills:** pdf → security-audit → code-module-design → code-tdd

- [x] **REFUSED for production implementation:** ticket 269 records `encryption=REFUSE_UNPROVEN`; no protect/unlock route is exposed without an approved encryption path.
- [x] Unsupported encryption remains explicitly unsupported rather than being guessed or bypassed.
- [x] No encrypted output success claim is made without an independently reopenable fixture and proven password/permission semantics.

**Verification:** Closed as a refusal downstream of ticket 269. Reopen only after an approved encryption/decryption implementation passes wrong/correct-password and independent-reopen evidence.
