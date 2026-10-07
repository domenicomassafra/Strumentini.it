# 50 — Upgrade existing image-tool functionality

**What to build:** Deepen the current image routes beyond Result v2: resize, crop, generic format conversion, metadata, EXIF removal, palette/dominant color, compare, contact sheet, favicon/app icons, platform presets, duplicate finder and screenshot helper get the controls/previews expected for their actual jobs.

**Traces to:** US-EXP-01, US-EXP-04; AC-01.1, AC-01.2, AC-04.1; DEC-EXP-03, DEC-EXP-06; C-EXP-04, C-EXP-05, C-EXP-09

**Constraints:** Preserve current verified core behavior; advanced options must be format/job specific rather than dumped into every image tool.

**Blocked by:** 213, 314, 315, 316, 317.

**Status:** completed

- [x] Ticket 314 upgrades resize with width/height, aspect lock, percent, contain/cover, no-upscale, output-format choices and live dimension estimates while preserving the separate physical-device Gold gate.
- [x] Ticket 213 replaces numeric-only crop with the shared interactive crop/transform workspace, including direct preview, pointer/touch movement and keyboard adjustment on the canonical image-crop route.
- [x] Ticket 315 classifies metadata/EXIF before→after, reinspects produced output and verifies the format-specific decoded-pixel fidelity claim.
- [x] Ticket 316 provides real slider/overlay/diff visualization, keyboard alternatives, explicit unequal-dimension alignment and bounded pixel-difference metrics.
- [x] Ticket 317 adds deterministic ordering/sizes and verified STORE-ZIP multi-output for favicon/contact-sheet exports plus exact platform-preset export.

**Verification:** Tickets 213/314–317 carry focused pixel/dimension tests and real-browser 390px acceptance. Existing image Gold semantics are preserved; image-resize remains correctly PARTIAL only because physical Android/iOS receipts 277/278 are external blockers, not because the functional upgrade is incomplete.
