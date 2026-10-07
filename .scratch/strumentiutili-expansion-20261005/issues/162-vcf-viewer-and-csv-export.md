# 162 — VCF viewer and CSV export

**What to build:** Add local vCard/VCF inspection with explicit field mapping and CSV export, preserving folded lines and multiple phones/emails without inventing contact fields.

**Traces to:** US-EXP-04; AC-04.1

**Constraints:** C-EXP-01, C-EXP-04, C-EXP-05; deterministic/local by default; extend existing engines/routes where the job is already present.

**Blocked by:** 70 — Result declaration in Tool Manifest.

**Status:** completed

**Suggested skills:** code-typescript → security-audit → code-tdd → inclusive-design

- [x] Multiple values remain separate and traceable to source contact.
- [x] Unsupported properties remain visible as unsupported/raw rather than dropped silently.
- [x] CSV export protects against formula injection.

**Verification:** vCard corpus including folds/Unicode/multiple values and CSV-injection cases.

**Evidence (2026-10-06):** `quality/fixtures/vcard-rfc6350/vectors.json` and `tests/vcf-x509-tools.test.ts` cover CRLF folding, Unicode, repeated TEL/EMAIL values, raw unsupported `X-*` properties and a formula-like `FN`; the generated CSV prefixes formula sigils before RFC-style quoting. Gold oracle `cand-226` is backed by RFC 6350 and the synthetic fixture corpus.
