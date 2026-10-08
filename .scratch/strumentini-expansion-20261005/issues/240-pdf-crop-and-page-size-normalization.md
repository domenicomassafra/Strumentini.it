# 240 — PDF crop and page-size normalization

**What to build:** Add visual crop boxes and page-size normalization with explicit media/crop box semantics, presets/custom size and per-page/range application.

**Traces to:** US-EXP-04; AC-04.1, AC-04.2

**Constraints:** C-EXP-01, C-EXP-04, C-EXP-05, C-EXP-08; local-first, explicit fidelity limits, verified output, lazy heavy dependencies.

**Blocked by:** 215, 269.

**Status:** completed

**Suggested skills:** pdf → interaction-design → code-tdd → qa-browser

- [x] Crop updates only the visible `/CropBox`, keeps the `/MediaBox` unchanged and leaves every source `/Contents` byte-identical; no destructive redaction is offered.
- [x] Page-size transformation explicitly offers contain/scale uniformly/center or no-scale/center (refuses too-small destination), with an explicit clip to the *previously visible* CropBox.
- [x] Mixed geometry and independently rendered PDF output are checked (including 90-degree CropBox source, reparse, source/output downloaded images and untouched page).

**Verification:** Mixed-size PDF corpus and box/geometry/render fixtures.

**2026-10-09 bounded #240 completion (NOT Gold):** Implemented `src/engines/pdf/crop-normalize.ts` and the local `/tools/pdf-crop-normalize/` route with bounded PDF.js four-thumbnail preview. Crop insets (left/top/right/bottom) are measured in displayed PDF points relative to the already visible CropBox, respecting source Rotate 0/90/180/270 and existing nonzero CropBox origins. The operation modifies only `/CropBox` and **hides, never deletes or redacts** underlying content; media box and original source streams remain unchanged. Normalization supports A4/Letter portrait/landscape and 100–2000pt custom dimensions; uniform `contain` scaling into target with deterministic centering or explicit scale=1 `center` only if entire source fits, else fail closed. Selected normalized pages become MediaBox=CropBox=[0,0,target width,target height], Rotate=0; prepend/append separate `q`/transformation `/CropBox re W n` clipping/`Q` streams before/after all original page streams, so pre-existing hidden content remains hidden and no original bytes are mutated. Out-of-range, reversed, duplicate selections, impossible crop and unsupported UserUnit/geometry fail closed. Strict reparse checks selected/unselected MediaBox/CropBox/Rotate/page count, original `/Contents` byte parity, and document signature. Browser/UI warns crop is **NOT PRIVACY REDACTION**.

**Proof:** `npx vitest run tests/pdf-crop-normalize-240.test.ts --maxWorkers 1 --no-file-parallelism --reporter dot` 10/10 PASS on mixed MediaBox/CropBox/Rotate including 90/180/270 and negative cases; `astro check` 0 errors/0 warnings; static site build 284 pages. Desktop Chromium 390×844 acceptance `npx tsx tests/pdf-crop-normalize-240.browser.ts` PASS with actual downloaded output PDFs, reopened/reparsed, independently rendered via existing PDF.js PDF-to-PNG tool, measured using Sharp. On source rotated page 2 with nonzero CropBox, visual crop produced result display 350×250 and expected visible rectangle source comparison mean pixel delta 1.5975/255; full source/result unselected page 1 had 0 different channels; normalize 500×600 centered and upright had **0 differing pixel channels** when independently extracting its 390×280 original picture at offset (55,160). Original content streams byte-identical, no offsite requests. Evidence images `/tmp/str240-crop-page2.png` and `/tmp/str240-normalize-page2.png`. Catalog route added with oracle `cand-264`, 264 tools and existing 257 Gold unchanged. **Feature AC complete, release oracle still IMPLEMENTED_UNVERIFIED**: no Gold receipt, physical device/other browser validation or arbitrary complex PDF fidelity certification. No changes to #68/#266.
