# 158 — Italy source freshness and annual rollover gate

**What to build:** Add a CI/report gate that enumerates every time-varying Italy source pack/tool, its supported latest year/effective date and next-review condition so stale fiscal/admin data cannot silently ship.

**Traces to:** US-EXP-07; AC-07.1; DEC-EXP-04, DEC-EXP-06

**Constraints:** C-EXP-01, C-EXP-03, C-EXP-06; official/versioned inputs where rules can change; fail closed on unsupported scope.

**Blocked by:** 115, 116, 117, 118, 119.

**Status:** blocked

**Suggested skills:** research-primary-sources → code-architecture-review → code-tdd

- [ ] Every annual/time-varying Italy dataset has owner, latest supported version and checked date.
- [ ] Expired review condition fails or blocks affected current-year claims.
- [ ] Static historical tools are not forced to query live networks.

**Verification:** Synthetic stale snapshot sabotage and current source-index report.
