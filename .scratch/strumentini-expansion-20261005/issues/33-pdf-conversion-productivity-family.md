# 33 — PDF conversion/productivity family

**What to build:** Finish the PDF productivity jobs that remain after the detailed compression/page/conversion tickets: search text across many PDFs, split by maximum output size, n-up pages per sheet, booklet imposition and front/back interleave, then integrate the outputs/handoffs from tickets 51–58 without duplicating their engines.

**Traces to:** US-EXP-04, US-EXP-10; AC-04.1, AC-05.1, AC-06.1, AC-10.1; DEC-EXP-01, DEC-EXP-05, DEC-EXP-06; C-EXP-05, C-EXP-08

**Constraints:** Conversion fidelity is measured per job; no blanket "almost 100% accurate" claim; searchable-text jobs distinguish born-digital PDF from OCR-required scans.

**Blocked by:** 248, 249, 250, 251, 252, 253, 254, 255, 256, 257, 258, 259, 260.

**Status:** completed

- [x] Multi-PDF search returns file/page/context and isolates unreadable/encrypted failures.
- [x] Split-by-size guarantees each produced part respects the requested ceiling or explains why impossible.
- [x] N-up/booklet/interleave outputs have page-order fixture proofs.
- [x] Conversion routes from tickets 56–58 are surfaced consistently without parallel implementations.

**Verification:** PDF corpus covering text/tables/scans/encryption/page geometry; output page/order/size assertions; conversion fidelity receipts.

**2026-10-10 functional closure, explicitly supported subset:** Existing canonical
local engines #248/#249/#250/#251/#252/#254/#255/#256 already satisfy
multi-PDF text search, exact-byte PDF splitting, verified n-up/booklet/interleave
order and the bounded conversion directions. New
`src/components/tools/pdf/PdfProductivityRoutes33.tsx` consolidates nine
real routes, reusing the existing tools instead of duplicating processing:
multi-search, split, n-up, booklet/interleave, printable text/markup PDF,
PDF→Markdown and bounded **editable text-only** DOCX (#57), selected PDF
tables→XLSX with preview, PDF→images or **raster-slide** PPTX, images→PDF.
The navigation is exposed from both public multi-search and split tools;
it explicitly tells users to **select the file again**, because these routes
do not advertise a verified cross-tool binary handoff. No arbitrary rich
Office→PDF renderer, auto-OCR on scans, general visual PDF→editable PowerPoint,
layout reconstruction or 100% conversion fidelity is claimed.

**Real proof at integrated source:** `tests/pdf-productivity-family-33.test.ts`
independently checks nine canonical Astro routes/manifests, real file/page/context
matches alongside encrypted and malformed PDF refusal, PDF rebuilding with
each measured part ≤1024 bytes and a single large image page refusing with
`PdfSinglePageLimit249`, plus n-up 5→2 sheets with three explicit blank
slots, 4-page booklet faces [4,1]/[2,3], and reverse duplex interleave
F1/B3/F2/B2/F3/B1. Combined existing #248/#249/#250/#251 regression suites
**22/22 PASS**. The live Chromium 390×844 navigation acceptance
`node tests/pdf-productivity-family-33.browser.mjs` reports
**20/20 PASS** on the local public Astro routes, 9 canonical destinations
reachable over HTTP, 8 correct non-self links per route, truthful reselect
notice, no horizontal overflow, JS errors or offsite requests.
PDF→PPTX was separately rechecked on actual `https://strumentini.it`:
**12/12 PASS**, a downloaded three-slide PPTX independently reopened by
python-pptx/Pillow in chosen [3,1,2] source order. This is functional
desktop-browser evidence, not Gold or physical iOS/Android testing
(separate global #280/#281).
