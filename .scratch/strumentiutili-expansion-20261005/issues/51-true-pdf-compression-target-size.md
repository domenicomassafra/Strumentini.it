# 51 — True PDF compression profiles + target size

**What to build:** Turn the current structural `pdf-compression-lite` foundation into a clearly named basic optimizer and add a true PDF compressor with balanced/strong/high-quality profiles, embedded-image downsample/recompression, scan-oriented mode, optional grayscale where chosen, and “under X KB/MB” best-effort targeting.

**Traces to:** US-EXP-04, US-EXP-10; AC-04.1, AC-04.2, AC-06.1, AC-10.1; DEC-EXP-01, DEC-EXP-05, DEC-EXP-06; C-EXP-05, C-EXP-08

**Constraints:** Searchable text/vector content remains intact unless a mode explicitly rasterizes; target size must be verified after encoding; profile trade-offs are visible; output is locally verified as a valid PDF.

**Blocked by:** 01, 05, 34.

**Status:** blocked

- [ ] Basic structural optimizer and image-aware compressor are distinct truthful modes/jobs.
- [ ] Result reports original/result bytes, savings %, pages, image count touched, effective image DPI/quality strategy and warnings.
- [ ] Target-size mode either satisfies the requested ceiling or explains the limiting content and offers split/remove-page handoffs.
- [ ] Batch mode processes multiple PDFs with per-file results and ZIP download.

**Verification:** Text-heavy, image-heavy, scanned, vector-heavy and already-optimized PDF corpus; extraction/render regression checks; size-target assertions; mobile memory receipt.

