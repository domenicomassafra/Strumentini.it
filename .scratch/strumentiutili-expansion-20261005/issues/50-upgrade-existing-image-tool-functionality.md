# 50 — Upgrade existing image-tool functionality

**What to build:** Deepen the current image routes beyond Result v2: resize, crop, generic format conversion, metadata, EXIF removal, palette/dominant color, compare, contact sheet, favicon/app icons, platform presets, duplicate finder and screenshot helper get the controls/previews expected for their actual jobs.

**Traces to:** US-EXP-01, US-EXP-04; AC-01.1, AC-01.2, AC-04.1; DEC-EXP-03, DEC-EXP-06; C-EXP-04, C-EXP-05, C-EXP-09

**Constraints:** Preserve current verified core behavior; advanced options must be format/job specific rather than dumped into every image tool.

**Blocked by:** 01, 47, 49.

**Status:** blocked

- [ ] Resize supports width/height, lock ratio, percent, contain/cover, no-upscale and output-format choices with live dimension estimate.
- [ ] Crop has a visual crop box/aspect presets instead of top-left numeric-only cropping.
- [ ] Metadata/EXIF shows before/after metadata classes and verified stripped output.
- [ ] Compare provides an actual slider/overlay/diff visualization plus dimensions/byte/pixel-difference summary.
- [ ] Contact sheet/favicon/platform tools expose ordering, sizes and downloadable multi-output ZIP where relevant.

**Verification:** Current Gold remains green plus visual/pixel acceptance and generated route checklist for every existing image tool.

