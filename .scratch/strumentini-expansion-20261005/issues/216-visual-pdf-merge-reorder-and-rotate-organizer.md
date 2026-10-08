# 216 — Visual PDF merge reorder and rotate organizer

**What to build:** Use shared thumbnails for mixed-file merge, page reorder and per-page rotation with multi-select, undo and keyboard/touch alternatives while delegating mutation to the verified PDF core.

**Traces to:** US-EXP-01, US-EXP-04; AC-04.1

**Constraints:** C-EXP-01, C-EXP-04, C-EXP-05, C-EXP-08; local-first, bounded memory, verified output, lazy heavy dependencies.

**Blocked by:** 215 — Bounded lazy PDF page-thumbnail renderer.

**Status:** completed (bounded visual preview and existing verified PDF core; production/physical device promotion separately gated)

**Suggested skills:** pdf → interaction-design → code-tdd → qa-browser

- [x] Page identity/order survives drag and keyboard movement.
- [x] Source file/page counts remain visible in mixed merge.
- [x] Final order/pages/bytes are verified and summarized.

**Verification:** Page-hash/order fixtures, visual render review and mobile/keyboard QA.

**Implementation proof (2026-10-08):** `PdfVisualOrder` provides touch/keyboard up/down controls, drag-to-move, stable page identities and bounded undo history, feeding the existing PDF reorder engine without bypassing its full-permutation validation. Per-page rotation remains on the original PDF mutation route, using ticket 215 shared lazy thumbnails and selected-page state. `PdfMergeOrganizer` displays each selected source file's local inspected page count/bytes, makes whole-file order movable by keyboard/touch/drag with undo, and shows a bounded preview of the selected source only on request. The authoritative merge module now records per-source filename/page count/bytes, compares summed source page counts to independently parsed output, and exposes the final output byte count; invalid/encrypted files fail closed. Dedicated unit regressions cover page identity, order and actual downloaded merged text/page order; Chromium/Firefox/WebKit browser tests exercise 200-page previews, file/page keyboard moves, undo, drag and actual downloaded merged PDFs: `npm run acceptance:pdf-thumbnails` **36/36 PASS**. Source page manipulation across multiple PDFs remains file-granular in the merge route; per-page arbitrary reorder is handled in the existing reorder route, not marketed as in-merge page slicing. Physical mobile release evidence is NOT inferred from 390px desktop browser acceptance.
