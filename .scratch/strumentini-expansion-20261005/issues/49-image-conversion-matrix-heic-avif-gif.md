MIGRATO su GitHub Issues il 17/10/2026: https://github.com/domenicomassafra/strumentini-it/issues?q=is%3Aissue. Non aggiornare più questo file.

# 49 — Image conversion matrix + HEIC/AVIF/GIF

**What to build:** Complete high-value directional image conversion routes backed by shared codecs: JPG/PNG/WebP/AVIF, HEIC/HEIF→JPG/PNG/WebP/PDF, SVG→raster/PDF at chosen dimensions, and GIF static-frame/animated conversion modes where proven.

**Traces to:** US-EXP-04, US-EXP-10; AC-04.1, AC-06.1, AC-10.1; DEC-EXP-01, DEC-EXP-05, DEC-EXP-06; C-EXP-04, C-EXP-05, C-EXP-08

**Constraints:** Never call raster→SVG a vector conversion unless actual tracing is deliberately implemented; HEIC/AVIF/GIF support is capability/codec proven; JPG alpha flattening requires an explicit background choice.

**Blocked by:** 212, 312, 313.

**Status:** blocked

- [x] Each accepted direction has an explicit input/output fidelity contract and verified signature.
- [ ] HEIC from real iPhone samples is covered on physical iOS/Android/desktop where the promoted path claims support.
- [ ] SVG raster export requires size/scale/background controls and keeps vector optimization as a separate job.
- [x] Animated GIF behavior is distinct from extracting a still frame.

**Verification:** Directional codec matrix tests, real HEIC/AVIF/GIF/SVG fixtures, alpha/orientation/color cases, physical-device evidence where required.

**Implementation evidence (2026-10-07):** `image-format-conversion` now accepts JPG/JPEG, PNG, WebP, AVIF, HEIC/HEIF and GIF. HEIC/HEIF uses lazy `heic-to@1.6.5` / libheif-WASM after the older decoder failed the checked synthetic macOS HEIC fixture; AVIF uses the browser-local decoder; GIF is explicitly first-frame-only and is not marketed as animation-preserving conversion. Accepted raster outputs remain verified PNG/JPEG/WebP with explicit JPEG alpha background and quality/loss disclosure. `scripts/acceptance-conversion-matrix.mjs` proves JPG↔PNG/WebP, WebP↔JPG/PNG, AVIF→JPG/PNG/WebP, HEIC→JPG/PNG/WebP and GIF-first-frame→JPG/PNG/WebP in Chromium with reopen/signature/dimension checks. Ticket remains blocked only for the still-open real-iPhone/physical-mobile HEIC corpus and SVG/animated-GIF scope.

## 2026-10-10 owner planning reconciliation

**Original status and all historical acceptance criteria stay unchanged and OPEN.** New planning crosswalk: #367, #393.

**Next actionable AC:** HEIC from real iPhone samples is covered on physical iOS/Android/desktop where the promoted path claims support.. The original acceptance cannot be transferred or marked implemented merely because a new child was planned. Verify actual current source, output, negative cases and physical device when required; retain all gates and source-year/fidelity/security limits.
