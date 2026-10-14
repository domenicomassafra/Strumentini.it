# 235 — Advanced Images to PDF composition

**What to build:** Upgrade images→PDF with reorder/rotate, A4/Letter/original geometry, margins, fit/fill, orientation and one-image/page vs contact-sheet modes.

**Traces to:** US-EXP-04, US-EXP-10; AC-04.1

**Constraints:** C-EXP-01, C-EXP-04, C-EXP-05, C-EXP-08; local-first, bounded memory, verified output, lazy heavy dependencies.

**Blocked by:** 98, 103, 212.

**Status:** blocked

**Suggested skills:** pdf → interaction-design → code-tdd → qa-browser

- [x] Preview shows crop/fit effect before export.
- [x] HEIC input appears only when its decode path is approved.
- [x] Page geometry/order and final PDF type are verified.

**Verification:** Mixed-aspect fixture, page geometry render review and mobile ordering.

**Implementation evidence (2026-10-07):** Existing `images-to-pdf` now accepts JPG/JPEG, PNG, WebP, AVIF, HEIC/HEIF and GIF-first-frame; keeps original JPEG bytes when possible; supports explicit order, per-image 0/90/180/270 rotation, original/A4/Letter pages, auto/portrait/landscape, margin, contain/cover fit and one-image-per-page versus contact-sheet composition. `PdfTool` shows a pre-export page preview reflecting background, margin and contain/cover. The production browser acceptance creates a two-page A4 landscape PDF from PNG+HEIC with reordered/rotated sources and a separate one-page contact-sheet PDF, then reparses page geometry/type. Status remains formally blocked only because upstream ticket 212 still requires genuine physical-device HEIC evidence.

## 2026-10-10 owner planning reconciliation

**Original status and all historical acceptance criteria stay unchanged and OPEN.** New planning crosswalk: #372, #380.

**Next actionable AC:** Verify the original outstanding requirements and dated source evidence before closing. The original acceptance cannot be transferred or marked implemented merely because a new child was planned. Verify actual current source, output, negative cases and physical device when required; retain all gates and source-year/fidelity/security limits.

## 2026-10-14 worker-5 source correction — pending review/integration

Prior 2026-10-07 mixed PNG+HEIC desktop conversion was real but used a synthetic HEIC from sips and does **not** authorize production HEIC promotion under completed #268 (REFUSE). On the isolated source correction branch, the public Images→PDF picker, catalog manifest and Italian copy now exclude HEIC/HEIF and describe the missing real-iPhone/mobile proof. The Images→PDF module refuses declared HEIC/HEIF filename and MIME as well as a HEIF ftyp signature disguised as PNG, **before converting any image in a mixed selection**; the shared image codec and its independent experimental capabilities are unchanged.

Focused Vitest (new negative unit, existing format/PDF suites): **17/17 PASS**; real Chromium public route: **PASS** declared+signature refusal, no result, PNG+JPEG downloadable PDF independently reopened with PDF.js (**2 pages**), 390px and zero off-site requests; updated browser conversion matrix: **PASS** two-page reordered/rotated PNG+JPEG, contact-sheet PDF, and PDF→raster/ZIP while retaining separate image-format conversion HEIC tests. Scoped strict TypeScript: **PASS**. Historical #235 checkboxes and blocked status remain unchanged: still require genuine iPhone HEIC and physical iOS/Android behavior for any future HEIC-enabled claim, physical/mobile ordering acceptance, review, source-bound release admission, merged main and production proof. This branch does not establish actual deployed site behavior.

Certification index regenerated from this exact changed source now declares Images→PDF **releaseGate BLOCKED**, **goldEligible false**, with **RECEIPT_MANIFEST_IDENTITY_STALE** for historical Gold receipt. The Gold receipt is intentionally not re-attested; production release admission remains NO_GO.
