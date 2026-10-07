# 80 — Reference and network provenance state primitive

**What to build:** Create the shared result primitive for authoritative/reference-network jobs: source identity, retrieval/checked time, local-vs-network boundary, stale/unavailable state and formal-vs-remote validation distinction.

**Traces to:** US-EXP-07, US-EXP-09; AC-07.2; DEC-EXP-02

**Constraints:** C-EXP-03, C-EXP-05, C-EXP-06; never present local checksum as remote verification.

**Blocked by:** 72, 74.

**Status:** completed

**Suggested skills:** interaction-design → inclusive-design → research-primary-sources → code-tdd

- [x] Local validity, remote valid/invalid, unavailable and stale are distinct.
- [x] Authority and timestamp are visible in result detail.
- [x] Network denial cannot rewrite a local result into a remote claim.

**Verification:** Offline/reference-network fixtures for every state.

**Evidence:** tests/reference-result.test.ts proves local-valid, remote valid/invalid, stale and unavailable states with authority/timestamps and no promotion of local evidence into remote claims.
