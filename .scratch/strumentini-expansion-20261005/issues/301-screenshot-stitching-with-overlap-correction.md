# 301 — Screenshot stitching with overlap correction

**What to build:** Add local vertical/horizontal screenshot stitching with automatic overlap suggestion plus manual correction/fallback when overlap is ambiguous.

**Traces to:** US-EXP-04

**Constraints:** C-EXP-01, C-EXP-04, C-EXP-05, C-EXP-09; extend existing shared engines/workspaces and avoid duplicate public routes for mere modes.

**Blocked by:** 213 — Direct-manipulation image transform workspace.

**Status:** completed

**Suggested skills:** code-module-design → interaction-design → code-tdd → qa-browser

- [x] Automatic overlap shows confidence/preview and never silently discards content.
- [x] Manual offset/crop correction is available.
- [x] Export pixel dimensions/content order are verified.

**Verification:** Known-overlap, no-overlap and ambiguous fixtures with mobile touch QA.

**Evidence (2026-10-07):** The canonical screenshot-helper route exposes a bounded overlap suggestion that reports best confidence, runner-up confidence, margin and an overlay preview; the suggestion is never applied automatically. Scores below 0.92 or margins below 0.02 are flagged ambiguous, while the UI always offers manual overlap, cross-axis offset and an explicit 0px no-crop fallback. `stitchScreenshotsLocal` preserves the first image whole, removes exactly the user-confirmed leading overlap from the second image and records output dimensions/order/crop policy. Pure tests prove both known-overlap and repeated-pattern ambiguity. `scripts/acceptance-image-advanced-workspace.mjs` proves suggestion preview, manual application, zero-overlap fallback, verified output order/dimensions, 390px layout and local-only task traffic.
