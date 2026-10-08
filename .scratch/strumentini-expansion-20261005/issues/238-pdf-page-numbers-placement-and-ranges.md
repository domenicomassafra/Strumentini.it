# 238 — PDF page numbers placement and ranges

**What to build:** Add page-number insertion with page range, position, offset/start number, font/size/margins and preview based on shared page thumbnails.

**Traces to:** US-EXP-04, US-EXP-10; AC-04.1

**Constraints:** C-EXP-01, C-EXP-04, C-EXP-05, C-EXP-08; local-first, bounded memory, verified output, lazy heavy dependencies.

**Blocked by:** 215, 269.

**Status:** completed

**Suggested skills:** pdf → interaction-design → code-tdd → qa-browser

- [x] Selected range and numbering start are previewed before write (bounded PDF.js thumbnails and SVG positions from the same PDF geometry plan).
- [x] Existing page content remains unchanged outside overlay insertion (all original `/Contents` stream bytes re-compared after reparse).
- [x] Output pages/count/signature and visual placement verified on the synthetic multipage browser fixture.

**Verification:** Multi-page/range/position corpus and rendered visual checks.

**2026-10-08 verified implementation (ticket AC COMPLETE; NOT Gold / no physical-device claim):** Dedicated local route `/tools/pdf-page-numbers/`, catalog `cand-261` registered with existing `pdf-gold`/`pdf-signature` fixture families and no Gold receipt. `src/engines/pdf/page-numbers.ts` writes a *new* per-page PDF content stream with a standard font reference, preserving every original `/Contents` stream byte-for-byte, original page count and CropBox/Rotate geometry. Strict page range grammar rejects duplicates, decreasing or out-of-range selections; supports explicit start number, signed offset, all six corners/centers, Helvetica/Courier/Times-Roman, 8–36pt size and 8–72pt margin, and abort before writing. Unsupported dimensions/CropBoxes fail closed. `tests/pdf-page-numbers-238.test.ts` covers 18 valid/invalid cases including nonzero CropBox and 90-degree rotation. Real Chromium *desktop* 390×844 acceptance via `npx tsx tests/pdf-page-numbers-238.browser.ts` PASS: preview labels 13/14 on selected pages 2/3, invalid range refused, downloaded 4-page PDF (1354→2086 bytes), re-parsed output, byte-equal original streams. Both input/output were independently rendered through the shipped PDF.js PDF→PNG tool: page 1 unchanged (0 pixel differences); page 2 has 120 changed pixels at [280,409,299,422], page 3 has 124 at [280,409,299,421], within the requested bottom-right margin. Zero external requests. Local screenshot receipts `/tmp/str238-numbering-preview.png` and `/tmp/str238-numbered-p2.png`. `astro check` 0 errors/0 warnings; Astro built 281 pages. **Separate broader release/Gold gates remain OPEN:** dependencies #215/#269, mixed real-world PDFs, rotated-page browser screenshot corpus, browser matrix, physical-device memory/accessibility and independent Gold certification. Oracle `cand-261` remains `IMPLEMENTED_UNVERIFIED` for release/Gold purposes; closing #238's three AC is not an assertion of physical-device or Gold certification.
