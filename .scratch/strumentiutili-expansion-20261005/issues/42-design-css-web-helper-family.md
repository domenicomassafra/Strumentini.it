# 42 — Design/CSS/web-helper family

**What to build:** Add focused design/web helpers for CSS gradient, box-shadow and border-radius generation, color harmonies/tints/shades, named CSS colors, color-blindness image simulation, px↔rem/em conversion, sitemap.xml generation, and Wi-Fi QR presets; improve existing color/contrast/palette/meta/robots tools rather than cloning them.

**Traces to:** US-EXP-05, US-EXP-10; AC-05.1, AC-10.1; DEC-EXP-01, DEC-EXP-06; C-EXP-03, C-EXP-04, C-EXP-09

**Constraints:** Generated CSS/XML must be standards-valid; accessibility simulation is illustrative and must not replace real contrast/accessibility checks.

**Blocked by:** 199, 200, 201, 202, 203, 310.

**Status:** completed

- [x] Tickets 199/200 provide CSS design helpers and color modes through the existing design/image seams with previewable, copyable generated output.
- [x] Ticket 202 validates/normalizes HTTP(S) URLs and emits bounded downloadable `sitemap.xml` with optional metadata only when supplied.
- [x] Tickets 200/201/203/310 extend canonical color/image/QR/web-helper surfaces through modes or shared engines rather than cloning equivalent primitives.

**Verification:** CSS-design, sitemap, image/color and QR focused suites plus their browser acceptance cover parser/validator fixtures, color/contrast boundaries, QR round trips and mobile-width previews.
