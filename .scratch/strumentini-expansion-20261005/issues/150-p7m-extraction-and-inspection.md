# 150 — P7M extraction and inspection

**What to build:** Add local P7M/CMS envelope inspection and payload extraction only where the selected library proves support; expose signer/certificate metadata without claiming online trust-chain validity.

**Traces to:** US-EXP-07, US-EXP-09; AC-09.1

**Constraints:** C-EXP-01, C-EXP-03, C-EXP-06; official/versioned inputs where rules can change; fail closed on unsupported scope.

**Blocked by:** 100, 103, 267.

**Status:** completed

**Suggested skills:** security-audit → code-module-design → code-tdd

- [x] **REFUSED for production implementation:** ticket 267 proved byte-identical payload extraction and certificate-subject inspection in the isolated `pkijs@3.4.1` / `asn1js@3.0.10` spike, but explicitly refused production promotion because physical-mobile/full-memory evidence is absent.
- [x] The spike exercises valid SignedData, deterministic corrupt input and a valid unsupported non-SignedData envelope with explicit failure behavior; no production route is exposed while the feasibility gate is REFUSE.
- [x] Spike evidence records `trustChainStatus: NOT_EVALUATED`; no certificate trust/revocation claim is promoted.

**Verification:** Closed as a refusal downstream of ticket 267. Evidence remains in `quality/benchmarks/heavy-local-feasibility/ticket-decisions-267-275.json` and `research/lanes/12-heavy-feasibility-ticket-decisions-267-275.md`; reopen only after the missing physical-mobile/full-memory promotion evidence exists.
