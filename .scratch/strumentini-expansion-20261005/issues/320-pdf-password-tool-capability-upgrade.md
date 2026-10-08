# 320 — PDF password tool capability upgrade

**What to build:** Refactor current password-check/remove route to use the approved legitimate password-supplied decrypt capability from ticket 242 while retaining explicit refusal of unsupported encryption/bypass.

**Traces to:** US-EXP-04, US-EXP-09

**Constraints:** C-EXP-01, C-EXP-04, C-EXP-05, C-EXP-09; extend existing shared engines/workspaces and avoid duplicate public routes for mere modes.

**Blocked by:** 242 — PDF protect encrypt and legitimate unlock.

**Status:** completed

**Suggested skills:** pdf → security-audit → code-tdd

- [x] **REFUSED for production implementation:** the approved decrypt capability demanded from ticket 242 does not exist. No password-supplied removal is implemented or claimed.
- [x] The existing route clearly rejects encrypted files (`UNSUPPORTED_CAPABILITY`) even when a password is passed; it cannot distinguish a wrong password without a decrypt engine, and never claims to have tested it.
- [x] No bypass/cracking semantics are introduced. An unencrypted PDF may only be copied, not "unlocked".

**Verification:** Closed with explicit refusal downstream of #242/#269, not an implemented decrypt upgrade. `tests/pdf-password-capability.test.ts` checks the existing *marker-only* encrypted fixture, all supplied-password states, no exported artifact/no mutation, and unencrypted copy. The marker fixture does **not** establish an independent actually encrypted password-protected PDF corpus or a valid/wrong-password decrypt path. Reopen only with an independently verifiable approved engine, encrypted real fixture corpus and authorization-safe browser/device acceptance.
