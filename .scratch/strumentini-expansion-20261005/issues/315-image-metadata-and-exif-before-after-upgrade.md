# 315 — Image metadata and EXIF before-after upgrade

**What to build:** Deepen metadata viewer/remover into classified metadata groups, before→after diff and verified stripped output while preserving pixels where the chosen path claims pixel preservation.

**Traces to:** US-EXP-04, US-EXP-09

**Constraints:** C-EXP-01, C-EXP-04, C-EXP-05, C-EXP-09; extend existing shared engines/workspaces and avoid duplicate public routes for mere modes.

**Blocked by:** 97, 103.

**Status:** completed

**Suggested skills:** security-audit → code-tdd → qa-browser

- [x] Removed/retained metadata classes are listed.
- [x] Output metadata is reinspected before success.
- [x] Pixel/content fidelity claim has a format-specific verification.

**Verification:** EXIF/XMP/GPS/orientation corpus and reinspection.

**Evidence (2026-10-06):** The existing `exif-remover` route/oracle `cand-148` remains canonical. `metadata.ts` now groups observed carriers as privacy/descriptive/color and produces a before→after diff with removed and retained classes. The remover still re-encodes to PNG, then byte-walks the actual produced container before success; any surviving privacy-bearing segment or wrong output format fails closed. It additionally reopens the produced PNG and compares every browser-decoded RGBA byte and dimensions against the source decoded raster. The fidelity claim is therefore intentionally PNG/browser-raster-specific: decoded RGBA is exact, while original container bytes, metadata, ICC/profile semantics and pre-decode codec history are explicitly not claimed preserved. Result v2 shows metadata groups before, removed, retained, reinspection state and fidelity limitation. Existing metadata fixtures/tests cover Exif, XMP, IPTC, comments, descriptive text/timestamp and ICC grouping; the real Chromium acceptance strips the decodeable Exif PNG, confirms an empty reinspected output inventory and exact reopened RGBA. No new route/oracle was added.
