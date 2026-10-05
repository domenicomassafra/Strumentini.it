# 52 — Visual PDF page organizer for existing page tools

**What to build:** Give merge, split, delete/extract, reorder and rotate PDF one shared thumbnail organizer with drag/drop, selection, range syntax, per-page rotation/removal, undo and explicit output grouping, while keeping the existing local engines as the verified mutation core.

**Traces to:** US-EXP-01, US-EXP-04; AC-01.2, AC-04.1; DEC-EXP-03, DEC-EXP-06; C-EXP-04, C-EXP-05, C-EXP-09

**Constraints:** Thumbnail rendering is lazy/bounded; keyboard operations mirror drag interactions; page mutations remain deterministic and preserve non-target pages.

**Blocked by:** 01, 05.

**Status:** blocked

- [ ] Merge shows all input documents/pages and permits file/page reordering before output.
- [ ] Split supports every page, every N pages, ranges, custom groups and selected pages.
- [ ] Delete/extract and rotate use thumbnail selection with select-all/invert/range helpers.
- [ ] Result reports page counts/order and offers ZIP for multi-output splits/extractions.

**Verification:** Page-order fixture corpus, keyboard/mobile drag-selection acceptance, output page hash/order checks, cancellation and memory limits.

