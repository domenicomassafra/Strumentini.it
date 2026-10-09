# 47 — JPEG/PNG/WebP/SVG compression engines

**What to build:** Replace the current one-size-fits-all canvas re-encode model with format-aware local compression for JPEG, PNG, WebP and SVG: JPEG-native lossy controls, PNG lossless + palette/lossy modes, WebP lossy/lossless controls, and SVGO-style vector optimization.

**Traces to:** US-EXP-04, US-EXP-09, US-EXP-10; AC-04.1, AC-04.2, AC-06.1, AC-10.1; DEC-EXP-01, DEC-EXP-02, DEC-EXP-05, DEC-EXP-06; C-EXP-05, C-EXP-08

**Constraints:** Preserve alpha/vector semantics where applicable; “lossless” requires pixel/DOM-semantic proof appropriate to the format; codecs are lazy and benchmarked; SVG scripts/external references get explicit safety treatment.

**Blocked by:** 207, 208, 209.

**Status:** ready-for-agent

- [ ] JPEG has normal/high-compression presets plus expert controls only when the codec exposes them reliably.
- [ ] PNG distinguishes pixel-lossless optimization from palette/color-lossy compression and verifies transparency.
- [ ] WebP distinguishes lossy/lossless and exposes alpha/effort controls only when supported by the chosen codec.
- [ ] SVG optimization shows raw and gzip byte reduction, visual original-vs-optimized preview, multipass/precision settings and unsafe/aggressive changes separately.

**Verification:** Real corpus per format, byte/pixel/vector-render comparisons, malformed input cases, bundle/runtime/mobile receipts, and output-signature verification.

**2026-10-09 isolated implementation (#047, no production promotion):** `src/engines/image/png-lossless-47.ts` provides a strict **PNG RGB/RGBA 8-bit noninterlaced** lossless IDAT recompressor; CRCs, chunk layout, zlib stream, decoded scanline counts and filters are checked. Recompression changes no filtered pixel bytes and preserves every non-IDAT chunk in original byte order, including transparency and color metadata. The output is independently re-inflated and byte-compared with source scanlines; if compression grows or ties, the validated source is kept. **Actual** source/output byte counts, signed savings and dimensions are returned. The limit is 4 MiB input, one million pixels, ~4 MiB decoded scanlines; abort checks occur before/after read and inside streamed inflate/chunk checks. No UI or shared catalog integration.

**Capability/REFUSAL:** `probeImageCompression47()` is a conservative implementation-capability matrix, not a browser codec claim: this PNG subset alone is marked supported. JPEG expert/presets (#207), WebP lossless/effort (#207), PNG palette/dither and general optimization (#208), and SVG optimization/rendering (#209) remain refused under #268. External/script-bearing SVG is not rendered or fetched. Native browser canvas re-encoding that already exists elsewhere is not promoted to a uniform advanced compressor.

**Proof:** `tests/image-compression-47.test.ts` validates RFC-style PNG chunk CRC and zlib format limits, input corruption, explicit refusals, actual byte reconciliation, alpha and metadata retention, stop/keep-original policy and cancellation. `scripts/acceptance-image-compression-47.ts` generates genuine disk PNG RGB/RGBA files with Pillow and independently reopens originals/results with Pillow, proving exact pixel bytes/metadata. Recorded desktop run: RGBA 320×256 **328,183 → 1,354 bytes**, decoded RGBA **327,680 bytes identical**; RGB 320×256 **246,229 → 698 bytes**, decoded RGB **245,760 bytes identical**. Samples intentionally use `compress_level=0` to exercise significant lossless savings; these ratios are not production performance claims.

**Still open:** all four comprehensive acceptance items above, including JPEG native expert presets, PNG indexed/palette/dither, WebP modes, SVG optimizer with safe visual and gzip comparisons, cross-browser corpus/performance and physical mobile acceptance. PNG subset supports no interlaced/indexed/16-bit/APNG; metadata chunks are preserved rather than optimized. Ticket remains OPEN (`ready-for-agent`) pending approved downstream codec/optimizer paths and product integration.

**2026-10-09 PRIME browser cross-engine verification, not a Gold promotion:** `scripts/acceptance-image-compression-47.browser.mjs` imports the actual isolated source engine through a local Vite server and recompresses two genuine RGB/RGBA uncompressed PNGs in each of **Chromium, Firefox and WebKit** at 390×844. Original vs output pixels match byte-for-byte in the browser's `createImageBitmap`+Canvas decoder, and the exported PNG bytes are decoded **independently through Sharp** into all original 160×112 RGB/RGBA raw sample values. All six outputs shrink (RGB 54,038→50,975 bytes; RGBA 71,987→69,795 bytes), preserve dimensions/alpha, report exact savings, refuse an already-aborted job, and incur zero offsite requests or page JavaScript errors: **54/54 assertions PASS**. This exercises the **isolated engine**, not the existing public canvas-compression route; no mobile hardware, palette/lossy controls, JPEG/WebP expert codecs or SVG optimizer were accepted. Ticket remains `ready-for-agent`, comprehensive four AC unchecked.
