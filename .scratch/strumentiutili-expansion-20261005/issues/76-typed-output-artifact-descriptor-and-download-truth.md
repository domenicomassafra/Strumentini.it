# 76 — Typed output artifact descriptor and download truth

**What to build:** Introduce a typed output artifact descriptor carrying name, MIME, byte length, verified signature/type, fidelity/loss note and download metadata so generated files cannot be presented as valid before verification.

**Traces to:** US-EXP-04, US-EXP-05; AC-04.1, AC-05.1

**Constraints:** C-EXP-01, C-EXP-05, C-EXP-08; measured facts only.

**Blocked by:** 70 — Result declaration in Tool Manifest.

**Status:** completed

**Suggested skills:** code-architecture-review → code-typescript → security-audit → code-tdd

- [x] Artifacts expose authoritative bytes and declared/verified type.
- [x] MIME/extension/signature mismatch becomes warning/error.
- [x] Contract supports text, structured, image, PDF and generic file output.

**Verification:** Known-good, mismatch and malformed artifact fixtures.

**Evidence:** tests/output-artifact.test.ts and tests/artifact-verifier.test.ts pass known-good/mismatch/malformed cases with authoritative bytes, MIME/signature verification, fidelity notes and download gating.
