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

## 2026-10-11 wave 14 independent JPEG/WebP forensic boundary correction — partial, OPEN

Source HEAD `39e07827`, independent source ownership **only** `src/engines/image/metadata.ts` (not `strip-metadata.ts`, any visual UI, PDF or other ticket). New adversarial test `tests/metadata-trailing-394.test.ts` uses **real Sharp-encoded and independently reopened** JPEG/WebP exports with real pixels, an independent RIFF FourCC/length walker, and explicit byte assertions on concealed Exif/XMP sentinel payloads. **RED (4/4 failed before correction):** JPEG scanner reported `complete:true` as soon as SOS was reached, even if an actual after-export APP1/Exif marker was appended *after EOI* or EOI itself was missing; WebP reported `complete:true` for bytes beyond declared RIFF length, an oversized/truncated RIFF declaration or a partial header. **Second RED (2/2):** real WebP exported with XMP by Sharp contained the standards-defined `XMP ` FourCC (fourth byte is ASCII space) but its inventory had zero privacy carriers; a valid decodable WebP with unknown `PRIV` chunk was also falsely described as metadata-free.

The one-engine correction walks JPEG entropy with 0xFF00 stuffing and RST markers through the **actual terminal EOI** (including multi-SOS boundaries), refuses missing EOI, and marks bytes beyond EOI as unverified privacy-bearing `JPEG trailing payload`. It compares WebP's declared RIFF end with physical bytes, checks full chunk headers including even-byte padding, counts data beyond RIFF as `WebP trailing payload`, recognizes `XMP ` rather than the impossible three-byte `XMP` chunk ID, and treats unknown WebP RIFF chunks as `ancillary` rather than silently omitting potential identifying payloads. Nothing is stripped/re-encoded by this inventory-only modification; this makes misleading forensic success claims fail closed. The real decoder can still render tampered output, which is why byte-level inspection is necessary.

**GREEN:** `npx vitest run tests/metadata-trailing-394.test.ts tests/metadata-forensic-394.test.ts tests/image-media-tools.test.ts tests/image-upgrade-cluster.test.ts` **36/36 PASS** (new 6/6, existing 30/30); `npx tsc --noEmit --pretty false` **exit 0**, `git diff --check` **PASS**. No new dependency, vendor, Gold claim, commit/push/deploy. Scope remains only JPEG/WebP container *inspection* and the already implemented PNG export inspector; this does **not** independently verify JPEG/WebP pixel fidelity, erase pixel steganography, inspect nested thumbnail pixels individually, prove all unknown metadata semantics, or deliver document stripping for PDF/OOXML/SVG. Non-PNG `scanImageMetadataBlob` retains the explicit 8 MiB bounded-prefix limit and returns `complete:false` for larger blobs. Original AC-394.1 and AC-394.3 stay unchecked for broader supported document sanitizers, malicious corpus, physical mobile/cross-browser and release rollback. AC-394.2 remains checked only at its previously documented bounded claim scope; no production approval implied.

**Additional live checks / concurrent blocker:** The existing `node tests/metadata-forensic-394.browser.mjs` also **PASS** in real Chromium 390×844, exercising actual PNG export/decoded pixel readback, independent CRC/chunk-walker, injected metadata refusal, unsupported formats, cancellation and oversized input. A later global TypeScript rerun after new concurrent work arrived was **NOT_PASS**: unrelated unowned new `tests/audit-397.test.ts` imports absent `../scripts/validator/audit-397` (`TS2307`) and reports implicit-any parameters (`TS7031`/`TS7006`). The earlier all-clear on typecheck predates those concurrent #397 files; do **not** claim that the latest repo-wide `tsc` is green. #397 files were untouched. Separate `git diff --check` remains **PASS**.
