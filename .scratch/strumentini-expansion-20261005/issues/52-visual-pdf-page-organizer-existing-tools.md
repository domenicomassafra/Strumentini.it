# 52 — Visual PDF page organizer for existing page tools

**What to build:** Give merge, split, delete/extract, reorder and rotate PDF one shared thumbnail organizer with drag/drop, selection, range syntax, per-page rotation/removal, undo and explicit output grouping, while keeping the existing local engines as the verified mutation core.

**Traces to:** US-EXP-01, US-EXP-04; AC-01.2, AC-04.1; DEC-EXP-03, DEC-EXP-06; C-EXP-04, C-EXP-05, C-EXP-09

**Constraints:** Thumbnail rendering is lazy/bounded; keyboard operations mirror drag interactions; page mutations remain deterministic and preserve non-target pages.

**Blocked by:** 215, 216, 217.

**Status:** completed (bounded cross-source page composition with safe per-page mutation and browser verification)

- [x] Merge shows all input documents/pages and permits file/page reordering before output.
- [x] Split supports every page, every N pages, ranges, custom groups and selected pages.
- [x] Delete/extract and rotate use thumbnail selection with select-all/invert/range helpers.
- [x] Result reports page counts/order and offers ZIP for multi-output splits/extractions.

**Verification:** Page-order fixture corpus, keyboard/mobile drag-selection acceptance, output page hash/order checks, cancellation and memory limits.

**Implementation (2026-10-08):** Tickets 215/216/217 supply bounded (4-page), optional local PDF.js thumbnails, keyboard/touch page selection, page/whole-file order and undo, strict common interval/group parser, audited PDF output and byte-verified multi-PDF split ZIP. This ticket adds `src/engines/pdf/merge-page-plan.ts` (immutable source file/page identities, ≤200 pages, strict single-occurrence/bounds/rotation validation) and `mergePdfsWithPagePlan`, a page-order-aware version of the existing safe local PDF writer that interleaves selected pages across two or more PDFs, optionally rotates each page relative to its existing orientation and omits pages without touching originals. `PdfMergeOrganizer` provides page-level buttons/drag, undo, removal, bounded lazy per-source thumbnail toggling and rotation preview; changing file order remaps identities to the same source object. The runtime independently reparses output for page count and rotations; browser fixtures also reopen the actual download and check `THIRD,FIRST` after interleaving, deleting and 90° rotation. The `pdf-rotate` module now accepts strict `1-3` / `tutte` expressions with inverted selection and confirms exactly which pages changed, while keeping its original `rotations` object API. Split remains the separately verified PDF+ZIP route, while extract/delete are single-output PDF operations (no claim that extraction emits a multi-file ZIP). `npm run acceptance:pdf-thumbnails` exercises **54/54** browser assertions across Chromium/Firefox/WebKit including the 390px viewport; other ticket/browser suites are independent evidence. Real phone acceptance, whole-tree source-bound receipts and public deployment remain separately gated.
