# 190 — Phone link hashtag and mention extractor

**What to build:** Extract conservative typed matches with original source spans, grouped output and CSV/copy while making locale/false-positive limits visible.

**Traces to:** US-EXP-05

**Constraints:** C-EXP-01, C-EXP-04, C-EXP-05; deterministic/local by default; extend existing engines/routes where the job is already present.

**Blocked by:** 92 — Migrate TextWriting and list renderers to Result v2.

**Status:** completed

**Suggested skills:** code-typescript → code-tdd → inclusive-design

- [x] Overlapping matches resolve deterministically.
- [x] Unicode/punctuation source spans remain correct.
- [x] Result provides original substring and normalized form only where rule is explicit.

**Verification:** Adversarial punctuation/Unicode/overlap fixtures.

**Evidence (2026-10-06):** `extractPhoneLinkHashtagMention` returns typed exact source substrings, UTF-16 and code-point spans, explicit normalization and deterministic URL>phone>hashtag>mention overlap priority. Tests cover emoji offsets, URL overlap, email false-mention suppression, punctuation and phone normalization; cand-237 binds `text-expansion`.
