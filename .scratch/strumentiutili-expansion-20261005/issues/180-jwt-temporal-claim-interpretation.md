# 180 — JWT temporal-claim interpretation

**What to build:** Extend existing JWT inspector with exp/nbf/iat human times and expired/not-yet-valid interpretation against an explicit reference time, while keeping signature/issuer/audience unverified unless separately proven.

**Traces to:** US-EXP-05, US-EXP-09

**Constraints:** C-EXP-01, C-EXP-04, C-EXP-05; deterministic/local by default; extend existing engines/routes where the job is already present.

**Blocked by:** 91 — Migrate DeveloperWebTool renderer to Result v2.

**Status:** completed

**Suggested skills:** security-audit → code-typescript → code-tdd → inclusive-design

- [x] Malformed/non-numeric time claims are reported in `temporal.claimIssues` instead of being silently interpreted.
- [x] Reference clock is explicit in the result and can be supplied as an ISO instant for deterministic tests.
- [x] UI/result warnings continue to state that signature, issuer and audience are not cryptographically verified.

**Verification:** `tests/developer-web-engine.test.ts` covers fixed-time before/expiry-boundary states, future `nbf`, malformed claims and invalid reference clocks.
