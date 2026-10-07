# 30 — Screenshot/document privacy family

**What to build:** Add screenshot stitching with overlap handling, irreversible rectangle/pixel redaction, and document-perspective straightening; integrate the existing screenshot-border helper so privacy/edit jobs share one image workspace and verifiable output.

**Traces to:** US-EXP-04, US-EXP-09; AC-04.1, AC-04.2; DEC-EXP-02, DEC-EXP-06; C-EXP-04, C-EXP-05

**Constraints:** Redaction must replace output pixels, not draw a removable overlay; stitching must fail safely when overlap confidence is insufficient rather than hallucinating alignment.

**Blocked by:** 214, 301, 302.

**Status:** completed

- [x] Stitching supports manual correction/fallback when automatic overlap is ambiguous.
- [x] Redaction output is byte/pixel-verifiable as destructive and previewable before download.
- [x] Perspective straighten supports four-corner control and clear crop boundaries.

**Verification:** Synthetic overlap corpus, pixel inspection proving redacted content is absent, and mobile pointer/touch acceptance.

**Evidence (2026-10-07):** Dependency tickets 214, 301 and 302 are completed on the canonical screenshot/image-crop workspaces. Stitching reports confidence/ambiguity and requires explicit manual overlap/offset, with a 0px fallback that discards nothing. Ticket 214's shared transform pipeline destructively rewrites solid/pixelated redaction regions before PNG export; focused tests inspect the changed RGBA bytes, multiple-region state and deterministic undo/reset, while the export seam rejects retained PNG metadata carriers. Perspective mode validates four corners, displays the source crop polygon and uses the same deterministic homography pipeline for preview/export. The combined advanced browser acceptance passes the stitch and perspective surfaces at 390px with keyboard alternatives and local-only task traffic.
