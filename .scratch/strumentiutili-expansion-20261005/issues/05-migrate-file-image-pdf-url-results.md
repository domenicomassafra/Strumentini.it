# 05 — Migrate file/image/PDF/URL results

**What to build:** Migrate the 74 existing tools in `file-privacy` (19), `pdf` (20), `image` (15), `url-marketing` (12), `image-visual` (5), `qr-local` (2), and `file-hash` (1) to Result v2, including the shared file workspace, progress, preview, before/after metrics, direct downloads, batch status, and precise privacy claims.

**Traces to:** US-EXP-01, US-EXP-04, US-EXP-09; AC-01.1, AC-01.2, AC-04.1, AC-04.2; DEC-EXP-02, DEC-EXP-03; C-EXP-01, C-EXP-04, C-EXP-05, C-EXP-09

**Constraints:** No upload introduced for local tools; file drop/list/progress must be shared primitives; output bytes remain authoritative.

**Blocked by:** 96, 97, 98, 99.

**Status:** completed

- [x] 74/74 engine entries are covered by explicit file/image/PDF/URL result semantics.
- [x] File operations show name/type/size and before→after facts where applicable.
- [x] Batch failures are isolated and successful outputs remain downloadable.
- [x] Privacy/destructive results state what was actually removed/changed, not just "success".

**Verification:** Generated 74/74 coverage proof, existing Gold suites, byte-level assertions for destructive operations, and representative mobile file-flow browser acceptance.

**Evidence:** child tickets 96, 97, 98 and 99 are completed. Their generated ownership totals 19 file/privacy + 20 image + 20 PDF/document + 15 URL/QR/hash = 74/74 declared result semantics. File/privacy, image, PDF, URL/QR/hash focused suites and browser lanes pass with bounded previews, verified artifacts, byte/measured-change facts, isolated batch handling and local-only processing. Image-resize remains truthfully Partial/REFUSED for its still-open physical-device evidence rather than being promoted by this presentation migration.
