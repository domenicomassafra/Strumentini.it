# 251 — PDF booklet and front-back interleave

**What to build:** Add booklet imposition and front/back interleave as separate page-order operations with explicit duplex/blank-page assumptions and print-order preview.

**Traces to:** US-EXP-04; AC-04.1

**Constraints:** C-EXP-01, C-EXP-04, C-EXP-05, C-EXP-08; local-first, explicit fidelity limits, verified output, lazy heavy dependencies.

**Blocked by:** 215, 250

**Implementation dependencies:** #250 composer reused through its exported API, with no #250 source edits. #215 was an earlier broader dependency and is not used by the bounded standalone implementation.

**Status:** completed

**Suggested skills:** pdf → interaction-design → code-tdd → qa-browser

- [x] Imposition order is shown before export.
- [x] Required blank insertion is explicit.
- [x] Interleave detects unequal/front-back length mismatch and asks for a deterministic policy.

**Verification:** Numbered-page order fixtures for booklet/interleave and rendered verification.

**Worker-1 completion evidence (2026-10-09):** Self-contained `src/engines/pdf/booklet-interleave-251.ts` plans whole-document nested booklet folds in 4-page groups with explicit 4n padding and source-page census; PDF faces are 2-up landscape, front/back sequence 1,2,… and long-edge duplex compensates by rotating every back 180°. Short-edge duplex leaves every face upright. The preview shows every source position including truly blank slots, front/back sheet/face, and print-driver assumptions *before* download. Output uses the public #250 composer without modifying it; explicitly raster JPEG/loses links/text selection, rejects annotations. Interleave accepts separate front/back PDFs, with selectable forward/reverse order and `reject` (default) versus explicit `pad-shorter`; it creates a vector-preserving PDF in the declared order and inserts actual white PDF pages, never auto-assuming missing pages. Interleave rejects PDFs with annotations, links, actions, or forms rather than silently stripping interactive content while cloning. Files are bounded to 25 MiB and 32 logical pages per source. New standalone `/tools/pdf-booklet-interleave/` route + UI/manifest/module, candidate `cand-267`, using `ItalianToolPage` when registered by prime, otherwise noindex stand-alone page; no generated catalog, oracle, dashboard or Gold edits.

**Verified:** `npx vitest run tests/pdf-booklet-interleave-251.test.ts` **5/5 PASS**: exact booklet signatures for 1–32 pages, 5→8 padding 3, short/long backside rotation, interleave order in both scan directions, unequal-length reject/pad, real vector output page extraction/white blank, annotated input reject. Independent Chromium `npx tsx scripts/acceptance-pdf-booklet-interleave-251.ts` **PASS** (390×844 static-built route, no heavy dev server), downloading real PDF outputs: 5 source booklet pages produce 4 faces and 3 blank slots for *each* short-edge/long-edge variant, 3 front+2 back interleave produces 6 real pages with one declared blank and mismatch rejection when no policy chosen. **14/14 downloaded PDF pages** reopened, rasterized via existing PDF.js `pdf-to-images` route, each PNG independently decoded by Sharp, source-color slot mapping and blank white slots checked, physical PDF geometry/rotations and interleave extractable text compared, 0 external requests/browser errors. `npx astro build` **287 pages PASS**. `npx astro check` is not globally clean because of pre-existing errors confined to #250/#256 browser acceptance files (not touched by this worker); no #251 diagnostics were reported. No full suite, push, deployment, prod, or Gold claim. The three stated AC are met; limitations: printer-driver paper feed varies by hardware, booklet is raster lossy and physical printer validation is outside this scoped acceptance.
