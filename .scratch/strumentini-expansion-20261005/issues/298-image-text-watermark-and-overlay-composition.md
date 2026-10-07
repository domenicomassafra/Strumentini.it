# 298 — Image text watermark and overlay composition

**What to build:** Add text/image watermark and overlay composition to the shared image workspace with position, opacity, scale, rotation and batch-safe export.

**Traces to:** US-EXP-04

**Constraints:** C-EXP-01, C-EXP-04, C-EXP-05, C-EXP-09; extend existing shared engines/workspaces and avoid duplicate public routes for mere modes.

**Blocked by:** 213 — Direct-manipulation image transform workspace.

**Status:** completed

**Suggested skills:** interaction-design → code-tdd → qa-browser

- [x] Overlay preview uses the exact export transform.
- [x] Alpha/color-space behavior is explicit.
- [x] Watermark is not described as destructive privacy redaction.

**Verification:** Pixel-position fixtures and touch/keyboard browser QA.

**Evidence (2026-10-07):** The canonical `/tools/screenshot-border-background-helper/` route now exposes text/image overlay composition through the shared `advanced-workspace` engine with bounded position, opacity, scale, rotation, font and color controls. `composeWatermarkLocal` renders once to a verified PNG Blob and the UI uses that same Blob for both preview and download (`previewExportIdentity=same-rendered-png-blob`), while the result explicitly discloses Canvas source-over alpha handling, browser Canvas color-space limits and `visual-overlay-not-redaction`. Source/result byte sizes are measured and shown. `scripts/acceptance-image-advanced-workspace.mjs` proves changed output pixels, exact preview/export Blob identity, keyboard control at 390px, local-only task traffic and no horizontal overflow. The focused image suites pass 47/47 across resize, transform, advanced workspace, media, upgrade-cluster and Result v2 coverage.
