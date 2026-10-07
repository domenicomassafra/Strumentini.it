# 314 — Image resize functional upgrade

**What to build:** Upgrade current resize with width/height, aspect lock, percent, contain/cover, no-upscale, output-format choice and live dimension estimate without changing certification status by fiat.

**Traces to:** US-EXP-04

**Constraints:** C-EXP-01, C-EXP-04, C-EXP-05, C-EXP-09; extend existing shared engines/workspaces and avoid duplicate public routes for mere modes.

**Blocked by:** 97, 103.

**Status:** completed

**Suggested skills:** interaction-design → code-tdd → qa-browser

- [x] All modes produce verified dimensions.
- [x] Contain/cover/crop semantics are previewed and distinct.
- [x] Physical Gold blockers remain governed by tickets 277–279.

**Verification:** Pixel-dimension corpus, mobile UI and existing image-resize certification regression.

**Evidence (2026-10-06):** The resize policy now covers manual width/height, percent scaling, aspect-lock math and no-upscale geometry while preserving contain versus cover/crop behavior. `tests/image-resize-engine.test.ts` plus the physical-receipt validator pass 11/11 and `npx tsc --noEmit` passes. Real-route ticket-314 browser receipts pass in Chrome and Edge at `quality/receipts/image-resize/upgrade-314-{chrome,edge}.json`: both independently decode downloaded output for 800×800 cover/crop, 50% → 800×600 contain, and 125% with no-upscale → 1600×1200, and verify aspect lock, live estimates, format choice and 390px usability. The canonical image-resize certification remains `PARTIAL`/`goldEligible=false`; tickets 277 and 278 still lack physical device receipts and ticket 279 therefore remains blocked.
