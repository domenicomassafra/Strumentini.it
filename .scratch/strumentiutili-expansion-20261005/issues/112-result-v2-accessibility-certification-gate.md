# 112 — Result-v2 accessibility certification gate

**What to build:** Add a fresh keyboard, focus, accessibility-tree, 200% reflow, reduced-motion and non-color-state evidence gate across representative Result v2 classes.

**Traces to:** US-EXP-01; AC-01.3

**Constraints:** C-EXP-04; test evidence is required before WCAG claims.

**Blocked by:** 73, 81.

**Status:** completed

**Suggested skills:** inclusive-design → qa-browser

- [x] Keyboard path covers actions, retry and any direct-manipulation alternative.
- [x] Announcements/status do not rely on color only.
- [x] 200% zoom and reduced-motion samples remain functional at representative widths.

**Verification:** Observed browser accessibility evidence and deterministic structural assertions.

Evidence (2026-10-06): `npm run acceptance:result-v2-a11y` passes across all 9 Result v2 semantic classes. The browser gate focuses every declared result action, the representative retry action, the PDF page-preview direct control, and both bounded text/table preview alternatives; it captures an ARIA snapshot for every class and requires the visible text/status mark cue. It verifies 200% zoom-equivalent reflow at 390px and 320px plus active reduced-motion behavior. Fresh machine-readable evidence is in `quality/receipts/result-v2/accessibility.json`; `npx tsc --noEmit` and scoped `git diff --check` pass.
