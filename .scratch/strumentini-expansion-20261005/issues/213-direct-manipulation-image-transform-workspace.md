# 213 — Direct-manipulation image transform workspace

**What to build:** Build one preview/export seam for rotate/flip, crop/round crop, border/background and basic tonal controls, reusing the existing image engine and file workspace.

**Traces to:** US-EXP-04; AC-04.1, AC-04.2

**Constraints:** C-EXP-01, C-EXP-04, C-EXP-05, C-EXP-08; local-first, bounded memory, verified output, lazy heavy dependencies.

**Blocked by:** 78, 97.

**Status:** completed

**Suggested skills:** code-module-design → interaction-design → code-tdd → qa-browser

- [x] The canonical `/tools/image-crop/` route now exposes number/select/checkbox/range controls usable by pointer/touch and keyboard; preview calls the same `applyImageTransformPixels` pipeline used by `transformImageLocal` export.
- [x] Round-crop alpha preservation versus explicit color-background flattening is visible in the UI and returned export metadata; PNG is used so transparency remains truthful.
- [x] Undo/reset use the bounded transform-history primitive deterministically, and the feature replaces the existing crop UI instead of creating a second file workspace/route.

**Verification:** `tests/image-transform-workspace.test.ts` covers exact pipeline mutation, alpha/background policy and undo/reset. The route uses native form controls for pointer/touch/keyboard and the shared verified Image Result v2 export seam; final integration browser QA covers the 390px route after catalog/build stabilization.
