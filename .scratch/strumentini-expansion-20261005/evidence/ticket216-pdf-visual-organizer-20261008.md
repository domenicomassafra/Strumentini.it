# Ticket 216 — visual PDF organizer proof (2026-10-08)

## Supported scope

- `PdfVisualOrder` adds page-identity-preserving up/down buttons, drag-to-order and undo to the original reorder tool, without changing the existing mutation engine.
- `PdfThumbnailPicker` from ticket 215 supports per-page rotation selection with actual rotated thumbnail previews (PDF mutations remain on the original `pdf-rotate` route).
- `PdfMergeOrganizer` exposes each source PDF with original filename, byte count and independently inspected page count; keyboard/touch/drag can reorder entire sources and undo. Users can inspect up to four thumbnails at a time per selected source.
- The existing `pdf-merge` implementation now checks that the independently parsed merged output page count matches the sum of original source page counts. Output size is measured from actual bytes. Wrong/corrupt inputs fail closed. Fine-grained cross-file page slicing is not claimed: the merge route reorders whole source files, while the reorder tool handles individual pages.

## Reproducible verification

- `tests/pdf-page-order-controls.test.ts`: stable page identity, arbitrary reordering, bounds, duplicates/missing pages refusal.
- `tests/pdf-visual-merge.test.ts`: two source PDFs with different lengths, exact file-order/source byte inventory, actual merged text order and independently reopened page count; corrupt input refusal.
- `npm run acceptance:pdf-thumbnails`: Chromium, Firefox and WebKit **36/36 PASS**, with 200-page bounded preview, keyboard and drag order, undo, per-page rotation, mixed source counts, output PDF downloaded/reopened and verified for FIRST→SECOND→THIRD text ordering, native 390px viewport.
- This is code/browser acceptance, not the source-bound production Gold/browser/rollback receipt. No physical iOS/Android evidence or deployment authorization is inferred.
