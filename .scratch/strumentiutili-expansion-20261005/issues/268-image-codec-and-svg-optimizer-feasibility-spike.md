# 268 — Image codec and SVG optimizer feasibility spike

**What to build:** Choose exact local dependencies or browser-native paths for JPEG/WebP advanced controls, PNG optimization, SVG optimization, HEIC/AVIF/GIF handling with license, lazy bundle, memory and real-mobile evidence.

**Traces to:** US-EXP-04, US-EXP-06; AC-06.1

**Constraints:** C-EXP-02, C-EXP-05, C-EXP-08; feasibility evidence only.

**Blocked by:** None for the feasibility decision. Ticket 100 preflight and ticket 101 shared worker/cancellation runtime are complete; physical evidence remains a promotion prerequisite.

**Status:** completed

**Suggested skills:** security-audit → browser-performance-benchmark → qa-browser

- [x] Each format/mode is IMPLEMENT/SPIKE/REFUSE separately.
- [x] HEIC/GIF are independently decided: animated GIF has a checked corpus; HEIC promotion is refused until a genuine iPhone-origin fixture is available.
- [x] No codec enters shared initial bundle.

**Verification:** Reproducible codec matrix with version/license/bundle/runtime/mobile evidence.

**Evidence (2026-10-06, superseded by the recheck below):** The desktop tranche established separate decisions for JPEG/WebP/PNG native encode, advanced codec controls, PNG/SVG optimization, HEIC, AVIF and animated GIF. The generated animated GIF exposes four frames in all five desktop engines. AVIF/WebP encode is not a uniform browser-native path: Chromium/Firefox fall back to PNG for requested AVIF while the observed WebKit path produces AVIF, and WebKit falls back to PNG for requested WebP. HEIC remains a lazy `libheif-js@1.23.5` spike. The sole checked-in HEIC fixture was generated from a synthetic PNG using macOS `sips`; it is not a real-iPhone photo. Genuine iOS/Android codec/memory receipts are also `NOT_RUN`. Heavy candidates stay dynamically imported in the isolated spike and the production light-route receipt continues to show no heavy codec fetch.

**Recheck (2026-10-07):** The feasibility decision is complete as **REFUSE new codec/optimizer production promotion**. Ticket 100 preflight and ticket 101 shared worker termination/resource ceilings now exist, and every image mode has an explicit IMPLEMENT/SPIKE/REFUSE outcome. The checked HEIC corpus is still synthetic, so libheif-js@1.23.5 remains only a spike and no HEIC production claim is authorized; the repository still has no genuine iPhone-origin HEIC fixture and no physical iOS/Android codec/memory receipt. Those are promotion blockers owned by the physical acceptance frontier, not fabricated passes. Downstream 207/208/209/212 and families 47/48/49 must preserve that boundary.
