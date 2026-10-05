# 05 — Migrate file/image/PDF/URL results

**What to build:** Migrate the 74 existing tools in `file-privacy` (19), `pdf` (20), `image` (15), `url-marketing` (12), `image-visual` (5), `qr-local` (2), and `file-hash` (1) to Result v2, including the shared file workspace, progress, preview, before/after metrics, direct downloads, batch status, and precise privacy claims.

**Traces to:** US-EXP-01, US-EXP-04, US-EXP-09; AC-01.1, AC-01.2, AC-04.1, AC-04.2; DEC-EXP-02, DEC-EXP-03; C-EXP-01, C-EXP-04, C-EXP-05, C-EXP-09

**Constraints:** No upload introduced for local tools; file drop/list/progress must be shared primitives; output bytes remain authoritative.

**Blocked by:** 01 — Expand Result System v2 primitives.

**Status:** blocked

- [ ] 74/74 engine entries are covered by explicit file/image/PDF/URL result semantics.
- [ ] File operations show name/type/size and before→after facts where applicable.
- [ ] Batch failures are isolated and successful outputs remain downloadable.
- [ ] Privacy/destructive results state what was actually removed/changed, not just "success".

**Verification:** Generated 74/74 coverage proof, existing Gold suites, byte-level assertions for destructive operations, and representative mobile file-flow browser acceptance.

