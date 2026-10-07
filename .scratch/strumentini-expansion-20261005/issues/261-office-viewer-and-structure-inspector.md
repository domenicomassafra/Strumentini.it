# 261 — Office viewer and structure inspector

**What to build:** Add local read-only DOCX/XLSX/PPTX inspection/view modes only for parser/render features approved by the Office feasibility gate, exposing unsupported constructs rather than fake fidelity.

**Traces to:** US-EXP-04, US-EXP-09

**Constraints:** C-EXP-01, C-EXP-04, C-EXP-05, C-EXP-08; local-first, explicit fidelity limits, verified output, lazy heavy dependencies.

**Blocked by:** none for semantic/read-only structure inspection; faithful rendering remains outside this ticket's completed bounded mode.

**Status:** completed (read-only semantic/structure inspector; no faithful rendering)

**Suggested skills:** security-audit → code-module-design → qa-browser

- [x] Viewer clearly distinguishes semantic preview from faithful rendering.
- [x] Package/structure counts and unsupported constructs are visible.
- [x] No macro/script content executes.

**Verification:** Office corpus, hostile package fixtures and browser accessibility.

**Evidence (2026-10-07 downstream):** `inspectOfficeStructure` exposes ticket-225 package kind/counts, XML/media/font classes, metadata fields, external-relationship count and format-specific unsupported constructs for DOCX/XLSX/PPTX. It hard-codes `previewPolicy=semantic-structure-only-not-faithful-rendering` and `activeContentPolicy=macros-refused-scripts-never-executed-external-links-never-resolved`; macros/encrypted packages are already refused by the underlying package analyzer. Unit coverage checks all three corpus formats. `quality/receipts/office-downstream/browser-acceptance.json` exercises the worker-owned read-only path at 390px with zero external requests. No Office→PDF, slide raster or layout-faithful viewer claim is made.
