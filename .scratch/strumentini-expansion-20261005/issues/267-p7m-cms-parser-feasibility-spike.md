# 267 — P7M CMS parser feasibility spike

**What to build:** Choose or refuse a maintained local CMS/P7M parser by testing license, browser bundle, envelope coverage, certificate metadata, payload extraction, memory and mobile behavior.

**Traces to:** US-EXP-06, US-EXP-07, US-EXP-09; AC-06.1

**Constraints:** C-EXP-02, C-EXP-05, C-EXP-08; feasibility evidence only, no production route in this ticket.

**Blocked by:** None — ticket 100 is completed.

**Status:** completed

**Suggested skills:** research-primary-sources → security-audit → browser-performance-benchmark → qa-browser

- [x] Decision is IMPLEMENT or REFUSE with named version/license.
- [x] Valid/corrupt/unsupported real fixtures are exercised.
- [x] No trust-chain validity feature is promised unless independently proven.

**Verification:** Reproducible dependency benchmark and fixture report.

**Evidence (2026-10-06):** decision is **REFUSE production promotion**. The isolated spike evaluates `pkijs@3.4.1` (BSD-3-Clause) with `asn1js@3.0.10`; a real DER CMS SignedData fixture generated locally with OpenSSL, a deterministic truncation and a valid non-SignedData CMS envelope are exercised in Chrome, Edge, Chromium, Firefox and WebKit with zero external requests. The path extracts the embedded payload and certificate subject, rejects corrupt/unsupported input, measures ~81.6 KB gzip lazy bundle, and records `trustChainStatus: NOT_EVALUATED`. Physical mobile/full-memory proof is absent, so the parser remains unpromoted rather than being presented as a certificate-validity oracle. See `quality/benchmarks/heavy-local-feasibility/ticket-decisions-267-275.json` and `research/lanes/12-heavy-feasibility-ticket-decisions-267-275.md`.
