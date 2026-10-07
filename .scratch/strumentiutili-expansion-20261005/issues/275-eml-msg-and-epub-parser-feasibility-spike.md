# 275 — EML MSG and EPUB parser feasibility spike

**What to build:** Decide local EML, MSG and EPUB parser paths separately using version/license, format coverage, active-content security, bundle/runtime/mobile evidence before ticket 24 exposes those jobs.

**Traces to:** US-EXP-04, US-EXP-06, US-EXP-09

**Constraints:** C-EXP-02, C-EXP-05, C-EXP-08; feasibility evidence only.

**Blocked by:** None — ticket 100 is completed.

**Status:** completed

**Suggested skills:** security-audit → browser-performance-benchmark → qa-browser

- [x] EML, MSG and EPUB each receive independent IMPLEMENT/SPIKE/REFUSE status.
- [x] Remote/active HTML content policy is tested.
- [x] No parser is shipped merely to satisfy a catalog count.

**Verification:** Format corpus, hostile content cases and dependency matrix.

**Evidence (2026-10-06):** decision is **REFUSE** independently for EML, MSG and EPUB: no approved local parser is installed/proven, so no dependency is shipped for catalog count. Synthetic hostile EML and EPUB fixtures contain script plus remote-resource references; the browser spike reads them as inert bytes, detects the active/remote markers before render or resource resolution, and records zero external requests across all five desktop engines. MSG has only a deliberately invalid CFB-signature fixture, so no semantic MSG parsing claim is made. The policy is `REJECT_BEFORE_RENDER_OR_EXTERNAL_RESOURCE_RESOLUTION`.
