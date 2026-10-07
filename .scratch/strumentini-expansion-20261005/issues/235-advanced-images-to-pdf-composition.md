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
