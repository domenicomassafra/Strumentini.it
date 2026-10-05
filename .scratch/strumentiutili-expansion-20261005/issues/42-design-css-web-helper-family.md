# 42 — Design/CSS/web-helper family

**What to build:** Add focused design/web helpers for CSS gradient, box-shadow and border-radius generation, color harmonies/tints/shades, named CSS colors, color-blindness image simulation, px↔rem/em conversion, sitemap.xml generation, and Wi-Fi QR presets; improve existing color/contrast/palette/meta/robots tools rather than cloning them.

**Traces to:** US-EXP-05, US-EXP-10; AC-05.1, AC-10.1; DEC-EXP-01, DEC-EXP-06; C-EXP-03, C-EXP-04, C-EXP-09

**Constraints:** Generated CSS/XML must be standards-valid; accessibility simulation is illustrative and must not replace real contrast/accessibility checks.

**Blocked by:** 01.

**Status:** blocked

- [ ] CSS helpers have live preview plus copyable standards-valid output.
- [ ] Sitemap generator validates/normalizes URLs and emits downloadable XML.
- [ ] Existing color/meta/robots/QR routes are enhanced through modes/hand-offs instead of duplicated.

**Verification:** Parser/validator fixtures for generated CSS/XML, contrast/color edge cases, QR round-trip, and mobile preview tests.

