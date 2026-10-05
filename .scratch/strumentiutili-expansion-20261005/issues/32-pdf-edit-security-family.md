# 32 — PDF edit/security family

**What to build:** Add local PDF signing/placement, page numbers, text/image watermarking, true redaction, password protection/encryption, crop, and basic fill/write overlays with page thumbnails and direct manipulation where the underlying PDF library can preserve document integrity.

**Traces to:** US-EXP-04, US-EXP-09; AC-04.1, AC-04.2, AC-06.1; DEC-EXP-02, DEC-EXP-05, DEC-EXP-06; C-EXP-05, C-EXP-08

**Constraints:** Drawn signature placement is not described as a qualified digital signature; redaction must remove/invalidate underlying content in the exported PDF, not just cover it visually.

**Blocked by:** 01, 05, 34.

**Status:** blocked

- [ ] Page thumbnails support selecting placement/range for page numbers/watermark/signature/redaction.
- [ ] Protect/unlock modes make password/permission semantics explicit.
- [ ] Redaction has post-export extraction/byte inspection proving hidden text is not recoverable through normal PDF extraction.

**Verification:** Real PDF fixture matrix including forms/images/text/encryption; post-process parsing; browser/mobile page interaction acceptance.

