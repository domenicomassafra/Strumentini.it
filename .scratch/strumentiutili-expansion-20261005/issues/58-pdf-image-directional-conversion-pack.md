# 58 — PDF↔image directional conversion pack

**What to build:** Upgrade existing Images→PDF and PDF→images into discoverable high-intent routes with real options: JPG/PNG/WebP/HEIC→PDF and PDF→JPG/PNG/WebP, with ordering, page range, DPI/scale, quality, page size, margins, fit/fill and ZIP output.

**Traces to:** US-EXP-04, US-EXP-10; AC-04.1, AC-10.1; DEC-EXP-01, DEC-EXP-06; C-EXP-04, C-EXP-05

**Constraints:** Directional routes reuse existing engines/workspace; HEIC depends on verified decode; PDF page rendering stays raster and does not imply vector extraction.

**Blocked by:** 01, 05, 49.

**Status:** blocked

- [ ] Images→PDF supports reorder/rotate, A4/Letter/original page, margins, orientation and fit/fill.
- [ ] PDF→images supports page range, JPG/PNG/WebP, scale/DPI and quality with one-file-per-page naming.
- [ ] Batch/multi-page results download cleanly as ZIP with total pages/bytes.

**Verification:** Mixed-image and multi-page PDF fixtures, page dimension/render checks, ZIP integrity and route-specific acceptance.

