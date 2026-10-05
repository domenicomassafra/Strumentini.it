# 49 — Image conversion matrix + HEIC/AVIF/GIF

**What to build:** Complete high-value directional image conversion routes backed by shared codecs: JPG/PNG/WebP/AVIF, HEIC/HEIF→JPG/PNG/WebP/PDF, SVG→raster/PDF at chosen dimensions, and GIF static-frame/animated conversion modes where proven.

**Traces to:** US-EXP-04, US-EXP-10; AC-04.1, AC-06.1, AC-10.1; DEC-EXP-01, DEC-EXP-05, DEC-EXP-06; C-EXP-04, C-EXP-05, C-EXP-08

**Constraints:** Never call raster→SVG a vector conversion unless actual tracing is deliberately implemented; HEIC/AVIF/GIF support is capability/codec proven; JPG alpha flattening requires an explicit background choice.

**Blocked by:** 01, 34, 47.

**Status:** blocked

- [ ] Each accepted direction has an explicit input/output fidelity contract and verified signature.
- [ ] HEIC from real iPhone samples is covered on physical iOS/Android/desktop where the promoted path claims support.
- [ ] SVG raster export requires size/scale/background controls and keeps vector optimization as a separate job.
- [ ] Animated GIF behavior is distinct from extracting a still frame.

**Verification:** Directional codec matrix tests, real HEIC/AVIF/GIF/SVG fixtures, alpha/orientation/color cases, physical-device evidence where required.

