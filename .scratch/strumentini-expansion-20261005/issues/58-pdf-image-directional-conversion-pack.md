# 58 — PDF↔image directional conversion pack

**What to build:** Upgrade existing Images→PDF and PDF→images into discoverable high-intent routes with real options: JPG/PNG/WebP/HEIC→PDF and PDF→JPG/PNG/WebP, with ordering, page range, DPI/scale, quality, page size, margins, fit/fill and ZIP output.

**Traces to:** US-EXP-04, US-EXP-10; AC-04.1, AC-10.1; DEC-EXP-01, DEC-EXP-06; C-EXP-04, C-EXP-05

**Constraints:** Directional routes reuse existing engines/workspace; HEIC depends on verified decode; PDF page rendering stays raster and does not imply vector extraction.

**Blocked by:** 235, 236.

**Status:** blocked

- [x] Images→PDF supports reorder/rotate, A4/Letter/original page, margins, orientation and fit/fill.
- [x] PDF→images supports page range, JPG/PNG/WebP, scale/DPI and quality with one-file-per-page naming.
- [x] Batch/multi-page results download cleanly as ZIP with total pages/bytes.

**Verification:** Mixed-image and multi-page PDF fixtures, page dimension/render checks, ZIP integrity and route-specific acceptance.

**Implementation evidence (2026-10-07):** Both existing canonical routes were upgraded rather than duplicated. Images→PDF accepts JPG/PNG/WebP/AVIF/HEIC/HEIF/GIF-first-frame and exposes order, per-image rotation, original/A4/Letter geometry, margins, orientation, contain/cover and contact-sheet composition. PDF→images uses lazy local PDF.js page rendering with page selection, JPG/PNG/WebP, scale/DPI, quality, deterministic per-page names, per-page failure isolation and a verified ZIP for multi-page output. `scripts/acceptance-conversion-matrix.mjs` proves the mixed PNG+HEIC PDF path, layout facts, contact-sheet mode, `[2,1]` PDF page rendering and ZIP integrity at 390px with no task-time external/non-GET requests. Status remains `blocked` only because umbrella dependencies 235/236 retain broader physical/mobile prerequisite blockers, not because these directional conversion ACs are missing.
