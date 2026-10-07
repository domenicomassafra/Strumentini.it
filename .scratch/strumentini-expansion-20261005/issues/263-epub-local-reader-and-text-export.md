# 263 — EPUB local reader and text export

**What to build:** Implement local EPUB structure/read/text export only if feasibility approves parser/security/mobile cost, sanitizing HTML/CSS and blocking external active content.

**Traces to:** US-EXP-04, US-EXP-09

**Constraints:** C-EXP-01, C-EXP-04, C-EXP-05, C-EXP-08; local-first, explicit fidelity limits, verified output, lazy heavy dependencies.

**Blocked by:** 103, 275.

**Status:** completed

**Suggested skills:** security-audit → code-module-design → code-tdd → qa-browser

- [x] **REFUSED for production implementation:** ticket 275 independently refuses EPUB because no approved parser with proven spine/navigation fidelity, sanitization and mobile/resource cost is installed.
- [x] The hostile EPUB feasibility fixture contains script and remote-resource references and is rejected before render/resource resolution with zero external requests in the browser matrix.
- [x] No lossy text export is offered without a parser that can first prove spine order and declare structure/image/style loss truthfully.

**Verification:** Closed as a refusal downstream of ticket 275. Reopen only after the parser/security/mobile promotion gate is satisfied.
