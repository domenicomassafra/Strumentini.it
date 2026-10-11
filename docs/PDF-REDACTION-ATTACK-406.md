# #406 — Independent PDF redaction attack corpus, revision/decoy-trailer probe

Date: 2026-10-11 (Mac Studio). Git source baseline: 39e0782713b23e67e5deecdc1565d777f9ef431b, with concurrent non-#406 worker changes explicitly out of scope.

**Result: PARTIAL, original ticket OPEN / NO-GO for complete PDF redaction security assurance.** The source change is a bounded fail-closed pre-render admission guard. It is not a new PDF parser, not a certificate, and does not publish the experimental PDF redaction UI.

## Confirmed distinct-parser vulnerability and RED evidence

The existing in-house PDF parser obtains the trailer with a last text occurrence of the word trailer. An attacker can place a benign-looking PDF comment between a **genuine second cross-reference trailer** and its final startxref footer that contains an unrelated decoy trailer dictionary without /Prev. The original pre-render gate checked only the parser-selected dictionary for /Prev, while independent viewers continue to follow the true incremental cross-reference section. This was a **source-admission policy bypass**; no claim that an actual exported PDF leaked a secret was made.

New test tests/pdf-redaction-attack-406.test.ts creates a synthetic source from the existing real two-revision incremental PDF fixture (not a pasted inert /Prev string). It inserts an ASCII percent comment containing a false trailer dictionary before the last startxref. This preserves both real xref offsets, both startxref sections, both %%EOF markers and the existing recoverable source text/hidden orphan object. Evidence:

- **pypdf strict, independent parser:** one real page and a positive effective /Prev offset at the actual latest trailer, with private searchable text and the orphan marker present in source bytes.
- **PDF.js, independent viewer:** the same adversarial source renders as a one-page PDF; text extraction returns the actual text hidden beneath an opaque overlay.
- **In-house pre-render gate before fix:** assertSupportedSource237 returned pageCount = 1, accepting the multi-revision source (RED: the adversarial test failed on expected refusal).
- **Before patch legitimate controls:** the unmodified incremental PDF was already refused, and the clean single-revision covered-source PDF was supported. Therefore the observed bypass depended on conflicting trailer interpretation, not a generic broken fixture.

After the fix the adversarial test additionally calls the real redactPdfRaster237 entrypoint with the same multi-revision bytes and verifies a rejected Promise before any output artifact is returned; it does not simulate a successful export of unsafe input.

## Narrow GREEN fix

Only src/engines/pdf/secure-raster-redaction-237.ts was modified. The redaction source gate now independently examines the bounded input bytes for exactly one complete startxref section and exactly one %%EOF section before interpreting the in-house trailer. A genuine incremental document with two physical revisions is refused even if untrusted comments camouflage /Prev from that parser. Ambiguous/unusual footer layouts are conservatively refused; valid single-revision sources remain admitted. The existing later checks still refuse hybrid /XRefStm, linearization, signed dictionaries, active objects, excessive raster declarations and unsupported source metadata.

Test replay:

    ./node_modules/.bin/vitest run tests/pdf-redaction-attack-406.test.ts tests/pdf-redaction-237.test.ts tests/pdf-redaction-malicious-corpus-237.test.ts --testTimeout=20000

**PASS 35/35** (new #406 2/2, existing #237 18/18 and malicious corpus 15/15). Strict scoped TypeScript **PASS** with src/env.d.ts included for Astro's PDF.js worker URL module typing.

## Real output verification, entirely local DEV-only

For actual exported PDF bytes—not just mock canvases or an output object—the existing project runner was executed against the **current source**:

    node scripts/acceptance-pdf-redaction-237-dev.browser.mjs

**PASS, exit 0.** The DEV-only experimental page downloaded two actual newly generated image-only PDF artifacts: a 2-page ordinary source and the adversarial covered-text + orphan-object PDF (not the refused incremental case). The runner independently reopened and interrogated both exported artifacts using PDF.js text extraction, pypdf strict structural parsing and independently decoded Flate RGB pixels, pdfminer.six text recovery, and native macOS PDFKit/CoreGraphics rendering, copy selection, print to a new PDF, and re-open. Source-only private and orphan text was absent from the exports; selected RGB pixels were verified black with unselected visual witnesses. Corrupt source refused. It reported zero offsite requests/browser errors and a 390 px viewport; this viewport is **not** physical iPhone/Android evidence. Forensic temporary files were cleaned up by the runner. No personal PDFs or network/provider calls.

This existing end-to-end evidence demonstrates local output safety for **two accepted sample sources**; the newly constructed incremental/decoy PDF must **refuse** before rasterization and is intentionally not an exported-artifact sample.

## Explicit unresolved AC and scope

Original AC-406.1–3 **remain unchecked**. The corpus does not exhaust genuine signed/certified chains, hybrid xref edge cases, parser object stream differentials, nested/encoded metadata, thumbnail caches or all malicious PDFs. PDFium and Poppler differential re-opening were **NOT_RUN** because the required independent binaries were not available in this run; production browser matrix, physical iOS/Android PDF rendering/memory/cancellation, external security sign-off and recovery attempts in arbitrary alternate editors are likewise **NOT_RUN**. No Gold, receipt promotion, release, commit, push or deployment is authorized by these samples.

Owned edits were confined to the #406 original issue, this new document, the existing PDF redaction source entry gate, and the new #406 adversarial regression test. Files owned by #407, #339, #330, #329, #404 and existing #237 fixtures/receipts were not changed.
