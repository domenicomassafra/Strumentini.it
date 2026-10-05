# 64 — Upgrade existing file/archive/research functionality

**What to build:** Deepen current file/privacy/archive/research tools with richer batch workflows, real compressed archives, safer extraction/inspection, manifest/export formats, file-table previews, hash verification ergonomics, metadata/privacy summaries and bibliography/source exports.

**Traces to:** US-EXP-01, US-EXP-04, US-EXP-05, US-EXP-09; AC-01.1, AC-04.1, AC-04.2, AC-05.1; DEC-EXP-02, DEC-EXP-03; C-EXP-04, C-EXP-05, C-EXP-09

**Constraints:** File paths/content stay local; archive extraction is path-traversal safe; bibliography transforms preserve source identity rather than inventing metadata.

**Blocked by:** 01, 03, 05.

**Status:** blocked

- [ ] Every existing file/archive/research route has a concrete advanced-option/workflow audit.
- [ ] Folder/duplicate/list/manifest tools show file tables with size/hash/status and export useful machine-readable manifests.
- [ ] Research tools expose BibTeX/RIS/plain-table handoffs while keeping duplicate/source-identity logic explicit.

**Verification:** Existing Gold plus malicious archive/path fixtures, large folder/file-list cases, bibliography identity cases and generated route coverage.

