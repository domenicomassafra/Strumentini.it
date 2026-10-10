# 306 — Video to GIF conversion

**What to build:** Add bounded video→GIF only if the approved media stack proves timing/color/memory quality, exposing fps, size, scale and duration ceiling.

**Traces to:** US-EXP-06

**Constraints:** C-EXP-01, C-EXP-04, C-EXP-05, C-EXP-09; extend existing shared engines/workspaces and avoid duplicate public routes for mere modes.

**Blocked by:** 234 — Video transform worker core.

**Status:** ready-for-agent

**Suggested skills:** code-module-design → code-tdd → qa-browser → browser-performance-benchmark

- [ ] Output animation duration/frame timing matches declared tolerance.
- [ ] Large/long input is rejected before OOM risk.
- [ ] GIF signature/animation and final bytes are verified.

**Verification:** Short video corpus, timing/frame count and mobile/perf checks.
