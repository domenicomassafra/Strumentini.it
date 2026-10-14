# 58 — PDF↔image directional conversion pack

**What to build:** Upgrade existing Images→PDF and PDF→images into discoverable high-intent routes with real options: JPG/PNG/WebP/HEIC→PDF and PDF→JPG/PNG/WebP, with ordering, page range, DPI/scale, quality, page size, margins, fit/fill and ZIP output.

**Traces to:** US-EXP-04, US-EXP-10; AC-04.1, AC-10.1; DEC-EXP-01, DEC-EXP-06; C-EXP-04, C-EXP-05

**Constraints:** Directional routes reuse existing engines/workspace; HEIC depends on verified decode; PDF page rendering stays raster and does not imply vector extraction.

**Blocked by:** 235, 236.

**Status:** blocked

- [x] Images→PDF supports reorder/rotate, A4/Letter/original page, margins, orientation and fit/fill.
- [x] PDF→images supports page range, JPG/PNG/WebP, scale/DPI and quality with one-file-per-page naming.
- [x] Batch/multi-page results download cleanly as ZIP with total pages/bytes.

**Verification:** Mixed-image and multi-page PDF fixtures, page dimension/render checks, ZIP integrity and route-specific acceptance.

**Implementation evidence (2026-10-07):** Both existing canonical routes were upgraded rather than duplicated. Images→PDF accepts JPG/PNG/WebP/AVIF/HEIC/HEIF/GIF-first-frame and exposes order, per-image rotation, original/A4/Letter geometry, margins, orientation, contain/cover and contact-sheet composition. PDF→images uses lazy local PDF.js page rendering with page selection, JPG/PNG/WebP, scale/DPI, quality, deterministic per-page names, per-page failure isolation and a verified ZIP for multi-page output. `scripts/acceptance-conversion-matrix.mjs` proves the mixed PNG+HEIC PDF path, layout facts, contact-sheet mode, `[2,1]` PDF page rendering and ZIP integrity at 390px with no task-time external/non-GET requests. Status remains `blocked` only because umbrella dependencies 235/236 retain broader physical/mobile prerequisite blockers, not because these directional conversion ACs are missing.

**2026-10-10 independent worker-7 recheck — STILL BLOCKED, NOT DONE:** The three original AC checkboxes are functionally demonstrated for bounded supported inputs on desktop; #236 is now `completed`, so it is **not** an ongoing functional blocker. Live, read-only Chromium/390px `scripts/acceptance-conversion-matrix.mjs` verification on current source passes, including **synthetic** 811-byte HEIC fixture decoded by `libheif-wasm` to true JPEG/PNG/WebP, reordered PNG+HEIC two-page A4 landscape PDF (`order=[2,1]`, rotations 90°/180°, 841.89×595.28 pt pages), 1-page contact sheet, and PDF→PNG `[2,1]`, two 612×792 images and two-entry ZIP. Four focused PDF catalog/raster/ZIP suites pass **29/29**; the compiled public PDF export acceptance passes **69/69** on Chromium/Firefox/WebKit, verifying independently downloaded PNG/JPEG/WebP where supported, order `3,1-2`, ZIP entry order/byte parity, invalid selections, and truthful WebKit WebP-encoder refusal. The compiled static `dist/` used in that separate acceptance was timestamped **2026-10-10 12:05**, while the first live matrix used current dev source; do not conflate these as one source-fingerprinted build. Evidence: `../evidence/ticket058-pdf-image-20261010.md`.

**Why not complete despite 3/3 UI/functional AC:** HEIC/HEIF is explicitly promised in `src/tools/images-to-pdf/manifest.ts` and the public `ImagesToPdfTool.tsx` file picker, and the `heic-to/csp` runtime decoder is callable; this is **not a truthful HEIC production refusal**. Canonical feasibility #268 nevertheless **REFUSES HEIC production promotion** until a *genuine iPhone-origin* photo and physical iOS/Android decode/orientation/resource evidence exist. Its checked-in `source.heic` derives from a synthetic macOS `sips` export, not an iPhone photo; independent #212 `probeHeicDecode212()` reports `productionApproved=false` and #212 is still open. Existing physical web gates #280/#281 remain `NOT_RUN`. The #58 specification itself expressly includes **HEIC→PDF**; without HEIC promotion approval or an actual public fail-closed gate, checking those three AC boxes is not enough to mark the entire original family completed. **Status stays `blocked`**, no Gold/release claim, no changes to #235/#212/#268/source. Prime to reconcile the public HEIC promise/guard with #268 authority; no new ticket created.

## 2026-10-10 owner planning reconciliation

**Original status and all historical acceptance criteria stay unchanged and OPEN.** New planning crosswalk: #372, #380.

**Next actionable AC:** Verify the original outstanding requirements and dated source evidence before closing. The original acceptance cannot be transferred or marked implemented merely because a new child was planned. Verify actual current source, output, negative cases and physical device when required; retain all gates and source-year/fidelity/security limits.

## 2026-10-14 worker-5 cross-ticket correction — still blocked

An isolated #235 correction changes Images→PDF public/engine behavior to truthful **HEIC/HEIF refusal**, consistent with #268 real-device promotion decision. Previously evidenced desktop HEIC conversion remains only historical/synthetic and is no longer an Images→PDF positive acceptance expectation. Real Chromium public-route refusal and PNG+JPEG independently reparsed two-page PDF **PASS**, updated browser conversion matrix for PNG+JPEG composition, contact sheet, PDF→PNG/ZIP and distinct experimental HEIC→image conversion **PASS**, focused Vitest **17/17 PASS**, scoped strict TypeScript **PASS**. No attempt was made to promote the shared HEIC decoder, modify #212/#268 or fabricate genuine iPhone photos/physical iOS/Android checks (#280/#281 remain NOT_RUN). Parent #58 explicitly asks for actual HEIC→PDF, so **Status: blocked** and original AC/checkboxes remain unchanged. Main/PR/release, Gold source fingerprint and physical mobile ordering/evidence require their independent gates before final closure.

Source-bound certification index for Images→PDF now truthfully reports **releaseGate BLOCKED / goldEligible false / RECEIPT_MANIFEST_IDENTITY_STALE** rather than projecting historical Gold onto changed module and manifest bytes.
