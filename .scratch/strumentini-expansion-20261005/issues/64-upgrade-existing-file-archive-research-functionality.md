# 64 — Upgrade existing file/archive/research functionality

**What to build:** Deepen current file/privacy/archive/research tools with richer batch workflows, real compressed archives, safer extraction/inspection, manifest/export formats, file-table previews, hash verification ergonomics, metadata/privacy summaries and bibliography/source exports.

**Traces to:** US-EXP-01, US-EXP-04, US-EXP-05, US-EXP-09; AC-01.1, AC-04.1, AC-04.2, AC-05.1; DEC-EXP-02, DEC-EXP-03; C-EXP-04, C-EXP-05, C-EXP-09

**Constraints:** File paths/content stay local; archive extraction is path-traversal safe; bibliography transforms preserve source identity rather than inventing metadata.

**Blocked by:** 197, 198, 222, 223, 224, 326, 327.

**Status:** completed

- [x] The existing file/archive/research routes are covered by the completed upgrade/audit lanes 197, 198, 326 and 327; archive compression/extraction breadth is explicitly contracted by the REFUSE decisions in 222–224 rather than left as an implied missing feature.
- [x] Folder/duplicate/list/checksum/handoff workflows use the shared file-result workspace with size/hash/status facts and machine-readable manifest/export paths where supported.
- [x] Research/bibliography workflows expose RIS/BibTeX/plain structured handoffs with source identity and duplicate semantics kept explicit instead of inventing metadata.

**Verification:** Existing file/research Gold and focused file-privacy/result tests cover the implemented workflows; malicious archive/path evidence is owned by 222–224/272 and remains a deliberate production refusal for unsafe codec/extraction breadth.
