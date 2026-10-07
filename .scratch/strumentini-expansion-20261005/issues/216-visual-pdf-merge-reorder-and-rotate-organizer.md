# 216 — Visual PDF merge reorder and rotate organizer

**What to build:** Use shared thumbnails for mixed-file merge, page reorder and per-page rotation with multi-select, undo and keyboard/touch alternatives while delegating mutation to the verified PDF core.

**Traces to:** US-EXP-01, US-EXP-04; AC-04.1

**Constraints:** C-EXP-01, C-EXP-04, C-EXP-05, C-EXP-08; local-first, bounded memory, verified output, lazy heavy dependencies.

**Blocked by:** 215 — Bounded lazy PDF page-thumbnail renderer.

**Status:** blocked

**Suggested skills:** pdf → interaction-design → code-tdd → qa-browser

- [ ] Page identity/order survives drag and keyboard movement.
- [ ] Source file/page counts remain visible in mixed merge.
- [ ] Final order/pages/bytes are verified and summarized.

**Verification:** Page-hash/order fixtures, visual render review and mobile/keyboard QA.
