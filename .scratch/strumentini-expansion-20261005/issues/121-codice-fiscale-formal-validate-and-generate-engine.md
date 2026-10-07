# 121 — Codice Fiscale formal validate and generate engine

**What to build:** Implement local formal validation and generation from declared personal fields, using official month/sex/date/checksum rules and the versioned geography pack; result must say it is not official assignment.

**Traces to:** US-EXP-02, US-EXP-07; AC-02.1, AC-07.1

**Constraints:** C-EXP-01, C-EXP-03, C-EXP-06; official/versioned inputs where rules can change; fail closed on unsupported scope.

**Blocked by:** 70, 115.

**Status:** blocked

**Suggested skills:** research-primary-sources → code-module-design → code-tdd

- [ ] Checksum and encoded date/sex/month rules are deterministic.
- [ ] Birth municipality/foreign state resolves through versioned source data.
- [ ] Malformed/impossible inputs return precise reason and no identity claim.

**Verification:** Checksum parity, leap-day, foreign-birth and malformed fixture corpus.
