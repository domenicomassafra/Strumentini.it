# 22 — Password/passphrase/security family

**What to build:** Add local password, Italian passphrase and PIN generation plus password-strength estimation using cryptographically secure randomness and an explainable estimator.

**Traces to:** US-EXP-05, US-EXP-09; AC-09.1; DEC-EXP-02; C-EXP-05, C-EXP-07

**Constraints:** Use Web Crypto randomness; never upload generated secrets; strength labels must not promise resistance or reuse breached-password data without an explicit network mode.

**Blocked by:** 159, 160.

**Status:** completed

- [x] Ticket 159 uses WebCrypto-backed rejection sampling for bounded password/PIN/passphrase selection rather than modulo-biased sampling.
- [x] The Italian passphrase mode exposes the bundled word-list identity/version/provenance instead of treating its vocabulary as implicit.
- [x] Ticket 160 reports deterministic length/pattern observations and explicit estimator limitations without breach-database or absolute-security claims.
- [x] Secrets remain local component/runtime state; the routes do not serialize generated values into URL/history/telemetry, and browser controls expose copy/reveal without adding persistence.

**Verification:** `tests/password-security-tools.test.ts` passes the generator/estimator vectors and property constraints; the tool manifests remain LOCAL/network-forbidden and focused browser/privacy checks in the lane cover clipboard/zero-network behavior.
