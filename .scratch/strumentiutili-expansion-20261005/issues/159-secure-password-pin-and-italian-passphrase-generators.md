# 159 — Secure password PIN and Italian passphrase generators

**What to build:** Create one cryptographically secure RNG seam for password, PIN and Italian passphrase modes using WebCrypto, unbiased selection and a versioned/provenanced word list.

**Traces to:** US-EXP-05, US-EXP-09; AC-09.1

**Constraints:** C-EXP-01, C-EXP-04, C-EXP-05; deterministic/local by default; extend existing engines/routes where the job is already present.

**Blocked by:** 70 — Result declaration in Tool Manifest.

**Status:** completed

**Suggested skills:** code-typescript → code-module-design → security-audit → code-tdd → inclusive-design

- [x] Character/length/word constraints are honored without modulo bias.
- [x] Secrets never persist in URL/history/telemetry.
- [x] Passphrase wordlist version/provenance is visible.

**Verification:** Property tests for output constraints/distribution seam plus zero-network/clipboard browser checks.

**Evidence (2026-10-06):** `tests/password-security-tools.test.ts` forces the uint32 rejection tail through the injectable RNG seam and exercises password/PIN/passphrase constraints repeatedly. `npm run acceptance:password-security` passes in headless Chrome against the built route, proving explicit clipboard-only copy, zero external requests, unchanged URL/history/localStorage/sessionStorage, no generated secret in request transport, and visible wordlist id/version/provenance. The manifest carries `deterministic: false`; the shared Italian tool page now exposes that contract without claiming random output is deterministic.
