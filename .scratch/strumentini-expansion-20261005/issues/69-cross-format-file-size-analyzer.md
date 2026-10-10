# 69 — Cross-format file-size analyzer

**What to build:** Add a read-only local tool that explains why a file is large and links to the correct compressor/optimizer: images, PDF, DOCX/PPTX/XLSX, ZIP, and inspectable audio/video each get a format-specific byte breakdown and actionable recommendation.

**Traces to:** US-EXP-04, US-EXP-09, US-EXP-10; AC-04.1, AC-10.1; DEC-EXP-01, DEC-EXP-02; C-EXP-04, C-EXP-05

**Constraints:** Diagnostic only; estimated savings are clearly estimates, not promises; unsupported/opaque content is reported rather than guessed; no upload.

**Blocked by:** 228, 265, 266.

**Status:** completed

- [x] Image analysis reports dimensions/encoding/metadata and flags obvious oversizing without changing pixels.
- [x] PDF analysis distinguishes text/vector-heavy, embedded-image-heavy and scan-heavy documents where detectable.
- [x] OOXML/ZIP analysis lists largest package/archive entries and grouped byte totals.
- [x] Audio/video inspection reports duration/codec/bitrate/resolution/sample-rate facts where the local inspector supports them.
- [x] Recommendations deep-link/handoff to the relevant compressor with no re-upload when the handoff contract supports the file.

**Verification:** Synthetic and real files with known byte composition, recommendation rules, no-network proof and no mutation of source bytes.

**Acceptance evidence (2026-10-10):** `tests/file-size-069.test.ts` verifies dimensional oversize triggers, source immutability, PDF text/vector evidence and stream byte reconciliation, OOXML largest entries/group byte reconciliation, ZIP groups and largest entries, verified MP4 tracks without guessed bitrate/FPS. Previous strict PDF image-page/unknown classification, valid PCM WAV and unsupported cases remain covered by `tests/pdf-size-adapter-265.test.ts`, `tests/file-size-adapters-266.test.ts`, and `tests/file-privacy-engine.test.ts`. Together 35/35 tests pass. `npx astro check` passed with 0 errors. `STR069_EXISTING_DEV_PORT=4381 node tests/file-size-069.browser.mjs` passed 24 checks on the public Astro route, mobile 390px: image/Office/ZIP/video/PDF visible breakdown, actionable PDF deep link, zero POST/offsite requests. Compressor manifests currently declare no file-**accepting** handoff; consequently the UI accurately says another selection is required after navigation. No unsupported cross-tool transfer is promised; accepting handoff is a conditional AC not triggered by these destinations. The report never estimates savings. Existing audited dependencies were reused; no new dependency was added.
