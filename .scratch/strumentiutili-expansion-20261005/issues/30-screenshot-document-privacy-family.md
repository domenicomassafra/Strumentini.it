# 30 — Screenshot/document privacy family

**What to build:** Add screenshot stitching with overlap handling, irreversible rectangle/pixel redaction, and document-perspective straightening; integrate the existing screenshot-border helper so privacy/edit jobs share one image workspace and verifiable output.

**Traces to:** US-EXP-04, US-EXP-09; AC-04.1, AC-04.2; DEC-EXP-02, DEC-EXP-06; C-EXP-04, C-EXP-05

**Constraints:** Redaction must replace output pixels, not draw a removable overlay; stitching must fail safely when overlap confidence is insufficient rather than hallucinating alignment.

**Blocked by:** 01, 29.

**Status:** blocked

- [ ] Stitching supports manual correction/fallback when automatic overlap is ambiguous.
- [ ] Redaction output is byte/pixel-verifiable as destructive and previewable before download.
- [ ] Perspective straighten supports four-corner control and clear crop boundaries.

**Verification:** Synthetic overlap corpus, pixel inspection proving redacted content is absent, and mobile pointer/touch acceptance.

