# 177 — X509 and CSR local inspector

**What to build:** Parse bounded PEM/DER X.509 certificates and CSRs locally into subject/issuer/SAN/validity/key/signature/fingerprint facts without online trust/revocation claims.

**Traces to:** US-EXP-05, US-EXP-09

**Constraints:** C-EXP-01, C-EXP-04, C-EXP-05; deterministic/local by default; extend existing engines/routes where the job is already present.

**Blocked by:** 91 — Migrate DeveloperWebTool renderer to Result v2.

**Status:** completed

**Suggested skills:** security-audit → code-typescript → code-module-design → code-tdd

- [x] Malformed/encrypted/unsupported inputs fail explicitly.
- [x] Certificate extension content is parsed as data, never executed.
- [x] Trust/revocation status is never inferred from inspection.

**Verification:** Certificate/CSR fixture corpus and independent fingerprint checks.

**Evidence (2026-10-06):** `quality/fixtures/x509-csr-rfc/` contains synthetic certificate and CSR fixtures in PEM and DER; `tests/vcf-x509-tools.test.ts` checks subject/SAN/key facts, explicit malformed/encrypted/unsupported failures, null CSR issuer/validity, and recomputes the certificate SHA-256 fingerprint independently with Node crypto. The parser bounds bytes/depth/nodes and the UI states that chain trust, revocation, hostname and private-key possession are not verified.
