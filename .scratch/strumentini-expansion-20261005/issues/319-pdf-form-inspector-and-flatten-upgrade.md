# 319 — PDF form inspector and flatten upgrade

**What to build:** Deepen form inspection and flatten with field/annotation counts, page provenance and exact before→after capability report; preserve visual appearance under supported flatten mode.

**Traces to:** US-EXP-04

**Constraints:** C-EXP-01, C-EXP-04, C-EXP-05, C-EXP-09; extend existing shared engines/workspaces and avoid duplicate public routes for mere modes.

**Blocked by:** 98, 215, 269.

**Status:** completed (verified safe subset; visible appearances explicitly unsupported)

**Suggested skills:** pdf → code-tdd → qa-browser

- [x] Fields/annotations affected are counted and identified.
- [x] Flatten result is reinspected for remaining interactive structures.
- [x] Visual regression stays within declared tolerance for the supported safe subset.

**Verification:** Form/annotation corpus, post-flatten inspection and render compare.

**Implemented 2026-10-08:** `form-annotation-audit.ts` provides page, subtype, reference object ID, hidden/visible flag, appearance stream, AcroForm field/widget provenance and counts. Form inspector and Result V2 disclose inventory and blockers. The existing page writer does not paint form appearance streams; `flattenPdfVerified` therefore **fails closed for visible annotations, widget appearances, dynamic XFA/NeedAppearances and malformed or unverified graphs** rather than silently dropping form graphics. Supported flatten is limited to hidden annotations and detached/no-visible widgets, with exact before/after field, annotation, page-count, supported capabilities, geometry, extracted text, and image-count checks; output hooks are independently re-inspected. The renderer only promises visual preservation within this bounded policy, *not general-purpose appearance flatten*. New browser acceptance exercises original/downloaded PDF with PDF.js decoded-PNG pixel identity (0 mismatches), visible-field fail-closed, field inventory/page provenance, no network upload at 390px in Chromium/Firefox/WebKit (**21/21**). Tests include malformed arrays, dynamic appearances, abort and linked widget field naming. Fixture: `quality/fixtures/pdf-gold/hidden-widget-form.pdf`. Details: `.scratch/strumentini-expansion-20261005/evidence/ticket319-pdf-form-flatten-20261008.md`. Release and physical-device evidence remain independently gated.
