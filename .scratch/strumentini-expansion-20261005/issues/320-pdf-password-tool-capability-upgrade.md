# 320 — PDF password tool capability upgrade

**What to build:** Refactor current password-check/remove route to use the approved legitimate password-supplied decrypt capability from ticket 242 while retaining explicit refusal of unsupported encryption/bypass.

**Traces to:** US-EXP-04, US-EXP-09

**Constraints:** C-EXP-01, C-EXP-04, C-EXP-05, C-EXP-09; extend existing shared engines/workspaces and avoid duplicate public routes for mere modes.

**Blocked by:** 242 — PDF protect encrypt and legitimate unlock.

**Status:** blocked

**Suggested skills:** pdf → security-audit → code-tdd

- [ ] Existing route accepts valid supplied password only when supported.
- [ ] Wrong/unsupported encryption states are precise.
- [ ] No bypass/cracking semantics are introduced.

**Verification:** Encrypted fixtures covering supported/unsupported/wrong-password cases.
