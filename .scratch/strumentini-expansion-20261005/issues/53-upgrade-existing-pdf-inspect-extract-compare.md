# 53 — Upgrade existing PDF inspect/extract/compare tools

**What to build:** Deepen the current PDF metadata, page-size/count, form, links, images, text extraction, compare, flatten and password tools with richer page-scoped outputs, original-byte extraction where safe, visual/text comparison, explicit before/after capability counts and legitimate password-supplied decryption.

**Traces to:** US-EXP-01, US-EXP-04, US-EXP-09; AC-01.2, AC-04.2, AC-05.1; DEC-EXP-02, DEC-EXP-03, DEC-EXP-06; C-EXP-04, C-EXP-05

**Constraints:** No password bypass/brute force; original embedded bytes are preferred over re-encoding when extracting; comparison claims only what can actually be parsed/rendered.

**Blocked by:** 220, 221, 242, 318, 319, 320.

**Status:** blocked

- [ ] Text extraction supports page range and reading-order/layout modes plus TXT/Markdown download.
- [ ] Image/link/form/metadata results include page/object provenance and useful counts.
- [ ] Compare separates document/page structure, text differences and optional visual differences.
- [ ] Flatten reports fields/annotations affected and verifies post-output state.
- [ ] Password removal accepts a supplied valid password when the engine/library supports it and clearly refuses unsupported encryption.

**Verification:** Encrypted/forms/annotations/images/text corpus, post-output inspection, extraction byte checks, compare fixtures, and no-bypass security tests.

**Capability boundary (2026-10-08):** Dependency #320 was closed as **REFUSED**, not implemented. The existing PDF password tool checks encryption markers and can create a copy of an already unencrypted PDF; it does **not** accept password-supplied decrypt, verify wrong/correct passwords or remove encryption. This parent may pursue the supported page-scoped/text/image/form/compare functionality but must not claim the refused password acceptance as completed or expose a pretend decrypt mode. The fifth acceptance checkbox above remains unfulfilled unless an independently approved engine is introduced.

**PRIME scoped text-export subset (2026-10-09, not public and not Gold):** Added source-only `src/engines/pdf/text-export-53.ts`. It calls the existing bounded `extractPdfTextScoped` with an explicit selection and `content-order` or `operator-lines`, produces **real UTF-8 TXT and Markdown bytes** with page provenance and filenames, and wraps untrusted source text in dynamically sized literal Markdown code fences (not HTML or executable markup). Invalid pages, cancellation, scans without extractable text and truncated results refuse rather than creating purported complete documents. This is **PDF content-stream operator text, NOT geometric reading order, visual fidelity, editable layout or OCR**; none of those absent features is claimed. `tests/pdf-text-export-53.test.ts` 2/2 targeted PASS with three-page, reordered-page, output-content, no-text and abort vectors. Parent remains `blocked`: original checkbox #1 needs truthful layout/reading-order modes and user-facing download integration; source-supported #320 remains refused, password-supplied decrypt is explicitly **not implemented**. No manifest/catalog route, no network, no fabricated Gold or physical evidence.
