# 221 — PDF structural text and visual comparison

**What to build:** Extend current compare into separately reported page alignment, structure, text and bounded rendered visual overlay/diff, degrading explicitly when a layer is unavailable.

**Traces to:** US-EXP-01, US-EXP-04; AC-04.2

**Constraints:** C-EXP-01, C-EXP-04, C-EXP-05, C-EXP-08; local-first, bounded memory, verified output, lazy heavy dependencies.

**Blocked by:** 215, 220.

**Status:** blocked

**Suggested skills:** pdf → code-tdd → qa-browser

- [ ] Added/removed/reordered pages are distinct from content changes.
- [ ] Text-only evidence cannot produce a full visual-equality claim.
- [ ] Unrenderable pages yield partial comparison state.

**Verification:** Known page insertion/reorder/text/image changes and rendered visual review.
