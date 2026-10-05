# 53 — Upgrade existing PDF inspect/extract/compare tools

**What to build:** Deepen the current PDF metadata, page-size/count, form, links, images, text extraction, compare, flatten and password tools with richer page-scoped outputs, original-byte extraction where safe, visual/text comparison, explicit before/after capability counts and legitimate password-supplied decryption.

**Traces to:** US-EXP-01, US-EXP-04, US-EXP-09; AC-01.2, AC-04.2, AC-05.1; DEC-EXP-02, DEC-EXP-03, DEC-EXP-06; C-EXP-04, C-EXP-05

**Constraints:** No password bypass/brute force; original embedded bytes are preferred over re-encoding when extracting; comparison claims only what can actually be parsed/rendered.

**Blocked by:** 01, 05, 52.

**Status:** blocked

- [ ] Text extraction supports page range and reading-order/layout modes plus TXT/Markdown download.
- [ ] Image/link/form/metadata results include page/object provenance and useful counts.
- [ ] Compare separates document/page structure, text differences and optional visual differences.
- [ ] Flatten reports fields/annotations affected and verifies post-output state.
- [ ] Password removal accepts a supplied valid password when the engine/library supports it and clearly refuses unsupported encryption.

**Verification:** Encrypted/forms/annotations/images/text corpus, post-output inspection, extraction byte checks, compare fixtures, and no-bypass security tests.

