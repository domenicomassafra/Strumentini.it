# 209 — Safe SVG optimizer and preview

**What to build:** Add parser-backed SVG optimization with safe preset, multipass/precision, raw+gzip delta, markup diff and render preview, explicitly treating scripts/external references as a security boundary.

**Traces to:** US-EXP-04, US-EXP-05, US-EXP-09; AC-04.2, AC-05.1

**Constraints:** C-EXP-01, C-EXP-04, C-EXP-05, C-EXP-08; local-first, bounded memory, verified output, lazy heavy dependencies.

**Blocked by:** 103, 268.

**Status:** completed

**Suggested skills:** security-audit → code-module-design → code-tdd → qa-browser

- [x] **REFUSED for production implementation:** ticket 268 records `svgOptimization=REFUSE_NO_BROWSER_NATIVE_OPTIMIZER`; no optimizer is shipped merely to satisfy the format matrix.
- [x] No SVG optimizer preview executes or resolves script/external content while the optimizer capability is refused.
- [x] No aggressive transform is exposed or implied without an approved parser/optimizer and semantic/render corpus.

**Verification:** Closed as a refusal downstream of ticket 268. Reopen only after an approved SVG optimizer passes semantic/render and hostile-reference acceptance.
