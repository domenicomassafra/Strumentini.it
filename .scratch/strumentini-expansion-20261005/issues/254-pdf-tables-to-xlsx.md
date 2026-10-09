# 254 — PDF tables to XLSX

**What to build:** Detect/select real table regions and export previewed grids to XLSX sheets; never market arbitrary visual pages as Excel reconstruction.

**Traces to:** US-EXP-04, US-EXP-10; AC-04.1

**Constraints:** C-EXP-01, C-EXP-04, C-EXP-05, C-EXP-08; local-first, explicit fidelity limits, verified output, lazy heavy dependencies.

**Blocked by:** 161, 220, 269.

**Status:** completed

**Suggested skills:** pdf → code-module-design → code-tdd → qa-browser

- [x] User sees extracted grid before export.
- [x] Page/table provenance is preserved per sheet/table.
- [x] Non-tabular/ambiguous content is refused or requires selection.

**Verification:** Ruled/unruled/ambiguous table corpus and independent XLSX reopen.

**Worker-1 bounded completion (2026-10-09, candidate `cand-268`, no Gold):** Implemented new isolated `src/engines/pdf/pdf-table-xlsx-254.ts`, `PdfTableXlsx254Tool.tsx`, standalone `/tools/pdf-tables-to-xlsx/` route, manifest/module and own unit/browser tests. This is a **strictly bounded** usable subset, not OCR or reconstruction of arbitrary PDF tables. The user explicitly chooses one page and a page-coordinate rectangle, sees PDF.js thumbnail with selection outline, then a cell-for-cell table preview **before** XLSX export. PDF.js `getOperatorList` must establish a complete rectilinear **stroked** grid (minimum 2x2, all full horizontal/vertical boundaries); `getTextContent` must independently place a single non-rotated text item in every cell without crossing borders. Unruled, incomplete grid/ambiguous, empty or multi-fragment cells, scanned/image-only, rotated or non-tabular content is rejected clearly; no guessed OCR success. Deliberate bounds: PDF ≤8 MiB/12 pages, one selected grid ≤12 columns/120 rows/1440 cells, ≤5000 text items/512 ruling segments, workbook ≤2 MiB. Only text-valued XLSX cells (never formulas, dates or inferred numerics), preserving leading zeros. The sheet `Pnn_Griglia` embeds the original filename, source-PDF SHA256, one-based page, exact selection rectangle in points and extraction method; provenance and every grid cell are independently reopened by `read-excel-file` after writing with `write-excel-file`, failing closed on mismatch. `ItalianToolPage` used only after prime registers the candidate in the generated catalog; until then standalone fallback is `noindex`; no shared generated/catalog/oracle/dashboard files touched.

**Verification:** `npx vitest run tests/pdf-table-xlsx-254.test.ts` checks ruled 3x3 grid, real XLSX reopen with complete file/page/region/hash and cell parity (e.g. `00127`, `00009`, literal `=2+2` and `+testo`), no formula nodes in OOXML, and explicit refusal of unruled/prose/broken-grid/invalid region/wrong page. Browser `PDF254_DEV_BASE=http://127.0.0.1:18554 npx tsx scripts/acceptance-pdf-table-xlsx-254.ts` **PASS** in Chromium 390×844 with one temporarily configured Vite server (needed only because this worker main has stale generated catalog for preexisting `pdf-n-up`): actual source-PDF PDF.js thumbnail and orange rectangle; table 3x3 visible before export; actual XLSX 3022 bytes downloaded and reopened by independent reader, exact 3x3 values and embedded source SHA/page/region/filename; leading zeros and `=2+2` literal preserved; changing to an unruled source triggers `NOT_A_RULED_TABLE` and removes stale download; zero offsite requests/browser errors. Unit tests PASS. `npx astro build` is blocked **solely** by preexisting `/tools/pdf-n-up` / `ItalianToolPage` stale generated catalog in this worktree, not the #254 route; prime owns catalog generation. No build/GOLD/production claim. This completes the three **stated scoped AC** only; excludes image-heavy PDF, handwritten/scanned OCR, tables without complete strokes, merged/multiline cells, full automatic multiple-table discovery and rich spreadsheet data typing.
