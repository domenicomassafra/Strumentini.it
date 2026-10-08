# 237 — True PDF redaction with post-export proof

**What to build:** Add page-region redaction only when underlying content can be proven removed/inactivated; covering rectangles alone never count, and unsupported cases must refuse.

**Traces to:** US-EXP-04, US-EXP-09; AC-04.2

**Constraints:** C-EXP-01, C-EXP-04, C-EXP-05, C-EXP-08; local-first, bounded memory, verified output, lazy heavy dependencies.

**Blocked by:** 215, 269.

**Status:** ready-for-agent

**Suggested skills:** pdf → security-audit → code-tdd → qa-browser

- [ ] Post-export text/image/object inspection proves supported redacted content absent.
- [ ] Visual result matches selected regions.
- [ ] Unsupported content model returns refusal/warning, never fake success.

**Verification:** Recoverability adversarial corpus, post-redaction extraction and rendered review.
