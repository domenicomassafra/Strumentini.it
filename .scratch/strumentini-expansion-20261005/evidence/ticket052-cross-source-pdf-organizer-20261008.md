# STR-052 — cross-file PDF page organizer acceptance, 2026-10-08

## Scope and reproducible evidence

- Source-aware page plan type: `src/engines/pdf/merge-page-plan.ts`. Identity tuple `(fileIndex, one-based page)`, optional additional 0/90/180/270-degree rotation, at most 200 total pages from 2–50 files; invalid, duplicated, stale, forged or empty plans fail closed.
- `src/engines/pdf/index.ts` retains the original `mergePdfs(inputs,signal)` API unchanged while exposing `mergePdfsWithPagePlan` for truly interleaved cross-file order, omission and relative rotations. The original local parsing, capability, output byte/memory limits, metadata-stripping/flattening and writer authority remain intact; no OCR or server route added.
- `src/components/tools/pdf/PdfMergeOrganizer.tsx` shows source file/page provenance and a list of at most 200 page identities. It allows keyboard/drag order, single-page 90-degree rotation (with thumbnail preview), exclusion/readdition from selected-source thumbnails, bounded undo and deliberate reset. Source reorder remaps page identities and invalidates stale page undo snapshots. Heavy thumbnails stay lazy, sequential and four-at-a-time from STR-215.
- `src/tools/pdf-merge/module.ts` checks exact output count and per-page rotations after reopening the PDF. The browser acceptance downloads the final PDF, reopens it, compares per-page text/rotation and verifies whole-file reorder after a custom plan does not change page identity.
- `src/tools/pdf-rotate/module.ts` accepts strict ranges, all, inversion via UI and preserves backwards compatibility with the original per-page `rotations` object; validates final page count and rotations.
- `tests/pdf-merge-page-plan.test.ts`, `tests/pdf-visual-rotation-selection.test.ts`, existing `tests/pdf-visual-merge.test.ts` and `tests/pdf-document-tools.test.ts` cover provenance/order, malformed plans, stable output and real text+rotation.
- `npm run acceptance:pdf-thumbnails`: **54/54 PASS** in Chromium, Firefox, WebKit; real downloaded interleaved PDF with source/page identity, source/file undo, drag, keyboard, thumbnail toggle, exclusion and rotation, plus existing 200-page bounded thumbnail proof.
- STR-217 owns group/range and multi-output split ZIP byte verification. PDF extraction/delete currently produce one PDF per request; their UI and result honesty are verified separately with `npm run acceptance:pdf-page-selection`.
- No production deployment performed; release authority remains fail-closed on genuine source-bound and physical-device gates.
