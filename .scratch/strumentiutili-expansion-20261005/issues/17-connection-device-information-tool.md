# 17 — Connection/device information tool

**What to build:** Add one support-oriented page for browser, OS/user-agent, locale, screen, viewport, DPR, orientation, touch capability, and breakpoint information locally, with public-IP lookup as a separately labelled explicit network action.

**Traces to:** US-EXP-02, US-EXP-05, US-EXP-09; AC-02.1, AC-07.2; DEC-EXP-02; C-EXP-03, C-EXP-05

**Constraints:** Local device information must work without the public-IP request; copy-all output must not imply fingerprint uniqueness or hidden tracking.

**Blocked by:** 81 — Semantic result-class conformance harness.

**Status:** completed

- [x] Local facts render without network dependency.
- [x] Public-IP action explains that a network service is contacted before execution.
- [x] Copy-all produces a support-friendly, privacy-bounded summary.

**Verification:** Browser tests for local facts, network interception proving no implicit IP call, and mocked public-IP success/failure states.

**Evidence (2026-10-06):** `/tools/connection-device-info/` renders browser/User-Agent description, locale, CSS screen/viewport, DPR, orientation, touch capability and the Strumentini breakpoint from browser APIs. `tests/browser-diagnostics.test.ts` covers normalization, breakpoint boundaries, privacy-bounded copy and fail-closed IP parsing. `quality/receipts/browser-diagnostics/acceptance.json` proves the real route renders the live browser values with zero external requests before the IP action, shows the network disclosure before the button, passes mocked public-IP success and failure, and copies a support summary that excludes the IP and explicitly says it is not a unique fingerprint. The 390px route has no horizontal overflow.
