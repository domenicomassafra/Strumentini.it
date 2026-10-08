# 221 — PDF structural text and visual comparison

**What to build:** Extend current compare into separately reported page alignment, structure, text and bounded rendered visual overlay/diff, degrading explicitly when a layer is unavailable.

**Traces to:** US-EXP-01, US-EXP-04; AC-04.2

**Constraints:** C-EXP-01, C-EXP-04, C-EXP-05, C-EXP-08; local-first, bounded memory, verified output, lazy heavy dependencies.

**Blocked by:** 215, 220.

**Status:** completed (explicit page alignment, bounded structural/text layers and user-triggered rendered visual diff)

**Suggested skills:** pdf → code-tdd → qa-browser

- [x] Added/removed/reordered pages are distinct from content changes.
- [x] Text-only evidence cannot produce a full visual-equality claim.
- [x] Unrenderable pages yield partial comparison state.

**Verification:** Known page insertion/reorder/text/image changes and rendered visual review.

**Implementation 2026-10-08:** `src/engines/pdf/compare-alignment.ts` adds bounded (≤200×200) dynamic-programming page alignment, with conservative unique nonempty/nontruncated text+geometry+resource-count anchors, added/removed pages, edits and confidently linked moved pages as distinct categories. Ambiguous duplicate/empty/scanned pages never establish authoritative page identity solely from missing text. `comparePdfs` returns independent `alignment`, `structure` (geometry, rotations and image/annotation *counts only*), `text` (extractable PDF text, not OCR), and `visual` (unknown/not-rendered) layers; unchanged legacy fields remain for callers. `PdfTool` shows exact bounded page correspondences and optional visual comparison. `PdfVisualCompare` imports PDF.js only on explicit user action, sequentially renders at most one pair of ≤176×208 thumbnails and produces a decoded-RGBA red-pixel diff overlay, independent of text extraction; all sessions and object URLs are released. Same sampled pixels are never advertised as full-document visual equivalence. Geometry mismatch, local read/decode/render failure => explicit partial rather than equality. Fixed the shared thumbnail renderer's fractional-viewport ceil off-by-one at 176×208. `tests/pdf-compare-alignment.test.ts` covers insertion/removal/reorder/text change, blank and duplicate ambiguity, images and no-rendered-equality; `tests/pdf-visual-diff.test.ts` covers pixel identity/differences/invalid geometry. `npm run acceptance:pdf-comparison` is **24/24 PASS across Chromium/Firefox/WebKit** at 390px: real text-identical, visually offset PDFs differ by decoded PNG pixels, exact same sample matches narrowly, differing geometry reports partial, a read failure after structural analysis reports partial, and page insertion/reorder are correctly categorized. Visual sampling is not full-document rendering and does not certify every PDF page or its byte-level visual fidelity. Production/source-bound evidence and physical-device receipts remain independently blocked.
