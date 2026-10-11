# 394 — Metadata stripping with after-export forensic inspection

**What to build:** Scrubs supported image/document metadata and reports before-after

**Traces to:** OWN-04 OWN-10; owner decisions 2026-10-10

**Constraints:** Current Astro/Preact stack; local-first optional server consent only; proprietary rights and donor provenance, financial source year, mobile and WCAG 2.2 AA, cost zero initially; no waived historical AC

**Blocked by:** None

**Status:** ready-for-agent

**Suggested skills:** plan-spec → plan-tickets → code-architecture-review → code-tdd → qa-browser; research-primary-sources/pdf/security-audit as needed

**Level:** base

**Priority:** P1 source/security/fidelity or P2 advanced

**Current evidence:** Historical audit dated 2026-10-10; no new implementation/evidence implied

**Donor / reuse decision:** Review installed engine first; if external ensure maintained release, license assets/transitives, runtime size, security, costs, migration and fallback

## Acceptance criteria

- [ ] AC-394.1: Scrubs supported image/document metadata and reports before-after.
- [x] AC-394.2: Nested thumbnails/comments/hidden metadata are not claimed removed without proof.
- [ ] AC-394.3: On the scoped input and failure cases, verify: Exif/OOXML/PDF/SVG malicious metadata corpus. Record the current source/date, independently checked outcome and NOT_RUN/NO_GO where evidence is absent.

**Verification:** Exif/OOXML/PDF/SVG malicious metadata corpus; run rejected/huge/partial/cancel cases and inspect output beyond UI mock.

**Failure / recovery:** Unsupported inputs and exceeded quota/memory return explicit refusal, no silent fallback or corruption; preserve valid prior output.

**External / owner gate:** A missing official source, vendor approval, physical device or security review blocks the affected production AC, not drafting/specification.

**Rollback / migration:** Keep previous behavior and stored project versions accessible until targeted canary and rollback proof.

**Out of scope:** Shipping functionality, buying licenses, changing receipt source fingerprints, broad desktop-only advanced exemptions.

**Execution prompt:** Routed by canonical EXECUTION-PROMPTS.md with gates.

## Implementation evidence — 2026-10-11, partial (owner release blocked)

- **Raster image scope implemented:** `src/engines/image/metadata.ts` and `strip-metadata.ts` now walk complete PNG Blob chunk boundaries, including chunks after large IDAT and bytes after IEND. Unknown private chunks are reported; XMP in PNG iTXt is identified as XMP. The output PNG is delivered only after all chunks and the exact trailer boundary have been checked, zero metadata chunks remain, and reopened browser RGBA matches the source's decoded pixels. The source inventory is explicitly labelled partial when the bounded JPEG/WebP prefix is insufficient.
- **Independent evidence:** `tests/metadata-forensic-394.test.ts` started RED (4 failing assertions on XMP/unknown chunk, trailing payload, missing full-Blob scan) and finished GREEN alongside the pre-existing image metadata suite (23 passing assertions). `node tests/metadata-forensic-394.browser.mjs` PASS in desktop Chromium at a 390×844 viewport: real PNG source with Exif/iTXt XMP/text/private chunks, actual canvas export, reopened bitmap and a separate CRC-checked PNG chunk walker of the returned bytes. Tampering with the browser encoder's otherwise-decodable PNG to insert >8 MiB tEXt and late iTXt XMP now causes a refusal. SVG/PDF/OOXML signatures, cancellation and 41 MiB oversized input were refused. No uploads or network requests were needed. `npm run check` PASS on 2026-10-11 (1999 files, 0 errors, 0 warnings, 22 existing diagnostic hints).
- **Claim limit:** Original Exif nested thumbnails are not individually decoded/inventoried; the original Exif chunk is excluded when the browser re-encodes the primary raster. The proof covers container metadata, not steganography inside pixels or identifying visual content. JPEG/WebP inventories >8 MiB are explicitly partial; browser-decoded visual color/ICC semantics may differ from the source file.
- **NO_GO / NOT_RUN:** PDF, SVG, and OOXML metadata stripping and a malicious document corpus were **not** implemented or certified by this raster engine. These formats are refused; a document sanitizer would require a separate implementation and independent format-specific evidence. Physical mobile device, Safari/Firefox readback and production canary/rollback were not run. Historical CI/prod gate remains blocked; this is source-only work without commit, push, or deploy.
- **Remaining AC:** AC-394.1 applies to supported JPEG/PNG/WebP raster output; the broader document-metadata portion remains open. AC-394.3 remains open for full malicious document corpus, cross-browser/device and rollback proofs.
