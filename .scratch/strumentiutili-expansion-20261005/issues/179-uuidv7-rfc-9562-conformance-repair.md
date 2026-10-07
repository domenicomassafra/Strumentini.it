# 179 — UUIDv7 RFC 9562 conformance repair

**What to build:** Repair UUIDv7 generation/interpretation to RFC 9562 48-bit Unix-millisecond layout with correct version/variant and cryptographic randomness.

**Traces to:** US-EXP-05; AC-09.1

**Constraints:** C-EXP-01, C-EXP-04, C-EXP-05; deterministic/local by default; extend existing engines/routes where the job is already present.

**Blocked by:** 91 — Migrate DeveloperWebTool renderer to Result v2.

**Status:** completed

**Suggested skills:** research-primary-sources → security-audit → code-typescript → code-tdd

- [x] Version/variant/time bits match RFC layout.
- [x] Timestamp round-trip is millisecond-correct.
- [x] No seeded pseudo-random mode is exposed as secure UUID generation.

**Verification:** Published/derived RFC vectors and property tests.

**Evidence (2026-10-06):** UUIDv7 now writes `Date.now()` directly into the leading 48-bit Unix-millisecond field before applying version 7 and RFC variant bits. `quality/fixtures/uuid-rfc9562/vectors.json` includes the RFC 9562 Appendix A.6 vector `017f22e2-79b0-7cc3-98c4-dc0c0c07398f`; the focused developer test reproduces it and decodes the first 48 bits back to `1645557742000` ms. The public route exposes no seed field, and internal seeded/explicit-byte generation remains labeled `explicit-test-input`; fresh developer browser acceptance and Gold certification pass.
