# 302 — Document image perspective straighten

**What to build:** Add four-corner perspective correction and crop preview for photographed documents inside the shared image workspace.

**Traces to:** US-EXP-04

**Constraints:** C-EXP-01, C-EXP-04, C-EXP-05, C-EXP-09; extend existing shared engines/workspaces and avoid duplicate public routes for mere modes.

**Blocked by:** 213 — Direct-manipulation image transform workspace.

**Status:** completed

**Suggested skills:** interaction-design → code-module-design → code-tdd → qa-browser

- [x] Four corners remain inside image and invalid/self-crossing geometry is rejected.
- [x] Preview makes resulting crop boundaries explicit.
- [x] Export pixels match the chosen transform deterministically.

**Verification:** Synthetic quadrilateral fixtures and touch/keyboard corner control.

**Evidence (2026-10-07):** The canonical `/tools/image-crop/` workspace now has a document-perspective mode with four source corners, visible polygon/crop boundary, pointer/touch dragging, selected-corner arrow-key movement (Shift=10px) and exact numeric X/Y alternatives. `normalizePerspectiveCorners` rejects out-of-bounds, self-crossing, concave and degenerate geometry before export. Preview and export call the same deterministic `perspectiveTransformPixels` inverse-homography/bilinear RGBA pipeline; focused tests prove an identity quadrilateral reproduces every source RGBA byte and rejects invalid geometry. Browser acceptance proves keyboard corner movement, successful verified PNG export and no 390px overflow with local-only task traffic.
