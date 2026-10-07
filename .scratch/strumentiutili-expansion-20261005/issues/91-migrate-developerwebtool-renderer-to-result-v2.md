# 91 — Migrate DeveloperWebTool renderer to Result v2

**What to build:** Migrate shared developer-web output to validator/text-code/reference classes with precise parser locations, bounded previews, copy/download and optional raw representation.

**Traces to:** US-EXP-01, US-EXP-05; AC-01.1, AC-05.1

**Constraints:** C-EXP-01, C-EXP-04, C-EXP-09; raw structure is secondary unless it is the requested output.

**Blocked by:** 77, 81, 82.

**Status:** completed

**Suggested skills:** code-module-design → code-typescript → code-tdd → qa-browser

- [x] All DeveloperWebTool-owned ids declare semantic classes.
- [x] Parser/validator failures expose exact evidence when available.
- [x] Large output uses bounded preview with complete download.

**Verification:** Developer-web Gold plus malformed and huge-output browser fixtures.

**Evidence:** the generated inventory reports all 20 owner-91 ids declared. `gold:developer-web` passes all 20 exact vectors with standards fixtures and browser evidence; `acceptance:developer-web` passes all 20 routes with keyboard/mobile/locality/lazy-load coverage. The shared renderer keeps bounded previews with complete artifacts, and `result-v2:legacy-zero` remains 0.
