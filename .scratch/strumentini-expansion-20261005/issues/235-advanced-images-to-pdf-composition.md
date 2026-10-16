MIGRATO su GitHub Issues il 17/10/2026: https://github.com/domenicomassafra/strumentini-it/issues?q=is%3Aissue. Non aggiornare più questo file.

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
