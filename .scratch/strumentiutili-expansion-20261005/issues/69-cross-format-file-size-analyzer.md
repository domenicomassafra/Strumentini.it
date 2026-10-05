# 69 — Cross-format file-size analyzer

**What to build:** Add a read-only local tool that explains why a file is large and links to the correct compressor/optimizer: images, PDF, DOCX/PPTX/XLSX, ZIP, and inspectable audio/video each get a format-specific byte breakdown and actionable recommendation.

**Traces to:** US-EXP-04, US-EXP-09, US-EXP-10; AC-04.1, AC-10.1; DEC-EXP-01, DEC-EXP-02; C-EXP-04, C-EXP-05

**Constraints:** Diagnostic only; estimated savings are clearly estimates, not promises; unsupported/opaque content is reported rather than guessed; no upload.

**Blocked by:** 01, 47, 51, 67, 68.

**Status:** blocked

- [ ] Image analysis reports dimensions/encoding/metadata and flags obvious oversizing without changing pixels.
- [ ] PDF analysis distinguishes text/vector-heavy, embedded-image-heavy and scan-heavy documents where detectable.
- [ ] OOXML/ZIP analysis lists largest package/archive entries and grouped byte totals.
- [ ] Audio/video inspection reports duration/codec/bitrate/resolution/sample-rate facts where the local inspector supports them.
- [ ] Recommendations deep-link/handoff to the relevant compressor with no re-upload when the handoff contract supports the file.

**Verification:** Synthetic and real files with known byte composition, recommendation rules, no-network proof and no mutation of source bytes.

