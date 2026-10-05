# 17 — Connection/device information tool

**What to build:** Add one support-oriented page for browser, OS/user-agent, locale, screen, viewport, DPR, orientation, touch capability, and breakpoint information locally, with public-IP lookup as a separately labelled explicit network action.

**Traces to:** US-EXP-02, US-EXP-05, US-EXP-09; AC-02.1, AC-07.2; DEC-EXP-02; C-EXP-03, C-EXP-05

**Constraints:** Local device information must work without the public-IP request; copy-all output must not imply fingerprint uniqueness or hidden tracking.

**Blocked by:** 01.

**Status:** blocked

- [ ] Local facts render without network dependency.
- [ ] Public-IP action explains that a network service is contacted before execution.
- [ ] Copy-all produces a support-friendly, privacy-bounded summary.

**Verification:** Browser tests for local facts, network interception proving no implicit IP call, and mocked public-IP success/failure states.

