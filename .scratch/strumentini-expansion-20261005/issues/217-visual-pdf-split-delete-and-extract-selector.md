# 217 — Visual PDF split delete and extract selector

**What to build:** Add thumbnail multi-select plus one shared range parser for every page, every N, ranges, custom groups and selected pages, with ZIP multi-output where applicable.

**Traces to:** US-EXP-01, US-EXP-04; AC-04.1

**Constraints:** C-EXP-01, C-EXP-04, C-EXP-05, C-EXP-08; local-first, bounded memory, verified output, lazy heavy dependencies.

**Blocked by:** 215, 222.

**Status:** completed (strict shared grammar, bounded visual selection and independently verified multi-PDF ZIP)

**Suggested skills:** pdf → interaction-design → code-tdd → qa-browser

- [x] Text range and thumbnail selection resolve to the same page identities.
- [x] Invalid ranges report exact offending token.
- [x] Output grouping/names are previewed and ZIP integrity verified.

**Verification:** Range properties, page hashes, ZIP checks and 390px keyboard QA.

**Implementation (2026-10-08):** `src/engines/pdf/page-selection.ts` provides the strict, bounded and runtime-consumed syntax for `tutte`/`*`, individual pages and ranges, `ogni:N` (N, 2N, … page extraction), `blocchi:N` (consecutive groups of N pages) and semicolon-separated custom output groups. Invalid, repeated, out-of-range, empty or oversized expressions report the offending token, never silently discard it. The shared ticket-215 `PdfThumbnailPicker` is reused in `PdfTool` for multi-select, explicit active split-group edits, keyboard toggles, inversion in extraction/deletion, 390px layout, and visible group/output count and suffix/ZIP preview. The unchanged authoritative local PDF mutation engine receives normalized, validated numbers. Split output PDFs are individually reopened to verify page counts. When 2+ PDF parts exist, ZIP generation is followed by central-directory validation **and full archive decompression with exact byte comparisons** of every output PDF; filenames and exported grouping are deterministic. Extract/delete results are also reopened with a checked page count; deleting the last page still fails closed. Tests: `tests/pdf-page-selection{,-operations}.test.ts` plus existing PDF suite, real downloaded PDF/ZIP browser acceptance in Chromium/Firefox/WebKit. These tests do not stand in for physical iOS/Android device receipts or authorize production release.
